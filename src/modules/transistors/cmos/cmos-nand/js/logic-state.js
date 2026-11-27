/**
 * logic-state.js - CMOS NAND2 Electrical Physics, Geometry Scaling & Live VTC
 * - Coupled Wp (60-400 nm), Wn (60-400 nm), and L (20-200 nm) model with
 *   mu_n = 2.0 * mu_p, series-NMOS stacking (beta_n,eff = beta_n / 2), internal node Vx,
 *   MN2 body effect, SCE |VTH| roll-off, velocity saturation, and lambda proportional to 1/L.
 * - Live KCL intersection solver computing V_OUT(VA, VB), Vx, V_M, NM_H, NM_L, and I_DD.
 * - Uniform green SiliconParamInfoModal explanations for VA, VB, Wp, Wn, and L.
 */

var currentA = 'off';
var currentB = 'off';
var currentSweep = 'va'; // 'va' | 'vb' | 'both'
var isCircuitFrozen = true;

var VDD = 1.00;
var MU_N_TO_P_RATIO = 2.00;

var NAND_GEOM_PRESETS = {
  balanced: { Wp: 240, Wn: 240, L: 28 },
  minarea:  { Wp: 120, Wn: 120, L: 28 },
  strongpd: { Wp: 180, Wn: 360, L: 28 }
};

var geomWp = 240; // nm [60..400]
var geomWn = 240; // nm [60..400]
var geomL  = 28;  // nm [20..200]
var activeGeomPreset = 'balanced';

function getNandGeomState() {
  return {
    Wp: geomWp,
    Wn: geomWn,
    L: geomL,
    preset: activeGeomPreset,
    widthRatio: geomWp / Math.max(1, geomWn),
    betaEffRatio: geomWp / Math.max(1, geomWn) // (kp*Wp/L) / (0.5*kn*Wn/L) = Wp / Wn for mu_n = 2*mu_p
  };
}
window.getNandGeomState = getNandGeomState;

function computeNandDeviceParams(Wp, Wn, L) {
  var sceRoll = 0.08 * Math.exp(-Math.max(0, L - 20.0) / 26.0);
  var vthN = 0.36 - sceRoll; // ~0.301 V at L=28 nm, ~0.360 V at L=200 nm
  var vthP = 0.36 - sceRoll;
  var lam = 0.015 + 0.085 * (28.0 / Math.max(20, L));
  var eSat = 0.018;
  var vCrit = eSat * L;

  var kpN = 0.36;
  var kpP = kpN / MU_N_TO_P_RATIO; // 0.18
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
    betaP: kP,
    betaNeff: 0.5 * kN,
    betaRatio: kP / Math.max(1e-9, 0.5 * kN)
  };
}

function evalNandFetCurrent(vgs, vth, k, vds, lam, vCrit) {
  var vd = Math.max(0, vds);
  var vt = 0.026;
  var ovRaw = vgs - vth;
  var arg = ovRaw / vt;
  var vov = arg > 24 ? ovRaw : vt * Math.log(1 + Math.exp(arg));

  var vdsat = (vov * vCrit) / Math.max(1e-6, vov + vCrit);
  var veff = Math.min(vd, vdsat);
  var driftDenom = 1.0 + veff / Math.max(1e-4, vCrit);
  var iDrift = k * ((vov * veff - 0.5 * veff * veff) / driftDenom) * (1.0 + lam * vd);
  var iLeak = k * 1.5e-5 * Math.exp(Math.max(-20, Math.min(2, ovRaw / 0.045))) * (1.0 - Math.exp(-vd / 0.026)) * (1.0 + lam * vd);
  return iDrift + iLeak;
}

