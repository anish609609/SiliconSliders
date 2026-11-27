/**
 * logic-state.js - Enhancement PMOS CAD Viewer
 * Geometry-Aware MOSFET Operating-Region Physics Engine & Live ISD-VSD Graph:
 * - Scales oxide capacitance Cox = eps_ox / t_ox and kp = mu_p * Cox * (W / L) with mu_p ≈ 0.45 * mu_n.
 * - Dynamic signed VTH,p (< 0) with t_ox dependence, exponential |VTH| roll-off (Lc ~ 25 nm), and DIBL.
 * - Velocity saturation VSD,sat = VOV * (Esat * L) / (VOV + Esat * L) transitioning smoothly between long- and short-channel regimes.
 * - Channel-length modulation lambda proportional to 1/L and Leff = max(0.2L, L - deltaL).
 * - Live interactive ISD vs VSD graph renderer with Lock Y-Axis scale, non-overlapping labels, and 3D coupling.
 */

var EPS0 = 8.854187817e-12;           // Vacuum permittivity (F/m)
var EPS_OX = 3.9 * EPS0;              // SiO2 permittivity (F/m)
var MU_P = 0.0135;                    // Effective hole mobility (0.45 * MU_N = 135 cm^2/(V*s))
var E_SAT = 5.0e6;                    // Critical velocity-saturation field (V/m)
var LC_ROLLOFF_NM = 25.0;             // Characteristic SCE roll-off length (nm)

var GEOM_PRESETS = {
  short28:   { L: 28,  W: 120, tox: 2.0 },
  long180:   { L: 180, W: 180, tox: 4.0 },
  highdrive: { L: 28,  W: 360, tox: 1.4 }
};

// Active device geometry parameters
var geomL = 28;      // Channel length (20..200 nm)
var geomW = 120;     // Channel width (40..400 nm)
var geomTox = 2.0;   // Gate oxide thickness (1.2..10.0 nm)

// Active continuous bias states (VSG = -VGS >= 0, VSD = -VDS >= 0)
var currentVsg = 1.00;   // Source-to-Gate bias VSG = |VGS| (0.00V to 1.80V)
var currentVsd = 0.80;   // Source-to-Drain bias VSD = |VDS| (0.00V to 1.80V)
var currentIds = 0.04;   // Source-to-Drain current ISD (mA)
var currentRegion = 'SATURATION';
var currentIn = 0;       // Backward-compatibility flag (0 = ON, 1 = OFF/Cutoff)

// Y-axis scale lock state for comparative scaling
var lockYAxis = false;
var lockedIdsMax = null;
var lockedTickStep = null;
var lastAutoIdsMax = 0.20;
var lastAutoTickStep = 0.05;

function computeThresholdDetails(vsd, L_nm, tox_nm) {
  var vth0Mag = 0.42 + 0.015 * tox_nm;                   // |VTH0,p| ≈ 0.45 V at tox = 2.0 nm
  var sceRolloff = 0.16 * Math.exp(-L_nm / LC_ROLLOFF_NM);
  var diblEta = 0.08 * Math.pow(28.0 / L_nm, 2.0);       // ~0.08 V/V at 28 nm, ~0.002 at 180 nm
  var vthMagRaw = vth0Mag - sceRolloff - diblEta * Math.max(0, vsd);
  var vthMag = Math.max(0.10, vthMagRaw);
  return {
    vth: -vthMag,
    vthMag: vthMag,
    vth0: -vth0Mag,
    vth0Mag: vth0Mag,
    sceRolloff: sceRolloff,
    diblEta: diblEta
  };
}

function computePmosPoint(vsg, vsd, L_nm, W_nm, tox_nm) {
  var L = Math.max(20, Math.min(200, Number(L_nm) || 28));
  var W = Math.max(40, Math.min(400, Number(W_nm) || 120));
  var tox = Math.max(1.2, Math.min(10.0, Number(tox_nm) || 2.0));

  var L_m = L * 1e-9;
  var tox_m = tox * 1e-9;
  var cox = EPS_OX / tox_m;
  var wlRatio = W / L;
  var kp = MU_P * cox * wlRatio * 1000.0; // mA/V^2 (0.45 * kn at identical W/L, tox)
  var lambda = 0.08 * (28.0 / L);         // 1/V, scales as 1/L

  var th = computeThresholdDetails(vsd, L, tox);
  var vthMag = th.vthMag;
  var vov = Math.max(0, vsg - vthMag);
  var esatL = E_SAT * L_m;
  var vsdSat = vov > 0.0001 ? (vov * esatL) / (vov + esatL) : 0.0;

  var region = 'CUTOFF';
  var isd = 0.0;
  var deltaL_nm = 0.0;

  if (vov <= 0.001) {
    region = 'CUTOFF';
    isd = 0.0;
  } else if (vsd < vsdSat) {
    region = 'LINEAR';
    isd = (kp / (1.0 + vsd / esatL)) * (vov * vsd - 0.5 * vsd * vsd);
  } else {
    region = 'SATURATION';
    var vsdDiff = vsd - vsdSat;
    isd = 0.5 * kp * vov * vsdSat * (1.0 + lambda * vsdDiff);
    deltaL_nm = Math.min(0.8 * L, 5.5 * Math.sqrt(Math.max(0, vsdDiff)));
  }

  var leff = Math.max(0.2 * L, L - deltaL_nm);
  var gState = (typeof window.getDeviceGeomState === 'function') ? window.getDeviceGeomState() : null;
  var modelL = gState ? gState.gateL : 2.0;
  var deltaL_scene = modelL * ((L - leff) / L);

  return {
    vsg: vsg,
    vsd: vsd,
    vgs: -vsg,
    vds: -vsd,
    vth: th.vth,
    vthMag: vthMag,
    vov: vov,
    vsdSat: vsdSat,
    vdsSat: -vsdSat,
    esatL: esatL,
    isd: Math.max(0, isd),
    ids: Math.max(0, isd),
    region: region,
    deltaL: deltaL_scene,
    deltaL_nm: L - leff,
    leff: leff,
    L: L,
    W: W,
    tox: tox,
    wlRatio: wlRatio,
    kp: kp,
    cox: cox,
    lambda: lambda,
    diblEta: th.diblEta
  };
}

