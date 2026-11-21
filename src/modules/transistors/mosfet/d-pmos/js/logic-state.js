/**
 * logic-state.js - Depletion-Mode PMOS (D-PMOS) CAD Viewer
 * Continuous D-PMOS Operating-Region Physics Engine & Live ISD-VSD Graph:
 * - Implanted P-channel provides pre-existing conduction at VGS = 0V (Normally ON).
 * - Threshold voltage VTH,p = +0.80V.
 * - Gate overdrive VOV = VTH,p - VGS.
 * - Delineates:
 *     1. Cutoff: VGS >= VTH,p (VOV <= 0), channel depleted of holes, ISD = 0.
 *     2. Depletion Mode: 0 < VGS < VTH,p, positive gate repels holes, thinning channel.
 *     3. Zero Bias: VGS = 0V, baseline implanted P-channel conduction.
 *     4. Enhancement Mode: VGS < 0, negative gate accumulates extra holes, thickening channel.
 * - Triode / Linear: VSD < VOV => ISD = kp * (VOV * VSD - 0.5 * VSD^2).
 * - Saturation: VSD >= VOV => ISD = 0.5 * kp * VOV^2 * (1 + lambda * (VSD - VOV)).
 * - Strictly continuous across pinch-off boundary (zero downward kink).
 */

// D-PMOS Physical Constants
var VTH_P = 0.80;         // Threshold voltage VTH,p (+0.80V)
var KP_PRIME = 0.65;      // Conduction parameter kp' = mu_p * Cox * (Wp/L) (mA/V^2)
var LAMBDA_P = 0.08;      // Channel-length modulation parameter (1/V)
var NOMINAL_L = 28.0;     // Gate length (nm)
var MODEL_L = 2.0;        // 3D coordinate length along X

// Active continuous bias states (Initialized to Normally-ON Zero Gate Bias)
var currentVgs = 0.00;    // Gate-to-Source bias (-1.00V to +1.20V, default 0.00V)
var currentVsd = 0.80;    // Source-to-Drain bias (0.00V to 1.80V, default 0.80V)
var currentIn = 0;        // Backward-compatibility flag (0 = ON, 1 = OFF/Cutoff)

// Public accessor for other modules (e.g. flow.js, scene.js)
window.getMosfetPhysicsState = function() {
  var vov = Math.max(0, VTH_P - currentVgs);
  var vsdSat = vov;
  var region = 'CUTOFF';
  var isd = 0.0;
  var deltaL = 0.0;

  if (vov <= 0.001) {
    region = 'CUTOFF';
    isd = 0.0;
  } else if (currentVsd < vsdSat) {
    region = 'LINEAR';
    isd = KP_PRIME * (vov * currentVsd - 0.5 * currentVsd * currentVsd);
  } else {
    region = 'SATURATION';
    var vsdDiff = currentVsd - vsdSat;
    isd = 0.5 * KP_PRIME * vov * vov * (1.0 + LAMBDA_P * vsdDiff);
    deltaL = MODEL_L * Math.min(0.38, 0.22 * Math.sqrt(Math.max(0, vsdDiff)));
  }

  var leff = NOMINAL_L * (1.0 - (deltaL / MODEL_L));
  var mode = (currentVgs >= VTH_P) ? 'cutoff' : (currentVgs > 0.02 ? 'depletion' : (Math.abs(currentVgs) <= 0.02 ? 'zero' : 'enhancement'));

  return {
    vgs: currentVgs,
    vsd: currentVsd,
    vth: VTH_P,
    vov: vov,
    vsdSat: vsdSat,
    isd: Math.max(0, isd),
    ids: Math.max(0, isd),
    region: region,
    mode: mode,
    deltaL: deltaL,
    leff: leff
  };
};

