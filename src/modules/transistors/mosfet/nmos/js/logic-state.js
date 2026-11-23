/**
 * logic-state.js - NMOS CAD Viewer
 * Continuous MOSFET Operating-Region Physics Engine & Live IDS-VDS Graph:
 * - Delineates Cutoff (VGS < VTH), Linear/Triode (VDS < VGS - VTH), and Saturation (VDS >= VGS - VTH).
 * - Computes drain current IDS with channel-length modulation lambda.
 * - Live interactive IDS vs VDS graph renderer with active operating point dot and pinch-off locus.
 * - Two-way coupled to 3D inversion channel taper/pinch-off and fine carrier particle flow.
 */

// MOSFET Physical Constants (28nm High-Performance HKMG node illustrative model)
var VTH = 0.40;          // Threshold voltage (V)
var KN_PRIME = 1.0;      // Conduction parameter kn' = mu_n * Cox * (W/L) (mA/V^2)
var LAMBDA = 0.08;       // Channel-length modulation parameter (1/V)
var NOMINAL_L = 28.0;    // Gate length (nm)
var MODEL_L = 2.0;       // 3D coordinate length along X

// Active continuous bias states
var currentVgs = 1.00;   // Gate-to-Source bias (0.00V to 1.80V)
var currentVds = 0.80;   // Drain-to-Source bias (0.00V to 1.80V)
var currentIn = 1;       // Backward-compatibility flag (1 = ON, 0 = OFF/Cutoff)

// Public accessor for other modules (e.g. flow.js)
window.getMosfetPhysicsState = function() {
  var vov = Math.max(0, currentVgs - VTH);
  var vdsSat = vov;
  var region = 'CUTOFF';
  var ids = 0.0;
  var deltaL = 0.0;

  if (vov <= 0.001) {
    region = 'CUTOFF';
    ids = 0.0;
  } else if (currentVds < vdsSat) {
    region = 'LINEAR';
    ids = KN_PRIME * (vov * currentVds - 0.5 * currentVds * currentVds);
  } else {
    region = 'SATURATION';
    var vdsDiff = currentVds - vdsSat;
    ids = 0.5 * KN_PRIME * vov * vov * (1.0 + LAMBDA * vdsDiff);
    deltaL = MODEL_L * Math.min(0.38, 0.22 * Math.sqrt(Math.max(0, vdsDiff)));
  }

  var leff = NOMINAL_L * (1.0 - (deltaL / MODEL_L));

  return {
    vgs: currentVgs,
    vds: currentVds,
    vth: VTH,
    vov: vov,
    vdsSat: vdsSat,
    ids: Math.max(0, ids),
    region: region,
    deltaL: deltaL,
    leff: leff
  };
};

