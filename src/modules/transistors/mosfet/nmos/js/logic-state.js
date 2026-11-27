/**
 * logic-state.js - NMOS CAD Viewer
 * Geometry-Aware MOSFET Operating-Region Physics Engine & Live IDS-VDS Graph:
 * - Scales oxide capacitance Cox = eps_ox / t_ox and kn = mu_n * Cox * (W / L).
 * - Dynamic VTH with t_ox dependence, exponential VTH roll-off (Lc ~ 25 nm), and DIBL (-eta(L) * VDS).
 * - Velocity saturation VDsat = VOV * (Esat * L) / (VOV + Esat * L) transitioning smoothly between long- and short-channel regimes.
 * - Channel-length modulation lambda proportional to 1/L and Leff = max(0.2L, L - deltaL).
 * - Live interactive IDS vs VDS graph renderer with optional Y-axis scale lock, pinch-off locus, and 3D coupling.
 */

var EPS0 = 8.854187817e-12;           // Vacuum permittivity (F/m)
var EPS_OX = 3.9 * EPS0;              // SiO2 permittivity (F/m)
var MU_N = 0.030;                     // Effective electron mobility (m^2 / (V*s) = 300 cm^2/(V*s))
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

// Active continuous bias states
var currentVgs = 1.00;   // Gate-to-Source bias (0.00V to 1.80V)
var currentVds = 0.80;   // Drain-to-Source bias (0.00V to 1.80V)
var currentIds = 0.10;   // Drain current (mA)
var currentRegion = 'SATURATION';
var currentIn = 1;       // Backward-compatibility flag (1 = ON, 0 = OFF/Cutoff)

// Y-axis scale lock state for comparative scaling
var lockYAxis = false;
var lockedIdsMax = null;
var lockedTickStep = null;
var lastAutoIdsMax = 0.34;
var lastAutoTickStep = 0.1;

function computeThresholdDetails(vds, L_nm, tox_nm) {
  var vth0 = 0.42 + 0.015 * tox_nm;                      // ~0.45 V at tox = 2.0 nm
  var sceRolloff = 0.16 * Math.exp(-L_nm / LC_ROLLOFF_NM);
  var diblEta = 0.08 * Math.pow(28.0 / L_nm, 2.0);       // ~0.08 V/V at 28 nm, ~0.002 at 180 nm
  var vthRaw = vth0 - sceRolloff - diblEta * Math.max(0, vds);
  return {
    vth: Math.max(0.10, vthRaw),
    vth0: vth0,
    sceRolloff: sceRolloff,
    diblEta: diblEta
  };
}

function computeMosfetPoint(vgs, vds, L_nm, W_nm, tox_nm) {
  var L = Math.max(20, Math.min(200, Number(L_nm) || 28));
  var W = Math.max(40, Math.min(400, Number(W_nm) || 120));
  var tox = Math.max(1.2, Math.min(10.0, Number(tox_nm) || 2.0));

  var L_m = L * 1e-9;
  var tox_m = tox * 1e-9;
  var cox = EPS_OX / tox_m;
  var wlRatio = W / L;
  var kn = MU_N * cox * wlRatio * 1000.0; // mA/V^2
  var lambda = 0.08 * (28.0 / L);         // 1/V, scales as 1/L

  var th = computeThresholdDetails(vds, L, tox);
  var vth = th.vth;
  var vov = Math.max(0, vgs - vth);
  var esatL = E_SAT * L_m;
  var vdsSat = vov > 0.0001 ? (vov * esatL) / (vov + esatL) : 0.0;

  var region = 'CUTOFF';
  var ids = 0.0;
  var deltaL_nm = 0.0;

  if (vov <= 0.001) {
    region = 'CUTOFF';
    ids = 0.0;
  } else if (vds < vdsSat) {
    region = 'LINEAR';
    ids = (kn / (1.0 + vds / esatL)) * (vov * vds - 0.5 * vds * vds);
  } else {
    region = 'SATURATION';
    var vdsDiff = vds - vdsSat;
    ids = 0.5 * kn * vov * vdsSat * (1.0 + lambda * vdsDiff);
    deltaL_nm = Math.min(0.8 * L, 5.5 * Math.sqrt(Math.max(0, vdsDiff)));
  }

  var leff = Math.max(0.2 * L, L - deltaL_nm);
  var gState = (typeof window.getDeviceGeomState === 'function') ? window.getDeviceGeomState() : null;
  var modelL = gState ? gState.gateL : 2.0;
  var deltaL_scene = modelL * ((L - leff) / L);

  return {
    vgs: vgs,
    vds: vds,
    vth: vth,
    vov: vov,
    vdsSat: vdsSat,
    esatL: esatL,
    ids: Math.max(0, ids),
    region: region,
    deltaL: deltaL_scene,
    deltaL_nm: L - leff,
    leff: leff,
    L: L,
    W: W,
    tox: tox,
    wlRatio: wlRatio,
    kn: kn,
    cox: cox,
    lambda: lambda,
    diblEta: th.diblEta
  };
}

