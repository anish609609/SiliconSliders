/**
 * logic-state.js - CMOS Inverter Electrical Physics, Geometry Scaling & Live VTC
 * - Coupled W_p (60-400 nm), W_n (60-400 nm), and L (20-200 nm) model with
 *   realistic mobility ratio (mu_n = 2.0 * mu_p), SCE VTH roll-off, velocity saturation,
 *   and channel-length modulation (lambda proportional to 1/L).
 * - Continuous KCL intersection solver (I_DS,n = I_DS,p) computing exact VTC V_OUT(V_IN),
 *   switching threshold V_M, shoot-through current I_DD(V_IN), and noise margins NM_H / NM_L.
 * - Expandable interactive VTC modal + uniform green SiliconParamInfoModal explanations.
 */

var currentVin = 'off'; // 'off' (High-Z) or float [0.00, 1.00]
window.currentIn = 'off';

var VDD = 1.00;
var MU_N_TO_P_RATIO = 2.00; // Realistic ~2.0x electron-to-hole mobility ratio

var CMOS_GEOM_PRESETS = {
  balanced: { Wp: 240, Wn: 120, L: 28 },
  minarea:  { Wp: 120, Wn: 120, L: 28 },
  skewed:   { Wp: 360, Wn: 120, L: 28 }
};

var geomWp = 240; // nm [60..400]
var geomWn = 120; // nm [60..400]
var geomL = 28;   // nm [20..200]
var activeGeomPreset = 'balanced';

function getCmosGeomState() {
  return {
    Wp: geomWp,
    Wn: geomWn,
    L: geomL,
    preset: activeGeomPreset,
    widthRatio: geomWp / Math.max(1, geomWn),
    betaRatio: geomWp / (MU_N_TO_P_RATIO * Math.max(1, geomWn))
  };
}
window.getCmosGeomState = getCmosGeomState;

// Compute geometry-dependent device parameters
function computeDeviceParams(Wp, Wn, L) {
  var sceRoll = 0.08 * Math.exp(-Math.max(0, L - 20.0) / 26.0);
  var vthN = 0.36 - sceRoll; // ~0.301 V at L=28 nm, ~0.360 V at L=200 nm
  var vthP = 0.36 - sceRoll; // |VTH,p|
  var lam = 0.015 + 0.085 * (28.0 / Math.max(20, L)); // Channel-length modulation ~1/L
  var eSat = 0.018; // V/nm -> E_sat * L = 0.504 V at 28 nm
  var vCrit = eSat * L;

  // Transconductance constants (mA/V^2) preserving mu_n = 2.0 * mu_p
  var kpN = 0.36;
  var kpP = kpN / MU_N_TO_P_RATIO; // 0.18 mA/V^2
  var kN = kpN * (Wn / L);
  var kP = kpP * (Wp / L);

  return {
    Wp: Wp,
    Wn: Wn,
    L: L,
    vthN: vthN,
    vthP: vthP,
    lambda: lam,
    vCrit: vCrit,
    kN: kN,
    kP: kP,
    betaN: kN,
    betaP: kP,
    betaRatio: kP / Math.max(1e-9, kN)
  };
}

// Smooth, strictly increasing FET I_DS(V_DS) model with velocity saturation & subthreshold tail
function evaluateFetCurrent(vgs, vth, k, vds, lam, vCrit) {
  var vd = Math.max(0, vds);
  var vt = 0.026;
  var ovRaw = vgs - vth;
  // Softplus overdrive for continuous transition from subthreshold into strong inversion
  var arg = ovRaw / vt;
  var vov = arg > 24 ? ovRaw : vt * Math.log(1 + Math.exp(arg));

  var vdsat = (vov * vCrit) / Math.max(1e-6, vov + vCrit);
  var veff = Math.min(vd, vdsat);
  var driftDenom = 1.0 + veff / Math.max(1e-4, vCrit);
  var iDrift = k * ((vov * veff - 0.5 * veff * veff) / driftDenom) * (1.0 + lam * vd);

  // Subtle residual leakage floor so KCL bisection has nonzero gradient even in deep cutoff
  var iLeak = k * 1.5e-5 * Math.exp(Math.max(-20, Math.min(2, ovRaw / 0.045))) * (1.0 - Math.exp(-vd / 0.026)) * (1.0 + lam * vd);
  return iDrift + iLeak;
}

