/**
 * physics.js - PN Junction Diode Physics Engine
 * Comprehensive semiconductor physics calculations for Silicon at temperature T:
 * - Built-in potential Vbi, total depletion width W, one-sided widths xp & xn.
 * - Peak electric field Emax and spatial space-charge rho(x) & field E(x) profiles.
 * - Sze empirical breakdown voltage VBR with temperature coefficients and regime classification (Zener vs Avalanche).
 * - Complete diode current I(VA) spanning forward conduction, reverse saturation, and smooth breakdown clamping.
 */

var DiodePhysics = (function () {
  // Fundamental Physical Constants (CGS units for semiconductor doping in cm^-3)
  var Q = 1.602176634e-19;        // Elementary charge (Coulombs)
  var KB = 1.380649e-23;          // Boltzmann constant (J/K)
  var EPS_0 = 8.854187817e-14;    // Vacuum permittivity (F/cm)
  var EPS_SI = 11.7 * EPS_0;      // Silicon permittivity (F/cm) ≈ 1.03594e-12 F/cm
  var DIODE_AREA = 1.0e-4;        // Illustrative junction area (cm^2) = 100μm × 100μm
  var RS_FORWARD = 1.5;           // Series resistance (Ohms)
  var RS_BREAKDOWN = 2.0;         // Series resistance during breakdown (Ohms)
  var N_IDEALITY = 1.05;          // Diode ideality factor
  var IS_REF = 1.0e-12;           // Reference saturation current (Amps) at 300K

  /**
   * Silicon bandgap Eg(T) in eV (Varshni empirical formula)
   */
  function siliconBandgap(T) {
    return 1.170 - (4.73e-4 * T * T) / (T + 636.0);
  }

  /**
   * Intrinsic carrier concentration ni(T) in cm^-3
   */
  function intrinsicCarrierConcentration(T) {
    var Eg = siliconBandgap(T);
    var Vt = (KB * T) / Q; // Thermal voltage in Volts
    // Standard semi-empirical formulation for Silicon
    var ni = 5.29e15 * Math.pow(T, 1.5) * Math.exp(-Eg / (2.0 * Vt));
    return Math.max(1.0e8, Math.min(1.0e13, ni));
  }

  /**
   * Thermal voltage Vt = kT / q in Volts
   */
  function thermalVoltage(T) {
    return (KB * T) / Q;
  }

  /**
   * Reverse saturation current Is(T) in Amps
   */
  function saturationCurrent(T) {
    var Eg300 = siliconBandgap(300.0);
    var EgT = siliconBandgap(T);
    var Vt = thermalVoltage(T);
    // Is scales as T^3 * exp(-Eg/kT)
    var isT = IS_REF * Math.pow(T / 300.0, 3.0) * Math.exp(-(EgT / Vt - Eg300 / thermalVoltage(300.0)));
    return Math.max(1.0e-16, Math.min(1.0e-7, isT));
  }

  /**
   * Built-in potential Vbi in Volts
   * Vbi = (kT/q) * ln( (NA * ND) / ni^2 )
   */
  function builtInPotential(Na, Nd, T) {
    var Vt = thermalVoltage(T);
    var ni = intrinsicCarrierConcentration(T);
    var arg = (Na * Nd) / (ni * ni);
    if (arg <= 1.0) return 0.55;
    var vbi = Vt * Math.log(arg);
    return Math.max(0.50, Math.min(1.15, vbi));
  }

  /**
   * Effective doping Neff = (NA * ND) / (NA + ND) in cm^-3
   */
  function effectiveDoping(Na, Nd) {
    return (Na * Nd) / (Na + Nd);
  }

  /**
   * Empirical Sze breakdown voltage VBR in Volts for abrupt Silicon junctions
   * VBR0 ≈ 60 * (Eg / 1.1)^1.5 * (Neff / 10^16)^-0.75
   * With temperature coefficient: negative for Zener (tunneling), positive for Avalanche (impact ionization).
   */
  function breakdownVoltage(Na, Nd, T) {
    var Eg = siliconBandgap(T);
    var Neff = effectiveDoping(Na, Nd);
    var baseVbr = 60.0 * Math.pow(Eg / 1.10, 1.5) * Math.pow(Neff / 1.0e16, -0.75);

    // Apply temperature coefficient alpha_T (1/K)
    // Zener (< 5V): tunneling probability increases as bandgap narrows slightly -> negative tempco
    // Avalanche (> 6V): lattice phonon scattering increases with T, reducing carrier mean free path -> positive tempco
    var alphaT = 0.0;
    if (baseVbr < 5.0) {
      alphaT = -0.0018 * Math.max(0.3, 5.0 - baseVbr); // negative tempco
    } else if (baseVbr > 6.0) {
      alphaT = +0.0012 * Math.min(3.0, baseVbr - 5.0);  // positive tempco
    } else {
      alphaT = 0.0; // mixed transition region
    }

    var vbr = baseVbr * (1.0 + alphaT * (T - 300.0));
    // Clamp to realistic physical range [2.5V, 100V]
    return Math.max(2.5, Math.min(100.0, vbr));
  }

  /**
   * Critical electric field Ecrit in V/cm
   */
  function criticalField(Na, Nd) {
    var Neff = effectiveDoping(Na, Nd);
    var logRatio = Math.log10(Math.max(1.0e14, Neff) / 1.0e16);
    var denom = Math.max(0.2, 1.0 - (1.0 / 3.0) * logRatio);
    return (4.0e5 / denom);
  }

  /**
   * Depletion widths:
   * W = sqrt( (2 * eps_s / q) * (1/NA + 1/ND) * max(Vbi - VA, 0.05) )
   * xp = W * ND / (NA + ND)
   * xn = W * NA / (NA + ND)
   * Returns widths in cm and in nanometers.
   */
  function depletionWidths(Va, Na, Nd, T) {
    var vbi = builtInPotential(Na, Nd, T);
    var effectiveBarrier = Math.max(0.05, vbi - Va);
    var dopingFactor = (1.0 / Na) + (1.0 / Nd);
    var W_cm = Math.sqrt((2.0 * EPS_SI / Q) * dopingFactor * effectiveBarrier);

    // Protect against non-physical infinities or extremes
    W_cm = Math.max(1.0e-7, Math.min(5.0e-3, W_cm));

    var totalDoping = Na + Nd;
    var xp_cm = W_cm * (Nd / totalDoping);
    var xn_cm = W_cm * (Na / totalDoping);

    return {
      wCm: W_cm,
      xpCm: xp_cm,
      xnCm: xn_cm,
      wNm: W_cm * 1.0e7,
      xpNm: xp_cm * 1.0e7,
      xnNm: xn_cm * 1.0e7,
      wUm: W_cm * 1.0e4,
      xpUm: xp_cm * 1.0e4,
      xnUm: xn_cm * 1.0e4,
      vbi: vbi,
      effectiveBarrier: effectiveBarrier
    };
  }

  /**
   * Peak electric field Emax in V/cm
   * |Emax| = (q * NA * xp) / eps_s = (2 * barrier) / W
   */
  function peakElectricField(Va, Na, Nd, T) {
    var widths = depletionWidths(Va, Na, Nd, T);
    var emax = (2.0 * widths.effectiveBarrier) / widths.wCm;
    return Math.max(0.0, emax);
  }

  /**
   * Total diode current I(VA) in Milliamperes (mA)
   * Combines Shockley forward conduction with series resistance clamping
   * and smooth exponential/Miller breakdown term when VA <= -VBR.
   */
  function diodeCurrent(Va, Na, Nd, T) {
    var Is = saturationCurrent(T);
    var Vt = thermalVoltage(T);
    var Vbr = breakdownVoltage(Na, Nd, T);

    // Case 1: Reverse Breakdown (VA <= -VBR)
    var Vrev = -Va;
    if (Vrev >= Vbr) {
      var deltaV = Vrev - Vbr;
      // Smooth exponential turn-on leading into series-resistance linear limit
      // Ensures sharp breakdown knee without Infinity or NaN
      var kneeFactor = 1.0 - Math.exp(-Math.min(deltaV / 0.12, 25.0));
      var iBreakdownAmps = (deltaV / RS_BREAKDOWN) * kneeFactor + 0.002 * kneeFactor;
      // Negative current flowing Cathode -> Anode
      return -iBreakdownAmps * 1000.0; // in mA
    }

    // Case 2: Normal Reverse Bias (-VBR < VA <= 0)
    if (Va <= 0.0) {
      // Normal Shockley reverse saturation current with subtle soft pre-breakdown curvature
      var revRatio = Vrev / Vbr;
      var preBreakdownMult = 1.0 / Math.max(0.05, 1.0 - Math.pow(Math.min(0.999, revRatio), 4.0));
      // Cap multiplier near breakdown to avoid discontinuity
      preBreakdownMult = Math.min(50.0, preBreakdownMult);
      var iRevAmps = -Is * (1.0 - Math.exp(Va / (N_IDEALITY * Vt))) * preBreakdownMult;
      return iRevAmps * 1000.0; // in mA
    }

    // Case 3: Forward Bias (VA > 0)
    // Shockley equation with implicit series resistance drop: VA = VD + I * RS
    // Solved via 3 iterations of Newton-Raphson for smooth continuity
    var Vd = Math.min(Va, 0.72); // Initial guess for internal junction voltage
    for (var iter = 0; iter < 4; iter++) {
      var expTerm = Math.exp(Math.min(Vd / (N_IDEALITY * Vt), 40.0));
      var fCurrent = Is * (expTerm - 1.0);
      var fRes = Vd + fCurrent * RS_FORWARD - Va;
      var fDeriv = 1.0 + (Is / (N_IDEALITY * Vt)) * expTerm * RS_FORWARD;
      var step = fRes / fDeriv;
      Vd -= Math.max(-0.1, Math.min(0.1, step));
    }
    var iFwdAmps = Is * (Math.exp(Math.min(Vd / (N_IDEALITY * Vt), 45.0)) - 1.0);
    return Math.max(0.0, iFwdAmps * 1000.0); // in mA
  }

  /**
   * Dynamic Regime Classification
   */
  function classifyRegime(Va, Na, Nd, T) {
    var Vbr = breakdownVoltage(Na, Nd, T);
    if (Va <= -Vbr) {
      if (Vbr < 5.0) return { regime: 'ZENER', label: 'Zener Breakdown', code: 'zener', vbr: Vbr };
      if (Vbr > 6.0) return { regime: 'AVALANCHE', label: 'Avalanche Breakdown', code: 'avalanche', vbr: Vbr };
      return { regime: 'MIXED', label: 'Mixed Breakdown', code: 'mixed', vbr: Vbr };
    }
    if (Va < -0.05) return { regime: 'REVERSE', label: 'Reverse Biased', code: 'reverse', vbr: Vbr };
    if (Va > 0.05) return { regime: 'FORWARD', label: 'Forward Biased', code: 'forward', vbr: Vbr };
    return { regime: 'EQUILIBRIUM', label: 'Thermal Equilibrium', code: 'equilibrium', vbr: Vbr };
  }

  /**
   * Complete telemetry state snapshot
   */
  function computeState(Va, Na, Nd, T) {
    var widths = depletionWidths(Va, Na, Nd, T);
    var emax = peakElectricField(Va, Na, Nd, T);
    var vbr = breakdownVoltage(Na, Nd, T);
    var ecrit = criticalField(Na, Nd);
    var currentMa = diodeCurrent(Va, Na, Nd, T);
    var regimeInfo = classifyRegime(Va, Na, Nd, T);
    var Eg = siliconBandgap(T);
    var ni = intrinsicCarrierConcentration(T);

    return {
      va: Va,
      na: Na,
      nd: Nd,
      temperature: T,
      eg: Eg,
      ni: ni,
      vbi: widths.vbi,
      wNm: widths.wNm,
      wUm: widths.wUm,
      wCm: widths.wCm,
      xpNm: widths.xpNm,
      xpUm: widths.xpUm,
      xnNm: widths.xnNm,
      xnUm: widths.xnUm,
      emax: emax,
      ecrit: ecrit,
      vbr: vbr,
      currentMa: currentMa,
      currentA: currentMa * 1.0e-3,
      regime: regimeInfo.regime,
      regimeLabel: regimeInfo.label,
      regimeCode: regimeInfo.code
    };
  }

  /**
   * Generate sampled I-V curve points from -20.0V to +0.8V
   */
  function generateIVCurve(Na, Nd, T, numPoints) {
    var pts = [];
    var N = numPoints || 250;
    var Vbr = breakdownVoltage(Na, Nd, T);

    // Densely sample around breakdown -Vbr and around forward knee 0.5V - 0.8V
    for (var i = 0; i <= N; i++) {
      var frac = i / N;
      var v = -20.0 + frac * 20.8; // range [-20.0, +0.8]
      var iMa = diodeCurrent(v, Na, Nd, T);
      pts.push({ v: v, i: iMa });
    }

    // Ensure exact point at -Vbr and 0.0 are present
    pts.push({ v: -Vbr, i: diodeCurrent(-Vbr, Na, Nd, T) });
    pts.push({ v: 0.0, i: diodeCurrent(0.0, Na, Nd, T) });
    pts.sort(function (a, b) { return a.v - b.v; });

    return pts;
  }

  /**
   * Compute spatial space-charge rho(x) in C/cm^3 and electric field E(x) in V/cm
   * Across [-1.5 * xp, 1.5 * xn]
   */
  function computeSpatialProfiles(Va, Na, Nd, T, numSamples) {
    var widths = depletionWidths(Va, Na, Nd, T);
    var xp = widths.xpCm;
    var xn = widths.xnCm;
    var totalSpan = xp + xn;
    var xMin = -xp * 1.4;
    var xMax = xn * 1.4;
    var samples = numSamples || 120;
    var pts = [];

    var rhoP = -Q * Na; // in C/cm^3
    var rhoN = +Q * Nd; // in C/cm^3

    for (var i = 0; i <= samples; i++) {
      var x = xMin + (i / samples) * (xMax - xMin);
      var rho = 0.0;
      var field = 0.0;

      if (x >= -xp && x < 0.0) {
        rho = rhoP;
        // E(x) = (q * NA / eps_s) * (x + xp)  (slopes down to negative peak)
        field = -(Q * Na / EPS_SI) * (x + xp);
      } else if (x >= 0.0 && x <= xn) {
        rho = rhoN;
        // E(x) = -(q * ND / eps_s) * (xn - x)
        field = -(Q * Nd / EPS_SI) * (xn - x);
      } else {
        rho = 0.0;
        field = 0.0;
      }

      pts.push({
        xNm: x * 1.0e7,
        xNormalized: x / Math.max(1.0e-9, totalSpan),
        rho: rho,
        field: Math.abs(field) // magnitude of electric field
      });
    }

    return {
      points: pts,
      xpNm: widths.xpNm,
      xnNm: widths.xnNm,
      wNm: widths.wNm,
      emax: peakElectricField(Va, Na, Nd, T),
      ecrit: criticalField(Na, Nd)
    };
  }

  return {
    Q: Q,
    KB: KB,
    EPS_SI: EPS_SI,
    siliconBandgap: siliconBandgap,
    intrinsicCarrierConcentration: intrinsicCarrierConcentration,
    thermalVoltage: thermalVoltage,
    builtInPotential: builtInPotential,
    breakdownVoltage: breakdownVoltage,
    criticalField: criticalField,
    depletionWidths: depletionWidths,
    peakElectricField: peakElectricField,
    diodeCurrent: diodeCurrent,
    classifyRegime: classifyRegime,
    computeState: computeState,
    generateIVCurve: generateIVCurve,
    computeSpatialProfiles: computeSpatialProfiles
  };
})();

// Expose on window for browser scripts
if (typeof window !== 'undefined') {
  window.DiodePhysics = DiodePhysics;
}