// ---------------------------------------------------------------------------
// APPLY STATE: Drives Topbar, Graph, 3D Channel, Telemetry & Hole Flow
// ---------------------------------------------------------------------------
function applyLogicState() {
  var phys = window.getMosfetPhysicsState();
  var vgs = phys.vgs;
  var vsd = phys.vsd;
  var vov = phys.vov;
  var isd = phys.isd;
  var region = phys.region;
  var mode = phys.mode;
  var deltaL = phys.deltaL;
  var leff = phys.leff;

  currentIn = (region === 'CUTOFF') ? 1 : 0;

  // 1. Update Topbar Sliders & Value Readouts
  var vgsSlider = document.getElementById('vgs-slider') || document.getElementById('vsg-slider');
  var vgsVal = document.getElementById('vgs-val') || document.getElementById('vsg-val');
  if (vgsSlider && Math.abs(parseFloat(vgsSlider.value) - vgs) > 0.01) vgsSlider.value = vgs.toFixed(2);
  if (vgsVal) vgsVal.textContent = vgs.toFixed(2) + 'V';

  var vsdSlider = document.getElementById('vsd-slider');
  var vsdVal = document.getElementById('vsd-val');
  if (vsdSlider && Math.abs(parseFloat(vsdSlider.value) - vsd) > 0.01) vsdSlider.value = vsd.toFixed(2);
  if (vsdVal) vsdVal.textContent = vsd.toFixed(2) + 'V';

  // 2. Update Topbar Region Badge & Presets
  var regionBadge = document.getElementById('region-badge');
  if (regionBadge) {
    regionBadge.textContent = region === 'LINEAR' ? 'LINEAR / TRIODE' : region;
    regionBadge.className = 'region-badge-pill ' + region.toLowerCase();
  }

  document.querySelectorAll('#region-preset-seg button').forEach(function(b) {
    var p = b.dataset.preset;
    b.classList.toggle('active', (p === mode));
  });

  // 3. Update HUD Graph Pill & Readouts
  var hudRegionPill = document.getElementById('iv-hud-region-pill');
  if (hudRegionPill) {
    hudRegionPill.textContent = region === 'LINEAR' ? 'LINEAR' : region;
    hudRegionPill.className = 'region-pill ' + region.toLowerCase();
  }

  var ivVgs = document.getElementById('iv-vgs-readout') || document.getElementById('iv-vsg-readout');
  if (ivVgs) ivVgs.textContent = vgs.toFixed(2) + ' V';
  var ivVsd = document.getElementById('iv-vsd-readout');
  if (ivVsd) ivVsd.textContent = vsd.toFixed(2) + ' V';
  var ivVov = document.getElementById('iv-vov-readout');
  if (ivVov) ivVov.textContent = vov.toFixed(2) + ' V';
  var ivIsd = document.getElementById('iv-isd-readout') || document.getElementById('iv-ids-readout');
  if (ivIsd) ivIsd.textContent = (isd >= 0.01 ? isd.toFixed(2) : '0.00') + ' mA';
  var ivLeff = document.getElementById('iv-leff-readout');
  if (ivLeff) ivLeff.textContent = leff.toFixed(1) + ' nm';

  var ivStateDesc = document.getElementById('iv-state-desc');
  if (ivStateDesc) {
    if (region === 'CUTOFF') {
      ivStateDesc.textContent = 'Implanted P-channel depleted · Zero conduction (VGS ≥ +0.80V)';
    } else if (mode === 'depletion') {
      ivStateDesc.textContent = (region === 'LINEAR') ?
        'Depleted channel · Triode hole drift' :
        'Depleted channel · Pinch-off ΔL = ' + (NOMINAL_L - leff).toFixed(1) + ' nm';
    } else if (mode === 'zero') {
      ivStateDesc.textContent = (region === 'LINEAR') ?
        'Normally-ON P-channel · Triode hole drift' :
        'Normally-ON P-channel · Pinch-off ΔL = ' + (NOMINAL_L - leff).toFixed(1) + ' nm';
    } else {
      ivStateDesc.textContent = (region === 'LINEAR') ?
        'Enriched channel (VGS < 0) · High hole conductivity' :
        'Enriched channel · High-current pinch-off ΔL = ' + (NOMINAL_L - leff).toFixed(1) + ' nm';
    }
  }

  // 4. Update HUD Status Telemetry Badge
  var badgeVgs = document.getElementById('badge-vgs') || document.getElementById('badge-vg');
  var badgeState = document.getElementById('badge-state');
  var badgeChan = document.getElementById('badge-chan');
  var badgeIsd = document.getElementById('badge-isd');

  if (badgeVgs) {
    badgeVgs.textContent = vgs.toFixed(2) + ' V (' + (vgs >= VTH_P ? 'CUTOFF' : (vgs > 0 ? 'DEPLETION' : (vgs === 0 ? 'ZERO BIAS' : 'ENHANCE'))) + ')';
    badgeVgs.className = 'v ' + (region === 'CUTOFF' ? 'off' : 'on');
  }
  if (badgeState) {
    badgeState.textContent = region;
    badgeState.className = 'v ' + (region === 'CUTOFF' ? 'off' : (region === 'SATURATION' ? 'on' : 'warn'));
  }
  if (badgeChan) {
    if (region === 'CUTOFF') {
      badgeChan.textContent = 'DEPLETED / OFF';
      badgeChan.className = 'v off';
    } else if (region === 'LINEAR') {
      badgeChan.textContent = 'IMPLANTED P-CHANNEL (CONTINUOUS)';
      badgeChan.className = 'v on';
    } else {
      badgeChan.textContent = 'PINCHED-OFF (Leff=' + leff.toFixed(1) + 'nm)';
      badgeChan.className = 'v warn';
    }
  }
  if (badgeIsd) {
    badgeIsd.textContent = (isd >= 0.01 ? isd.toFixed(2) + ' mA' : '0.00 mA (CUTOFF)');
    badgeIsd.className = 'v ' + (isd >= 0.01 ? 'on' : 'off');
  }

  // 5. Update 2D SVG Schematic Indicators
  var schVg = document.getElementById('sch-vg-val');
  if (schVg) schVg.textContent = vgs.toFixed(2) + 'V';
  var schChan = document.getElementById('sch-channel-state');
  if (schChan) {
    schChan.textContent = region === 'CUTOFF' ? 'OFF (CUTOFF)' : (mode === 'zero' ? 'NORMALLY ON' : (mode === 'depletion' ? 'DEPLETED' : 'ENHANCED'));
  }

  // 6. Dynamically Deform 3D P-Channel in Real-Time
  if (typeof window.updateChannelGeometry === 'function') {
    window.updateChannelGeometry(vgs, vsd, isd, region, deltaL);
  }

  // 7. Redraw Live ISD-VSD Graph
  drawIsdVsdGraph(vgs, vsd, isd, region);

  // 8. Rebuild Fine Hole Carrier Flow Simulation
  if (typeof rebuildFlowCurves === 'function') {
    rebuildFlowCurves(isd, region, deltaL);
  }

  // 9. Update Context for AI Voice Assistant
  if (typeof lastSelectedId !== 'undefined' && lastSelectedId && typeof window.updateVoiceAssistantContext === 'function') {
    window.updateVoiceAssistantContext(lastSelectedId, idToInfo(lastSelectedId));
  }
}

