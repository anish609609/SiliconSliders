/**
 * logic-state.js - PMOS CAD Viewer
 * Continuous PMOS Operating-Region Physics Engine & Live ISD-VSD Graph:
 * - Delineates Cutoff (VSG < |VTH,p|), Linear/Triode (VSD < VSG - |VTH,p|), and Saturation (VSD >= VSG - |VTH,p|).
 * - Computes hole current ISD with channel-length modulation lambda.
 * - Live interactive ISD vs VSD graph renderer with active operating point dot and pinch-off locus.
 * - Two-way coupled to 3D P-channel taper/pinch-off and fine hole carrier flow.
 */

// PMOS Physical Constants (28nm High-Performance HKMG node illustrative model)
var VTH_P = 0.40;         // Threshold voltage magnitude |VTH,p| (V)
var KP_PRIME = 0.80;      // Conduction parameter kp' = mu_p * Cox * (Wp/L) (mA/V^2)
var LAMBDA_P = 0.08;      // Channel-length modulation parameter (1/V)
var NOMINAL_L = 28.0;     // Gate length (nm)
var MODEL_L = 2.0;        // 3D coordinate length along X

// Active continuous bias states
var currentVsg = 1.00;    // Source-to-Gate bias |VGS| (0.00V to 1.80V)
var currentVsd = 0.80;    // Source-to-Drain bias |VDS| (0.00V to 1.80V)
var currentIn = 0;        // Backward-compatibility flag (0 = ON, 1 = OFF/Cutoff)

function calculateIsd(testVsg, testVsd) {
  var vov = Math.max(0, testVsg - VTH_P);
  if (vov <= 0.001) return { isd: 0, region: 'CUTOFF' };
  var vsdSat = vov;
  if (testVsd < vsdSat) {
    var isd = KP_PRIME * (vov * testVsd - 0.5 * testVsd * testVsd);
    return { isd: Math.max(0, isd), region: 'LINEAR' };
  } else {
    var isd = 0.5 * KP_PRIME * vov * vov * (1.0 + LAMBDA_P * (testVsd - vsdSat));
    return { isd: Math.max(0, isd), region: 'SATURATION' };
  }
}
window.calculateIsd = calculateIsd;