function calculateIsd(testVsg, testVsd) {
  var pt = computePmosPoint(testVsg, testVsd, geomL, geomW, geomTox);
  return { isd: pt.isd, region: pt.region };
}
window.calculateIsd = calculateIsd;

// Public accessor for other modules (geometry.js, flow.js, selection.js, verify-devices.ts)
window.getMosfetPhysicsState = function() {
  return computePmosPoint(currentVsg, currentVsd, geomL, geomW, geomTox);
};

window.setMosfetGeometry = function(L_nm, W_nm, tox_nm) {
  if (typeof L_nm === 'number' && Number.isFinite(L_nm)) geomL = Math.max(20, Math.min(200, L_nm));
  if (typeof W_nm === 'number' && Number.isFinite(W_nm)) geomW = Math.max(40, Math.min(400, W_nm));
  if (typeof tox_nm === 'number' && Number.isFinite(tox_nm)) geomTox = Math.max(1.2, Math.min(10.0, tox_nm));
  applyLogicState();
};

function formatIsdText(isd) {
  if (isd < 0.0005) return '≈ 0 mA';
  if (isd < 0.1) return isd.toFixed(3) + ' mA';
  return isd.toFixed(2) + ' mA';
}

function syncGeometryControlsUI() {
  var lSlider = document.getElementById('geom-l-slider');
  var lVal = document.getElementById('geom-l-val');
  if (lSlider && Math.abs(parseFloat(lSlider.value) - geomL) > 0.1) lSlider.value = String(geomL);
  if (lVal) lVal.textContent = Math.round(geomL) + ' nm';

  var wSlider = document.getElementById('geom-w-slider');
  var wVal = document.getElementById('geom-w-val');
  if (wSlider && Math.abs(parseFloat(wSlider.value) - geomW) > 0.1) wSlider.value = String(geomW);
  if (wVal) wVal.textContent = Math.round(geomW) + ' nm';

  var toxSlider = document.getElementById('geom-tox-slider');
  var toxVal = document.getElementById('geom-tox-val');
  if (toxSlider && Math.abs(parseFloat(toxSlider.value) - geomTox) > 0.01) toxSlider.value = geomTox.toFixed(1);
  if (toxVal) toxVal.textContent = geomTox.toFixed(1) + ' nm';

  document.querySelectorAll('#geom-preset-group .geom-preset-btn').forEach(function(btn) {
    var p = GEOM_PRESETS[btn.dataset.geomPreset];
    var isMatch = Boolean(
      p &&
      Math.abs(geomL - p.L) < 0.5 &&
      Math.abs(geomW - p.W) < 1.0 &&
      Math.abs(geomTox - p.tox) < 0.05
    );
    btn.classList.toggle('active', isMatch);
  });
}

