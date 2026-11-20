/**
 * SiliconSliders - Thermal Oxidation Chamber Simulator Physics Engine
 * Exact Deal-Grove Model + Massoud Thin-Oxide Enhancement + CSTR Gas Switching Kinetics
 */

(function (global) {
  'use strict';

  var kB = 8.617333262e-5; // Boltzmann constant in eV/K
  var T_IDLE = 600.0;       // Load/Unload idle temperature in °C

  /**
   * Pre-computes 300 sequential time steps from t = 0 to t_total.
   *
   * @param {Object} params
   * @param {string} params.chemistry - 'dry' | 'wet' | 'issg'
   * @param {string} params.orientation - '100' | '111'
   * @param {number} params.tempPeak - Peak temperature in °C (700 - 1150)
   * @param {number} params.soakTime - Soak time in min (0.5 - 180)
   * @param {number} params.pressure - Chamber total pressure in atm (0.005 - 20)
   * @param {number} params.oxidantConc - Oxidant concentration % (10 - 100)
   * @param {number} params.rampRate - Temperature ramp rate in °C/min (5 - 150)
   * @returns {Object} Simulation trajectory and summary metrics
   */
  function solveOxidationTrajectory(params) {
    var chem = params.chemistry || 'dry';
    var orient = params.orientation || '100';
    var T_peak = Number(params.tempPeak) || 850;
    var t_soak = Number(params.soakTime) || 15;
    var P_total = Number(params.pressure) || 1.0;
    var conc_pct = Number(params.oxidantConc) || 20;
    var ramp_rate = Number(params.rampRate) || 10;

    // 1. Thermal Cycle Boundaries
    var t_ramp_up = (T_peak - T_IDLE) / ramp_rate;
    var t_soak_end = t_ramp_up + t_soak;
    var t_total = t_soak_end + t_ramp_up;

    // 2. CSTR Gas Flushing Residence Time
    // Rapid flush for low-pressure ISSG or rapid thermal processing (>20 °C/min)
    var tau_flush = (chem === 'issg' || ramp_rate > 20) ? 0.15 : 2.0;
    var orient_mult = (orient === '111') ? 1.68 : 1.0;

    var NUM_STEPS = 300;
    var dt = t_total / NUM_STEPS;

    var steps = [];
    var x = (typeof params.initialOxide === 'number') ? params.initialOxide : 1.0; // Native oxide at t = 0 (1.0 nm standard or 0.0 nm HF-dipped)
    var tb = 0.0; // Cumulative thermal budget index

    for (var i = 0; i <= NUM_STEPS; i++) {
      var t = i * dt;

      // A. Chamber Temperature T(t)
      var T = T_IDLE;
      var stage = 'ramp_up';
      if (t <= t_ramp_up) {
        T = T_IDLE + (t / (t_ramp_up || 1e-5)) * (T_peak - T_IDLE);
        stage = 'ramp_up';
      } else if (t <= t_soak_end) {
        T = T_peak;
        stage = 'soak';
      } else {
        var coolRatio = (t - t_soak_end) / (t_ramp_up || 1e-5);
        T = T_peak - Math.min(1.0, coolRatio) * (T_peak - T_IDLE);
        stage = 'cool_down';
      }
      var T_K = T + 273.15;

      // B. Smooth CSTR Gas Switching Concentrations
      var C_ox = 0.0;
      if (t < t_ramp_up) {
        C_ox = 0.0;
      } else if (t <= t_soak_end) {
        C_ox = (conc_pct / 100.0) * (1.0 - Math.exp(-(t - t_ramp_up) / tau_flush));
      } else {
        var C_end = (conc_pct / 100.0) * (1.0 - Math.exp(-t_soak / tau_flush));
        C_ox = C_end * Math.exp(-(t - t_soak_end) / tau_flush);
      }
      C_ox = Math.max(0.0, Math.min(1.0, C_ox));
      var C_n2 = Math.max(0.0, 1.0 - C_ox);
      var P_ox = P_total * C_ox;

      // C. Deal-Grove Rate Constants + Massoud Thin-Oxide Enhancement
      var B = 0.0;
      var B_over_A = 0.0;
      var R_massoud = 0.0;
      var dxdt = 0.0;

      if (P_ox > 1e-6) {
        if (chem === 'dry') {
          // Dry O2 oxidation kinetics
          B = 1.29e7 * Math.pow(P_ox, 0.75) * Math.exp(-1.23 / (kB * T_K));
          B_over_A = 6.22e7 * orient_mult * Math.pow(P_ox, 0.75) * Math.exp(-2.00 / (kB * T_K));
          R_massoud = Math.pow(P_ox, 0.75) * (
            1.2e8 * Math.exp(-2.15 / (kB * T_K)) * Math.exp(-x / 1.0) +
            2.5e7 * Math.exp(-2.25 / (kB * T_K)) * Math.exp(-x / 7.0)
          );
        } else if (chem === 'wet') {
          // Wet Pyrogenic H2O steam kinetics
          B = 6.43e6 * P_ox * Math.exp(-0.78 / (kB * T_K));
          B_over_A = 1.62e9 * orient_mult * P_ox * Math.exp(-2.05 / (kB * T_K));
          R_massoud = 0.0;
        } else if (chem === 'issg') {
          // ISSG Radical (In-Situ Steam/Radical Generation, Low-P)
          B = 1.5e7 * P_ox * Math.exp(-1.20 / (kB * T_K));
          B_over_A = 8.5e5 * orient_mult * (P_ox / (0.01 + P_ox)) * Math.exp(-1.15 / (kB * T_K));
          R_massoud = 0.0;
        }

        // Deal-Grove instantaneous growth rate: dx/dt = B / (2x + A) + R_massoud
        // Using identity: B / (2x + A) = 1 / (2x/B + 1/(B/A))
        var denom = 0.0;
        if (B > 0 && B_over_A > 0) {
          denom = (2.0 * x) / B + 1.0 / B_over_A;
        }
        var dgRate = denom > 0 ? (1.0 / denom) : 0.0;
        dxdt = dgRate + R_massoud;
      }

      // D. Cumulative Integration (Forward Euler with 300 steps)
      if (i > 0) {
        x += dxdt * dt;
      }

      // E. Thermal Budget Accumulator: TB = integral exp(-3.45 / (kB*T_K)) dt * 1e14
      tb += Math.exp(-3.45 / (kB * T_K)) * dt * 1e14;

      // F. Kinetic Regime Assessment
      var regime = 'Reaction (Linear)';
      var A_param = (B_over_A > 0) ? (B / B_over_A) : 100.0;
      if (x > A_param * 1.2) {
        regime = 'Diffusion (Parabolic)';
      } else if (x > A_param * 0.4) {
        regime = 'Transition (Linear-Parabolic)';
      } else if (chem === 'dry' && x < 15.0) {
        regime = 'Massoud Enhanced Thin-Oxide';
      }

      steps.push({
        index: i,
        t: t,
        stage: stage,
        T: T,
        T_K: T_K,
        C_ox: C_ox,
        C_n2: C_n2,
        P_ox: P_ox,
        x_ox: x,
        x_si: 0.44 * x,
        x_up: 0.56 * x,
        B: B,
        B_over_A: B_over_A,
        R_massoud: R_massoud,
        dxdt: dxdt,
        regime: regime,
        tb: tb
      });
    }

    // 3. Wafer Slip Risk Assessment
    var slipRisk = 'Low (Safe)';
    var slipRiskClass = 'safe';
    if (chem === 'issg' || ramp_rate <= 12) {
      slipRisk = 'Low (Safe)';
      slipRiskClass = 'safe';
    } else if (ramp_rate <= 25) {
      slipRisk = 'Elevated';
      slipRiskClass = 'elevated';
    } else {
      slipRisk = 'High Slip Risk';
      slipRiskClass = 'danger';
    }

    var finalStep = steps[steps.length - 1];

    return {
      params: params,
      t_ramp_up: t_ramp_up,
      t_soak_end: t_soak_end,
      t_total: t_total,
      tau_flush: tau_flush,
      steps: steps,
      final: {
        x_ox: finalStep.x_ox,
        x_si: finalStep.x_si,
        x_up: finalStep.x_up,
        tb: finalStep.tb,
        thermal_budget: finalStep.tb,
        slipRisk: slipRisk,
        slipRiskClass: slipRiskClass
      }
    };
  }

  /**
   * Linearly interpolates instantaneous state at timestamp t from precomputed steps.
   */
  function interpolateState(trajectory, t) {
    if (!trajectory || !trajectory.steps || !trajectory.steps.length) {
      return null;
    }
    var steps = trajectory.steps;
    var t_total = trajectory.t_total;
    var clampedT = Math.max(0, Math.min(t_total, t));

    var frac = clampedT / (t_total || 1.0);
    var idx = frac * (steps.length - 1);
    var i0 = Math.floor(idx);
    var i1 = Math.min(steps.length - 1, i0 + 1);
    var rem = idx - i0;

    var s0 = steps[i0];
    var s1 = steps[i1];

    function lerp(a, b) {
      return a + (b - a) * rem;
    }

    return {
      t: clampedT,
      stage: clampedT <= trajectory.t_ramp_up ? 'ramp_up' : (clampedT <= trajectory.t_soak_end ? 'soak' : 'cool_down'),
      T: lerp(s0.T, s1.T),
      C_ox: lerp(s0.C_ox, s1.C_ox),
      C_n2: lerp(s0.C_n2, s1.C_n2),
      P_ox: lerp(s0.P_ox, s1.P_ox),
      x_ox: lerp(s0.x_ox, s1.x_ox),
      x_si: lerp(s0.x_si, s1.x_si),
      x_up: lerp(s0.x_up, s1.x_up),
      B: lerp(s0.B, s1.B),
      B_over_A: lerp(s0.B_over_A, s1.B_over_A),
      dxdt: lerp(s0.dxdt, s1.dxdt),
      regime: s0.regime,
      tb: lerp(s0.tb, s1.tb)
    };
  }

  /**
   * Returns unified chemistry configurations (color, glow, labels, diffusion characteristics).
   */
  function getChemConfig(chem) {
    if (chem && typeof chem === 'object' && chem.color) return chem;
    var key = (chem || '').toLowerCase();
    if (key.indexOf('wet') !== -1 || key.indexOf('steam') !== -1 || key.indexOf('h2o') !== -1) {
      return {
        id: 'wet',
        name: 'Wet H₂O',
        label: 'H₂O Vapor',
        shortLabel: 'H₂O',
        color: '#10b981',       // Emerald / Teal-Green
        glow: 'rgba(16, 185, 129, 0.45)',
        chartFillTop: 'rgba(16, 185, 129, 0.28)',
        chartFillBottom: 'rgba(16, 185, 129, 0.02)',
        textColor: 'text-emerald-400',
        diffSpeed: 0.85,        // Higher diffusivity in SiO2
        jitter: 1.05
      };
    }
    if (key.indexOf('issg') !== -1 || key.indexOf('radical') !== -1) {
      return {
        id: 'issg',
        name: 'ISSG Radical',
        label: 'O* / OH* Radicals',
        shortLabel: 'O* / OH*',
        color: '#c084fc',       // Vibrant Violet / Amber
        glow: 'rgba(192, 132, 252, 0.50)',
        chartFillTop: 'rgba(192, 132, 252, 0.28)',
        chartFillBottom: 'rgba(192, 132, 252, 0.02)',
        textColor: 'text-purple-400',
        diffSpeed: 1.15,        // Fast atomic radical mobility
        jitter: 1.35
      };
    }
    return {
      id: 'dry',
      name: 'Dry O₂',
      label: 'O₂ Oxidant',
      shortLabel: 'O₂',
      color: '#22d3ee',         // Bright Cyan
      glow: 'rgba(34, 211, 238, 0.45)',
      chartFillTop: 'rgba(34, 211, 238, 0.28)',
      chartFillBottom: 'rgba(34, 211, 238, 0.02)',
      textColor: 'text-cyan-400',
      diffSpeed: 0.55,          // Slower molecular O2 diffusion
      jitter: 0.70
    };
  }

  // Export
  global.OxidationPhysics = {
    kB: kB,
    T_IDLE: T_IDLE,
    getChemConfig: getChemConfig,
    solveOxidationTrajectory: solveOxidationTrajectory,
    interpolateState: interpolateState
  };

})(typeof window !== 'undefined' ? window : this);