// ---------------------------------------------------------------------------
// LIVE ISD vs VSD CHARACTERISTIC GRAPH RENDERER
// ---------------------------------------------------------------------------
function drawIsdVsdGraph(activeVgs, activeVsd, activeIsd, activeRegion) {
  var canvas = document.getElementById('iv-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var W = rect.width || 300;
  var H = rect.height || 160;

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
  var textColor = isLight ? '#64748b' : '#64748b';
  var dimmedCurveColor = isLight ? 'rgba(219,39,119,0.22)' : 'rgba(244,63,94,0.22)';
  var activeCurveColor = isLight ? '#db2777' : '#f43f5e';
  var pinchOffColor = isLight ? '#d97706' : '#f59e0b';
  var dotColor = activeRegion === 'CUTOFF' ? '#dc2626' : (activeRegion === 'SATURATION' ? '#f43f5e' : '#cf8a4a');

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Margins
  var padL = 36;
  var padR = 14;
  var padT = 14;
  var padB = 24;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;

  var vsdMax = 1.8;
  var isdMax = 1.35; // mA (spans enhancement mode peak currents)

  function toX(v) { return padL + (v / vsdMax) * plotW; }
  function toY(i) { return padT + plotH - (i / isdMax) * plotH; }

  // Draw Grid Lines & Tick Labels
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = textColor;
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';

  // VSD ticks: 0, 0.6, 1.2, 1.8
  [0, 0.6, 1.2, 1.8].forEach(function(v) {
    var x = toX(v);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), x, padT + plotH + 13);
  });
  ctx.fillText('V_SD (V)', padL + plotW / 2, padT + plotH + 22);

  // ISD ticks: 0, 0.3, 0.6, 0.9, 1.2
  ctx.textAlign = 'right';
  [0, 0.3, 0.6, 0.9, 1.2].forEach(function(i) {
    var y = toY(i);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(i.toFixed(1), padL - 6, y + 3);
  });

  ctx.save();
  ctx.translate(11, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('I_SD (mA)', 0, 0);
  ctx.restore();

  // Draw Pinch-off Parabolic Boundary Curve: VSD = VOV => ISD = 0.5 * kp * VSD^2
  ctx.strokeStyle = pinchOffColor;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  var startedPinch = false;
  for (var v = 0; v <= vsdMax; v += 0.05) {
    var iBoundary = 0.5 * KP_PRIME * v * v;
    if (iBoundary > isdMax) break;
    var px = toX(v);
    var py = toY(iBoundary);
    if (!startedPinch) { ctx.moveTo(px, py); startedPinch = true; }
    else { ctx.lineTo(px, py); }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels for Linear and Saturation regions
  ctx.font = '8px "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? 'rgba(207,138,74,0.7)' : 'rgba(207,138,74,0.55)';
  ctx.textAlign = 'left';
  ctx.fillText('TRIODE / LINEAR', padL + 8, padT + 16);
  ctx.fillStyle = isLight ? 'rgba(219,39,119,0.7)' : 'rgba(244,63,94,0.55)';
  ctx.textAlign = 'right';
  ctx.fillText('SATURATION', padL + plotW - 8, padT + 16);

  // Generates curve sampling coordinates that strictly include boundary point v = vov
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

  // Family of VGS Curves for D-PMOS: Cutoff (+0.8V), Depletion (+0.4V), Zero Bias (0.0V), Enhancement (-0.4V, -0.8V)
  var vgsFamily = [0.80, 0.40, 0.00, -0.40, -0.80];
  vgsFamily.forEach(function(curveVgs) {
    var vovFamily = Math.max(0, VTH_P - curveVgs);
    if (vovFamily <= 0.001) return;

    var isCloseToActive = Math.abs(curveVgs - activeVgs) < 0.06;
    if (isCloseToActive) return; // Will draw highlighted active curve separately

    var pts = getSamplePoints(vovFamily, vsdMax, 0.04);
    ctx.strokeStyle = dimmedCurveColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    var started = false;

    for (var idx = 0; idx < pts.length; idx++) {
      var v = pts[idx];
      var iCalc = 0;
      if (v < vovFamily) {
        iCalc = KP_PRIME * (vovFamily * v - 0.5 * v * v);
      } else {
        iCalc = 0.5 * KP_PRIME * vovFamily * vovFamily * (1.0 + LAMBDA_P * (v - vovFamily));
      }
      var cx = toX(v);
      var cy = toY(Math.min(isdMax, iCalc));
      if (!started) { ctx.moveTo(cx, cy); started = true; }
      else { ctx.lineTo(cx, cy); }
    }
    ctx.stroke();

    // Curve label
    var endI = 0.5 * KP_PRIME * vovFamily * vovFamily * (1.0 + LAMBDA_P * (vsdMax - vovFamily));
    if (endI < isdMax) {
      ctx.fillStyle = textColor;
      ctx.font = '7.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText((curveVgs > 0 ? '+' : '') + curveVgs.toFixed(1) + 'V', toX(vsdMax) - 2, toY(endI) - 3);
    }
  });

  // Active Highlighted VGS Curve
  var activeVov = Math.max(0, VTH_P - activeVgs);
  if (activeVov > 0.001) {
    var activePts = getSamplePoints(activeVov, vsdMax, 0.03);
    ctx.strokeStyle = activeCurveColor;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    var startedActive = false;

    for (var idx = 0; idx < activePts.length; idx++) {
      var v = activePts[idx];
      var iCalc = 0;
      if (v < activeVov) {
        iCalc = KP_PRIME * (activeVov * v - 0.5 * v * v);
      } else {
        iCalc = 0.5 * KP_PRIME * activeVov * activeVov * (1.0 + LAMBDA_P * (v - activeVov));
      }
      var cx = toX(v);
      var cy = toY(Math.min(isdMax, iCalc));
      if (!startedActive) { ctx.moveTo(cx, cy); startedActive = true; }
      else { ctx.lineTo(cx, cy); }
    }
    ctx.stroke();
  }

  // Crosshairs from Axes to Operating Point
  var dotX = toX(activeVsd);
  var dotY = toY(Math.min(isdMax, activeIsd));

  ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);

  // Horizontal line to Y axis
  ctx.beginPath();
  ctx.moveTo(padL, dotY);
  ctx.lineTo(dotX, dotY);
  ctx.stroke();

  // Vertical line to X axis
  ctx.beginPath();
  ctx.moveTo(dotX, padT + plotH);
  ctx.lineTo(dotX, dotY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Active Operating Point Dot
  ctx.beginPath();
  ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
  ctx.fillStyle = isLight ? 'rgba(219,39,119,0.25)' : 'rgba(244,63,94,0.30)';
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
  var vgsSlider = document.getElementById('vgs-slider') || document.getElementById('vsg-slider');
  if (vgsSlider) {
    vgsSlider.addEventListener('input', function(e) {
      currentVgs = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  // Topbar VSD Slider
  var vsdSlider = document.getElementById('vsd-slider');
  if (vsdSlider) {
    vsdSlider.addEventListener('input', function(e) {
      currentVsd = parseFloat(e.target.value);
      applyLogicState();
    });
  }

  // Preset Buttons (Topbar & HUD)
  function applyPreset(preset) {
    if (preset === 'cutoff') {
      currentVgs = 1.00;
      currentVsd = 0.80;
    } else if (preset === 'depletion') {
      currentVgs = 0.40;
      currentVsd = 0.80;
    } else if (preset === 'zero') {
      currentVgs = 0.00;
      currentVsd = 0.80;
    } else if (preset === 'enhancement') {
      currentVgs = -0.60;
      currentVsd = 0.80;
    }
    applyLogicState();
  }

  document.querySelectorAll('[data-preset]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyPreset(btn.dataset.preset);
    });
  });

  // Interactive Graph Canvas: Drag or Click to modulate VSD
  var canvas = document.getElementById('iv-canvas');
  if (canvas) {
    var isDragging = false;

    function handleGraphPointer(e) {
      var rect = canvas.getBoundingClientRect();
      var padL = 36, padR = 14;
      var padT = 14, padB = 24;
      var plotW = rect.width - padL - padR;
      var plotH = rect.height - padT - padB;

      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;

      var clickX = clientX - rect.left - padL;
      var clickY = clientY - rect.top - padT;

      var normX = Math.max(0, Math.min(1.0, clickX / plotW));

      currentVsd = Math.round(normX * 1.8 * 20) / 20; // 0.05V step
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