// ---------------------------------------------------------------------------
// APPLY STATE: Drives 3D Geometry, Sliders, Graph, Telemetry & Carrier Flow
// ---------------------------------------------------------------------------
function applyLogicState() {
  if (typeof window.updateDeviceGeometry3D === 'function') {
    window.updateDeviceGeometry3D(geomL, geomW, geomTox);
  }
  syncGeometryControlsUI();

  var phys = window.getMosfetPhysicsState();
  var vsg = phys.vsg;
  var vsd = phys.vsd;
  var vth = phys.vth;
  var vthMag = phys.vthMag;
  var vov = phys.vov;
  var vsdSat = phys.vsdSat;
  var isd = phys.isd;
  var region = phys.region;
  var deltaL = phys.deltaL;
  var leff = phys.leff;

  currentIn = (region === 'CUTOFF') ? 1 : 0;
  currentIds = isd;
  currentRegion = region;

  // 1. Update Bias Sliders & Value Readouts
  var vsgSlider = document.getElementById('vsg-slider');
  var vsgVal = document.getElementById('vsg-val');
  if (vsgSlider && Math.abs(parseFloat(vsgSlider.value) - vsg) > 0.01) vsgSlider.value = vsg.toFixed(2);
  if (vsgVal) vsgVal.textContent = vsg.toFixed(2) + 'V';

  var vsdSlider = document.getElementById('vsd-slider');
  var vsdVal = document.getElementById('vsd-val');
  if (vsdSlider && Math.abs(parseFloat(vsdSlider.value) - vsd) > 0.01) vsdSlider.value = vsd.toFixed(2);
  if (vsdVal) vsdVal.textContent = vsd.toFixed(2) + 'V';

  // 2. Update Region Badge & Presets
  var regionBadge = document.getElementById('region-badge');
  if (regionBadge) {
    regionBadge.textContent = region === 'LINEAR' ? 'LINEAR / TRIODE' : region;
    regionBadge.className = 'region-badge-pill ' + region.toLowerCase();
  }

  document.querySelectorAll('#region-preset-seg button').forEach(function(b) {
    var p = b.dataset.preset;
    b.classList.toggle('active', (region === 'CUTOFF' && p === 'cutoff') ||
                                 (region === 'LINEAR' && p === 'linear') ||
                                 (region === 'SATURATION' && p === 'saturation'));
  });

  // 3. Update Telemetry Readouts
  var ivVsg = document.getElementById('iv-vsg-readout') || document.getElementById('iv-vgs-readout');
  if (ivVsg) ivVsg.textContent = vsg.toFixed(2) + ' V';
  var ivVsd = document.getElementById('iv-vsd-readout') || document.getElementById('iv-vds-readout');
  if (ivVsd) ivVsd.textContent = vsd.toFixed(2) + ' V';
  var ivVth = document.getElementById('iv-vth-readout');
  if (ivVth) ivVth.textContent = vth.toFixed(2) + ' V';
  var ivVov = document.getElementById('iv-vov-readout');
  if (ivVov) ivVov.textContent = vov.toFixed(2) + ' V';
  var ivWl = document.getElementById('iv-wl-readout');
  if (ivWl) ivWl.textContent = phys.wlRatio.toFixed(2);
  var ivIsd = document.getElementById('iv-isd-readout') || document.getElementById('iv-ids-readout');
  if (ivIsd) ivIsd.textContent = formatIsdText(isd);
  var ivLeff = document.getElementById('iv-leff-readout');
  if (ivLeff) ivLeff.textContent = leff.toFixed(1) + ' nm';
  var ivVsdsat = document.getElementById('iv-vsdsat-readout');
  if (ivVsdsat) ivVsdsat.textContent = vsdSat.toFixed(2) + ' V';
  var ivDl = document.getElementById('iv-dl-readout');
  if (ivDl) ivDl.textContent = phys.deltaL_nm.toFixed(1) + ' nm';

  var ivStateDesc = document.getElementById('iv-state-desc');
  if (ivStateDesc) {
    var isShortCh = phys.L < 50;
    if (region === 'CUTOFF') {
      ivStateDesc.textContent = (isShortCh && vsd > 0.4)
        ? 'Cutoff · DIBL-shifted VTH,p (' + vth.toFixed(2) + ' V)'
        : 'Channel quenched · Subthreshold state';
    } else if (region === 'LINEAR') {
      ivStateDesc.textContent = isShortCh
        ? 'Linear · High-field hole velocity roll-off'
        : 'Continuous P-channel · Ohmic hole drift';
    } else {
      ivStateDesc.textContent = isShortCh
        ? 'DIBL + Velocity Saturation (ΔL = ' + phys.deltaL_nm.toFixed(1) + ' nm)'
        : 'Pinch-off Saturation (ΔL = ' + phys.deltaL_nm.toFixed(1) + ' nm)';
    }
  }

  // 4. Update Compatibility Telemetry Badge
  var badgeVsg = document.getElementById('badge-vgs') || document.getElementById('badge-vg');
  var badgeState = document.getElementById('badge-state');
  var badgeChan = document.getElementById('badge-chan');
  var badgeIds = document.getElementById('badge-ids') || document.getElementById('badge-isd');

  if (badgeVsg) {
    badgeVsg.textContent = vsg.toFixed(2) + ' V (' + (vsg <= vthMag ? 'VSG ≤ |VTH|' : 'VSG > |VTH|') + ')';
    badgeVsg.className = 'v ' + (region === 'CUTOFF' ? 'off' : 'on');
  }
  if (badgeState) {
    badgeState.textContent = region;
    badgeState.className = 'v ' + (region === 'CUTOFF' ? 'off' : (region === 'SATURATION' ? 'on' : 'warn'));
  }
  if (badgeChan) {
    if (region === 'CUTOFF') {
      badgeChan.textContent = 'DEPLETED / NO CHANNEL';
      badgeChan.className = 'v off';
    } else if (region === 'LINEAR') {
      badgeChan.textContent = 'INVERTED P-CHANNEL (CONTINUOUS)';
      badgeChan.className = 'v on';
    } else {
      badgeChan.textContent = 'PINCHED-OFF (Leff=' + leff.toFixed(1) + 'nm)';
      badgeChan.className = 'v warn';
    }
  }
  if (badgeIds) {
    badgeIds.textContent = (isd >= 0.0005 ? formatIsdText(isd) : '0.00 mA (CUTOFF)');
    badgeIds.className = 'v ' + (isd >= 0.0005 ? 'on' : 'off');
  }

  // 5. Update 2D SVG Schematic Indicators
  var schVg = document.getElementById('sch-vg-val') || document.getElementById('sch-vsg-val');
  if (schVg) schVg.textContent = (1.0 - vsg).toFixed(2) + 'V';
  var schChan = document.getElementById('sch-channel-state');
  if (schChan) {
    schChan.textContent = region === 'CUTOFF' ? 'OFF (CUTOFF)' : (region === 'LINEAR' ? 'ON (TRIODE)' : 'ON (SAT)');
  }

  // 6. Dynamically Deform 3D Inversion Channel & Depletion Shells
  if (typeof window.updateChannelGeometry === 'function') {
    window.updateChannelGeometry(vsg, vsd, isd, region, deltaL);
  }

  // 7. Redraw Live ISD-VSD Graph
  drawIsdVdsGraph(vsg, vsd, isd, region);

  // 8. Rebuild Fine Hole Carrier Flow Simulation
  if (typeof rebuildFlowCurves === 'function') {
    rebuildFlowCurves(isd, region, deltaL);
  }

  // 9. Update Context for AI Voice Assistant and Inspector
  if (typeof lastSelectedId !== 'undefined' && lastSelectedId) {
    if (typeof window.updateVoiceAssistantContext === 'function') {
      window.updateVoiceAssistantContext(lastSelectedId, idToInfo(lastSelectedId));
    }
    if ((lastSelectedId === 'channel' || lastSelectedId === 'depletion') && typeof showInspector === 'function') {
      showInspector(lastSelectedId, idToInfo(lastSelectedId));
    }
  }
}