function renderSinglePmosGraph(canvas, activeVsg, activeVsd, activeIsd, activeRegion, isModal) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  var W = rect.width || (isModal ? 560 : 310);
  var H = rect.height || (isModal ? 380 : 225);

  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  var isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // Palette - Standardized D-NMOS teal-green & warm amber palette
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

  // Margins: Trimmed for inline, slightly more generous for modal
  var padL = isModal ? 40 : 32;
  var padR = isModal ? 34 : 28;
  var padT = isModal ? 18 : 16;
  var padB = isModal ? 26 : 24;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;

  var vsdMax = 1.8;
  var isdMax = 0.95; // mA

  function toX(v) { return padL + (v / vsdMax) * plotW; }
  function toY(i) { return padT + plotH - (i / isdMax) * plotH; }

  // Draw Grid Lines & Tick Labels
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
  [0, 0.3, 0.6, 0.9].forEach(function(i) {
    var y = toY(i);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(i.toFixed(1), padL - 5, y + 3.5);
  });

  // Axes
  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  // Axis Labels
  ctx.save();
  ctx.translate(isModal ? 12 : 9, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = axisFont;
  ctx.fillText('I_SD (mA)', 0, 0);
  ctx.restore();

  // Region Zone Labels
  ctx.font = (isModal ? '10px' : '8.5px') + ' "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? 'rgba(74,146,201,0.75)' : 'rgba(74,146,201,0.60)';
  ctx.textAlign = 'left';
  ctx.fillText('TRIODE / LINEAR', padL + 8, padT + 13);
  ctx.fillStyle = isLight ? 'rgba(16,185,129,0.80)' : 'rgba(87,207,143,0.65)';
  ctx.textAlign = 'center';
  ctx.fillText('SATURATION', toX(1.35), padT + 13);

  // Quadratic Pinch-off locus
  ctx.strokeStyle = pinchOffColor;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (var step = 0; step <= 60; step++) {
    var vPinch = (step / 60) * 1.4;
    var iPinch = 0.5 * KP_PRIME * vPinch * vPinch;
    if (vPinch <= vsdMax && iPinch <= isdMax) {
      var px = toX(vPinch);
      var py = toY(iPinch);
      if (step === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Family of ISD vs VSD curves: 0.4, 0.7, 1.0, 1.3, 1.6
  var vsgLevels = [0.4, 0.7, 1.0, 1.3, 1.6];
  var labelPositions = [];

  vsgLevels.forEach(function(vsgLevel) {
    ctx.strokeStyle = dimmedCurveColor;
    ctx.lineWidth = isModal ? 1.4 : 1.2;
    ctx.beginPath();

    var pts = [];
    for (var s = 0; s <= 70; s++) {
      var v = (s / 70) * vsdMax;
      var cur = calculateIsd(vsgLevel, v).isd;
      pts.push({ x: toX(v), y: toY(cur) });
    }

    pts.forEach(function(pt, idx) {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    var endI = calculateIsd(vsgLevel, vsdMax).isd;
    labelPositions.push({
      vsg: vsgLevel,
      endI: endI,
      rawY: toY(endI) + 3
    });
  });

  // Space curve labels cleanly
  var minSpacing = isModal ? 17 : 15;
  var lastY = toY(0) + 3;
  for (var k = 0; k < labelPositions.length; k++) {
    var lp = labelPositions[k];
    if (lp.endI >= isdMax * 0.99) continue;
    var finalY = Math.min(lp.rawY, lastY - (k > 0 ? minSpacing : 0));
    lastY = finalY;
    ctx.fillStyle = textColor;
    ctx.font = (isModal ? '9.5px' : '8.5px') + ' "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(lp.vsg.toFixed(1) + 'V', toX(vsdMax) + 3, finalY);
  }

  // Draw Highlighted Active VSG Curve
  var activeVov = Math.max(0, activeVsg - VTH_P);
  if (activeVov > 0.001) {
    ctx.strokeStyle = activeCurveColor;
    ctx.lineWidth = isModal ? 2.8 : 2.4;
    ctx.beginPath();
    for (var s = 0; s <= 70; s++) {
      var v = (s / 70) * vsdMax;
      var cur = calculateIsd(activeVsg, v).isd;
      var px = toX(v);
      var py = toY(cur);
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Crosshairs to Operating Point
  var opX = toX(activeVsd);
  var opY = toY(activeIsd);

  ctx.strokeStyle = dotColor;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(opX, padT + plotH);
  ctx.lineTo(opX, opY);
  ctx.lineTo(padL, opY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Operating Point Dot (glowing outer + solid inner)
  ctx.beginPath();
  ctx.arc(opX, opY, isModal ? 8 : 7, 0, Math.PI * 2);
  ctx.fillStyle = isLight ? 'rgba(13,148,136,0.25)' : 'rgba(95,217,196,0.30)';
  ctx.fill();

  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(opX, opY, isModal ? 5 : 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Operating point label
  ctx.font = (isModal ? '10.5px' : '8.5px') + ' "IBM Plex Mono", monospace';
  ctx.textAlign = opX > W - (isModal ? 120 : 90) ? 'right' : 'left';
  var labelX = opX > W - (isModal ? 120 : 90) ? opX - 8 : opX + 8;
  var labelY = Math.max(padT + 12, Math.min(padT + plotH - 6, opY - 6));
  ctx.fillStyle = dotColor;
  ctx.fillText(activeRegion + ' (' + activeIsd.toFixed(2) + ' mA)', labelX, labelY);

  ctx.restore();
}

function drawIsdVdsGraph(activeVsg, activeVsd, activeIsd, activeRegion) {
  var vsg = (typeof activeVsg === 'number') ? activeVsg : currentVsg;
  var vsd = (typeof activeVsd === 'number') ? activeVsd : currentVsd;
  var isd = (typeof activeIsd === 'number') ? activeIsd : (typeof currentIds === 'number' ? currentIds : 0.14);
  var reg = activeRegion || (typeof currentRegion === 'string' ? currentRegion : 'SATURATION');

  var canvas = document.getElementById('iv-canvas');
  if (canvas) {
    renderSinglePmosGraph(canvas, vsg, vsd, isd, reg, false);
  }

  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalCanvas = document.getElementById('iv-modal-canvas');
  if (modalCanvas && modalBackdrop && modalBackdrop.style.display !== 'none') {
    renderSinglePmosGraph(modalCanvas, vsg, vsd, isd, reg, true);
  }

  var mVsg = document.getElementById('iv-m-vsg');
  var mVsd = document.getElementById('iv-m-vsd');
  var mIsd = document.getElementById('iv-m-isd');
  var mRegion = document.getElementById('iv-m-region');
  if (mVsg) mVsg.textContent = vsg.toFixed(2) + ' V';
  if (mVsd) mVsd.textContent = vsd.toFixed(2) + ' V';
  if (mIsd) mIsd.textContent = isd.toFixed(2) + ' mA';
  if (mRegion) mRegion.textContent = reg;
}
window.drawIsdVdsGraph = drawIsdVdsGraph;
window.drawIsdVsdGraph = drawIsdVdsGraph;
window.drawIdsVdsGraph = drawIsdVdsGraph;

window.getMosfetPhysicsState = function() {
  var vov = Math.max(0, currentVsg - VTH_P);
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
    deltaL = MODEL_L * Math.min(0.40, 0.22 * Math.sqrt(Math.max(0, vsdDiff)));
  }

  var leff = NOMINAL_L * (1.0 - (deltaL / MODEL_L));

  return {
    vsg: currentVsg,
    vsd: currentVsd,
    vgs: -currentVsg,
    vds: -currentVsd,
    vth: VTH_P,
    vov: vov,
    vsdSat: vsdSat,
    isd: Math.max(0, isd),
    ids: Math.max(0, isd),
    region: region,
    deltaL: deltaL,
    leff: leff
  };
};

// ---------------------------------------------------------------------------
// APPLY STATE: Drives Topbar, Graph, 3D Channel, Telemetry & Hole Carrier Flow
// ---------------------------------------------------------------------------
function applyLogicState() {
  var phys = window.getMosfetPhysicsState();
  var vsg = phys.vsg;
  var vsd = phys.vsd;
  var vov = phys.vov;
  var isd = phys.isd;
  var region = phys.region;
  var deltaL = phys.deltaL;
  var leff = phys.leff;

  currentIn = (region === 'CUTOFF') ? 1 : 0;

  // 1. Update Topbar Sliders & Value Readouts
  var vsgSlider = document.getElementById('vsg-slider');
  var vsgVal = document.getElementById('vsg-val');
  if (vsgSlider && Math.abs(parseFloat(vsgSlider.value) - vsg) > 0.01) vsgSlider.value = vsg.toFixed(2);
  if (vsgVal) vsgVal.textContent = vsg.toFixed(2) + 'V';

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

  var ivVsg = document.getElementById('iv-vsg-readout') || document.getElementById('iv-vgs-readout');
  if (ivVsg) ivVsg.textContent = vsg.toFixed(2) + ' V';
  var ivVsd = document.getElementById('iv-vsd-readout') || document.getElementById('iv-vds-readout');
  if (ivVsd) ivVsd.textContent = vsd.toFixed(2) + ' V';
  var ivVov = document.getElementById('iv-vov-readout');
  if (ivVov) ivVov.textContent = vov.toFixed(2) + ' V';
  var ivIsd = document.getElementById('iv-isd-readout') || document.getElementById('iv-ids-readout');
  if (ivIsd) ivIsd.textContent = (isd >= 0.01 ? isd.toFixed(2) : '≈ 0') + ' mA';
  var ivLeff = document.getElementById('iv-leff-readout');
  if (ivLeff) ivLeff.textContent = leff.toFixed(1) + ' nm';

  var ivStateDesc = document.getElementById('iv-state-desc');
  if (ivStateDesc) {
    if (region === 'CUTOFF') {
      ivStateDesc.textContent = 'Channel quenched · Subthreshold state';
    } else if (region === 'LINEAR') {
      ivStateDesc.textContent = 'Continuous P-channel · Ohmic hole drift';
    } else {
      ivStateDesc.textContent = 'Pinch-off ΔL = ' + (NOMINAL_L - leff).toFixed(1) + ' nm · High-field sweep';
    }
  }

  document.querySelectorAll('#isd-vsd-hud .iv-preset-btn, #ids-vds-hud .iv-preset-btn').forEach(function(btn) {
    var p = btn.dataset.preset;
    btn.classList.toggle('active', (region === 'CUTOFF' && p === 'cutoff') ||
                                   (region === 'LINEAR' && p === 'linear') ||
                                   (region === 'SATURATION' && p === 'saturation'));
  });

  // 4. Update HUD Status Telemetry Badge
  var badgeVsg = document.getElementById('badge-vsg') || document.getElementById('badge-vg');
  var badgeState = document.getElementById('badge-state');
  var badgeChan = document.getElementById('badge-chan');
  var badgeIsd = document.getElementById('badge-isd');

  if (badgeVsg) {
    badgeVsg.textContent = vsg.toFixed(2) + ' V (' + (vsg <= VTH_P ? 'VSG < |VTH|' : 'VSG > |VTH|') + ')';
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
  if (badgeIsd) {
    badgeIsd.textContent = (isd >= 0.01 ? isd.toFixed(2) + ' mA' : '0.00 mA (CUTOFF)');
    badgeIsd.className = 'v ' + (isd >= 0.01 ? 'on' : 'off');
  }

  // 5. Update 2D SVG Schematic Indicators
  var schVg = document.getElementById('sch-vg-val') || document.getElementById('sch-vsg-val');
  if (schVg) schVg.textContent = (1.0 - vsg).toFixed(2) + 'V';
  var schChan = document.getElementById('sch-channel-state');
  if (schChan) {
    schChan.textContent = region === 'CUTOFF' ? 'OFF (CUTOFF)' : (region === 'LINEAR' ? 'ON (TRIODE)' : 'ON (SAT)');
  }

  // 6. Dynamically Deform 3D Inversion Channel in Real-Time
  if (typeof window.updateChannelGeometry === 'function') {
    window.updateChannelGeometry(vsg, vsd, isd, region, deltaL);
  }

  // 7. Redraw Live ISD-VSD Graph
  drawIsdVsdGraph(vsg, vsd, isd, region);

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

  function applyPreset(preset) {
    if (preset === 'cutoff') {
      currentVsg = 0.00;
      currentVsd = 0.80;
    } else if (preset === 'linear') {
      currentVsg = 1.00;
      currentVsd = 0.30;
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

  function bindCanvasPointer(cvs, isModal) {
    var isDragging = false;
    function handleGraphPointer(e) {
      var rect = cvs.getBoundingClientRect();
      var padL = isModal ? 48 : 34;
      var padR = isModal ? 42 : 28;
      var plotW = rect.width - padL - padR;

      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var clickX = clientX - rect.left - padL;
      var normX = Math.max(0, Math.min(1.0, clickX / plotW));

      currentVsd = Math.round(normX * 1.8 * 20) / 20; // 0.05V step
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

  function openIvModal() {
    if (!modalBackdrop) return;
    modalBackdrop.style.display = 'flex';
    applyLogicState();
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogicStateControls);
} else {
  initLogicStateControls();
}