// Public accessor for other modules (geometry.js, flow.js, selection.js, verify-devices.ts)
window.getMosfetPhysicsState = function() {
  return computeMosfetPoint(currentVgs, currentVds, geomL, geomW, geomTox);
};

window.setMosfetGeometry = function(L_nm, W_nm, tox_nm) {
  if (typeof L_nm === 'number' && Number.isFinite(L_nm)) geomL = Math.max(20, Math.min(200, L_nm));
  if (typeof W_nm === 'number' && Number.isFinite(W_nm)) geomW = Math.max(40, Math.min(400, W_nm));
  if (typeof tox_nm === 'number' && Number.isFinite(tox_nm)) geomTox = Math.max(1.2, Math.min(10.0, tox_nm));
  applyLogicState();
};

function formatIdsText(ids) {
  if (ids < 0.0005) return '≈ 0 mA';
  if (ids < 0.1) return ids.toFixed(3) + ' mA';
  return ids.toFixed(2) + ' mA';
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
  // Sync 3D dimensions before computing channel/flow so modelL and bounds match
  if (typeof window.updateDeviceGeometry3D === 'function') {
    window.updateDeviceGeometry3D(geomL, geomW, geomTox);
  }
  syncGeometryControlsUI();

  var phys = window.getMosfetPhysicsState();
  var vgs = phys.vgs;
  var vds = phys.vds;
  var vth = phys.vth;
  var vov = phys.vov;
  var vdsSat = phys.vdsSat;
  var ids = phys.ids;
  var region = phys.region;
  var deltaL = phys.deltaL;
  var leff = phys.leff;

  currentIn = (region === 'CUTOFF') ? 0 : 1;
  currentIds = ids;
  currentRegion = region;

  // 1. Update Bias Sliders & Value Readouts
  var vgsSlider = document.getElementById('vgs-slider');
  var vgsVal = document.getElementById('vgs-val');
  if (vgsSlider && Math.abs(parseFloat(vgsSlider.value) - vgs) > 0.01) vgsSlider.value = vgs.toFixed(2);
  if (vgsVal) vgsVal.textContent = vgs.toFixed(2) + 'V';

  var vdsSlider = document.getElementById('vds-slider');
  var vdsVal = document.getElementById('vds-val');
  if (vdsSlider && Math.abs(parseFloat(vdsSlider.value) - vds) > 0.01) vdsSlider.value = vds.toFixed(2);
  if (vdsVal) vdsVal.textContent = vds.toFixed(2) + 'V';

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
  var ivVgs = document.getElementById('iv-vgs-readout');
  if (ivVgs) ivVgs.textContent = vgs.toFixed(2) + ' V';
  var ivVds = document.getElementById('iv-vds-readout');
  if (ivVds) ivVds.textContent = vds.toFixed(2) + ' V';
  var ivVth = document.getElementById('iv-vth-readout');
  if (ivVth) ivVth.textContent = vth.toFixed(2) + ' V';
  var ivVov = document.getElementById('iv-vov-readout');
  if (ivVov) ivVov.textContent = vov.toFixed(2) + ' V';
  var ivWl = document.getElementById('iv-wl-readout');
  if (ivWl) ivWl.textContent = phys.wlRatio.toFixed(2);
  var ivIds = document.getElementById('iv-ids-readout');
  if (ivIds) ivIds.textContent = formatIdsText(ids);
  var ivLeff = document.getElementById('iv-leff-readout');
  if (ivLeff) ivLeff.textContent = leff.toFixed(1) + ' nm';
  var ivVdsat = document.getElementById('iv-vdsat-readout');
  if (ivVdsat) ivVdsat.textContent = vdsSat.toFixed(2) + ' V';
  var ivDl = document.getElementById('iv-dl-readout');
  if (ivDl) ivDl.textContent = phys.deltaL_nm.toFixed(1) + ' nm';

  var ivStateDesc = document.getElementById('iv-state-desc');
  if (ivStateDesc) {
    var isShortCh = phys.L < 50;
    if (region === 'CUTOFF') {
      ivStateDesc.textContent = (isShortCh && vds > 0.4)
        ? 'Cutoff · DIBL-shifted VTH (' + vth.toFixed(2) + ' V)'
        : 'Channel quenched · Subthreshold state';
    } else if (region === 'LINEAR') {
      ivStateDesc.textContent = isShortCh
        ? 'Linear · High-field velocity roll-off'
        : 'Continuous channel · Ohmic drift (v ∝ VDS)';
    } else {
      ivStateDesc.textContent = isShortCh
        ? 'DIBL + Velocity Saturation (ΔL = ' + phys.deltaL_nm.toFixed(1) + ' nm)'
        : 'Pinch-off Saturation (ΔL = ' + phys.deltaL_nm.toFixed(1) + ' nm)';
    }
  }

  // 4. Update Compatibility Telemetry Badge
  var badgeVgs = document.getElementById('badge-vgs') || document.getElementById('badge-in');
  var badgeState = document.getElementById('badge-state') || document.getElementById('badge-pmos');
  var badgeChan = document.getElementById('badge-chan') || document.getElementById('badge-nmos');
  var badgeIds = document.getElementById('badge-ids') || document.getElementById('badge-out');

  if (badgeVgs) {
    badgeVgs.textContent = vgs.toFixed(2) + ' V (' + (vgs <= vth ? 'VGS <= VTH' : 'VGS > VTH') + ')';
    badgeVgs.className = 'v ' + (region === 'CUTOFF' ? 'off' : 'on');
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
      badgeChan.textContent = 'INVERTED (CONTINUOUS)';
      badgeChan.className = 'v on';
    } else {
      badgeChan.textContent = 'PINCHED-OFF (Leff=' + leff.toFixed(1) + 'nm)';
      badgeChan.className = 'v warn';
    }
  }
  if (badgeIds) {
    badgeIds.textContent = (ids >= 0.0005 ? formatIdsText(ids) : '0.00 mA (CUTOFF)');
    badgeIds.className = 'v ' + (ids >= 0.0005 ? 'on' : 'off');
  }

  // 5. Update 2D SVG Schematic Indicators
  var schVgs = document.getElementById('sch-vgs-val');
  if (schVgs) schVgs.textContent = vgs.toFixed(2) + 'V';
  var schChan = document.getElementById('sch-channel-state');
  if (schChan) {
    schChan.textContent = region === 'CUTOFF' ? 'OFF (CUTOFF)' : (region === 'LINEAR' ? 'ON (TRIODE)' : 'ON (SAT)');
  }

  // 6. Dynamically Deform 3D Inversion Channel & Depletion Shells
  if (typeof window.updateChannelGeometry === 'function') {
    window.updateChannelGeometry(vgs, vds, ids, region, deltaL);
  }

  // 7. Redraw Live IDS-VDS Graph
  drawIdsVdsGraph(vgs, vds, ids, region);

  // 8. Rebuild Fine Carrier Flow Simulation
  if (typeof rebuildFlowCurves === 'function') {
    rebuildFlowCurves(ids, region, deltaL);
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
// LIVE IDS vs VDS CHARACTERISTIC GRAPH RENDERER
// ---------------------------------------------------------------------------
var IV_GRAPH_PAD = { L: 48, R: 38, T: 22, B: 24 };

function computeNiceYScale(peakIds) {
  var target = Math.max(0.05, peakIds * 1.15);
  var steps = [0.02, 0.03, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0];
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

function renderSingleGraph(canvas, activeVgs, activeVds, activeIds, activeRegion, isModal) {
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

  var vdsMax = 1.8;
  var vgsFamily = [0.4, 0.7, 1.0, 1.3, 1.6];

  function calcIds(testVgs, testVds) {
    return computeMosfetPoint(testVgs, testVds, geomL, geomW, geomTox).ids;
  }

  // Determine Y scale (auto or locked)
  var peakCurrent = Math.max(calcIds(1.6, vdsMax), calcIds(activeVgs, vdsMax), activeIds);
  var autoScale = computeNiceYScale(peakCurrent);
  lastAutoIdsMax = autoScale.idsMax;
  lastAutoTickStep = autoScale.tickStep;

  var idsMax = (lockYAxis && lockedIdsMax) ? lockedIdsMax : autoScale.idsMax;
  var tickStep = (lockYAxis && lockedTickStep) ? lockedTickStep : autoScale.tickStep;

  function toX(v) { return padL + (v / vdsMax) * plotW; }
  function toY(i) { return padT + plotH - (i / idsMax) * plotH; }

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
  ctx.fillText('V_DS (V)', padL + plotW / 2, padT + plotH + (isModal ? 26 : 23));

  ctx.font = tickFont;
  ctx.textAlign = 'right';
  var yDecimals = tickStep < 0.1 ? 2 : 1;
  for (var tIdx = 0; tIdx <= 3; tIdx++) {
    var iTick = tIdx * tickStep;
    if (iTick > idsMax * 0.99) break;
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
  ctx.fillText('I_DS (mA)', 0, 0);
  ctx.restore();

  // Clip plot area so curves exceeding locked Y-axis stay neatly inside axes
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  // Draw Velocity-Saturated Pinch-Off Boundary Curve: Vov(v) = v * EsatL / (EsatL - v)
  var refPt = computeMosfetPoint(1.0, 0.0, geomL, geomW, geomTox);
  var esatL = refPt.esatL;
  ctx.strokeStyle = pinchOffColor;
  ctx.lineWidth = isModal ? 1.5 : 1.3;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  var startedPinch = false;
  var maxBoundaryV = Math.min(vdsMax, esatL * 0.94);
  for (var v = 0; v <= maxBoundaryV; v += 0.015) {
    var vovReq = (v * esatL) / Math.max(0.005, esatL - v);
    var ptAtV = computeMosfetPoint(refPt.vth + vovReq, v, geomL, geomW, geomTox);
    var iBoundary = 0.5 * ptAtV.kn * vovReq * v;
    if (iBoundary > idsMax * 1.15) break;
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

  function getSamplePoints(vdsSatHint, maxV, baseStep) {
    var pts = [];
    for (var sv = 0; sv <= maxV + 0.0001; sv += baseStep) {
      pts.push(Math.min(maxV, sv));
    }
    if (vdsSatHint > 0.001 && vdsSatHint < maxV) {
      pts.push(vdsSatHint);
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

  // Draw Family of VGS Curves
  var labelPositions = [];
  vgsFamily.forEach(function(fVgs) {
    var midState = computeMosfetPoint(fVgs, 0.2, geomL, geomW, geomTox);
    var pts = getSamplePoints(midState.vdsSat, vdsMax, 0.03);
    ctx.strokeStyle = dimmedCurveColor;
    ctx.lineWidth = isModal ? 1.4 : 1.2;
    ctx.beginPath();
    for (var idx = 0; idx < pts.length; idx++) {
      var pv = pts[idx];
      var pi = calcIds(fVgs, pv);
      var px = toX(pv);
      var py = toY(pi);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    var endI = calcIds(fVgs, vdsMax);
    labelPositions.push({
      vgs: fVgs,
      endI: endI,
      rawY: toY(endI) + 3
    });
  });

  // Draw Highlighted Active VGS Curve
  var activeMid = computeMosfetPoint(activeVgs, activeVds, geomL, geomW, geomTox);
  var activePts = getSamplePoints(activeMid.vdsSat, vdsMax, 0.025);
  ctx.strokeStyle = activeCurveColor;
  ctx.lineWidth = isModal ? 2.8 : 2.4;
  ctx.beginPath();
  for (var idx = 0; idx < activePts.length; idx++) {
    var av = activePts[idx];
    var ai = calcIds(activeVgs, av);
    var px = toX(av);
    var py = toY(ai);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Crosshairs & Active Operating Point Dot
  var dotX = toX(activeVds);
  var dotY = toY(activeIds);
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
  var labelX = toX(vdsMax) + 5;
  ctx.fillStyle = activeCurveColor;
  ctx.font = (isModal ? '700 9.5px' : '700 8.5px') + ' "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('V_GS', labelX, padT - 6);

  var minSpacing = isModal ? 16 : 13;
  var lastY = toY(0) + 3;
  var minTopY = padT + 9;
  for (var k = 0; k < labelPositions.length; k++) {
    var lp = labelPositions[k];
    if (lp.endI > idsMax * 0.98) continue;
    var finalY = Math.max(minTopY, Math.min(lp.rawY, lastY - (k > 0 ? minSpacing : 0)));
    lastY = finalY;
    ctx.fillStyle = textColor;
    ctx.font = (isModal ? '9.5px' : '8.5px') + ' "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(lp.vgs.toFixed(1) + 'V', labelX, finalY);
  }

  ctx.restore();
}

function drawIdsVdsGraph(activeVgs, activeVds, activeIds, activeRegion) {
  var phys = (typeof window.getMosfetPhysicsState === 'function') ? window.getMosfetPhysicsState() : null;
  var vgs = (typeof activeVgs === 'number') ? activeVgs : (phys ? phys.vgs : currentVgs);
  var vds = (typeof activeVds === 'number') ? activeVds : (phys ? phys.vds : currentVds);
  var ids = (typeof activeIds === 'number') ? activeIds : (phys ? phys.ids : (typeof currentIds === 'number' ? currentIds : 0.10));
  var reg = activeRegion || (phys ? phys.region : (typeof currentRegion === 'string' ? currentRegion : 'SATURATION'));

  var inlineCanvas = document.getElementById('iv-canvas');
  if (inlineCanvas) {
    renderSingleGraph(inlineCanvas, vgs, vds, ids, reg, false);
  }

  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalCanvas = document.getElementById('iv-modal-canvas');
  if (modalCanvas && modalBackdrop && modalBackdrop.style.display !== 'none') {
    renderSingleGraph(modalCanvas, vgs, vds, ids, reg, true);
  }

  // Update modal readouts if present
  var mVgs = document.getElementById('iv-m-vgs');
  var mVds = document.getElementById('iv-m-vds');
  var mVth = document.getElementById('iv-m-vth');
  var mWl = document.getElementById('iv-m-wl');
  var mIds = document.getElementById('iv-m-ids');
  var mLeff = document.getElementById('iv-m-leff');
  var mReg = document.getElementById('iv-m-region');
  if (mVgs) mVgs.textContent = vgs.toFixed(2) + ' V';
  if (mVds) mVds.textContent = vds.toFixed(2) + ' V';
  if (mVth && phys) mVth.textContent = phys.vth.toFixed(2) + ' V';
  if (mWl && phys) mWl.textContent = phys.wlRatio.toFixed(2);
  if (mIds) mIds.textContent = formatIdsText(ids || 0);
  if (mLeff && phys) mLeff.textContent = phys.leff.toFixed(1) + ' nm';
  if (mReg) mReg.textContent = reg;
}

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
  drawIdsVdsGraph();
}

// ---------------------------------------------------------------------------
// INTERACTIVE EVENT LISTENERS & INITIALIZATION
// ---------------------------------------------------------------------------
function initLogicStateControls() {
  var vgsSlider = document.getElementById('vgs-slider');
  if (vgsSlider) {
    vgsSlider.addEventListener('input', function(e) {
      currentVgs = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  var vdsSlider = document.getElementById('vds-slider');
  if (vdsSlider) {
    vdsSlider.addEventListener('input', function(e) {
      currentVds = parseFloat(e.target.value);
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

  // Operating Region Preset Buttons
  function applyPreset(preset) {
    if (preset === 'cutoff') {
      currentVgs = 0.00;
      currentVds = 0.80;
    } else if (preset === 'linear') {
      currentVgs = 1.00;
      var st = computeMosfetPoint(currentVgs, 0.10, geomL, geomW, geomTox);
      currentVds = Math.max(0.05, Math.min(0.30, Math.floor(st.vdsSat * 0.65 * 20) / 20));
    } else if (preset === 'saturation') {
      currentVgs = 1.00;
      currentVds = 0.80;
    }
    applyLogicState();
  }

  document.querySelectorAll('[data-preset]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyPreset(btn.dataset.preset);
    });
  });

  // Lock Y-Axis Toggles (inline & modal)
  var lockBtn = document.getElementById('iv-lock-y-btn');
  if (lockBtn) lockBtn.addEventListener('click', toggleLockYAxis);
  var modalLockBtn = document.getElementById('iv-modal-lock-y-btn');
  if (modalLockBtn) modalLockBtn.addEventListener('click', toggleLockYAxis);

  // Interactive Graph Canvas: Drag or Click to modulate VDS
  function bindCanvasPointer(c, isModal) {
    if (!c) return;
    var isDragging = false;

    function handleGraphPointer(e) {
      var rect = c.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var scaleX = c.width / rect.width;

      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var canvasX = (clientX - rect.left) * scaleX;

      var padL = (isModal ? 56 : IV_GRAPH_PAD.L) * (scaleX || 1);
      var padR = (isModal ? 46 : IV_GRAPH_PAD.R) * (scaleX || 1);
      var plotW = c.width - padL - padR;

      var clickX = canvasX - padL;
      var normX = Math.max(0, Math.min(1.0, clickX / plotW));

      currentVds = Math.round(normX * 1.8 * 20) / 20;
      applyLogicState();
    }

    c.addEventListener('mousedown', function(e) {
      isDragging = true;
      handleGraphPointer(e);
    });
    window.addEventListener('mousemove', function(e) {
      if (isDragging) handleGraphPointer(e);
    });
    window.addEventListener('mouseup', function() {
      isDragging = false;
    });

    c.addEventListener('touchstart', function(e) {
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

  // Expandable Graph Modal Controls
  var expandBtn = document.getElementById('iv-expand-btn');
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalCloseBtn = document.getElementById('iv-modal-close');
  var modalResizeObserver = null;

  function openIvModal() {
    if (!modalBackdrop) return;
    modalBackdrop.style.display = 'flex';
    if (!modalResizeObserver && typeof ResizeObserver !== 'undefined' && modalCanvas) {
      modalResizeObserver = new ResizeObserver(function() {
        if (modalBackdrop.style.display !== 'none') drawIdsVdsGraph();
      });
      modalResizeObserver.observe(modalCanvas.parentElement || modalCanvas);
    }
    drawIdsVdsGraph();
    requestAnimationFrame(drawIdsVdsGraph);
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
      vgs: {
        title: 'Gate-to-Source Bias (V<sub>GS</sub>)',
        param: 'Electrostatic Gate Control Voltage: 0.00 V to 1.80 V',
        formula: 'V<sub>OV</sub> = V<sub>GS</sub> − V<sub>TH</sub>   |   Q<sub>inv</sub> ∝ C<sub>ox</sub> · V<sub>OV</sub>',
        increase: 'Deepens the inversion channel; jumps to a higher I-V curve with larger <code>I<sub>DS</sub></code> and higher <code>V<sub>Dsat</sub></code>.',
        decrease: 'Weakens the channel; below <code>V<sub>TH</sub></code>, the inversion layer vanishes (Cutoff, <code>I<sub>DS</sub> ≈ 0</code>) and bulk holes return toward the oxide.',
        tradeoff: 'Higher <code>V<sub>GS</sub></code> boosts switching speed and drive current <code>I<sub>on</sub></code>, but raises dynamic switching power (<code>P ∝ C·V<sub>DD</sub>²</code>) and vertical gate oxide field stress.',
        theorySection: 'nmos-inversion'
      },
      vds: {
        title: 'Drain-to-Source Bias (V<sub>DS</sub>)',
        param: 'Lateral Channel Acceleration Bias: 0.00 V to 1.80 V',
        formula: 'Linear (V<sub>DS</sub> &lt; V<sub>Dsat</sub>)  →  Saturation (V<sub>DS</sub> ≥ V<sub>Dsat</sub>)',
        increase: 'Moves the operating point right along the active curve. Past <code>V<sub>Dsat</sub></code>, pinch-off (<code>ΔL</code>) grows and DIBL slightly lowers <code>V<sub>TH</sub></code> in short channels.',
        decrease: 'Reduces lateral electric field; returns the device to the Linear (Triode) region.',
        tradeoff: 'High <code>V<sub>DS</sub></code> maximizes saturation sweep velocity, but aggravates DIBL leakage, hot-carrier injection near the drain, and finite output resistance <code>r<sub>o</sub></code>.',
        theorySection: 'nmos-pinchoff'
      },
      geomL: {
        title: 'Channel Length (L)',
        param: 'Physical Metallurgical Gate Length: 20 nm to 200 nm',
        formula: 'I<sub>DS</sub> ∝ 1/L   |   λ ∝ 1/L   |   ΔV<sub>TH,SCE</sub> ∝ exp(−L / L<sub>c</sub>)',
        increase: 'Lowers <code>I<sub>DS</sub></code> and flattens saturation curves (higher <code>r<sub>o</sub></code>). Short-channel effects (DIBL, <code>V<sub>TH</sub></code> roll-off) fade out.',
        decrease: 'Boosts drive current <code>I<sub>DS</sub></code>, tilts saturation curves upward, lowers <code>V<sub>TH</sub></code> (roll-off), and triggers velocity saturation.',
        tradeoff: 'Scaling <code>L</code> shrinks transistor footprint and boosts cutoff frequency <code>f<sub>T</sub></code>, at the cost of stronger DIBL, <code>V<sub>TH</sub></code> variability, and higher off-state leakage.',
        theorySection: 'nmos-secondorder'
      },
      geomW: {
        title: 'Channel Width (W)',
        param: 'Active Transverse Gate Width: 40 nm to 400 nm',
        formula: 'I<sub>DS</sub> ∝ W   |   k<sub>n</sub> = μ<sub>n</sub> · C<sub>ox</sub> · (W / L)',
        increase: 'Widens the conductive path in 3D; scales the entire I-V family upward proportionally without changing <code>V<sub>TH</sub></code> or curve shape.',
        decrease: 'Narrows the channel, scaling <code>I<sub>DS</sub></code> down proportionally.',
        tradeoff: 'Wider devices drive heavier capacitive loads faster, but linearly increase layout footprint and gate input capacitance (<code>C<sub>g</sub> = C<sub>ox</sub>·W·L</code>).',
        theorySection: 'nmos-equations'
      },
      geomTox: {
        title: 'Gate Oxide Thickness (t<sub>ox</sub>)',
        param: 'Effective Equivalent Oxide Thickness (EOT): 1.2 nm to 10.0 nm',
        formula: 'C<sub>ox</sub> = ε<sub>ox</sub> / t<sub>ox</sub>   |   I<sub>DS</sub> ∝ C<sub>ox</sub>   |   V<sub>TH0</sub> ∝ t<sub>ox</sub>',
        increase: 'Weakens gate capacitive control; lowers <code>I<sub>DS</sub></code> across all curves and slightly raises <code>V<sub>TH</sub></code>.',
        decrease: 'Strengthens gate control; boosts <code>I<sub>DS</sub></code> and lowers <code>V<sub>TH</sub></code>.',
        tradeoff: 'Scaling SiO₂ below ~1.5 nm triggers exponential quantum-mechanical direct-tunneling gate leakage—motivating High-k HfO₂ stacks with thinner EOT.',
        theorySection: 'nmos-inversion'
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogicStateControls);
} else {
  initLogicStateControls();
}