// ---------------------------------------------------------------------------
// APPLY STATE: Drives Topbar, Graph, 3D Channel, Telemetry & Carrier Flow
// ---------------------------------------------------------------------------
function applyLogicState() {
  var phys = window.getMosfetPhysicsState();
  var vgs = phys.vgs;
  var vds = phys.vds;
  var vov = phys.vov;
  var ids = phys.ids;
  var region = phys.region;
  var deltaL = phys.deltaL;
  var leff = phys.leff;

  currentIn = (region === 'CUTOFF') ? 0 : 1;

  // 1. Update Topbar Sliders & Value Readouts
  var vgsSlider = document.getElementById('vgs-slider');
  var vgsVal = document.getElementById('vgs-val');
  if (vgsSlider && Math.abs(parseFloat(vgsSlider.value) - vgs) > 0.01) vgsSlider.value = vgs.toFixed(2);
  if (vgsVal) vgsVal.textContent = vgs.toFixed(2) + 'V';

  var vdsSlider = document.getElementById('vds-slider');
  var vdsVal = document.getElementById('vds-val');
  if (vdsSlider && Math.abs(parseFloat(vdsSlider.value) - vds) > 0.01) vdsSlider.value = vds.toFixed(2);
  if (vdsVal) vdsVal.textContent = vds.toFixed(2) + 'V';

  // 2. Update Topbar Region Badge & Presets
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

  // 3. Update HUD Graph Pill & Readouts
  var hudRegionPill = document.getElementById('iv-hud-region-pill');
  if (hudRegionPill) {
    hudRegionPill.textContent = region === 'LINEAR' ? 'LINEAR' : region;
    hudRegionPill.className = 'region-pill ' + region.toLowerCase();
  }

  var ivVgs = document.getElementById('iv-vgs-readout');
  if (ivVgs) ivVgs.textContent = vgs.toFixed(2) + ' V';
  var ivVds = document.getElementById('iv-vds-readout');
  if (ivVds) ivVds.textContent = vds.toFixed(2) + ' V';
  var ivVov = document.getElementById('iv-vov-readout');
  if (ivVov) ivVov.textContent = vov.toFixed(2) + ' V';
  var ivIds = document.getElementById('iv-ids-readout');
  if (ivIds) ivIds.textContent = (ids >= 0.01 ? ids.toFixed(2) : '≈ 0') + ' mA';
  var ivLeff = document.getElementById('iv-leff-readout');
  if (ivLeff) ivLeff.textContent = leff.toFixed(1) + ' nm';

  var ivStateDesc = document.getElementById('iv-state-desc');
  if (ivStateDesc) {
    if (region === 'CUTOFF') {
      ivStateDesc.textContent = 'Channel quenched · Subthreshold state';
    } else if (region === 'LINEAR') {
      ivStateDesc.textContent = 'Continuous channel · Ohmic drift (v ∝ VDS)';
    } else {
      ivStateDesc.textContent = 'Pinch-off ΔL = ' + (NOMINAL_L - leff).toFixed(1) + ' nm · High-field sweep';
    }
  }

  document.querySelectorAll('#ids-vds-hud .iv-preset-btn').forEach(function(btn) {
    var p = btn.dataset.preset;
    btn.classList.toggle('active', (region === 'CUTOFF' && p === 'cutoff') ||
                                   (region === 'LINEAR' && p === 'linear') ||
                                   (region === 'SATURATION' && p === 'saturation'));
  });

  // 4. Update HUD Status Telemetry Badge
  var badgeVgs = document.getElementById('badge-vgs') || document.getElementById('badge-in');
  var badgeState = document.getElementById('badge-state') || document.getElementById('badge-pmos');
  var badgeChan = document.getElementById('badge-chan') || document.getElementById('badge-nmos');
  var badgeIds = document.getElementById('badge-ids') || document.getElementById('badge-out');

  if (badgeVgs) {
    badgeVgs.textContent = vgs.toFixed(2) + ' V (' + (vgs <= VTH ? 'VGS < VTH' : 'VGS > VTH') + ')';
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
    badgeIds.textContent = (ids >= 0.01 ? ids.toFixed(2) + ' mA' : '0.00 mA (CUTOFF)');
    badgeIds.className = 'v ' + (ids >= 0.01 ? 'on' : 'off');
  }

  // 5. Update 2D SVG Schematic Indicators
  var schVgs = document.getElementById('sch-vgs-val');
  if (schVgs) schVgs.textContent = vgs.toFixed(2) + 'V';
  var schChan = document.getElementById('sch-channel-state');
  if (schChan) {
    schChan.textContent = region === 'CUTOFF' ? 'OFF (CUTOFF)' : (region === 'LINEAR' ? 'ON (TRIODE)' : 'ON (SAT)');
  }

  // 6. Dynamically Deform 3D Inversion Channel in Real-Time
  if (typeof window.updateChannelGeometry === 'function') {
    window.updateChannelGeometry(vgs, vds, ids, region, deltaL);
  }

  // 7. Redraw Live IDS-VDS Graph
  drawIdsVdsGraph(vgs, vds, ids, region);

  // 8. Rebuild Fine Carrier Flow Simulation
  if (typeof rebuildFlowCurves === 'function') {
    rebuildFlowCurves(ids, region, deltaL);
  }

  // 9. Update Context for AI Voice Assistant
  if (typeof lastSelectedId !== 'undefined' && lastSelectedId && typeof window.updateVoiceAssistantContext === 'function') {
    window.updateVoiceAssistantContext(lastSelectedId, idToInfo(lastSelectedId));
  }
}

// ---------------------------------------------------------------------------
// LIVE IDS vs VDS CHARACTERISTIC GRAPH RENDERER
// ---------------------------------------------------------------------------
var IV_GRAPH_PAD = { L: 38, R: 36, T: 18, B: 28 };