// Self-consistent intermediate node Vx solve for MN1 (bottom) and MN2 (top) in series
function solveNmosSeriesStack(va, vb, vout, p) {
  var lo = 0.0;
  var hi = Math.max(0.0, vout);
  for (var iter = 0; iter < 22; iter++) {
    var mid = 0.5 * (lo + hi);
    var vthN2 = p.vthN + 0.06 * (Math.sqrt(0.70 + mid) - Math.sqrt(0.70)); // subtle body effect
    var i1 = evalNandFetCurrent(va, p.vthN, p.kN, mid, p.lambda, p.vCrit);
    var i2 = evalNandFetCurrent(vb - mid, vthN2, p.kN, vout - mid, p.lambda, p.vCrit);
    if (i1 > i2) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  var vx = 0.5 * (lo + hi);
  var vthN2Final = p.vthN + 0.06 * (Math.sqrt(0.70 + vx) - Math.sqrt(0.70));
  var i1f = evalNandFetCurrent(va, p.vthN, p.kN, vx, p.lambda, p.vCrit);
  var i2f = evalNandFetCurrent(vb - vx, vthN2Final, p.kN, vout - vx, p.lambda, p.vCrit);
  return { vx: vx, id: 0.5 * (i1f + i2f), vthN2: vthN2Final };
}

function solveNand2KCL(va, vb, p) {
  var a = Math.max(0.0, Math.min(VDD, va));
  var b = Math.max(0.0, Math.min(VDD, vb));
  var lo = 0.0;
  var hi = VDD;
  for (var iter = 0; iter < 30; iter++) {
    var mid = 0.5 * (lo + hi);
    var iPu = evalNandFetCurrent(VDD - a, p.vthP, p.kP, VDD - mid, p.lambda, p.vCrit) +
              evalNandFetCurrent(VDD - b, p.vthP, p.kP, VDD - mid, p.lambda, p.vCrit);
    var series = solveNmosSeriesStack(a, b, mid, p);
    if (series.id > iPu) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  var vout = 0.5 * (lo + hi);
  var iPuF = evalNandFetCurrent(VDD - a, p.vthP, p.kP, VDD - vout, p.lambda, p.vCrit) +
             evalNandFetCurrent(VDD - b, p.vthP, p.kP, VDD - vout, p.lambda, p.vCrit);
  var seriesF = solveNmosSeriesStack(a, b, vout, p);
  return {
    vout: vout,
    vx: seriesF.vx,
    vthN2: seriesF.vthN2,
    idd: 0.5 * (iPuF + seriesF.id)
  };
}

function formatCurrentReadout(iddMa) {
  if (iddMa >= 0.0995) return iddMa.toFixed(2) + ' mA';
  var uA = iddMa * 1000.0;
  return (uA < 10 ? uA.toFixed(1) : Math.round(uA)) + ' µA';
}

/* Analytical & KCL NAND2 Voltage Transfer Characteristic function (VDD = 1.00V) */
function calcNandVout(va, vb) {
  if (va === 'off' || vb === 'off') return null;
  var p = computeNandDeviceParams(geomWp, geomWn, geomL);
  return solveNand2KCL(Number(va), Number(vb), p).vout;
}
window.calcNandVout = calcNandVout;

var _cachedSweepKey = '';
var _cachedSweepData = null;

function getNandSweepData(sweepMode, fixedA, fixedB) {
  var p = computeNandDeviceParams(geomWp, geomWn, geomL);
  var refOther = sweepMode === 'va'
    ? (fixedB === 'off' ? 1.0 : Number(fixedB))
    : (sweepMode === 'vb' ? (fixedA === 'off' ? 1.0 : Number(fixedA)) : 1.0);
  var key = [geomWp, geomWn, geomL, sweepMode, refOther.toFixed(2)].join('|');
  if (_cachedSweepData && _cachedSweepKey === key) return _cachedSweepData;

  var N = 100;
  var pts = [];
  var maxIdd = 0;

  for (var i = 0; i <= N; i++) {
    var vin = i / N;
    var va = sweepMode === 'va' ? vin : (sweepMode === 'both' ? vin : refOther);
    var vb = sweepMode === 'vb' ? vin : (sweepMode === 'both' ? vin : refOther);
    var sol = solveNand2KCL(va, vb, p);
    if (sol.idd > maxIdd) maxIdd = sol.idd;
    pts.push({ vin: vin, vout: sol.vout, idd: sol.idd, vx: sol.vx });
  }

  var isInverting = sweepMode === 'both' || refOther >= 0.45;
  var vm = (p.vthN + p.betaRatio > 0)
    ? (p.vthN + Math.sqrt(p.betaRatio) * (VDD - p.vthP)) / (1.0 + Math.sqrt(p.betaRatio))
    : 0.50;

  for (var j = 1; j < pts.length; j++) {
    var d0 = pts[j - 1].vout - pts[j - 1].vin;
    var d1 = pts[j].vout - pts[j].vin;
    if (d0 >= 0 && d1 <= 0) {
      var fr = d0 / Math.max(1e-9, d0 - d1);
      vm = pts[j - 1].vin + fr * (pts[j].vin - pts[j - 1].vin);
      break;
    }
  }

  var slopes = [];
  for (var k = 0; k <= N; k++) {
    var k0 = Math.max(0, k - 1);
    var k1 = Math.min(N, k + 1);
    slopes.push((pts[k1].vout - pts[k0].vout) / Math.max(1e-5, pts[k1].vin - pts[k0].vin));
  }

  var vil = p.vthN;
  var vih = VDD - p.vthP;
  if (isInverting) {
    for (var li = 1; li < N; li++) {
      if (pts[li].vin <= vm && slopes[li] <= -1.0) {
        var s0 = slopes[li - 1], s1 = slopes[li];
        var tL = s1 < s0 ? Math.max(0, Math.min(1, (-1.0 - s0) / (s1 - s0))) : 0.5;
        vil = pts[li - 1].vin + tL * (pts[li].vin - pts[li - 1].vin);
        break;
      }
    }
    for (var ri = N - 1; ri >= 1; ri--) {
      if (pts[ri].vin >= vm && slopes[ri] <= -1.0) {
        var r0 = slopes[ri], r1 = slopes[ri + 1];
        var tR = r1 > r0 ? Math.max(0, Math.min(1, (-1.0 - r0) / (r1 - r0))) : 0.5;
        vih = pts[ri].vin + tR * (pts[ri + 1].vin - pts[ri].vin);
        break;
      }
    }
  }

  var voh = pts[0].vout;
  var vol = pts[N].vout;
  var nml = isInverting ? Math.max(0, vil - vol) : 0.41;
  var nmh = isInverting ? Math.max(0, voh - vih) : 0.41;

  _cachedSweepKey = key;
  _cachedSweepData = {
    params: p,
    points: pts,
    maxIdd: Math.max(0.005, maxIdd),
    isInverting: isInverting,
    vm: vm,
    vil: vil,
    vih: vih,
    voh: voh,
    vol: vol,
    nmh: nmh,
    nml: nml
  };
  return _cachedSweepData;
}

function computeTransistorRegions(va, vb, vout, optSol) {
  var p = computeNandDeviceParams(geomWp, geomWn, geomL);
  if (va === 'off' || vb === 'off' || vout === null) {
    return { mp1: 'SUBTHRESHOLD', mp2: 'SUBTHRESHOLD', mn1: 'SUBTHRESHOLD', mn2: 'SUBTHRESHOLD', vx: 0.5, vthN: p.vthN, vthP: p.vthP };
  }

  var sol = optSol || solveNand2KCL(Number(va), Number(vb), p);
  var vx = sol.vx;
  var vsdP = VDD - vout;

  var vsg1 = VDD - va;
  var mp1 = (vsg1 < p.vthP - 0.06) ? 'CUTOFF' : (vsg1 < p.vthP ? 'SUBTHRESHOLD' : (vsdP < (vsg1 - p.vthP) ? 'LINEAR' : 'SATURATION'));

  var vsg2 = VDD - vb;
  var mp2 = (vsg2 < p.vthP - 0.06) ? 'CUTOFF' : (vsg2 < p.vthP ? 'SUBTHRESHOLD' : (vsdP < (vsg2 - p.vthP) ? 'LINEAR' : 'SATURATION'));

  var mn1 = (va < p.vthN - 0.06) ? 'CUTOFF' : (va < p.vthN ? 'SUBTHRESHOLD' : (vx < (va - p.vthN) ? 'LINEAR' : 'SATURATION'));

  var vgs2 = vb - vx;
  var vds2 = Math.max(0, vout - vx);
  var vthN2 = sol.vthN2 || p.vthN;
  var mn2 = (vgs2 < vthN2 - 0.06) ? 'CUTOFF' : (vgs2 < vthN2 ? 'SUBTHRESHOLD' : (vds2 < (vgs2 - vthN2) ? 'LINEAR' : 'SATURATION'));

  return { mp1: mp1, mp2: mp2, mn1: mn1, mn2: mn2, vx: vx, vthN: p.vthN, vthP: p.vthP };
}
window.computeTransistorRegions = computeTransistorRegions;

function computeNand2State(a, b) {
  var p = computeNandDeviceParams(geomWp, geomWn, geomL);
  var sweepData = getNandSweepData(currentSweep, a, b);
  var frozen = (a === 'off' || b === 'off');

  if (frozen) {
    return {
      a: a,
      b: b,
      frozen: true,
      vout: null,
      out: 'HIGH-Z',
      mp1: false,
      mp2: false,
      mn1: false,
      mn2: false,
      idd: 0.0,
      vm: sweepData.vm,
      nmh: sweepData.nmh,
      nml: sweepData.nml,
      vthN: p.vthN,
      vthP: p.vthP,
      wp: p.Wp,
      wn: p.Wn,
      l: p.L,
      widthRatio: p.Wp / Math.max(1, p.Wn),
      betaEffRatio: p.betaRatio,
      regions: { mp1: 'SUBTHRESHOLD', mp2: 'SUBTHRESHOLD', mn1: 'SUBTHRESHOLD', mn2: 'SUBTHRESHOLD', vx: 0.5, vthN: p.vthN, vthP: p.vthP }
    };
  }

  var va = Number(a);
  var vb = Number(b);
  var sol = solveNand2KCL(va, vb, p);
  var regions = computeTransistorRegions(va, vb, sol.vout, sol);

  return {
    a: va,
    b: vb,
    frozen: false,
    vout: sol.vout,
    out: sol.vout >= 0.70 ? 1 : (sol.vout <= 0.30 ? 0 : 'TRANS'),
    mp1: regions.mp1 !== 'CUTOFF' && regions.mp1 !== 'SUBTHRESHOLD',
    mp2: regions.mp2 !== 'CUTOFF' && regions.mp2 !== 'SUBTHRESHOLD',
    mn1: regions.mn1 !== 'CUTOFF' && regions.mn1 !== 'SUBTHRESHOLD',
    mn2: regions.mn2 !== 'CUTOFF' && regions.mn2 !== 'SUBTHRESHOLD',
    idd: sol.idd,
    vm: sweepData.vm,
    nmh: sweepData.nmh,
    nml: sweepData.nml,
    vthN: p.vthN,
    vthP: p.vthP,
    wp: p.Wp,
    wn: p.Wn,
    l: p.L,
    widthRatio: p.Wp / Math.max(1, p.Wn),
    betaEffRatio: p.betaRatio,
    regions: regions
  };
}
window.computeNand2State = computeNand2State;

function getCircuitStateSnapshot() {
  var st = computeNand2State(currentA, currentB);
  return {
    inputA: st.a,
    inputB: st.b,
    vout: st.vout === null ? 'HIGH-Z' : st.vout.toFixed(2) + 'V',
    outputLogic: st.out,
    Wp: st.wp + 'nm',
    Wn: st.wn + 'nm',
    L: st.l + 'nm',
    vm: st.vm.toFixed(2) + 'V',
    regions: st.regions
  };
}
window.getCircuitStateSnapshot = getCircuitStateSnapshot;

function setOnOffTint(meshId, stateVal) {
  var list = meshesById[meshId];
  if (!list) return;
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (!m || !m.material) continue;
    if (typeof selectedMeshes !== 'undefined' && selectedMeshes.indexOf(m) !== -1) continue;

    if (m.userData.colorVar && typeof resolveNandCanonProp === 'function') {
      var cProp = resolveNandCanonProp(m.userData.colorVar);
      if (cProp && m.material.color) {
        m.material.color.set(cProp.color);
      }
      if (m.userData.coreMesh && m.userData.coreMesh.material && m.userData.coreMesh.material.color && cProp) {
        m.userData.coreMesh.material.color.set(cProp.color);
      }
    }

    if (!m.material.emissive) continue;
    if (stateVal === true) {
      var isP = meshId.indexOf('pmos') === 0;
      m.material.emissive.setHex(isP ? 0x0ea5e9 : 0x22c55e);
      m.material.emissiveIntensity = 0.25;
      m.userData.baseEmissive = isP ? 0x0ea5e9 : 0x22c55e;
      m.userData.baseEmissiveIntensity = 0.25;
    } else {
      m.material.emissive.setHex(0x000000);
      m.material.emissiveIntensity = 0;
      m.userData.baseEmissive = 0x000000;
      m.userData.baseEmissiveIntensity = 0;
    }
  }
}

function setMetalPulsing(idsMap) {
  for (var i = 0; i < allMeshes.length; i++) {
    var m = allMeshes[i];
    if (!m.userData || m.userData.layer !== 'metal') continue;
    var id = m.userData.id;
    m.userData.pulsing = Boolean(idsMap[id]);
  }
}

function applyLogicTint() {
  var s = computeNand2State(currentA, currentB);
  isCircuitFrozen = s.frozen;

  if (typeof updateSchematicVisuals === 'function') {
    updateSchematicVisuals(s);
  }

  if (s.frozen) {
    ['pmosASrc', 'pmosBSrc', 'pmosSharedDrn', 'nmosASrc', 'nmosMidNode', 'nmosBDrn'].forEach(function(id) {
      setOnOffTint(id, false);
    });
    setMetalPulsing({});
  } else {
    var isZeroOut = s.vout <= 0.30;
    var isOneOut = s.vout >= 0.70;
    setOnOffTint('pmosASrc', s.mp1);
    setOnOffTint('pmosBSrc', s.mp2);
    setOnOffTint('pmosSharedDrn', s.mp1 || s.mp2);
    setOnOffTint('nmosASrc', s.mn1 && s.mn2);
    setOnOffTint('nmosMidNode', s.mn1 || s.mn2);
    setOnOffTint('nmosBDrn', s.mn1 && s.mn2);

    var pulseIds = {};
    if (s.mp1) { pulseIds.vddStubPmosA = true; pulseIds.outPmosBranch = true; }
    if (s.mp2) { pulseIds.vddStubPmosB = true; pulseIds.outPmosBranch = true; }
    if (s.mp1 || s.mp2) { pulseIds.vddRail = true; pulseIds.outSpine = true; pulseIds.outPin = true; }
    if (s.mn1 && s.mn2) {
      pulseIds.outNmosBranch = true; pulseIds.outSpine = true; pulseIds.outPin = true;
      pulseIds.gndStubNmosA = true; pulseIds.gndRail = true;
    }
    if (isOneOut) pulseIds.outPin = true;
    if (isZeroOut) pulseIds.gndRail = true;
    setMetalPulsing(pulseIds);
  }

  if (typeof window.updateNandChannels === 'function') {
    window.updateNandChannels(s);
  }
  if (typeof window.updateSubGateCarriers === 'function' && window.showSubstrateHoles) {
    window.updateSubGateCarriers(typeof performance !== 'undefined' ? performance.now() * 0.001 : 0);
  }
  if (typeof rebuildFlowCurves === 'function') {
    rebuildFlowCurves();
  }

  updateTelemetryAndUi(s);
}
window.applyLogicTint = applyLogicTint;

function updateTelemetryAndUi(optState) {
  var s = optState || computeNand2State(currentA, currentB);

  var aBtns = document.querySelectorAll('#input-a-group button[data-a], #input-a-group .seg-btn[data-a]');
  for (var i = 0; i < aBtns.length; i++) {
    var vaAttr = aBtns[i].getAttribute('data-a');
    aBtns[i].classList.toggle('active',
      (vaAttr === 'off' && currentA === 'off') ||
      (vaAttr === '0' && currentA === 0) ||
      (vaAttr === '1' && currentA === 1)
    );
  }

  var bBtns = document.querySelectorAll('#input-b-group button[data-b], #input-b-group .seg-btn[data-b]');
  for (var j = 0; j < bBtns.length; j++) {
    var vbAttr = bBtns[j].getAttribute('data-b');
    bBtns[j].classList.toggle('active',
      (vbAttr === 'off' && currentB === 'off') ||
      (vbAttr === '0' && currentB === 0) ||
      (vbAttr === '1' && currentB === 1)
    );
  }

  var vaSlider = document.getElementById('va-slider');
  var vbSlider = document.getElementById('vb-slider');
  var vaVal = document.getElementById('va-val');
  var vbVal = document.getElementById('vb-val');
  if (vaSlider && currentA !== 'off') vaSlider.value = Number(currentA).toFixed(2);
  if (vbSlider && currentB !== 'off') vbSlider.value = Number(currentB).toFixed(2);
  if (vaVal) vaVal.textContent = currentA === 'off' ? 'OFF' : Number(currentA).toFixed(2) + ' V';
  if (vbVal) vbVal.textContent = currentB === 'off' ? 'OFF' : Number(currentB).toFixed(2) + ' V';

  var presetBtns = document.querySelectorAll('#nand-preset-seg .dp-preset-btn');
  presetBtns.forEach(function(btn) {
    var p = btn.getAttribute('data-preset');
    var active = false;
    if (p === 'off') active = (currentA === 'off' || currentB === 'off');
    else if (p === '00') active = (currentA === 0 && currentB === 0);
    else if (p === '01') active = (currentA === 0 && currentB === 1);
    else if (p === '10') active = (currentA === 1 && currentB === 0);
    else if (p === '11') active = (currentA === 1 && currentB === 1);
    else if (p === 'vm') active = (currentA !== 'off' && currentB !== 'off' && Math.abs(currentA - s.vm) < 0.03);
    btn.classList.toggle('active', active);
  });

  var vaReadout = document.getElementById('iv-va-readout');
  var vbReadout = document.getElementById('iv-vb-readout');
  var voutReadout = document.getElementById('iv-vout-readout');
  var vmReadout = document.getElementById('iv-vm-readout');
  var ratioReadout = document.getElementById('iv-ratio-readout');
  var logicReadout = document.getElementById('iv-logic-readout');
  var nmhReadout = document.getElementById('iv-nmh-readout');
  var nmlReadout = document.getElementById('iv-nml-readout');
  var iddReadout = document.getElementById('iv-idd-readout');
  var stateDesc = document.getElementById('iv-state-desc');

  if (vaReadout) vaReadout.textContent = currentA === 'off' ? 'OFF' : Number(currentA).toFixed(2) + ' V';
  if (vbReadout) vbReadout.textContent = currentB === 'off' ? 'OFF' : Number(currentB).toFixed(2) + ' V';
  if (vmReadout) vmReadout.textContent = s.vm.toFixed(2) + ' V';
  if (ratioReadout) ratioReadout.textContent = s.widthRatio.toFixed(2) + ' (' + Math.round(s.wp) + '/' + Math.round(s.wn) + ')';
  if (nmhReadout) nmhReadout.textContent = s.nmh.toFixed(2) + ' V';
  if (nmlReadout) nmlReadout.textContent = s.nml.toFixed(2) + ' V';
  if (iddReadout) iddReadout.textContent = s.frozen ? '0.0 µA' : formatCurrentReadout(s.idd);

  if (s.frozen) {
    if (voutReadout) voutReadout.textContent = 'FLOATING';
    if (logicReadout) { logicReadout.textContent = 'HIGH-Z'; logicReadout.style.color = ''; }
    if (stateDesc) stateDesc.textContent = 'Inputs Floating · High-Z Output (Stationary Flow)';
  } else {
    var voutVal = s.vout;
    if (voutReadout) voutReadout.textContent = voutVal.toFixed(2) + ' V';

    if (voutVal >= 0.70) {
      if (logicReadout) { logicReadout.textContent = '1 (HIGH)'; logicReadout.style.color = 'var(--cyan)'; }
      if (stateDesc) {
        stateDesc.textContent = (currentA <= s.vthN && currentB <= s.vthN)
          ? 'Pull-Up Parallel: Both MP1 & MP2 Conduct'
          : (currentA <= s.vthN ? 'Pull-Up MP1 Conducts (VA LOW)' : 'Pull-Up MP2 Conducts (VB LOW)');
      }
    } else if (voutVal <= 0.30) {
      if (logicReadout) { logicReadout.textContent = '0 (LOW)'; logicReadout.style.color = 'var(--gold)'; }
      if (stateDesc) stateDesc.textContent = 'Pull-Down Series: Both MN1 & MN2 Conduct to GND';
    } else {
      if (logicReadout) { logicReadout.textContent = 'TRANSITION'; logicReadout.style.color = 'var(--amber)'; }
      if (stateDesc) stateDesc.textContent = 'Switching Transition Region (VM = ' + s.vm.toFixed(2) + 'V · Vx = ' + s.regions.vx.toFixed(2) + 'V)';
    }
  }

  function colorRegion(el, reg) {
    if (!el) return;
    el.textContent = reg;
    if (reg === 'LINEAR') el.style.color = 'var(--cyan)';
    else if (reg === 'SATURATION') el.style.color = 'var(--amber)';
    else if (reg === 'CUTOFF') el.style.color = 'var(--coral)';
    else el.style.color = 'var(--muted)';
  }

  colorRegion(document.getElementById('tx-mp1-reg'), s.regions.mp1);
  colorRegion(document.getElementById('tx-mp2-reg'), s.regions.mp2);
  colorRegion(document.getElementById('tx-mn1-reg'), s.regions.mn1);
  colorRegion(document.getElementById('tx-mn2-reg'), s.regions.mn2);

  // Sync Modal readouts
  var mVa = document.getElementById('iv-m-va');
  var mVb = document.getElementById('iv-m-vb');
  var mVout = document.getElementById('iv-m-vout');
  var mVm = document.getElementById('iv-m-vm');
  var mRatio = document.getElementById('iv-m-ratio');
  var mNm = document.getElementById('iv-m-nm');
  var mState = document.getElementById('iv-m-state');
  if (mVa) mVa.textContent = currentA === 'off' ? 'OFF' : Number(currentA).toFixed(2) + ' V';
  if (mVb) mVb.textContent = currentB === 'off' ? 'OFF' : Number(currentB).toFixed(2) + ' V';
  if (mVout) mVout.textContent = s.frozen ? 'FLOATING' : s.vout.toFixed(2) + ' V';
  if (mVm) mVm.textContent = s.vm.toFixed(2) + ' V';
  if (mRatio) mRatio.textContent = s.widthRatio.toFixed(2) + ' : 1';
  if (mNm) mNm.textContent = s.nmh.toFixed(2) + ' / ' + s.nml.toFixed(2) + ' V';
  if (mState) mState.textContent = s.frozen ? 'HIGH-Z' : (s.vout >= 0.7 ? '1 (VDD)' : (s.vout <= 0.3 ? '0 (GND)' : 'TRANS'));

  colorRegion(document.getElementById('iv-m-mp1'), s.regions.mp1);
  colorRegion(document.getElementById('iv-m-mp2'), s.regions.mp2);
  colorRegion(document.getElementById('iv-m-mn1'), s.regions.mn1);
  colorRegion(document.getElementById('iv-m-mn2'), s.regions.mn2);

  var vaState = document.getElementById('va-ctx-state');
  if (vaState) {
    vaState.textContent = s.frozen
      ? 'A=OFF B=OFF (High-Z)'
      : ('A=' + Number(currentA).toFixed(2) + 'V B=' + Number(currentB).toFixed(2) + 'V · OUT=' + s.vout.toFixed(2) + 'V · VM=' + s.vm.toFixed(2) + 'V');
  }
}

function drawTransferOnCanvas(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var isModal = (canvasId === 'iv-modal-canvas');
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = canvas.clientWidth || (isModal ? 560 : 310);
  var h = canvas.clientHeight || (isModal ? 380 : 225);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var bg = isLight ? '#f8fafc' : '#080b0f';
  var colGrid = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.07)';
  var colAxis = isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(255, 255, 255, 0.28)';
  var colText = isLight ? '#475569' : '#9aa6b6';
  var colCurve = isLight ? '#0d9488' : '#34d399';
  var colIdd = isLight ? '#7c3aed' : '#c084fc';
  var colVm = isLight ? '#d97706' : '#fbbf24';

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  var padLeft = isModal ? 54 : 44;
  var padRight = isModal ? 40 : 32;
  var padTop = isModal ? 38 : 30;
  var padBot = isModal ? 42 : 34;
  var plotW = Math.max(40, w - padLeft - padRight);
  var plotH = Math.max(40, h - padTop - padBot);

  function toPxX(v) { return padLeft + Math.max(0, Math.min(1, v)) * plotW; }
  function toPxY(v) { return padTop + (1.0 - Math.max(0, Math.min(1, v))) * plotH; }

  var tickFont = isModal ? '10.5px "IBM Plex Mono", monospace' : '9px "IBM Plex Mono", monospace';
  var axisFont = isModal ? '600 11px "IBM Plex Mono", monospace' : '600 9.5px "IBM Plex Mono", monospace';
  var tagFont = isModal ? '600 10.5px "IBM Plex Mono", monospace' : '600 9px "IBM Plex Mono", monospace';

  // Grid & Major Ticks (0.0, 0.5, 1.0 text; 0.25 steps gridlines)
  ctx.strokeStyle = colGrid;
  ctx.lineWidth = 1;
  [0, 0.25, 0.50, 0.75, 1.00].forEach(function(v, idx) {
    var gx = toPxX(v);
    var gy = toPxY(v);
    ctx.beginPath(); ctx.moveTo(gx, padTop); ctx.lineTo(gx, padTop + plotH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(padLeft, gy); ctx.lineTo(padLeft + plotW, gy); ctx.stroke();

    if (idx % 2 === 0) {
      ctx.fillStyle = colText;
      ctx.font = tickFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(v.toFixed(1), gx, padTop + plotH + 5);

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.toFixed(1), padLeft - 5, gy);
    }
  });

  ctx.strokeStyle = colAxis;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(padLeft, padTop, plotW, plotH);

  var sweep = getNandSweepData(currentSweep, currentA, currentB);
  var pts = sweep.points;

  // VOUT = VIN dashed reference diagonal
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = isLight ? 'rgba(100,116,139,0.28)' : 'rgba(148,163,184,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(toPxX(0), toPxY(0));
  ctx.lineTo(toPxX(1), toPxY(1));
  ctx.stroke();
  ctx.restore();

  if (sweep.isInverting) {
    ctx.save();
    ctx.fillStyle = isLight ? 'rgba(13,148,136,0.06)' : 'rgba(52,211,153,0.06)';
    ctx.fillRect(toPxX(0), padTop, Math.max(0, toPxX(sweep.vil) - toPxX(0)), plotH);
    ctx.fillRect(toPxX(sweep.vih), padTop, Math.max(0, toPxX(1) - toPxX(sweep.vih)), plotH);
    ctx.restore();
  }

  // Shoot-Through Current I_DD curve
  if (sweep.isInverting) {
    ctx.beginPath();
    for (var ii = 0; ii < pts.length; ii++) {
      var pxI = toPxX(pts[ii].vin);
      var pyI = padTop + plotH - (pts[ii].idd / sweep.maxIdd) * (plotH * 0.72);
      if (ii === 0) ctx.moveTo(pxI, pyI);
      else ctx.lineTo(pxI, pyI);
    }
    ctx.strokeStyle = colIdd;
    ctx.lineWidth = isModal ? 2.0 : 1.6;
    ctx.stroke();
  }

  // V_OUT VTC Curve
  ctx.beginPath();
  for (var si = 0; si < pts.length; si++) {
    var pxV = toPxX(pts[si].vin);
    var pyV = toPxY(pts[si].vout);
    if (si === 0) ctx.moveTo(pxV, pyV);
    else ctx.lineTo(pxV, pyV);
  }
  ctx.strokeStyle = colCurve;
  ctx.lineWidth = isModal ? 2.8 : 2.3;
  ctx.stroke();

  // Switching Threshold V_M marker line + non-overlapping header pill
  if (sweep.isInverting) {
    var xVm = toPxX(sweep.vm);
    var yVm = toPxY(sweep.vm);
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = colVm;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(xVm, padTop);
    ctx.lineTo(xVm, padTop + plotH);
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(xVm, yVm, isModal ? 4.5 : 3.5, 0, Math.PI * 2);
    ctx.strokeStyle = colVm;
    ctx.lineWidth = 1.6;
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.stroke();

    var vmLabel = 'VM=' + sweep.vm.toFixed(2) + 'V';
    ctx.font = tagFont;
    var vmW = ctx.measureText(vmLabel).width + 8;
    var vmX = Math.max(padLeft + vmW * 0.5 + 2, Math.min(padLeft + plotW - vmW * 0.5 - 2, xVm));
    var vmY = padTop - 13;
    ctx.fillStyle = isLight ? 'rgba(254, 243, 199, 0.96)' : 'rgba(120, 53, 15, 0.85)';
    ctx.strokeStyle = colVm;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(vmX - vmW * 0.5, vmY - 7, vmW, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = colVm;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(vmLabel, vmX, vmY - 0.5);
  }

  // Top Header Legends (fixed away from VM badge)
  ctx.font = tickFont;
  ctx.textBaseline = 'top';
  ctx.fillStyle = colCurve;
  ctx.textAlign = 'left';
  ctx.fillText('VOUT(V)', 8, 5);

  ctx.fillStyle = colIdd;
  ctx.textAlign = 'right';
  if (sweep.isInverting) {
    ctx.fillText('IDD (' + formatCurrentReadout(sweep.maxIdd) + ' pk)', w - 8, 5);
  } else {
    var heldLabel = currentSweep === 'va' ? 'VB=' : 'VA=';
    var heldV = currentSweep === 'va' ? currentB : currentA;
    ctx.fillStyle = colVm;
    ctx.fillText(heldLabel + (heldV === 'off' ? 'OFF' : Number(heldV).toFixed(2) + 'V'), w - 8, 5);
  }

  // Axis Titles
  ctx.fillStyle = colText;
  ctx.font = axisFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  var xTitle = currentSweep === 'va' ? 'VA (V)' : (currentSweep === 'vb' ? 'VB (V)' : 'VIN (VA = VB) (V)');
  ctx.fillText(xTitle, padLeft + plotW * 0.5, h - 4);

  ctx.save();
  ctx.translate(12, padTop + plotH * 0.5);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VOUT (V)', 0, 0);
  ctx.restore();

  // Active Operating Point Dot
  var curVin = currentSweep === 'va'
    ? (currentA === 'off' ? null : Number(currentA))
    : (currentSweep === 'vb'
        ? (currentB === 'off' ? null : Number(currentB))
        : (currentA === 'off' ? null : Number(currentA)));

  if (curVin !== null) {
    var curVout = calcNandVout(currentA === 'off' ? 1.0 : currentA, currentB === 'off' ? 1.0 : currentB);
    if (curVout !== null) {
      var dotX = toPxX(curVin);
      var dotY = toPxY(curVout);
      ctx.save();
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(dotX, padTop + plotH); ctx.lineTo(dotX, dotY);
      ctx.moveTo(padLeft, dotY); ctx.lineTo(dotX, dotY);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(dotX, dotY, isModal ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fillStyle = colVm;
      ctx.fill();
      ctx.strokeStyle = isLight ? '#0f172a' : '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawTransferGraph() {
  drawTransferOnCanvas('iv-canvas');
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  if (modalBackdrop && modalBackdrop.style.display !== 'none' && !modalBackdrop.classList.contains('hidden')) {
    drawTransferOnCanvas('iv-modal-canvas');
  }
}
window.drawTransferGraph = drawTransferGraph;

function setInputs(a, b) {
  currentA = (a === 'off' || a === null || a === undefined) ? 'off' : Math.max(0, Math.min(1.0, Number(a)));
  currentB = (b === 'off' || b === null || b === undefined) ? 'off' : Math.max(0, Math.min(1.0, Number(b)));
  applyLogicTint();
  drawTransferGraph();
}
window.setInputs = setInputs;

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
}

function setNandGeometry(Wp, Wn, L, presetName) {
  if (typeof Wp === 'number' && !isNaN(Wp)) geomWp = Math.max(60, Math.min(400, Math.round(Wp / 10) * 10));
  if (typeof Wn === 'number' && !isNaN(Wn)) geomWn = Math.max(60, Math.min(400, Math.round(Wn / 10) * 10));
  if (typeof L === 'number' && !isNaN(L)) geomL = Math.max(20, Math.min(200, Math.round(L / 2) * 2));

  if (presetName && NAND_GEOM_PRESETS[presetName]) {
    activeGeomPreset = presetName;
  } else {
    activeGeomPreset = 'custom';
    Object.keys(NAND_GEOM_PRESETS).forEach(function(k) {
      var pr = NAND_GEOM_PRESETS[k];
      if (pr.Wp === geomWp && pr.Wn === geomWn && pr.L === geomL) {
        activeGeomPreset = k;
      }
    });
  }

  syncGeomUiControls();

  if (typeof window.updateNandGeometry3D === 'function') {
    window.updateNandGeometry3D(geomWp, geomWn, geomL);
  }
  applyLogicTint();
  drawTransferGraph();
}
window.setNandGeometry = setNandGeometry;

function setNandGeometryPreset(name) {
  var pr = NAND_GEOM_PRESETS[name] || NAND_GEOM_PRESETS.balanced;
  setNandGeometry(pr.Wp, pr.Wn, pr.L, NAND_GEOM_PRESETS[name] ? name : 'balanced');
}
window.setNandGeometryPreset = setNandGeometryPreset;

function setupCanvasDrag(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var dragging = false;
  var isModal = (canvasId === 'iv-modal-canvas');

  function updateFromPointer(e) {
    var rect = canvas.getBoundingClientRect();
    var w = rect.width || canvas.clientWidth || (isModal ? 560 : 310);
    var padLeft = isModal ? 54 : 44;
    var padRight = isModal ? 40 : 32;
    var plotW = Math.max(40, w - padLeft - padRight);
    var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    var normX = Math.max(0.0, Math.min(1.0, (clientX - rect.left - padLeft) / plotW));
    var vin = Math.round(normX * 100) / 100;

    if (currentSweep === 'va') {
      setInputs(vin, currentB === 'off' ? 1.00 : currentB);
    } else if (currentSweep === 'vb') {
      setInputs(currentA === 'off' ? 1.00 : currentA, vin);
    } else {
      setInputs(vin, vin);
    }
  }

  canvas.addEventListener('pointerdown', function(e) {
    dragging = true;
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
    }
    updateFromPointer(e);
  });
  canvas.addEventListener('pointermove', function(e) {
    if (!dragging) return;
    updateFromPointer(e);
  });
  canvas.addEventListener('pointerup', function() { dragging = false; });
  canvas.addEventListener('pointercancel', function() { dragging = false; });
}

var _modalBackdrop = document.getElementById('iv-modal-backdrop');
function openModal() {
  if (!_modalBackdrop) _modalBackdrop = document.getElementById('iv-modal-backdrop');
  if (!_modalBackdrop) return;
  _modalBackdrop.classList.remove('hidden');
  _modalBackdrop.style.display = 'flex';
  updateTelemetryAndUi();
  drawTransferOnCanvas('iv-modal-canvas');
}
window.openModal = openModal;

function closeModal() {
  if (!_modalBackdrop) _modalBackdrop = document.getElementById('iv-modal-backdrop');
  if (!_modalBackdrop) return;
  _modalBackdrop.classList.add('hidden');
  _modalBackdrop.style.display = 'none';
}
window.closeModal = closeModal;

function initLogicStateControls() {
  var aGroup = document.getElementById('input-a-group');
  if (aGroup) {
    aGroup.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-a]');
      if (!btn) return;
      var val = btn.getAttribute('data-a');
      var nextA = val === 'off' ? 'off' : parseFloat(val);
      var nextB = nextA === 'off' ? 'off' : (currentB === 'off' ? 0.00 : currentB);
      setInputs(nextA, nextB);
    });
  }

  var bGroup = document.getElementById('input-b-group');
  if (bGroup) {
    bGroup.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-b]');
      if (!btn) return;
      var val = btn.getAttribute('data-b');
      var nextB = val === 'off' ? 'off' : parseFloat(val);
      var nextA = nextB === 'off' ? 'off' : (currentA === 'off' ? 0.00 : currentA);
      setInputs(nextA, nextB);
    });
  }

  var vaSlider = document.getElementById('va-slider');
  var vbSlider = document.getElementById('vb-slider');
  if (vaSlider) {
    vaSlider.addEventListener('input', function() {
      setInputs(parseFloat(vaSlider.value), currentB === 'off' ? 1.0 : currentB);
    });
  }
  if (vbSlider) {
    vbSlider.addEventListener('input', function() {
      setInputs(currentA === 'off' ? 1.0 : currentA, parseFloat(vbSlider.value));
    });
  }

  var presetSeg = document.getElementById('nand-preset-seg');
  if (presetSeg) {
    presetSeg.addEventListener('click', function(e) {
      var btn = e.target.closest('.dp-preset-btn');
      if (!btn) return;
      var p = btn.getAttribute('data-preset');
      if (p === '00') setInputs(0.00, 0.00);
      else if (p === '01') setInputs(0.00, 1.00);
      else if (p === '10') setInputs(1.00, 0.00);
      else if (p === '11') setInputs(1.00, 1.00);
      else if (p === 'vm') {
        var sw = getNandSweepData(currentSweep, currentA, currentB);
        var vmV = Math.round(sw.vm * 100) / 100;
        if (currentSweep === 'va') setInputs(vmV, 1.00);
        else if (currentSweep === 'vb') setInputs(1.00, vmV);
        else setInputs(vmV, vmV);
      }
      else if (p === 'off') setInputs('off', 'off');
    });
  }

  var sweepSeg = document.getElementById('vtc-sweep-seg');
  if (sweepSeg) {
    sweepSeg.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-sweep]');
      if (!btn) return;
      currentSweep = btn.getAttribute('data-sweep');
      sweepSeg.querySelectorAll('button').forEach(function(b) {
        b.classList.toggle('active', b === btn);
      });
      applyLogicTint();
      drawTransferGraph();
    });
  }

  var wpSl = document.getElementById('geom-wp-slider');
  var wnSl = document.getElementById('geom-wn-slider');
  var lSl = document.getElementById('geom-l-slider');
  if (wpSl) wpSl.addEventListener('input', function() { setNandGeometry(parseFloat(wpSl.value), geomWn, geomL); });
  if (wnSl) wnSl.addEventListener('input', function() { setNandGeometry(geomWp, parseFloat(wnSl.value), geomL); });
  if (lSl) lSl.addEventListener('input', function() { setNandGeometry(geomWp, geomWn, parseFloat(lSl.value)); });

  var geomPresets = document.getElementById('geom-preset-group');
  if (geomPresets) {
    geomPresets.addEventListener('click', function(e) {
      var btn = e.target.closest('.geom-preset-btn');
      if (!btn) return;
      setNandGeometryPreset(btn.dataset.geomPreset);
    });
  }

  var expandBtn = document.getElementById('iv-expand-btn');
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalClose = document.getElementById('iv-modal-close');
  var modalCanvasEl = document.getElementById('iv-modal-canvas');
  if (expandBtn) expandBtn.addEventListener('click', openModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', function(e) {
      if (e.target === modalBackdrop) closeModal();
    });
  }
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalBackdrop && modalBackdrop.style.display !== 'none' && !modalBackdrop.classList.contains('hidden')) {
      closeModal();
    }
  });

  if (typeof ResizeObserver !== 'undefined') {
    var ivEl = document.getElementById('iv-canvas');
    if (ivEl) new ResizeObserver(function() { drawTransferOnCanvas('iv-canvas'); }).observe(ivEl);
    if (modalCanvasEl) new ResizeObserver(function() {
      if (modalBackdrop && modalBackdrop.style.display !== 'none' && !modalBackdrop.classList.contains('hidden')) {
        drawTransferOnCanvas('iv-modal-canvas');
      }
    }).observe(modalCanvasEl);
  }

  setupCanvasDrag('iv-canvas');
  setupCanvasDrag('iv-modal-canvas');

  // Register uniform green Parameter Info Modals
  if (typeof window.SiliconParamInfoModal !== 'undefined' && window.SiliconParamInfoModal.register) {
    window.SiliconParamInfoModal.register({
      va: {
        title: 'Gate A Input Voltage (VA)',
        param: 'VA [0.00 V – 1.00 V] or OFF (High-Z)',
        formula: 'VGS,MN1 = VA ,   VSG,MP1 = VDD − VA',
        increase: 'Turns on bottom series NMOS MN1 while turning off pull-up PMOS MP1; allows discharge only when VB is also HIGH.',
        decrease: 'Turns off MN1 (breaking the series pull-down stack) and turns on MP1 to pull OUT HIGH to VDD.',
        explanation: 'Drives Polysilicon Gate A across both parallel pull-up MP1 and bottom pull-down MN1.',
        tradeoff: 'When VA switches from 0 to 1 while VB is already 1, internal node Vx quickly discharges to GND without charge-sharing glitches.',
        theorySection: 'nand-truthtable'
      },
      vb: {
        title: 'Gate B Input Voltage (VB)',
        param: 'VB [0.00 V – 1.00 V] or OFF (High-Z)',
        formula: 'VGS,MN2 = VB − Vx ,   VTH,MN2 = VTH0 + γ(√(2φF + Vx) − √(2φF))',
        increase: 'Turns on top series NMOS MN2 while turning off parallel PMOS MP2. When VA = 0, raising VB shares charge between OUT and internal node Vx.',
        decrease: 'Turns off MN2 and activates MP2 to pull the Shared P+ Drain output HIGH to VDD.',
        explanation: 'Drives Polysilicon Gate B across parallel pull-up MP2 and top series NMOS MN2 (subject to body effect when Vx > 0).',
        tradeoff: 'Because MN2 sits atop MN1 at intermediate potential Vx, its overdrive is reduced by Vx + ΔVTH(Vx), slowing transitions on input B.',
        theorySection: 'nand-chargesharing'
      },
      geomWp: {
        title: 'Parallel PMOS Width (Wp)',
        param: 'Wp [60 nm – 400 nm]',
        formula: 'βp = μp · Cox · (Wp / L) ,   VM rises with √(βp / βn,eff)',
        increase: 'Widens both parallel PMOS fingers (MP1 & MP2), raising single-input pull-up current and shifting NAND2 VM rightward toward VDD.',
        decrease: 'Narrows pull-up PMOS active stripes, reducing pull-up drive and shifting VM leftward toward GND.',
        explanation: 'Since single-input pull-up uses only one of the two parallel PMOS devices, each keeps full inverter-equivalent Wp.',
        tradeoff: 'Wider PMOS increases input gate capacitance on both pins without accelerating stacked pull-down transitions.',
        theorySection: 'nand-sizing'
      },
      geomWn: {
        title: 'Series NMOS Width (Wn)',
        param: 'Wn [60 nm – 400 nm]',
        formula: 'βn,eff = βn / 2 = ½ μn · Cox · (Wn / L)',
        increase: 'Widens the stacked series NMOS pair (MN1 + MN2), cutting series pull-down resistance Rn1 + Rn2 in half at 2:2 and shifting VM left.',
        decrease: 'Throttles the series NMOS discharge path, raising fall delay tpHL and shifting VM rightward toward VDD.',
        explanation: 'Stacking two NMOS transistors in series doubles channel resistance; doubling Wn (~240 nm) restores unit pull-down symmetry.',
        tradeoff: 'Because μn ≈ 2.0 μp, choosing Wn = Wp (Balanced 2:2) matches series NMOS to a single PMOS (βp = βn,eff), centering VM ≈ VDD/2.',
        theorySection: 'nand-sizing'
      },
      geomL: {
        title: 'Dual Channel Length (L)',
        param: 'L [20 nm – 200 nm]',
        formula: 'β ∝ 1/L ,   VTH(L) = VTH0 − ΔVSCE(L) ,   λ ∝ 1/L',
        increase: 'Extends both Gate A and Gate B stripes, suppressing SCE |VTH| roll-off and lowering λ for sharper VTC gain.',
        decrease: 'Increases drive strength and shortens channel transit time, while raising channel-length modulation λ and subthreshold leakage.',
        explanation: 'Sets physical gate length L under both Gate A (MP1/MN1) and Gate B (MP2/MN2) simultaneously.',
        tradeoff: 'Longer gates improve noise margins NMH/NML and reduce shoot-through current IDD at the cost of cell pitch and gate RC delay.',
        theorySection: 'nand-sizing'
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
  setInputs('off', 'off');
}

initLogicStateControls();