// Solve I_DS,n(vin, vout) = I_DS,p(VDD - vin, VDD - vout) via bisection
function solveInverterKCL(vin, p) {
  var vgsN = Math.max(0, Math.min(VDD, vin));
  var vsgP = Math.max(0, Math.min(VDD, VDD - vin));
  var lo = 0.0;
  var hi = VDD;
  for (var iter = 0; iter < 36; iter++) {
    var mid = 0.5 * (lo + hi);
    var iN = evaluateFetCurrent(vgsN, p.vthN, p.kN, mid, p.lambda, p.vCrit);
    var iP = evaluateFetCurrent(vsgP, p.vthP, p.kP, VDD - mid, p.lambda, p.vCrit);
    if (iN > iP) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  var vout = 0.5 * (lo + hi);
  var iFinalN = evaluateFetCurrent(vgsN, p.vthN, p.kN, vout, p.lambda, p.vCrit);
  var iFinalP = evaluateFetCurrent(vsgP, p.vthP, p.kP, VDD - vout, p.lambda, p.vCrit);
  return {
    vout: vout,
    idd: 0.5 * (iFinalN + iFinalP)
  };
}

var _cachedCurveKey = '';
var _cachedVtcData = null;

function getVtcCurveData(Wp, Wn, L) {
  var wP = typeof Wp === 'number' ? Wp : geomWp;
  var wN = typeof Wn === 'number' ? Wn : geomWn;
  var len = typeof L === 'number' ? L : geomL;
  var key = wP + '|' + wN + '|' + len;
  if (_cachedVtcData && _cachedCurveKey === key) return _cachedVtcData;

  var params = computeDeviceParams(wP, wN, len);
  var N = 100;
  var pts = [];
  var maxIdd = 0;

  for (var i = 0; i <= N; i++) {
    var v = i / N;
    var sol = solveInverterKCL(v, params);
    if (sol.idd > maxIdd) maxIdd = sol.idd;
    pts.push({ vin: v, vout: sol.vout, idd: sol.idd });
  }

  // Analytical & KCL switching threshold V_M (crossing where V_OUT = V_IN)
  var vm = 0.5;
  for (var j = 1; j < pts.length; j++) {
    var dPrev = pts[j - 1].vout - pts[j - 1].vin;
    var dCurr = pts[j].vout - pts[j].vin;
    if (dPrev >= 0 && dCurr <= 0) {
      var frac = dPrev / Math.max(1e-9, dPrev - dCurr);
      vm = pts[j - 1].vin + frac * (pts[j].vin - pts[j - 1].vin);
      break;
    }
  }

  // Compute numerical derivative dVOUT/dVIN for V_IL, V_IH, NM_L, NM_H
  var slopes = [];
  for (var k = 0; k <= N; k++) {
    var k0 = Math.max(0, k - 1);
    var k1 = Math.min(N, k + 1);
    var dvIn = Math.max(1e-5, pts[k1].vin - pts[k0].vin);
    slopes.push((pts[k1].vout - pts[k0].vout) / dvIn);
  }

  var vil = params.vthN;
  var vih = VDD - params.vthP;
  for (var lIdx = 1; lIdx < N; lIdx++) {
    if (pts[lIdx].vin <= vm && slopes[lIdx] <= -1.0) {
      var s0 = slopes[lIdx - 1];
      var s1 = slopes[lIdx];
      var tL = (s1 < s0) ? ((-1.0 - s0) / (s1 - s0)) : 0.5;
      tL = Math.max(0, Math.min(1, tL));
      vil = pts[lIdx - 1].vin + tL * (pts[lIdx].vin - pts[lIdx - 1].vin);
      break;
    }
  }
  for (var rIdx = N - 1; rIdx >= 1; rIdx--) {
    if (pts[rIdx].vin >= vm && slopes[rIdx] <= -1.0) {
      var sr0 = slopes[rIdx];
      var sr1 = slopes[rIdx + 1];
      var tR = (sr1 > sr0) ? ((-1.0 - sr0) / (sr1 - sr0)) : 0.5;
      tR = Math.max(0, Math.min(1, tR));
      vih = pts[rIdx].vin + tR * (pts[rIdx + 1].vin - pts[rIdx].vin);
      break;
    }
  }

  var voh = pts[0].vout;
  var vol = pts[N].vout;
  var nml = Math.max(0, vil - vol);
  var nmh = Math.max(0, voh - vih);

  _cachedCurveKey = key;
  _cachedVtcData = {
    params: params,
    points: pts,
    maxIdd: Math.max(0.005, maxIdd),
    vm: vm,
    voh: voh,
    vol: vol,
    vil: vil,
    vih: vih,
    nmh: nmh,
    nml: nml
  };
  return _cachedVtcData;
}

function getVoutAt(vinFloat) {
  if (typeof vinFloat !== 'number' || isNaN(vinFloat)) return 0.50;
  var params = computeDeviceParams(geomWp, geomWn, geomL);
  return solveInverterKCL(vinFloat, params).vout;
}
window.getVoutAt = getVoutAt;

function getIddAt(vinFloat) {
  if (typeof vinFloat !== 'number' || isNaN(vinFloat)) return 0.0;
  var params = computeDeviceParams(geomWp, geomWn, geomL);
  return solveInverterKCL(vinFloat, params).idd;
}
window.getIddAt = getIddAt;

function formatCurrentReadout(iddMa) {
  if (iddMa >= 0.0995) return iddMa.toFixed(2) + ' mA';
  var uA = iddMa * 1000.0;
  return (uA < 10 ? uA.toFixed(1) : Math.round(uA)) + ' µA';
}

function calcCmosState(vinVal) {
  var curve = getVtcCurveData(geomWp, geomWn, geomL);
  var p = curve.params;
  var widthRatio = p.Wp / Math.max(1, p.Wn);

  if (vinVal === 'off' || vinVal === null || vinVal === undefined) {
    return {
      vin: 'off',
      vinText: 'OFF',
      vout: 0.50,
      voutText: 'FLOATING',
      nmosReg: 'CUTOFF',
      pmosReg: 'CUTOFF',
      idd: 0.0,
      vm: curve.vm,
      nmh: curve.nmh,
      nml: curve.nml,
      vthN: p.vthN,
      vthP: p.vthP,
      wp: p.Wp,
      wn: p.Wn,
      l: p.L,
      widthRatio: widthRatio,
      betaRatio: p.betaRatio,
      maxIdd: curve.maxIdd,
      stateDesc: 'Input Floating · High-Z Output',
      vtcRegion: 'FLOATING (HIGH-Z)',
      outDotClass: 'off'
    };
  }

  var vin = Math.max(0.0, Math.min(VDD, Number(vinVal)));
  var sol = solveInverterKCL(vin, p);
  var vout = sol.vout;
  var idd = sol.idd;

  var nmosReg = 'CUTOFF';
  var nmosVov = vin - p.vthN;
  if (vin < p.vthN - 0.06) {
    nmosReg = 'CUTOFF';
  } else if (vin < p.vthN) {
    nmosReg = 'SUBTHRESHOLD';
  } else if (vout < nmosVov) {
    nmosReg = 'LINEAR';
  } else {
    nmosReg = 'SATURATION';
  }

  var pmosReg = 'CUTOFF';
  var pmosVsg = VDD - vin;
  var pmosVov = pmosVsg - p.vthP;
  var pmosVsd = VDD - vout;
  if (pmosVsg < p.vthP - 0.06) {
    pmosReg = 'CUTOFF';
  } else if (pmosVsg < p.vthP) {
    pmosReg = 'SUBTHRESHOLD';
  } else if (pmosVsd < pmosVov) {
    pmosReg = 'LINEAR';
  } else {
    pmosReg = 'SATURATION';
  }

  var vtcRegion = 'TRANSITION';
  var stateDesc = '';
  if (vin < p.vthN) {
    vtcRegion = 'REGION A (LOGIC 1 OUT)';
    stateDesc = 'Pull-Up Active · VOUT ≈ VDD (NMOS OFF)';
  } else if (vin < curve.vm - 0.03) {
    vtcRegion = 'REGION B (PRE-TRANSITION)';
    stateDesc = 'PMOS Linear · NMOS Sat (VOUT Dropping)';
  } else if (Math.abs(vin - curve.vm) <= 0.03) {
    vtcRegion = 'REGION C (SWITCHING POINT)';
    stateDesc = 'Both Saturation at VM = ' + curve.vm.toFixed(2) + 'V (Peak Shoot-Through)';
  } else if (vin <= VDD - p.vthP) {
    vtcRegion = 'REGION D (POST-TRANSITION)';
    stateDesc = 'NMOS Linear · PMOS Sat (Pull-Down)';
  } else {
    vtcRegion = 'REGION E (LOGIC 0 OUT)';
    stateDesc = 'Pull-Down Active · VOUT ≈ GND (PMOS OFF)';
  }

  var outDotClass = 'trans';
  if (vout >= 0.85) outDotClass = 'one';
  else if (vout <= 0.15) outDotClass = 'zero';

  return {
    vin: vin,
    vinText: vin.toFixed(2) + ' V',
    vout: vout,
    voutText: vout.toFixed(2) + ' V',
    nmosReg: nmosReg,
    pmosReg: pmosReg,
    idd: idd,
    vm: curve.vm,
    nmh: curve.nmh,
    nml: curve.nml,
    vthN: p.vthN,
    vthP: p.vthP,
    wp: p.Wp,
    wn: p.Wn,
    l: p.L,
    widthRatio: widthRatio,
    betaRatio: p.betaRatio,
    maxIdd: curve.maxIdd,
    stateDesc: stateDesc,
    vtcRegion: vtcRegion,
    outDotClass: outDotClass
  };
}
window.calcCmosState = calcCmosState;

function syncGeomUiControls() {
  var wpSl = document.getElementById('geom-wp-slider');
  var wnSl = document.getElementById('geom-wn-slider');
  var lSl = document.getElementById('geom-l-slider');
  var wpVal = document.getElementById('geom-wp-val');
  var wnVal = document.getElementById('geom-wn-val');
  var lVal = document.getElementById('geom-l-val');

  if (wpSl) wpSl.value = String(geomWp);
  if (wnSl) wnSl.value = String(geomWn);
  if (lSl) lSl.value = String(geomL);
  if (wpVal) wpVal.textContent = geomWp + ' nm';
  if (wnVal) wnVal.textContent = geomWn + ' nm';
  if (lVal) lVal.textContent = geomL + ' nm';

  var presetGroup = document.getElementById('geom-preset-group');
  if (presetGroup) {
    presetGroup.querySelectorAll('.geom-preset-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.geomPreset === activeGeomPreset);
    });
  }

  var vmBtn = document.querySelector('#region-preset-seg button[data-preset="vm"]');
  if (vmBtn) {
    var curve = getVtcCurveData(geomWp, geomWn, geomL);
    vmBtn.title = 'VIN = VM (' + curve.vm.toFixed(2) + 'V Live Switching Threshold)';
  }
}

