/**
 * physics.js - LVDT (Linear Variable Differential Transformer) Analytical Engine
 *
 * Implements mutual inductance coupling, series-opposition secondary voltages,
 * smooth tanh saturation roll-off beyond +/-5 mm, frequency response H(f),
 * quadrature residual null phasor, 0/180 deg phase shift, and linearity metrics.
 */
(function (root) {
  'use strict';

  var CONSTANTS = {
    xMin: -10.0,               // mm
    xMax: 10.0,                // mm
    linearRangeMm: 5.0,        // +/- 5 mm rated linear stroke
    nominalSensitivityMvVmm: 100.0, // 100 mV / V / mm = 0.10 V/(V*mm)
    cubicCoeff: 0.00015,       // subtle 0.375% non-linearity inside +/- 5 mm
    satWidthMm: 2.6,           // tanh roll-off scale outside +/- 5 mm
    quadNullRatio: 0.008,      // 0.8% FS quadrature null (40 mVrms at Vp = 5 Vrms)
    fLowHz: 120.0,             // primary inductive corner frequency (Hz)
    fHighHz: 14000.0,          // high-frequency core eddy/capacitance corner (Hz)
    fRefHz: 2500.0,            // nominal calibration frequency where H(f) = 1.000
    baseCouplingRatio: 0.50    // VS1(0) = VS2(0) = 0.50 * Vp * H(f)
  };

  function clamp(val, lo, hi) {
    return Math.max(lo, Math.min(hi, val));
  }

  /**
   * Raw unnormalized bandpass transfer magnitude for primary-to-secondary coupling.
   */
  function rawFreqGain(fHz) {
    var f = Math.max(10.0, Number(fHz) || CONSTANTS.fRefHz);
    var rLow = f / CONSTANTS.fLowHz;
    var lowPassPart = rLow / Math.sqrt(1.0 + rLow * rLow);
    var rHigh = f / CONSTANTS.fHighHz;
    var highPassPart = 1.0 / Math.sqrt(1.0 + Math.pow(rHigh, 4));
    return lowPassPart * highPassPart;
  }

  var REF_FREQ_GAIN = rawFreqGain(CONSTANTS.fRefHz);

  /**
   * Normalized frequency gain H(f), calibrated so H(2500 Hz) === 1.000.
   */
  function frequencyResponse(fHz) {
    return rawFreqGain(fHz) / REF_FREQ_GAIN;
  }

  /**
   * Effective magnetic displacement x_eff(x) with high linearity inside +/-5 mm
   * and C1-continuous tanh saturation roll-off beyond +/-5 mm.
   */
  function effectiveDisplacement(xMm) {
    var x = clamp(Number(xMm) || 0, CONSTANTS.xMin, CONSTANTS.xMax);
    var absX = Math.abs(x);
    var sgn = x < 0 ? -1 : (x > 0 ? 1 : 0);
    var xL = CONSTANTS.linearRangeMm;
    var c3 = CONSTANTS.cubicCoeff;

    if (absX <= xL) {
      return x * (1.0 - c3 * x * x);
    }

    var xAtEdge = xL * (1.0 - c3 * xL * xL);
    var slopeAtEdge = 1.0 - 3.0 * c3 * xL * xL;
    var excess = absX - xL;
    var w = CONSTANTS.satWidthMm;
    var satExcess = w * Math.tanh(excess / w);
    return sgn * (xAtEdge + slopeAtEdge * satExcess);
  }

  /**
   * Derivative dx_eff / dx for instantaneous local sensitivity.
   */
  function effectiveSlope(xMm) {
    var x = clamp(Number(xMm) || 0, CONSTANTS.xMin, CONSTANTS.xMax);
    var absX = Math.abs(x);
    var xL = CONSTANTS.linearRangeMm;
    var c3 = CONSTANTS.cubicCoeff;

    if (absX <= xL) {
      return 1.0 - 3.0 * c3 * x * x;
    }

    var slopeAtEdge = 1.0 - 3.0 * c3 * xL * xL;
    var excess = absX - xL;
    var ch = Math.cosh(excess / CONSTANTS.satWidthMm);
    return slopeAtEdge / (ch * ch);
  }

  /**
   * Computes complete LVDT electrical & instrumentation state.
   *
   * @param {Object} params
   * @param {number} params.xMm - Core displacement in [-10, +10] mm
   * @param {number} params.vpVrms - Primary excitation RMS amplitude in [1, 10] Vrms
   * @param {number} params.freqHz - Excitation frequency in [50, 10000] Hz
   * @param {string} [params.demodulatorMode='raw'] - 'raw' (Raw AC) or 'demod' (Signed DC)
   * @param {boolean} [params.includeResidualNull=false] - Quadrature null voltage toggle
   */
  function computeState(params) {
    var p = params || {};
    var xMm = clamp(p.xMm !== undefined ? Number(p.xMm) : 0.0, CONSTANTS.xMin, CONSTANTS.xMax);
    var vpVrms = clamp(p.vpVrms !== undefined ? Number(p.vpVrms) : 5.0, 1.0, 10.0);
    var freqHz = clamp(p.freqHz !== undefined ? Number(p.freqHz) : 2500.0, 50.0, 10000.0);
    var demodulatorMode = p.demodulatorMode === 'demod' ? 'demod' : 'raw';
    var includeResidualNull = Boolean(p.includeResidualNull);

    var hFreq = frequencyResponse(freqHz);
    var nominalS_VVmm = (CONSTANTS.nominalSensitivityMvVmm / 1000.0) * hFreq;
    var xEff = effectiveDisplacement(xMm);
    var slopeRatio = effectiveSlope(xMm);

    // Individual secondary RMS voltages
    var vS0 = CONSTANTS.baseCouplingRatio * vpVrms * hFreq;
    var halfDiff = 0.5 * nominalS_VVmm * vpVrms * xEff;
    var vS1 = Math.max(0.0, vS0 - halfDiff);
    var vS2 = Math.max(0.0, vS0 + halfDiff);

    // Series-opposition differential real component:
    // x < 0 -> VS1 > VS2 -> positive in-phase (0 deg)
    // x > 0 -> VS2 > VS1 -> negative (180 deg phase flip)
    var vDiffInPhase = vS1 - vS2;
    var vQuad = includeResidualNull ? (CONSTANTS.quadNullRatio * vpVrms) : 0.0;

    var vOutRms = Math.sqrt(vDiffInPhase * vDiffInPhase + vQuad * vQuad);
    var vOutSignedAc = vDiffInPhase; // Real projection on primary reference
    // Signed demodulated DC: positive for +x, negative for -x
    var vOutDemodDc = -vDiffInPhase;

    // Phase angle relative to primary excitation [0, 180] degrees
    var phaseDeg;
    if (includeResidualNull) {
      phaseDeg = Math.atan2(vQuad, vDiffInPhase) * (180.0 / Math.PI);
    } else {
      if (Math.abs(xMm) < 1e-6) {
        phaseDeg = 0.0;
      } else {
        phaseDeg = xMm > 0 ? 180.0 : 0.0;
      }
    }

    // Instantaneous sensitivity (mV / V / mm)
    var sensitivityMvVmm = CONSTANTS.nominalSensitivityMvVmm * hFreq * slopeRatio;

    // Linearity error (% of full-scale linear stroke at +/- 5 mm)
    var vIdeal = nominalS_VVmm * vpVrms * Math.abs(xMm);
    var vActualMag = Math.abs(vDiffInPhase);
    var vFullScale = nominalS_VVmm * vpVrms * CONSTANTS.linearRangeMm;
    var linearityErrorPct = vFullScale > 0
      ? (Math.abs(vActualMag - vIdeal) / vFullScale) * 100.0
      : 0.0;

    // Linear zone status classification
    var absX = Math.abs(xMm);
    var zoneStatus;
    var zoneLabel;
    if (absX <= 0.05) {
      zoneStatus = 'null';
      zoneLabel = 'NULL BALANCE';
    } else if (absX <= CONSTANTS.linearRangeMm) {
      zoneStatus = 'linear';
      zoneLabel = 'LINEAR ZONE';
    } else if (linearityErrorPct <= 1.0) {
      zoneStatus = 'linear';
      zoneLabel = 'NEAR LINEAR LIMIT';
    } else {
      zoneStatus = 'saturated';
      zoneLabel = 'NON-LINEAR ROLL-OFF';
    }

    // Magnetic flux coupling balance [0..1] for 3D visualization
    var fluxBalance = clamp(xEff / (CONSTANTS.linearRangeMm * 1.45), -0.92, 0.92);
    var fluxLeft = clamp(0.5 - 0.45 * fluxBalance, 0.08, 0.95);
    var fluxRight = clamp(0.5 + 0.45 * fluxBalance, 0.08, 0.95);

    return {
      xMm: xMm,
      xEff: xEff,
      vpVrms: vpVrms,
      freqHz: freqHz,
      hFreq: hFreq,
      demodulatorMode: demodulatorMode,
      includeResidualNull: includeResidualNull,
      vS1: vS1,
      vS2: vS2,
      vDiffInPhase: vDiffInPhase,
      vQuad: vQuad,
      vOutRms: vOutRms,
      vOutSignedAc: vOutSignedAc,
      vOutDemodDc: vOutDemodDc,
      vFullScale: vFullScale,
      phaseDeg: phaseDeg,
      sensitivityMvVmm: sensitivityMvVmm,
      nominalSensitivityMvVmm: CONSTANTS.nominalSensitivityMvVmm * hFreq,
      linearityErrorPct: linearityErrorPct,
      zoneStatus: zoneStatus,
      zoneLabel: zoneLabel,
      fluxLeft: fluxLeft,
      fluxRight: fluxRight
    };
  }

  /**
   * Samples the Vout vs x transfer curve across [-10, +10] mm.
   */
  function sampleTransferCurve(params, steps) {
    var n = steps || 161;
    var out = [];
    for (var i = 0; i < n; i++) {
      var x = CONSTANTS.xMin + (i / (n - 1)) * (CONSTANTS.xMax - CONSTANTS.xMin);
      var st = computeState({
        xMm: x,
        vpVrms: params.vpVrms,
        freqHz: params.freqHz,
        demodulatorMode: params.demodulatorMode,
        includeResidualNull: params.includeResidualNull
      });
      var idealSigned = st.nominalSensitivityMvVmm / 1000.0 * st.vpVrms * x;
      var yVal = params.demodulatorMode === 'demod' ? st.vOutDemodDc : st.vOutRms;
      var yIdeal = params.demodulatorMode === 'demod' ? idealSigned : Math.abs(idealSigned);
      out.push({
        x: x,
        y: yVal,
        yIdeal: yIdeal,
        vOutRms: st.vOutRms,
        vOutDemodDc: st.vOutDemodDc,
        linearityErrorPct: st.linearityErrorPct
      });
    }
    return out;
  }

  /**
   * Samples instantaneous waveforms Vin(t) and Vout(t) over N carrier cycles.
   */
  function sampleOscilloscope(state, timePhaseRad, numCycles, samples) {
    var cycles = numCycles || 2.5;
    var n = samples || 220;
    var vinArr = [];
    var voutArr = [];
    var sqrt2 = Math.SQRT2;
    var vpPeak = sqrt2 * state.vpVrms;
    var vRealPeak = sqrt2 * state.vDiffInPhase;
    var vQuadPeak = sqrt2 * state.vQuad;

    for (var i = 0; i < n; i++) {
      var theta = (i / (n - 1)) * (cycles * Math.PI * 2.0) + (timePhaseRad || 0);
      var vin = vpPeak * Math.sin(theta);
      var vout;
      if (state.demodulatorMode === 'demod') {
        // Phase-sensitive demodulator + LPF output with small carrier ripple
        var ripple = 0.018 * state.vOutRms * Math.sin(2.0 * theta);
        vout = state.vOutDemodDc + ripple;
      } else {
        // Instantaneous AC waveform: real component + quadrature null component
        vout = vRealPeak * Math.sin(theta) + vQuadPeak * Math.cos(theta);
      }
      vinArr.push(vin);
      voutArr.push(vout);
    }

    return {
      vin: vinArr,
      vout: voutArr,
      vpPeak: vpPeak,
      voutPeak: Math.max(sqrt2 * state.vFullScale * 1.35, 1.0)
    };
  }

  root.LVDTPhysics = {
    CONSTANTS: CONSTANTS,
    frequencyResponse: frequencyResponse,
    effectiveDisplacement: effectiveDisplacement,
    effectiveSlope: effectiveSlope,
    computeState: computeState,
    sampleTransferCurve: sampleTransferCurve,
    sampleOscilloscope: sampleOscilloscope
  };
})(typeof window !== 'undefined' ? window : globalThis);