// ---------------------------------------------------------------------------
// LIVE ISD vs VSD CHARACTERISTIC GRAPH RENDERER
// ---------------------------------------------------------------------------
var IV_GRAPH_PAD = { L: 48, R: 38, T: 22, B: 24 };

function computeNiceYScale(peakIsd) {
  var target = Math.max(0.025, peakIsd * 1.15);
  var steps = [0.01, 0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0];
  var chosenStep = steps[steps.length - 1];
  for (var i = 0; i < steps.length; i++) {
    if (steps[i] * 3.5 >= target) {
      chosenStep = steps[i];
      break;
    }
  }
  return {
    tickStep: chosenStep,
    idsMax: chosenStep * 3.75
  };
}

function renderSinglePmosGraph(canvas, activeVsg, activeVsd, activeIsd, activeRegion, isModal) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var W = canvas.clientWidth || rect.width || (isModal ? 560 : 310);
  var H = canvas.clientHeight || rect.height || (isModal ? 380 : 225);

  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  var isLight = document.documentElement.getAttribute('data-theme') === 'light';

  var bgColor = isLight ? '#f8fafc' : '#080c12';
  var gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  var textColor = isLight ? '#64748b' : '#7d8ba0';
  var dimmedCurveColor = isLight ? 'rgba(13,148,136,0.24)' : 'rgba(95,217,196,0.20)';
  var activeCurveColor = isLight ? '#0d9488' : '#5fd9c4';
  var pinchOffColor = isLight ? '#d97706' : '#f59e0b';
  var dotColor = activeRegion === 'CUTOFF' ? '#dc2626' : (activeRegion === 'SATURATION' ? '#10b981' : '#0284c7');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  var padL = isModal ? 56 : IV_GRAPH_PAD.L;
  var padR = isModal ? 46 : IV_GRAPH_PAD.R;
  var padT = isModal ? 24 : IV_GRAPH_PAD.T;
  var padB = isModal ? 28 : IV_GRAPH_PAD.B;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;

  var vsdMax = 1.8;
  var vsgFamily = [0.4, 0.7, 1.0, 1.3, 1.6];

  function calcIsd(testVsg, testVsd) {
    return computePmosPoint(testVsg, testVsd, geomL, geomW, geomTox).isd;
  }

  var peakCurrent = Math.max(calcIsd(1.6, vsdMax), calcIsd(activeVsg, vsdMax), activeIsd);
  var autoScale = computeNiceYScale(peakCurrent);
  lastAutoIdsMax = autoScale.idsMax;
  lastAutoTickStep = autoScale.tickStep;

  var isdMax = (lockYAxis && lockedIdsMax) ? lockedIdsMax : autoScale.idsMax;
  var tickStep = (lockYAxis && lockedTickStep) ? lockedTickStep : autoScale.tickStep;

  function toX(v) { return padL + (v / vsdMax) * plotW; }
  function toY(i) { return padT + plotH - (i / isdMax) * plotH; }

  // Grid & Axis Ticks
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = textColor;
  var tickFont = isModal ? '11px "IBM Plex Mono", monospace' : '9.5px "IBM Plex Mono", monospace';
  var axisFont = isModal ? '600 11px "IBM Plex Mono", monospace' : '600 9.5px "IBM Plex Mono", monospace';
  ctx.font = tickFont;
  ctx.textAlign = 'center';

  [0, 0.6, 1.2, 1.8].forEach(function(v) {
    var x = toX(v);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), x, padT + plotH + (isModal ? 15 : 13));
  });
  ctx.font = axisFont;
  ctx.fillText('V_SD (V)', padL + plotW / 2, padT + plotH + (isModal ? 26 : 23));

  ctx.font = tickFont;
  ctx.textAlign = 'right';
  var yDecimals = tickStep < 0.1 ? 2 : 1;
  for (var tIdx = 0; tIdx <= 3; tIdx++) {
    var iTick = tIdx * tickStep;
    if (iTick > isdMax * 0.99) break;
    var y = toY(iTick);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(iTick.toFixed(yDecimals), padL - 6, y + 3.5);
  }

  ctx.save();
  ctx.translate(isModal ? 13 : 11, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = axisFont;
  ctx.fillText('I_SD (mA)', 0, 0);
  ctx.restore();

  // Clip plot area
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  // Draw Velocity-Saturated Pinch-Off Boundary Curve
  var refPt = computePmosPoint(1.0, 0.0, geomL, geomW, geomTox);
  var esatL = refPt.esatL;
  ctx.strokeStyle = pinchOffColor;
  ctx.lineWidth = isModal ? 1.5 : 1.3;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  var startedPinch = false;
  var maxBoundaryV = Math.min(vsdMax, esatL * 0.94);
  for (var v = 0; v <= maxBoundaryV; v += 0.015) {
    var vovReq = (v * esatL) / Math.max(0.005, esatL - v);
    var ptAtV = computePmosPoint(refPt.vthMag + vovReq, v, geomL, geomW, geomTox);
    var iBoundary = 0.5 * ptAtV.kp * vovReq * v;
    if (iBoundary > isdMax * 1.15) break;
    var px = toX(v);
    var py = toY(iBoundary);
    if (!startedPinch) { ctx.moveTo(px, py); startedPinch = true; }
    else { ctx.lineTo(px, py); }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels for Linear and Saturation regions
  ctx.font = (isModal ? '10px' : '8.5px') + ' "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? 'rgba(74,146,201,0.75)' : 'rgba(74,146,201,0.60)';
  ctx.textAlign = 'left';
  ctx.fillText('TRIODE', padL + 6, padT + 12);
  ctx.fillStyle = isLight ? 'rgba(16,185,129,0.80)' : 'rgba(87,207,143,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('SATURATION', toX(1.35), padT + 12);

  function getSamplePoints(vsdSatHint, maxV, baseStep) {
    var pts = [];
    for (var sv = 0; sv <= maxV + 0.0001; sv += baseStep) {
      pts.push(Math.min(maxV, sv));
    }
    if (vsdSatHint > 0.001 && vsdSatHint < maxV) {
      pts.push(vsdSatHint);
    }
    pts.sort(function(a, b) { return a - b; });
    var unique = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      if (pts[i] - unique[unique.length - 1] > 0.002) {
        unique.push(pts[i]);
      }
    }
    return unique;
  }

  // Draw Family of VSG Curves
  var labelPositions = [];
  vsgFamily.forEach(function(fVsg) {
    var midState = computePmosPoint(fVsg, 0.2, geomL, geomW, geomTox);
    var pts = getSamplePoints(midState.vsdSat, vsdMax, 0.03);
    ctx.strokeStyle = dimmedCurveColor;
    ctx.lineWidth = isModal ? 1.4 : 1.2;
    ctx.beginPath();
    for (var idx = 0; idx < pts.length; idx++) {
      var pv = pts[idx];
      var pi = calcIsd(fVsg, pv);
      var px = toX(pv);
      var py = toY(pi);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    var endI = calcIsd(fVsg, vsdMax);
    labelPositions.push({
      vsg: fVsg,
      endI: endI,
      rawY: toY(endI) + 3
    });
  });

  // Draw Highlighted Active VSG Curve
  var activeMid = computePmosPoint(activeVsg, activeVsd, geomL, geomW, geomTox);
  var activePts = getSamplePoints(activeMid.vsdSat, vsdMax, 0.025);
  ctx.strokeStyle = activeCurveColor;
  ctx.lineWidth = isModal ? 2.8 : 2.4;
  ctx.beginPath();
  for (var idx = 0; idx < activePts.length; idx++) {
    var av = activePts[idx];
    var ai = calcIsd(activeVsg, av);
    var px = toX(av);
    var py = toY(ai);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Crosshairs & Active Operating Point Dot
  var dotX = toX(activeVsd);
  var dotY = toY(activeIsd);
  var clampedDotY = Math.max(padT + 4, Math.min(padT + plotH, dotY));

  ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(dotX, padT + plotH);
  ctx.lineTo(dotX, clampedDotY);
  ctx.lineTo(padL, clampedDotY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(dotX, clampedDotY, isModal ? 8 : 7, 0, Math.PI * 2);
  ctx.fillStyle = isLight ? 'rgba(13,148,136,0.25)' : 'rgba(95,217,196,0.30)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(dotX, clampedDotY, isModal ? 5 : 4.5, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore(); // end plot clip

  // Family Curve Right-Edge Column Header & Labels (outside clip)
  var labelX = toX(vsdMax) + 5;
  ctx.fillStyle = activeCurveColor;
  ctx.font = (isModal ? '700 9.5px' : '700 8.5px') + ' "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('V_SG', labelX, padT - 6);

  var minSpacing = isModal ? 16 : 13;
  var lastY = toY(0) + 3;
  var minTopY = padT + 9;
  for (var k = 0; k < labelPositions.length; k++) {
    var lp = labelPositions[k];
    if (lp.endI > isdMax * 0.98) continue;
    var finalY = Math.min(lp.rawY, lastY - (k > 0 ? minSpacing : 0));
    if (finalY < minTopY) continue;
    lastY = finalY;
    ctx.fillStyle = textColor;
    ctx.font = (isModal ? '9.5px' : '8.5px') + ' "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(lp.vsg.toFixed(1) + 'V', labelX, finalY);
  }

  ctx.restore();
}

function drawIsdVdsGraph(activeVsg, activeVsd, activeIsd, activeRegion) {
  var phys = (typeof window.getMosfetPhysicsState === 'function') ? window.getMosfetPhysicsState() : null;
  var vsg = (typeof activeVsg === 'number') ? activeVsg : (phys ? phys.vsg : currentVsg);
  var vsd = (typeof activeVsd === 'number') ? activeVsd : (phys ? phys.vsd : currentVsd);
  var isd = (typeof activeIsd === 'number') ? activeIsd : (phys ? phys.isd : (typeof currentIds === 'number' ? currentIds : 0.04));
  var reg = activeRegion || (phys ? phys.region : (typeof currentRegion === 'string' ? currentRegion : 'SATURATION'));

  var inlineCanvas = document.getElementById('iv-canvas');
  if (inlineCanvas) {
    renderSinglePmosGraph(inlineCanvas, vsg, vsd, isd, reg, false);
  }

  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalCanvas = document.getElementById('iv-modal-canvas');
  if (modalCanvas && modalBackdrop && modalBackdrop.style.display !== 'none') {
    renderSinglePmosGraph(modalCanvas, vsg, vsd, isd, reg, true);
  }

  var mVsg = document.getElementById('iv-m-vsg');
  var mVsd = document.getElementById('iv-m-vsd');
  var mVth = document.getElementById('iv-m-vth');
  var mWl = document.getElementById('iv-m-wl');
  var mIsd = document.getElementById('iv-m-isd');
  var mLeff = document.getElementById('iv-m-leff');
  var mReg = document.getElementById('iv-m-region');
  if (mVsg) mVsg.textContent = vsg.toFixed(2) + ' V';
  if (mVsd) mVsd.textContent = vsd.toFixed(2) + ' V';
  if (mVth && phys) mVth.textContent = phys.vth.toFixed(2) + ' V';
  if (mWl && phys) mWl.textContent = phys.wlRatio.toFixed(2);
  if (mIsd) mIsd.textContent = formatIsdText(isd || 0);
  if (mLeff && phys) mLeff.textContent = phys.leff.toFixed(1) + ' nm';
  if (mReg) mReg.textContent = reg;
}
window.drawIsdVdsGraph = drawIsdVdsGraph;
window.drawIsdVsdGraph = drawIsdVdsGraph;
window.drawIdsVdsGraph = drawIsdVdsGraph;

function syncLockYAxisButtons() {
  [document.getElementById('iv-lock-y-btn'), document.getElementById('iv-modal-lock-y-btn')].forEach(function(btn) {
    if (!btn) return;
    btn.classList.toggle('active', lockYAxis);
    btn.setAttribute('aria-pressed', lockYAxis ? 'true' : 'false');
    var label = btn.querySelector('span');
    if (label) label.textContent = lockYAxis ? 'Y-Axis Locked' : 'Lock Y-Axis';
  });
}

function toggleLockYAxis() {
  lockYAxis = !lockYAxis;
  if (lockYAxis) {
    lockedIdsMax = lastAutoIdsMax;
    lockedTickStep = lastAutoTickStep;
  } else {
    lockedIdsMax = null;
    lockedTickStep = null;
  }
  syncLockYAxisButtons();
  drawIsdVdsGraph();
}

// ---------------------------------------------------------------------------
// INTERACTIVE EVENT LISTENERS & INITIALIZATION
// ---------------------------------------------------------------------------
function initLogicStateControls() {
  var vsgSlider = document.getElementById('vsg-slider');
  if (vsgSlider) {
    vsgSlider.addEventListener('input', function(e) {
      currentVsg = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  var vsdSlider = document.getElementById('vsd-slider');
  if (vsdSlider) {
    vsdSlider.addEventListener('input', function(e) {
      currentVsd = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  // Device Geometry Sliders
  var lSlider = document.getElementById('geom-l-slider');
  if (lSlider) {
    lSlider.addEventListener('input', function(e) {
      geomL = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  var wSlider = document.getElementById('geom-w-slider');
  if (wSlider) {
    wSlider.addEventListener('input', function(e) {
      geomW = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  var toxSlider = document.getElementById('geom-tox-slider');
  if (toxSlider) {
    toxSlider.addEventListener('input', function(e) {
      geomTox = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  // Geometry Preset Pills
  document.querySelectorAll('#geom-preset-group .geom-preset-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var p = GEOM_PRESETS[btn.dataset.geomPreset];
      if (!p) return;
      geomL = p.L;
      geomW = p.W;
      geomTox = p.tox;
      applyLogicState();
    });
  });

  function applyPreset(preset) {
    if (preset === 'cutoff') {
      currentVsg = 0.00;
      currentVsd = 0.80;
    } else if (preset === 'linear') {
      currentVsg = 1.00;
      var st = computePmosPoint(currentVsg, 0.10, geomL, geomW, geomTox);
      currentVsd = Math.max(0.05, Math.min(0.30, Math.floor(st.vsdSat * 0.65 * 20) / 20));
    } else if (preset === 'saturation') {
      currentVsg = 1.00;
      currentVsd = 0.80;
    }
    applyLogicState();
  }

  document.querySelectorAll('[data-preset]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyPreset(btn.dataset.preset);
    });
  });

  var lockBtn = document.getElementById('iv-lock-y-btn');
  if (lockBtn) lockBtn.addEventListener('click', toggleLockYAxis);
  var modalLockBtn = document.getElementById('iv-modal-lock-y-btn');
  if (modalLockBtn) modalLockBtn.addEventListener('click', toggleLockYAxis);

  function bindCanvasPointer(cvs, isModal) {
    if (!cvs) return;
    var isDragging = false;

    function handleGraphPointer(e) {
      var rect = cvs.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var scaleX = cvs.width / rect.width;

      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var canvasX = (clientX - rect.left) * scaleX;

      var padL = (isModal ? 56 : IV_GRAPH_PAD.L) * (scaleX || 1);
      var padR = (isModal ? 46 : IV_GRAPH_PAD.R) * (scaleX || 1);
      var plotW = cvs.width - padL - padR;

      var clickX = canvasX - padL;
      var normX = Math.max(0, Math.min(1.0, clickX / plotW));

      currentVsd = Math.round(normX * 1.8 * 20) / 20;
      applyLogicState();
    }

    cvs.addEventListener('mousedown', function(e) {
      isDragging = true;
      handleGraphPointer(e);
    });
    window.addEventListener('mousemove', function(e) {
      if (isDragging) handleGraphPointer(e);
    });
    window.addEventListener('mouseup', function() {
      isDragging = false;
    });

    cvs.addEventListener('touchstart', function(e) {
      isDragging = true;
      handleGraphPointer(e);
      e.preventDefault();
    }, { passive: false });
    window.addEventListener('touchmove', function(e) {
      if (isDragging) {
        handleGraphPointer(e);
        e.preventDefault();
      }
    }, { passive: false });
    window.addEventListener('touchend', function() {
      isDragging = false;
    });
  }

  var canvas = document.getElementById('iv-canvas');
  if (canvas) bindCanvasPointer(canvas, false);

  var modalCanvas = document.getElementById('iv-modal-canvas');
  if (modalCanvas) bindCanvasPointer(modalCanvas, true);

  var expandBtn = document.getElementById('iv-expand-btn');
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalCloseBtn = document.getElementById('iv-modal-close');
  var modalResizeObserver = null;

  function openIvModal() {
    if (!modalBackdrop) return;
    modalBackdrop.style.display = 'flex';
    if (!modalResizeObserver && typeof ResizeObserver !== 'undefined' && modalCanvas) {
      modalResizeObserver = new ResizeObserver(function() {
        if (modalBackdrop.style.display !== 'none') drawIsdVdsGraph();
      });
      modalResizeObserver.observe(modalCanvas.parentElement || modalCanvas);
    }
    drawIsdVdsGraph();
    requestAnimationFrame(drawIsdVdsGraph);
  }
  function closeIvModal() {
    if (!modalBackdrop) return;
    modalBackdrop.style.display = 'none';
  }

  if (expandBtn) expandBtn.addEventListener('click', openIvModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeIvModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', function(e) {
      if (e.target === modalBackdrop) closeIvModal();
    });
  }
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalBackdrop && modalBackdrop.style.display !== 'none') {
      closeIvModal();
    }
  });

  // Register shared Chamber-style parameter info modal entries for all 5 sliders
  var modalHelper = (typeof window.SiliconParamInfoModal !== 'undefined') ? window.SiliconParamInfoModal : window.SiliconInfoPopover;
  if (modalHelper) {
    modalHelper.register({
      vsg: {
        title: 'Source-to-Gate Bias (V<sub>SG</sub> = −V<sub>GS</sub>)',
        param: 'Active-Low PMOS Gate Overdrive Magnitude: 0.00 V to 1.80 V (V<sub>GS</sub> = −V<sub>SG</sub>)',
        formula: 'V<sub>OV</sub> = V<sub>SG</sub> − |V<sub>TH,p</sub>|   |   Q<sub>p,inv</sub> ∝ C<sub>ox</sub> · V<sub>OV</sub>',
        increase: 'Deepens the hole (p+) inversion channel; steps onto a higher I<sub>SD</sub> curve with larger pinch-off voltage <code>V<sub>SD,sat</sub></code>.',
        decrease: 'Weakens hole inversion; when <code>V<sub>SG</sub> ≤ |V<sub>TH,p</sub>|</code> (<code>V<sub>GS</sub> ≥ V<sub>TH,p</sub></code>), the channel vanishes (Cutoff, <code>I<sub>SD</sub> ≈ 0</code>).',
        tradeoff: 'Because hole mobility <code>μ<sub>p</sub> ≈ 0.45 μ<sub>n</sub></code>, PMOS needs wider <code>W</code> or larger overdrive to match NMOS current—increasing gate capacitance <code>C<sub>g</sub></code>.',
        theorySection: 'pmos-inversion'
      },
      vsd: {
        title: 'Source-to-Drain Bias (V<sub>SD</sub> = −V<sub>DS</sub>)',
        param: 'Lateral Source-to-Drain Acceleration Magnitude: 0.00 V to 1.80 V',
        formula: 'Linear (V<sub>SD</sub> &lt; V<sub>SD,sat</sub>)  →  Saturation (V<sub>SD</sub> ≥ V<sub>SD,sat</sub>)',
        increase: 'Moves the operating point right along the active <code>V<sub>SG</sub></code> curve. Past <code>V<sub>SD,sat</sub></code>, drain pinch-off (<code>ΔL</code>) grows and DIBL lowers <code>|V<sub>TH,p</sub>|</code> in short channels.',
        decrease: 'Reduces the lateral electric field driving holes from Source (+V<sub>DD</sub>) to Drain; returns the device to Triode/Linear operation.',
        tradeoff: 'High <code>V<sub>SD</sub></code> boosts saturation hole drift velocity but aggravates short-channel DIBL leakage and channel-length modulation slope <code>λ</code>.',
        theorySection: 'pmos-pinchoff'
      },
      geomL: {
        title: 'Channel Length (L)',
        param: 'Physical Metallurgical Gate Length: 20 nm to 200 nm',
        formula: 'I<sub>SD</sub> ∝ 1/L   |   λ ∝ 1/L   |   Δ|V<sub>TH,p</sub>|<sub>SCE</sub> ∝ exp(−L / L<sub>c</sub>)',
        increase: 'Reduces drive current <code>I<sub>SD</sub></code> and flattens saturation slope (higher <code>r<sub>o</sub></code>). Short-channel DIBL and <code>|V<sub>TH,p</sub>|</code> roll-off vanish toward ~<code>-0.45 V</code>.',
        decrease: 'Boosts drive current <code>I<sub>SD</sub></code>, steepens saturation slope, reduces <code>|V<sub>TH,p</sub>|</code> via charge-sharing &amp; DIBL, and induces hole velocity saturation.',
        tradeoff: 'Shorter <code>L</code> maximizes switching speed <code>f<sub>T</sub></code>, at the cost of stronger off-state DIBL leakage and degraded output resistance <code>r<sub>o</sub></code>.',
        theorySection: 'pmos-secondorder'
      },
      geomW: {
        title: 'Channel Width (W)',
        param: 'Active Transverse P+ Gate Width: 40 nm to 400 nm',
        formula: 'I<sub>SD</sub> ∝ W   |   k<sub>p</sub> = μ<sub>p</sub> · C<sub>ox</sub> · (W / L)',
        increase: 'Widens the P-channel in 3D, scaling all <code>I<sub>SD</sub></code> curves proportionally (typically sized ~2× NMOS width in CMOS to compensate lower hole mobility <code>μ<sub>p</sub></code>).',
        decrease: 'Narrows the hole channel, scaling drive current <code>I<sub>SD</sub></code> down proportionally.',
        tradeoff: 'Increasing PMOS <code>W</code> equalizes rise/fall symmetry in CMOS gates, but adds linear input/diffusion capacitance (<code>C<sub>g</sub> ∝ W·L</code>).',
        theorySection: 'pmos-equations'
      },
      geomTox: {
        title: 'Gate Oxide Thickness (t<sub>ox</sub>)',
        param: 'Effective Equivalent Oxide Thickness (EOT): 1.2 nm to 10.0 nm',
        formula: 'C<sub>ox</sub> = ε<sub>ox</sub> / t<sub>ox</sub>   |   I<sub>SD</sub> ∝ C<sub>ox</sub>   |   |V<sub>TH0,p</sub>| ∝ t<sub>ox</sub>',
        increase: 'Reduces vertical capacitive gate coupling over the N-well, lowering <code>I<sub>SD</sub></code> and slightly increasing <code>|V<sub>TH,p</sub>|</code>.',
        decrease: 'Boosts gate capacitance <code>C<sub>ox</sub></code>, increasing hole inversion density and lowering <code>|V<sub>TH,p</sub>|</code>.',
        tradeoff: 'Ultra-thin EOT (&lt;1.5 nm SiO₂) demands High-k HfO₂ stacks to prevent exponential direct gate tunneling while preserving strong electrostatic control.',
        theorySection: 'pmos-inversion'
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogicStateControls);
} else {
  initLogicStateControls();
}