function setCmosGeometry(Wp, Wn, L, presetName) {
  if (typeof Wp === 'number' && !isNaN(Wp)) geomWp = Math.max(60, Math.min(400, Math.round(Wp / 10) * 10));
  if (typeof Wn === 'number' && !isNaN(Wn)) geomWn = Math.max(60, Math.min(400, Math.round(Wn / 10) * 10));
  if (typeof L === 'number' && !isNaN(L)) geomL = Math.max(20, Math.min(200, Math.round(L / 2) * 2));

  if (presetName && CMOS_GEOM_PRESETS[presetName]) {
    activeGeomPreset = presetName;
  } else {
    activeGeomPreset = 'custom';
    Object.keys(CMOS_GEOM_PRESETS).forEach(function(k) {
      var pr = CMOS_GEOM_PRESETS[k];
      if (pr.Wp === geomWp && pr.Wn === geomWn && pr.L === geomL) {
        activeGeomPreset = k;
      }
    });
  }

  syncGeomUiControls();

  if (typeof window.updateCmosGeometry3D === 'function') {
    window.updateCmosGeometry3D(geomWp, geomWn, geomL);
  }
  applyLogicState();
}
window.setCmosGeometry = setCmosGeometry;

function setCmosGeometryPreset(name) {
  var pr = CMOS_GEOM_PRESETS[name] || CMOS_GEOM_PRESETS.balanced;
  setCmosGeometry(pr.Wp, pr.Wn, pr.L, CMOS_GEOM_PRESETS[name] ? name : 'balanced');
}
window.setCmosGeometryPreset = setCmosGeometryPreset;