function drawIdsVdsGraph(activeVgs, activeVds, activeIds, activeRegion) {
  var canvas = document.getElementById('iv-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var W = rect.width || 310;
  var H = rect.height || 225;

  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  var isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // Palette
  var bgColor = isLight ? '#f8fafc' : '#080c12';
  var gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  var axisColor = isLight ? '#94a3b8' : '#232b38';
  var textColor = isLight ? '#64748b' : '#7d8ba0';
  var dimmedCurveColor = isLight ? 'rgba(13,148,136,0.24)' : 'rgba(95,217,196,0.20)';
  var activeCurveColor = isLight ? '#0d9488' : '#5fd9c4';
  var pinchOffColor = isLight ? '#d97706' : '#f59e0b';
  var dotColor = activeRegion === 'CUTOFF' ? '#dc2626' : (activeRegion === 'SATURATION' ? '#10b981' : '#0284c7');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Margins
  var padL = IV_GRAPH_PAD.L;
  var padR = IV_GRAPH_PAD.R;
  var padT = IV_GRAPH_PAD.T;
  var padB = IV_GRAPH_PAD.B;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;

  var vdsMax = 1.8;
  var idsMax = 1.15; // mA

  function toX(v) { return padL + (v / vdsMax) * plotW; }
  function toY(i) { return padT + plotH - (i / idsMax) * plotH; }

  // Draw Grid Lines & Tick Labels
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = textColor;
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';

  // VDS ticks: 0, 0.6, 1.2, 1.8
  [0, 0.6, 1.2, 1.8].forEach(function(v) {
    var x = toX(v);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), x, padT + plotH + 14);
  });
  ctx.font = '600 10px "IBM Plex Mono", monospace';
  ctx.fillText('V_DS (V)', padL + plotW / 2, padT + plotH + 26);

  // IDS ticks: 0, 0.3, 0.6, 0.9
  ctx.font = '10px "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  [0, 0.3, 0.6, 0.9].forEach(function(i) {
    var y = toY(i);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(i.toFixed(1), padL - 6, y + 3.5);
  });

  ctx.save();
  ctx.translate(11, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = '600 10px "IBM Plex Mono", monospace';
  ctx.fillText('I_DS (mA)', 0, 0);
  ctx.restore();

  // Draw Pinch-off Parabolic Boundary Curve: VDS = VGS - VTH => IDS = 0.5 * KN * VDS^2
  ctx.strokeStyle = pinchOffColor;
  ctx.lineWidth = 1.3;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  var startedPinch = false;
  for (var v = 0; v <= vdsMax; v += 0.04) {
    var iBoundary = 0.5 * KN_PRIME * v * v;
    if (iBoundary > idsMax) break;
    var px = toX(v);
    var py = toY(iBoundary);
    if (!startedPinch) { ctx.moveTo(px, py); startedPinch = true; }
    else { ctx.lineTo(px, py); }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels for Linear and Saturation regions
  ctx.font = '8.5px "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? 'rgba(74,146,201,0.7)' : 'rgba(74,146,201,0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('TRIODE / LINEAR', padL + 8, padT + 14);
  ctx.fillStyle = isLight ? 'rgba(16,185,129,0.7)' : 'rgba(87,207,143,0.55)';
  ctx.textAlign = 'right';
  ctx.fillText('SATURATION', padL + plotW - 6, padT + 14);

  // Helper to compute IDS(VDS) for a given VGS (Continuous at pinch-off VDS = VOV)
  function calcIds(testVgs, testVds) {
    var vov = Math.max(0, testVgs - VTH);
    if (vov <= 0.001) return 0;
    var vdsSat = vov;
    if (testVds < vdsSat) {
      return KN_PRIME * (vov * testVds - 0.5 * testVds * testVds);
    } else {
      return 0.5 * KN_PRIME * vov * vov * (1.0 + LAMBDA * (testVds - vdsSat));
    }
  }

  // Generates curve sampling coordinates that strictly include the boundary point v = vov
  function getSamplePoints(vov, maxV, baseStep) {
    var pts = [];
    for (var v = 0; v <= maxV + 0.0001; v += baseStep) {
      pts.push(Math.min(maxV, v));
    }
    if (vov > 0.001 && vov < maxV) {
      pts.push(vov);
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
  var vgsFamily = [0.4, 0.7, 1.0, 1.3, 1.6];
  var labelPositions = [];

  vgsFamily.forEach(function(fVgs) {
    var fVov = Math.max(0, fVgs - VTH);
    var pts = getSamplePoints(fVov, vdsMax, 0.04);
    ctx.strokeStyle = dimmedCurveColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (var idx = 0; idx < pts.length; idx++) {
      var v = pts[idx];
      var i = calcIds(fVgs, v);
      var px = toX(v);
      var py = toY(i);
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

  // Space curve labels cleanly to prevent overlapping (e.g. 0.4V and 0.7V near zero current)
  // Process ascending by endI (bottom of graph to top)
  var minSpacing = 13; // px
  var lastY = toY(0) + 3;
  for (var k = 0; k < labelPositions.length; k++) {
    var lp = labelPositions[k];
    if (lp.endI >= idsMax * 0.99) continue;
    var finalY = Math.min(lp.rawY, lastY - (k > 0 ? minSpacing : 0));
    lastY = finalY;
    ctx.fillStyle = textColor;
    ctx.font = '8.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(lp.vgs.toFixed(1) + 'V', toX(vdsMax) + 3, finalY);
  }

  // Draw Highlighted Active VGS Curve
  var activeVov = Math.max(0, activeVgs - VTH);
  var activePts = getSamplePoints(activeVov, vdsMax, 0.03);
  ctx.strokeStyle = activeCurveColor;
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (var idx = 0; idx < activePts.length; idx++) {
    var v = activePts[idx];
    var i = calcIds(activeVgs, v);
    var px = toX(v);
    var py = toY(i);
    if (idx === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw Crosshairs to Operating Point
  var dotX = toX(activeVds);
  var dotY = toY(activeIds);

  ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(dotX, padT + plotH);
  ctx.lineTo(dotX, dotY);
  ctx.lineTo(padL, dotY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Glowing Active Operating Point Dot (VDS, IDS)
  ctx.beginPath();
  ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
  ctx.fillStyle = isLight ? 'rgba(13,148,136,0.25)' : 'rgba(95,217,196,0.30)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(dotX, dotY, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = dotColor;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// INTERACTIVE EVENT LISTENERS & INITIALIZATION
// ---------------------------------------------------------------------------
function initLogicStateControls() {
  // Topbar VGS Slider
  var vgsSlider = document.getElementById('vgs-slider');
  if (vgsSlider) {
    vgsSlider.addEventListener('input', function(e) {
      currentVgs = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  // Topbar VDS Slider
  var vdsSlider = document.getElementById('vds-slider');
  if (vdsSlider) {
    vdsSlider.addEventListener('input', function(e) {
      currentVds = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  // Preset Buttons (Topbar & HUD)
  function applyPreset(preset) {
    if (preset === 'cutoff') {
      currentVgs = 0.00;
      currentVds = 0.80;
    } else if (preset === 'linear') {
      currentVgs = 1.00;
      currentVds = 0.30;
    } else if (preset === 'saturation') {
      currentVgs = 1.00;
      currentVds = 1.00;
    }
    applyLogicState();
  }

  document.querySelectorAll('[data-preset]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyPreset(btn.dataset.preset);
    });
  });

  // Toggle HUD Collapsible Section
  var ivHudToggle = document.getElementById('iv-hud-toggle');
  var ivHudBody = document.getElementById('iv-hud-body');
  var ivHudChev = document.getElementById('iv-hud-chev');
  if (ivHudToggle && ivHudBody) {
    ivHudToggle.addEventListener('click', function() {
      var isCollapsed = ivHudBody.classList.toggle('collapsed');
      if (ivHudChev) ivHudChev.classList.toggle('closed', isCollapsed);
    });
  }

  // Interactive Graph Canvas: Drag or Click to modulate VDS and VGS
  var canvas = document.getElementById('iv-canvas');
  if (canvas) {
    var isDragging = false;

    function handleGraphPointer(e) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var scaleX = canvas.width / rect.width;
      var scaleY = canvas.height / rect.height;

      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;

      var canvasX = (clientX - rect.left) * scaleX;
      var canvasY = (clientY - rect.top) * scaleY;

      var padL = IV_GRAPH_PAD.L, padR = IV_GRAPH_PAD.R;
      var padT = IV_GRAPH_PAD.T, padB = IV_GRAPH_PAD.B;
      var plotW = canvas.width - padL - padR;
      var plotH = canvas.height - padT - padB;

      var clickX = canvasX - padL;
      var clickY = canvasY - padT;

      var normX = Math.max(0, Math.min(1.0, clickX / plotW));
      var normY = Math.max(0, Math.min(1.0, 1.0 - (clickY / plotH)));

      currentVds = Math.round(normX * 1.8 * 20) / 20; // 0.05V step
      applyLogicState();
    }

    canvas.addEventListener('mousedown', function(e) {
      isDragging = true;
      handleGraphPointer(e);
    });
    window.addEventListener('mousemove', function(e) {
      if (isDragging) handleGraphPointer(e);
    });
    window.addEventListener('mouseup', function() {
      isDragging = false;
    });

    canvas.addEventListener('touchstart', function(e) {
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogicStateControls);
} else {
  initLogicStateControls();
}