function applyLogicState() {
  var st = calcCmosState(currentVin);
  window.currentIn = currentVin;

  if (typeof window.updateSchematicNodes === 'function') {
    window.updateSchematicNodes(st);
  }

  var bIn = document.getElementById('badge-in');
  var bOut = document.getElementById('badge-out');
  var bPmos = document.getElementById('badge-pmos');
  var bNmos = document.getElementById('badge-nmos');
  if (bIn) bIn.textContent = st.vin === 'off' ? 'OFF' : st.vin.toFixed(2) + 'V';
  if (bOut) bOut.textContent = st.voutText;
  if (bPmos) bPmos.textContent = st.pmosReg;
  if (bNmos) bNmos.textContent = st.nmosReg;

  var elVin = document.getElementById('iv-vin-readout');
  var elVout = document.getElementById('iv-vout-readout');
  var elVm = document.getElementById('iv-vm-readout');
  var elRatio = document.getElementById('iv-ratio-readout');
  var elNmh = document.getElementById('iv-nmh-readout');
  var elNml = document.getElementById('iv-nml-readout');
  var elIdd = document.getElementById('iv-idd-readout');
  var elNmos = document.getElementById('iv-nmos-reg-readout');
  var elPmos = document.getElementById('iv-pmos-reg-readout');
  var elDesc = document.getElementById('iv-state-desc');
  var elSliderVal = document.getElementById('vin-val');

  if (elVin) elVin.textContent = st.vinText;
  if (elVout) elVout.textContent = st.voutText;
  if (elVm) elVm.textContent = st.vm.toFixed(2) + ' V';
  if (elRatio) elRatio.textContent = st.widthRatio.toFixed(2) + ' (' + Math.round(st.Wp) + '/' + Math.round(st.Wn) + ')';
  if (elNmh) elNmh.textContent = st.nmh.toFixed(2) + ' V';
  if (elNml) elNml.textContent = st.nml.toFixed(2) + ' V';
  if (elIdd) elIdd.textContent = formatCurrentReadout(st.idd);
  if (elNmos) elNmos.textContent = st.nmosReg;
  if (elPmos) elPmos.textContent = st.pmosReg;
  if (elDesc) elDesc.textContent = st.stateDesc;
  if (elSliderVal) elSliderVal.textContent = st.vin === 'off' ? 'OFF' : st.vin.toFixed(2) + ' V';

  // Modal readouts sync
  var mVin = document.getElementById('iv-m-vin');
  var mVout = document.getElementById('iv-m-vout');
  var mVm = document.getElementById('iv-m-vm');
  var mRatio = document.getElementById('iv-m-ratio');
  var mNm = document.getElementById('iv-m-nm');
  var mNmos = document.getElementById('iv-m-nmos-reg');
  var mPmos = document.getElementById('iv-m-pmos-reg');
  if (mVin) mVin.textContent = st.vinText;
  if (mVout) mVout.textContent = st.voutText;
  if (mVm) mVm.textContent = st.vm.toFixed(2) + ' V';
  if (mRatio) mRatio.textContent = st.widthRatio.toFixed(2) + ' : 1';
  if (mNm) mNm.textContent = st.nmh.toFixed(2) + ' / ' + st.nml.toFixed(2) + ' V';
  if (mNmos) mNmos.textContent = st.nmosReg;
  if (mPmos) mPmos.textContent = st.pmosReg;

  // Voice assistant context sync
  var vaState = document.getElementById('va-ctx-state');
  if (vaState) {
    vaState.textContent = st.vin === 'off'
      ? 'IN=OFF (High-Z)'
      : ('IN=' + st.vin.toFixed(2) + 'V · OUT=' + st.vout.toFixed(2) + 'V · VM=' + st.vm.toFixed(2) + 'V');
  }

  var regSeg = document.getElementById('region-preset-seg');
  if (regSeg) {
    var btns = regSeg.querySelectorAll('button');
    btns.forEach(function(b) {
      var p = b.dataset.preset;
      var active = false;
      if (st.vin === 'off' && p === 'off') active = true;
      else if (st.vin !== 'off') {
        if (p === '0' && Math.abs(st.vin - 0.0) < 0.015) active = true;
        else if (p === 'vm' && Math.abs(st.vin - st.vm) < 0.02) active = true;
        else if (p === '1' && Math.abs(st.vin - 1.0) < 0.015) active = true;
      }
      b.classList.toggle('active', active);
    });
  }

  var vinSl = document.getElementById('vin-slider');
  if (vinSl && st.vin !== 'off') {
    vinSl.value = st.vin.toFixed(2);
  }

  var flowCap = document.getElementById('flow-caption');
  if (flowCap) {
    var tourActive = Boolean(window.isTourActive || (typeof isTourActive !== 'undefined' && isTourActive));
    if (tourActive) {
      flowCap.textContent = 'FABRICATION TOUR ACTIVE: Circuit Held Floating (High-Z).';
      flowCap.classList.add('visible');
    } else if (st.vin === 'off') {
      flowCap.textContent = 'INPUT FLOATING (HIGH-Z): Both channels quenched. Select 0 (GND), 1 (VDD), or sweep VIN.';
      flowCap.classList.add('visible');
    } else if (typeof flowMode !== 'undefined' && flowMode === 'off') {
      flowCap.textContent = 'CARRIER FLOW PAUSED: Select Carriers or Current in View Controls.';
      flowCap.classList.add('visible');
    } else if (st.vin < st.vthN) {
      flowCap.textContent = 'LOGIC LOW IN (VIN=' + st.vin.toFixed(2) + 'V): PMOS Pull-Up Channel ON -> OUT pulled to VDD (1.00V).';
      flowCap.classList.add('visible');
    } else if (st.vin > VDD - st.vthP) {
      flowCap.textContent = 'LOGIC HIGH IN (VIN=' + st.vin.toFixed(2) + 'V): NMOS Pull-Down Channel ON -> OUT pulled to GND (0.00V).';
      flowCap.classList.add('visible');
    } else {
      flowCap.textContent = 'TRANSITION REGION (VM=' + st.vm.toFixed(2) + 'V): Both PMOS & NMOS conducting — Shoot-through IDD = ' + formatCurrentReadout(st.idd) + '.';
      flowCap.classList.add('visible');
    }
  }

  // Update 3D Depletion Shells, Channel Pinch-off & Bulk Carriers
  if (typeof window.updateInverterDepletion === 'function') {
    window.updateInverterDepletion(st.vin, st.vout, st.nmosReg, st.pmosReg, st.vthN, st.vthP);
  }
  if (typeof window.updateInverterChannels === 'function') {
    window.updateInverterChannels(st.vin, st.vout, st.nmosReg, st.pmosReg, st.vthN, st.vthP);
  }
  if (typeof window.updateSubGateCarriers === 'function' && window.showSubstrateHoles) {
    window.updateSubGateCarriers(typeof performance !== 'undefined' ? performance.now() * 0.001 : 0);
  }

  // Color metal net accents cleanly based on active logic voltage
  if (typeof selectedMeshes !== 'undefined' && typeof groups !== 'undefined' && groups['metal']) {
    var colOut = st.vin === 'off' ? 0x64748b : (st.vout > 0.65 ? 0xf87171 : (st.vout < 0.35 ? 0x64748b : 0xfbbf24));
    var colIn = st.vin === 'off' ? 0x94a3b8 : (st.vin > 0.65 ? 0xe6c94a : (st.vin < 0.35 ? 0x60a5fa : 0xfbbf24));
    groups['metal'].children.forEach(function(m) {
      if (!m || !m.userData || !m.material || !m.material.color) return;
      if (selectedMeshes.indexOf(m) !== -1) return;
      if (m.userData.id === 'outSpine' || m.userData.id === 'outPin') {
        m.material.color.setHex(colOut);
      } else if (m.userData.id === 'inPin') {
        m.material.color.setHex(colIn);
      }
    });
  }

  renderSingleVtcGraph(st);
  if (isIvModalOpen) renderModalVtcGraph(st);
}
window.applyLogicState = applyLogicState;

function setVinState(val) {
  if (val === 'off' || val === null || val === undefined) {
    currentVin = 'off';
  } else {
    currentVin = Math.max(0.0, Math.min(VDD, Number(val)));
  }
  window.currentIn = currentVin;
  applyLogicState();
  if (typeof rebuildFlowCurves === 'function') rebuildFlowCurves();
}
window.setVinState = setVinState;

// =====================================================================
// VTC GRAPH RENDERING (Interactive Canvas + Expandable Modal, Zero Label Overlap)
// =====================================================================
function getGraphGeometry(w, h, isModal) {
  var padL = isModal ? 54 : 44;
  var padR = isModal ? 42 : 34;
  var padT = isModal ? 36 : 28;
  var padB = isModal ? 42 : 34;
  return {
    padL: padL,
    padR: padR,
    padT: padT,
    padB: padB,
    plotW: Math.max(40, w - padL - padR),
    plotH: Math.max(40, h - padT - padB)
  };
}

function drawVtcGraph(canvas, ctx, w, h, state, isModal) {
  if (!canvas || !ctx) return;
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var bg = isLight ? '#f8fafc' : '#080b0f';
  var gridCol = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.07)';
  var axisCol = isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.28)';
  var txtCol = isLight ? '#475569' : '#9aa6b6';
  var vtcCol = isLight ? '#0d9488' : '#34d399';
  var iddCol = isLight ? '#7c3aed' : '#c084fc';
  var vmCol = isLight ? '#d97706' : '#fbbf24';

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  var g = getGraphGeometry(w, h, isModal);
  var curve = getVtcCurveData(geomWp, geomWn, geomL);
  var fontMain = isModal ? '10.5px "IBM Plex Mono", monospace' : '9px "IBM Plex Mono", monospace';
  var fontBold = isModal ? 'bold 10.5px "IBM Plex Mono", monospace' : 'bold 9px "IBM Plex Mono", monospace';

  function xAt(v) { return g.padL + Math.max(0, Math.min(1, v)) * g.plotW; }
  function yAt(v) { return g.padT + (1.0 - Math.max(0, Math.min(1, v))) * g.plotH; }

  // Grid & Axes
  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1;
  var ticks = [0, 0.25, 0.50, 0.75, 1.00];
  ctx.font = fontMain;
  for (var t = 0; t < ticks.length; t++) {
    var tv = ticks[t];
    var gx = xAt(tv);
    var gy = yAt(tv);
    ctx.beginPath();
    ctx.moveTo(gx, g.padT);
    ctx.lineTo(gx, g.padT + g.plotH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(g.padL, gy);
    ctx.lineTo(g.padL + g.plotW, gy);
    ctx.stroke();

    // Clean non-overlapping X/Y major ticks (0.0, 0.5, 1.0)
    if (t % 2 === 0) {
      ctx.fillStyle = txtCol;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(tv.toFixed(1), gx, g.padT + g.plotH + 5);

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(tv.toFixed(1), g.padL - 5, gy);
    }
  }

  ctx.strokeStyle = axisCol;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(g.padL, g.padT, g.plotW, g.plotH);

  // Subtle VOUT = VIN diagonal reference (shows intersection at VM)
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = isLight ? 'rgba(100,116,139,0.28)' : 'rgba(148,163,184,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(xAt(0), yAt(0));
  ctx.lineTo(xAt(1), yAt(1));
  ctx.stroke();
  ctx.restore();

  // Shading for Noise Margin zones (NM_L & NM_H)
  ctx.save();
  ctx.fillStyle = isLight ? 'rgba(13,148,136,0.06)' : 'rgba(52,211,153,0.06)';
  ctx.fillRect(xAt(0), g.padT, Math.max(0, xAt(curve.vil) - xAt(0)), g.plotH);
  ctx.fillRect(xAt(curve.vih), g.padT, Math.max(0, xAt(1) - xAt(curve.vih)), g.plotH);
  ctx.restore();

  // Shoot-Through Current I_DD(V_IN) curve
  var pts = curve.points;
  var iddScale = curve.maxIdd;
  ctx.beginPath();
  for (var i = 0; i < pts.length; i++) {
    var pxI = xAt(pts[i].vin);
    var pyI = g.padT + g.plotH - (pts[i].idd / iddScale) * (g.plotH * 0.72);
    if (i === 0) ctx.moveTo(pxI, pyI);
    else ctx.lineTo(pxI, pyI);
  }
  ctx.strokeStyle = iddCol;
  ctx.lineWidth = isModal ? 2.0 : 1.6;
  ctx.stroke();

  // VTC Output Voltage V_OUT(V_IN) curve
  ctx.beginPath();
  for (var j = 0; j < pts.length; j++) {
    var pxV = xAt(pts[j].vin);
    var pyV = yAt(pts[j].vout);
    if (j === 0) ctx.moveTo(pxV, pyV);
    else ctx.lineTo(pxV, pyV);
  }
  ctx.strokeStyle = vtcCol;
  ctx.lineWidth = isModal ? 2.8 : 2.3;
  ctx.stroke();

  // Live Shifting Switching Threshold V_M Marker Line + Pill
  var xVm = xAt(curve.vm);
  var yVm = yAt(curve.vm);
  ctx.save();
  ctx.setLineDash([4, 3]);
  ctx.strokeStyle = vmCol;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(xVm, g.padT);
  ctx.lineTo(xVm, g.padT + g.plotH);
  ctx.stroke();
  ctx.restore();

  // Intersection ring at (VM, VM)
  ctx.beginPath();
  ctx.arc(xVm, yVm, isModal ? 4.5 : 3.5, 0, Math.PI * 2);
  ctx.strokeStyle = vmCol;
  ctx.lineWidth = 1.6;
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.stroke();

  // Clamped V_M pill in dedicated header slot (never collides with axes or curves)
  var vmText = 'VM=' + curve.vm.toFixed(2) + 'V';
  ctx.font = fontBold;
  var vmW = ctx.measureText(vmText).width + 8;
  var vmX = Math.max(g.padL + vmW * 0.5 + 2, Math.min(g.padL + g.plotW - vmW * 0.5 - 2, xVm));
  var vmY = g.padT - 13;
  ctx.fillStyle = isLight ? 'rgba(254, 243, 199, 0.96)' : 'rgba(120, 53, 15, 0.85)';
  ctx.strokeStyle = vmCol;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(vmX - vmW * 0.5, vmY - 7, vmW, 13);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = vmCol;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(vmText, vmX, vmY - 0.5);

  // Top Header Legends (strictly outside V_M pill & axes)
  ctx.font = fontMain;
  ctx.textBaseline = 'top';
  ctx.fillStyle = vtcCol;
  ctx.textAlign = 'left';
  ctx.fillText('VOUT(V)', 8, 6);

  ctx.fillStyle = iddCol;
  ctx.textAlign = 'right';
  ctx.fillText('IDD (' + formatCurrentReadout(iddScale) + ' pk)', w - 8, 6);

  // Axis Titles (safely below X-axis ticks and left of Y-axis ticks)
  ctx.fillStyle = txtCol;
  ctx.font = fontMain;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('VIN (V)', g.padL + g.plotW * 0.5, h - 4);

  ctx.save();
  ctx.translate(12, g.padT + g.plotH * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VOUT (V)', 0, 0);
  ctx.restore();

  // Active Operating Point Marker
  if (state && state.vin !== 'off') {
    var opX = xAt(state.vin);
    var opY = yAt(state.vout);

    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = isLight ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g.padL, opY);
    ctx.lineTo(opX, opY);
    ctx.lineTo(opX, g.padT + g.plotH);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(opX, opY, isModal ? 6.5 : 5, 0, Math.PI * 2);
    ctx.fillStyle = vmCol;
    ctx.fill();
    ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

var ivCanvas = document.getElementById('iv-canvas');
var ivCtx = ivCanvas ? ivCanvas.getContext('2d') : null;
var ivModalCanvas = document.getElementById('iv-modal-canvas');
var ivModalCtx = ivModalCanvas ? ivModalCanvas.getContext('2d') : null;

function renderSingleVtcGraph(st) {
  if (!ivCanvas || !ivCtx) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = ivCanvas.clientWidth || 310;
  var h = ivCanvas.clientHeight || 225;
  if (ivCanvas.width !== Math.round(w * dpr) || ivCanvas.height !== Math.round(h * dpr)) {
    ivCanvas.width = Math.round(w * dpr);
    ivCanvas.height = Math.round(h * dpr);
  }
  ivCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawVtcGraph(ivCanvas, ivCtx, w, h, st || calcCmosState(currentVin), false);
}

function renderModalVtcGraph(st) {
  if (!ivModalCanvas || !ivModalCtx) return;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = ivModalCanvas.clientWidth || 560;
  var h = ivModalCanvas.clientHeight || 380;
  if (ivModalCanvas.width !== Math.round(w * dpr) || ivModalCanvas.height !== Math.round(h * dpr)) {
    ivModalCanvas.width = Math.round(w * dpr);
    ivModalCanvas.height = Math.round(h * dpr);
  }
  ivModalCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawVtcGraph(ivModalCanvas, ivModalCtx, w, h, st || calcCmosState(currentVin), true);
}

// Interactive VTC Canvas Scrubbing
function attachVtcPointerScrub(canvas, isModal) {
  if (!canvas) return;
  var dragging = false;
  function updateFromEvent(e) {
    var rect = canvas.getBoundingClientRect();
    var w = rect.width || (isModal ? 560 : 310);
    var h = rect.height || (isModal ? 380 : 225);
    var g = getGraphGeometry(w, h, isModal);
    var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    var relX = (clientX - rect.left - g.padL) / Math.max(1, g.plotW);
    var vin = Math.max(0.0, Math.min(VDD, relX));
    setVinState(Math.round(vin * 100) / 100);
  }
  canvas.addEventListener('pointerdown', function(e) {
    dragging = true;
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    updateFromEvent(e);
  });
  canvas.addEventListener('pointermove', function(e) {
    if (!dragging) return;
    updateFromEvent(e);
  });
  canvas.addEventListener('pointerup', function() { dragging = false; });
  canvas.addEventListener('pointercancel', function() { dragging = false; });
}

// Expandable VTC Modal Management
var isIvModalOpen = false;
function openIvModal() {
  var backdrop = document.getElementById('iv-modal-backdrop');
  if (!backdrop) return;
  isIvModalOpen = true;
  backdrop.style.display = 'flex';
  renderModalVtcGraph(calcCmosState(currentVin));
}
window.openIvModal = openIvModal;

function closeIvModal() {
  var backdrop = document.getElementById('iv-modal-backdrop');
  if (!backdrop) return;
  isIvModalOpen = false;
  backdrop.style.display = 'none';
}
window.closeIvModal = closeIvModal;

function initLogicStateControls() {
  var regSeg = document.getElementById('region-preset-seg');
  if (regSeg) {
    regSeg.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var p = btn.dataset.preset;
        if (p === 'off') setVinState('off');
        else if (p === '0') setVinState(0.00);
        else if (p === '1') setVinState(1.00);
        else if (p === 'vm') {
          var curve = getVtcCurveData(geomWp, geomWn, geomL);
          setVinState(Math.round(curve.vm * 100) / 100);
        }
      });
    });
  }

  var vinSl = document.getElementById('vin-slider');
  if (vinSl) {
    vinSl.addEventListener('input', function() {
      setVinState(parseFloat(vinSl.value));
    });
  }

  var wpSl = document.getElementById('geom-wp-slider');
  var wnSl = document.getElementById('geom-wn-slider');
  var lSl = document.getElementById('geom-l-slider');
  if (wpSl) wpSl.addEventListener('input', function() { setCmosGeometry(parseFloat(wpSl.value), geomWn, geomL); });
  if (wnSl) wnSl.addEventListener('input', function() { setCmosGeometry(geomWp, parseFloat(wnSl.value), geomL); });
  if (lSl) lSl.addEventListener('input', function() { setCmosGeometry(geomWp, geomWn, parseFloat(lSl.value)); });

  var presetGroup = document.getElementById('geom-preset-group');
  if (presetGroup) {
    presetGroup.querySelectorAll('.geom-preset-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setCmosGeometryPreset(btn.dataset.geomPreset);
      });
    });
  }

  attachVtcPointerScrub(ivCanvas, false);
  attachVtcPointerScrub(ivModalCanvas, true);

  var expandBtn = document.getElementById('iv-expand-btn');
  var closeBtn = document.getElementById('iv-modal-close');
  var backdrop = document.getElementById('iv-modal-backdrop');
  if (expandBtn) expandBtn.addEventListener('click', openIvModal);
  if (closeBtn) closeBtn.addEventListener('click', closeIvModal);
  if (backdrop) {
    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closeIvModal();
    });
  }
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isIvModalOpen) closeIvModal();
  });

  if (typeof ResizeObserver !== 'undefined') {
    if (ivCanvas) {
      new ResizeObserver(function() { renderSingleVtcGraph(calcCmosState(currentVin)); }).observe(ivCanvas);
    }
    if (ivModalCanvas) {
      new ResizeObserver(function() { if (isIvModalOpen) renderModalVtcGraph(calcCmosState(currentVin)); }).observe(ivModalCanvas);
    }
  }

  // Register uniform green Parameter Info Modals
  if (typeof window.SiliconParamInfoModal !== 'undefined' && window.SiliconParamInfoModal.register) {
    window.SiliconParamInfoModal.register({
      vin: {
        title: 'Input Bias Voltage (VIN)',
        param: 'VIN [0.00 V – 1.00 V] or OFF (High-Z)',
        formula: 'VGS,n = VIN ,   VSG,p = VDD − VIN',
        increase: 'Turns on the N-Well/P-Well NMOS pull-down channel while turning off the PMOS pull-up channel, pulling VOUT down toward 0 V.',
        decrease: 'Turns off NMOS and strengthens PMOS hole inversion inside the N-Well, pulling VOUT up toward VDD (1.00 V).',
        explanation: 'Drives both the PMOS and NMOS gates simultaneously through the shared polysilicon strip.',
        tradeoff: 'Near the switching threshold VM, both transistors saturate concurrently, causing transient shoot-through current IDD between VDD and GND.',
        theorySection: 'inv-vtc'
      },
      geomWp: {
        title: 'PMOS Channel Width (Wp)',
        param: 'Wp [60 nm – 400 nm]',
        formula: 'βp = μp · Cox · (Wp / L) ,   VM rises with √(βp / βn)',
        increase: 'Widens the PMOS pull-up active finger and channel Z-span, increasing βp and shifting the VTC switching threshold VM rightward toward VDD.',
        decrease: 'Narrows PMOS pull-up drive relative to NMOS, shifting VM leftward toward GND and shrinking Noise Margin High (NMH).',
        explanation: 'Since holes have ~2× lower mobility than electrons (μn ≈ 2.0 μp), Wp must exceed Wn (~2:1) for symmetric pull-up and pull-down strength.',
        tradeoff: 'Larger Wp balances rising/falling propagation delays and centers VM, at the cost of higher gate/diffusion capacitance and silicon cell area.',
        theorySection: 'inv-sizing'
      },
      geomWn: {
        title: 'NMOS Channel Width (Wn)',
        param: 'Wn [60 nm – 400 nm]',
        formula: 'βn = μn · Cox · (Wn / L) ,   NML shrinks as βn dominates βp',
        increase: 'Widens the NMOS pull-down channel, making the pull-down network stronger and shifting switching threshold VM leftward toward GND.',
        decrease: 'Reduces NMOS pull-down current relative to PMOS, shifting VM rightward toward VDD and raising low-to-high noise immunity NML.',
        explanation: 'Controls the effective resistance of the NMOS sink path from OUT to GND inside the P-Well.',
        tradeoff: 'Increasing Wn speeds up high-to-low (tPHL) transitions but skews VM left unless Wp scales proportionally.',
        theorySection: 'inv-sizing'
      },
      geomL: {
        title: 'Shared Channel Length (L)',
        param: 'L [20 nm – 200 nm]',
        formula: 'β ∝ 1/L ,   VTH(L) = VTH0 − ΔVSCE(L) ,   λ ∝ 1/L',
        increase: 'Extends both polysilicon gate footprints and active spacing, suppressing VTH roll-off and lowering λ for a sharper, higher-gain VTC transition.',
        decrease: 'Boosts drive current and reduces intrinsic gate area, but introduces stronger channel-length modulation (λ) and short-channel |VTH| roll-off.',
        explanation: 'Sets the shared physical channel length along the X-axis between Source and Drain SDE junctions for both PMOS and NMOS.',
        tradeoff: 'Shorter L improves switching speed and peak drive at the expense of static leakage, lower transition voltage gain, and wider shoot-through transition.',
        theorySection: 'inv-sizing'
      }
    }, {
      onNavigateTheory: function(sectionId) {
        var btnTheory = document.querySelector('#mode-seg button[data-mode="theory"]');
        if (btnTheory) btnTheory.click();
        else if (typeof setViewMode === 'function') setViewMode('theory');
        if (sectionId) {
          setTimeout(function() {
            var sec = document.getElementById(sectionId);
            if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }
      }
    });
  }

  syncGeomUiControls();
}
window.initLogicStateControls = initLogicStateControls;
initLogicStateControls();
