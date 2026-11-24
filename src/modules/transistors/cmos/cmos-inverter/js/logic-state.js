/**
 * logic-state.js - CMOS Inverter CAD Viewer
 * Physics model for CMOS Inverter Voltage Transfer Characteristic (VTC),
 * 5 operating regions (A through E), continuous VIN modulation,
 * interactive dual-canvas graph rendering (inline + modal),
 * and synchronized 3D carrier flow and channel inversion states.
 */

// =====================================================================
// CMOS INVERTER PHYSICS CONSTANTS & STATE
// =====================================================================
var VDD = 1.00;        // Supply voltage (V)
var VTH_N = 0.40;      // NMOS threshold voltage (V)
var VTH_P = 0.40;      // |VTH,p| PMOS threshold voltage (V)
var VM = 0.50;         // Switching threshold (V)
var I_PEAK = 0.08;      // Peak shoot-through current at VM (mA)
var I_LEAK = 0.005;     // Weak subthreshold leakage current (mA)

// Global state: can be float 0.00 - 1.00 or 'off' (High-Z floating)
var currentVin = 'off';
window.currentIn = 'off';

var VTC_GRAPH_PAD = { L: 38, R: 28, T: 24, B: 26 };

// =====================================================================
// ANALYTICAL CMOS VTC PHYSICS & 5 OPERATING REGIONS
// =====================================================================
function calcCmosState(vin) {
  if (vin === 'off' || vin === null || vin === undefined) {
    return {
      vin: 'off',
      vout: null,
      idd: 0.00,
      nmosRegion: 'SUBTHRESHOLD',
      pmosRegion: 'SUBTHRESHOLD',
      stateDesc: 'Input Floating · High-Z Output (Weak Leakage)',
      pmosTint: 'partial',
      nmosTint: 'partial'
    };
  }

  var vInClamped = Math.max(0.00, Math.min(1.00, parseFloat(vin)));
  var vout = 0.00;
  var idd = 0.00;
  var nmosReg = 'CUTOFF';
  var pmosReg = 'LINEAR';
  var stateDesc = '';
  var pmosTint = false;
  var nmosTint = false;

  // Hyperbolic smooth transition parameter for Region B - D
  var gamma = 2.4;

  if (vInClamped < 0.40) {
    // REGION A: 0 <= VIN < VTH_N
    // NMOS Cutoff, PMOS Linear (VSD ~ 0)
    vout = VDD;
    idd = 0.00;
    nmosReg = 'CUTOFF';
    pmosReg = 'LINEAR';
    stateDesc = 'Region A · PMOS Pull-Up Active (Logic 1)';
    pmosTint = true;
    nmosTint = false;
  } else if (vInClamped >= 0.40 && vInClamped < 0.48) {
    // REGION B: VTH_N <= VIN < VM - delta
    // NMOS Saturation (pinched), PMOS Linear
    var u = (vInClamped - VM) / 0.10; // [-1.0, -0.2)
    var tanhU = Math.tanh(gamma * u) / Math.tanh(gamma);
    vout = VM - 0.50 * tanhU;
    idd = I_PEAK * Math.pow(Math.max(0, 1 - u * u), 2);
    nmosReg = 'SATURATION';
    pmosReg = 'LINEAR';
    stateDesc = 'Region B · NMOS Pinched · High Gain Transition';
    pmosTint = true;
    nmosTint = 'partial';
  } else if (vInClamped >= 0.48 && vInClamped <= 0.52) {
    // REGION C: VIN ~ VM (0.50V)
    // Both NMOS & PMOS in Saturation simultaneously!
    var u = (vInClamped - VM) / 0.10; // [-0.2, 0.2]
    var tanhU = Math.tanh(gamma * u) / Math.tanh(gamma);
    vout = VM - 0.50 * tanhU;
    idd = I_PEAK * Math.pow(Math.max(0, 1 - u * u), 2);
    nmosReg = 'SATURATION';
    pmosReg = 'SATURATION';
    stateDesc = 'Region C · Both in Saturation (VM) · Peak IDD';
    pmosTint = 'partial';
    nmosTint = 'partial';
  } else if (vInClamped > 0.52 && vInClamped <= 0.60) {
    // REGION D: VM + delta < VIN <= VDD - |VTH_P|
    // NMOS Linear, PMOS Saturation (pinched)
    var u = (vInClamped - VM) / 0.10; // (0.2, 1.0]
    var tanhU = Math.tanh(gamma * u) / Math.tanh(gamma);
    vout = VM - 0.50 * tanhU;
    idd = I_PEAK * Math.pow(Math.max(0, 1 - u * u), 2);
    nmosReg = 'LINEAR';
    pmosReg = 'SATURATION';
    stateDesc = 'Region D · PMOS Pinched · High Gain Transition';
    pmosTint = 'partial';
    nmosTint = true;
  } else {
    // REGION E: VDD - |VTH_P| < VIN <= VDD
    // PMOS Cutoff, NMOS Linear (VDS ~ 0)
    vout = 0.00;
    idd = 0.00;
    nmosReg = 'LINEAR';
    pmosReg = 'CUTOFF';
    stateDesc = 'Region E · NMOS Pull-Down Active (Logic 0)';
    pmosTint = false;
    nmosTint = true;
  }

  // Ensure strict clipping
  vout = Math.max(0.00, Math.min(VDD, vout));

  return {
    vin: vInClamped,
    vout: vout,
    idd: idd,
    nmosRegion: nmosReg,
    pmosRegion: pmosReg,
    stateDesc: stateDesc,
    pmosTint: pmosTint,
    nmosTint: nmosTint
  };
}

// Analytical function to evaluate VOUT for any VIN on the curve
function getVoutAt(v) {
  if (v < 0.40) return 1.00;
  if (v > 0.60) return 0.00;
  var u = (v - 0.50) / 0.10;
  var gamma = 2.4;
  var tanhU = Math.tanh(gamma * u) / Math.tanh(gamma);
  return Math.max(0.00, Math.min(1.00, 0.50 - 0.50 * tanhU));
}

// Analytical function to evaluate IDD for any VIN on the curve
function getIddAt(v) {
  if (v <= 0.40 || v >= 0.60) return 0.00;
  var u = (v - 0.50) / 0.10;
  return I_PEAK * Math.pow(Math.max(0, 1 - u * u), 2);
}

// =====================================================================
// APPLY LOGIC STATE & SYNC TELEMETRY
// =====================================================================
function applyLogicState() {
  var st = calcCmosState(currentVin);

  // Readouts
  var vinReadout = document.getElementById('iv-vin-readout');
  var voutReadout = document.getElementById('iv-vout-readout');
  var iddReadout = document.getElementById('iv-idd-readout');
  var nmosRegReadout = document.getElementById('iv-nmos-reg-readout');
  var pmosRegReadout = document.getElementById('iv-pmos-reg-readout');
  var stateDescEl = document.getElementById('iv-state-desc');
  var vinVal = document.getElementById('vin-val');
  var vinSlider = document.getElementById('vin-slider');

  if (st.vin === 'off') {
    if (vinReadout) vinReadout.textContent = 'OFF';
    if (voutReadout) voutReadout.textContent = 'FLOATING';
    if (iddReadout) iddReadout.textContent = '0.00 mA';
    if (nmosRegReadout) nmosRegReadout.textContent = 'SUBTHRESHOLD';
    if (pmosRegReadout) pmosRegReadout.textContent = 'SUBTHRESHOLD';
    if (stateDescEl) stateDescEl.textContent = st.stateDesc;
    if (vinVal) vinVal.textContent = 'OFF';
  } else {
    if (vinReadout) vinReadout.textContent = st.vin.toFixed(2) + ' V';
    if (voutReadout) voutReadout.textContent = st.vout.toFixed(2) + ' V';
    if (iddReadout) iddReadout.textContent = st.idd.toFixed(2) + ' mA';
    if (nmosRegReadout) nmosRegReadout.textContent = st.nmosRegion;
    if (pmosRegReadout) pmosRegReadout.textContent = st.pmosRegion;
    if (stateDescEl) stateDescEl.textContent = st.stateDesc;
    if (vinVal) vinVal.textContent = st.vin.toFixed(2) + 'V';
    if (vinSlider) vinSlider.value = st.vin.toFixed(2);
  }

  // Compatibility badge hooks
  var badgeIn = document.getElementById('badge-in');
  var badgePmos = document.getElementById('badge-pmos');
  var badgeNmos = document.getElementById('badge-nmos');
  var badgeOut = document.getElementById('badge-out');
  if (badgeIn) badgeIn.textContent = (st.vin === 'off') ? 'OFF' : st.vin.toFixed(2) + 'V';
  if (badgePmos) badgePmos.textContent = st.pmosRegion;
  if (badgeNmos) badgeNmos.textContent = st.nmosRegion;
  if (badgeOut) badgeOut.textContent = (st.vin === 'off') ? 'FLOATING' : st.vout.toFixed(2) + 'V';

  // Preset button highlights
  document.querySelectorAll('#region-preset-seg button').forEach(function(b) {
    var p = b.dataset.preset;
    var isActive = false;
    if (st.vin === 'off' && p === 'off') isActive = true;
    else if (st.vin === 0.00 && p === '0') isActive = true;
    else if (st.vin === 0.50 && p === 'vm') isActive = true;
    else if (st.vin === 1.00 && p === '1') isActive = true;
    b.classList.toggle('active', isActive);
  });

  // Topbar In-Seg Sync
  document.querySelectorAll('#in-seg button, #wb-in-seg button').forEach(function(b) {
    var raw = b.dataset.in;
    var isActive = false;
    if (st.vin === 'off' && raw === 'off') isActive = true;
    else if (typeof st.vin === 'number' && st.vin < 0.25 && raw === '0') isActive = true;
    else if (typeof st.vin === 'number' && st.vin > 0.75 && raw === '1') isActive = true;
    b.classList.toggle('active', isActive);
  });

  // 3D Active Silicon Tints
  if (typeof pmosAct !== 'undefined' && pmosAct) {
    [pmosAct.src, pmosAct.drn, pmosAct.srcSde, pmosAct.drnSde].forEach(function(m) {
      if (m) setOnOffTint(m, st.pmosTint);
    });
  }
  if (typeof nmosAct !== 'undefined' && nmosAct) {
    [nmosAct.src, nmosAct.drn, nmosAct.srcSde, nmosAct.drnSde].forEach(function(m) {
      if (m) setOnOffTint(m, st.nmosTint);
    });
  }

  // Update dynamic 3D inversion channel geometries & pinch-off regions
  if (typeof window.updateInverterChannels === 'function') {
    window.updateInverterChannels(st.vin, st.vout, st.nmosRegion, st.pmosRegion);
  }

  // Sync carrier flow
  window.currentIn = (st.vin === 'off') ? 'off' : st.vin;
  if (typeof refreshConnections === 'function') {
    refreshConnections();
  }

  // Redraw VTC Canvas
  drawVtcGraph();

  // Update AI Voice Tutor context
  if (typeof lastSelectedId !== 'undefined' && lastSelectedId && typeof window.updateVoiceAssistantContext === 'function') {
    window.updateVoiceAssistantContext(lastSelectedId, idToInfo(lastSelectedId));
  }
}

function setOnOffTint(mesh, state) {
  if (!mesh) return;
  if (state === 'partial') {
    mesh.userData.baseEmissive = 0xd97706; // warm amber
    mesh.userData.baseEmissiveIntensity = 0.32;
  } else if (state === true) {
    mesh.userData.baseEmissive = 0x2fbf7a; // emerald green ON
    mesh.userData.baseEmissiveIntensity = 0.35;
  } else {
    mesh.userData.baseEmissive = 0x3a1414; // deep red OFF
    mesh.userData.baseEmissiveIntensity = 0.25;
  }
  if (typeof selectedMeshes !== 'undefined' && selectedMeshes.indexOf(mesh) === -1 && mesh.material && mesh.material.emissive) {
    mesh.material.emissive.setHex(mesh.userData.baseEmissive);
    mesh.material.emissiveIntensity = mesh.userData.baseEmissiveIntensity;
  }
}

function setVinState(val) {
  if (val === 'off') {
    currentVin = 'off';
  } else {
    currentVin = Math.max(0.00, Math.min(1.00, Math.round(parseFloat(val) * 100) / 100));
  }
  applyLogicState();
}
window.setVinState = setVinState;

// =====================================================================
// DUAL-CANVAS VTC & SWITCHING GRAPH RENDERING
// =====================================================================
function renderSingleVtcGraph(canvas, st, isModal) {
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

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  var isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // Palette
  var bgColor = isLight ? '#f8fafc' : '#080c12';
  var gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  var textColor = isLight ? '#64748b' : '#7d8ba0';
  var vtcColor = isLight ? '#0284c7' : '#22d3ee';
  var iddColor = isLight ? 'rgba(180,83,9,0.70)' : 'rgba(245,158,11,0.65)';
  var vmColor = isLight ? 'rgba(100,116,139,0.40)' : 'rgba(148,163,184,0.40)';

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Padding: generous and responsive to modal vs inline
  var padL = isModal ? 50 : 44;
  var padR = isModal ? 36 : 28;
  var padT = isModal ? 26 : 22;
  var padB = isModal ? 32 : 26;
  var plotW = W - padL - padR;
  var plotH = H - padT - padB;

  function toX(v) { return padL + (v / 1.00) * plotW; }
  function toY(v) { return padT + plotH - (v / 1.00) * plotH; }
  function toY_idd(i) { return padT + plotH - (i / 0.10) * plotH; }

  // 1. Shaded Region Background Bands (Regions A through E)
  var regions = [
    { start: 0.00, end: 0.40, label: 'A', fill: isLight ? 'rgba(2,132,199,0.04)' : 'rgba(34,211,238,0.035)' },
    { start: 0.40, end: 0.48, label: 'B', fill: isLight ? 'rgba(147,51,234,0.04)' : 'rgba(168,85,247,0.04)' },
    { start: 0.48, end: 0.52, label: 'C', fill: isLight ? 'rgba(217,119,6,0.07)' : 'rgba(245,158,11,0.07)' },
    { start: 0.52, end: 0.60, label: 'D', fill: isLight ? 'rgba(234,88,12,0.04)' : 'rgba(249,115,22,0.04)' },
    { start: 0.60, end: 1.00, label: 'E', fill: isLight ? 'rgba(22,163,74,0.04)' : 'rgba(34,197,94,0.035)' }
  ];

  regions.forEach(function(r) {
    var x1 = toX(r.start);
    var x2 = toX(r.end);
    ctx.fillStyle = r.fill;
    ctx.fillRect(x1, padT, x2 - x1, plotH);

    // Top region label tag
    ctx.fillStyle = textColor;
    ctx.font = (isModal ? '10px' : '8.5px') + ' "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    var midX = (x1 + x2) / 2;
    ctx.fillText(r.label, midX, padT - (isModal ? 8 : 6));
  });

  // 2. Grid lines & Axis ticks
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.fillStyle = textColor;
  var tickFont = isModal ? '11px "IBM Plex Mono", monospace' : '9.5px "IBM Plex Mono", monospace';
  var axisFont = isModal ? '600 11px "IBM Plex Mono", monospace' : '600 9.5px "IBM Plex Mono", monospace';
  ctx.font = tickFont;
  ctx.textAlign = 'center';

  // VIN ticks: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0
  [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(function(v) {
    var x = toX(v);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + plotH);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), x, padT + plotH + (isModal ? 15 : 13));
  });
  ctx.font = axisFont;
  ctx.fillText('V_IN (V)', padL + plotW / 2, padT + plotH + (isModal ? 28 : 23));

  // VOUT ticks: 0.0, 0.2, 0.4, 0.6, 0.8, 1.0
  ctx.font = tickFont;
  ctx.textAlign = 'right';
  [0, 0.2, 0.4, 0.6, 0.8, 1.0].forEach(function(v) {
    var y = toY(v);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(v.toFixed(1), padL - 5, y + 3.5);
  });

  // Y-axis label: V_OUT (V)
  ctx.save();
  ctx.translate(isModal ? 14 : 11, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = axisFont;
  ctx.fillText('V_OUT (V)', 0, 0);
  ctx.restore();

  // 3. Switching Threshold VM = 0.50V vertical dashed line
  ctx.strokeStyle = vmColor;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(toX(VM), padT);
  ctx.lineTo(toX(VM), padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // Label for VM
  ctx.font = (isModal ? '9.5px' : '8px') + ' "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('VM = 0.5V', toX(VM), padT + (isModal ? 16 : 14));

  // 4. Subtle Dashed Shoot-Through Current IDD Peak Curve
  ctx.strokeStyle = iddColor;
  ctx.lineWidth = isModal ? 1.6 : 1.3;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  for (var v = 0.35; v <= 0.65; v += 0.005) {
    var curI = getIddAt(v);
    var px = toX(v);
    var py = toY_idd(curI);
    if (v === 0.35) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // IDD peak annotation
  ctx.fillStyle = isLight ? '#b45309' : '#f59e0b';
  ctx.font = (isModal ? '9px' : '7.5px') + ' "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('I_DD peak', toX(0.50), toY_idd(I_PEAK) - 4);

  // 5. Solid VTC Curve (VOUT vs VIN)
  ctx.strokeStyle = vtcColor;
  ctx.lineWidth = isModal ? 2.8 : 2.4;
  ctx.beginPath();
  for (var v = 0.00; v <= 1.001; v += 0.005) {
    var outV = getVoutAt(v);
    var px = toX(v);
    var py = toY(outV);
    if (v === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // 6. Active Operating Point & Crosshairs
  if (st.vin !== 'off') {
    var dotX = toX(st.vin);
    var dotY = toY(st.vout);

    // Crosshairs
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(dotX, padT + plotH);
    ctx.lineTo(dotX, dotY);
    ctx.lineTo(padL, dotY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glowing Dot Color based on Region
    var dotColor = vtcColor;
    if (st.nmosRegion === 'CUTOFF') dotColor = '#0284c7'; // cyan
    else if (st.nmosRegion === 'SATURATION' && st.pmosRegion === 'SATURATION') dotColor = '#f59e0b'; // amber VM
    else if (st.pmosRegion === 'CUTOFF') dotColor = '#10b981'; // green

    // Outer glow halo
    ctx.beginPath();
    ctx.arc(dotX, dotY, isModal ? 8 : 7, 0, Math.PI * 2);
    ctx.fillStyle = isLight ? 'rgba(2,132,199,0.25)' : 'rgba(34,211,238,0.30)';
    ctx.fill();

    // Inner dot
    ctx.beginPath();
    ctx.arc(dotX, dotY, isModal ? 5 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Coordinate tag near dot
    var tagX = dotX + (st.vin > 0.6 ? -10 : 10);
    var tagAlign = st.vin > 0.6 ? 'right' : 'left';
    var tagY = dotY + (st.vout < 0.3 ? -10 : 12);
    ctx.font = (isModal ? '10px' : '8.5px') + ' "IBM Plex Mono", monospace';
    ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
    ctx.textAlign = tagAlign;
    ctx.fillText('(' + st.vin.toFixed(2) + 'V, ' + st.vout.toFixed(2) + 'V)', tagX, tagY);
  } else {
    // Floating High-Z state indicator badge on graph
    ctx.save();
    ctx.fillStyle = isLight ? 'rgba(217,119,6,0.12)' : 'rgba(245,158,11,0.15)';
    ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b';
    ctx.lineWidth = 1;
    var bx = padL + plotW / 2 - (isModal ? 90 : 75);
    var by = padT + plotH / 2 - (isModal ? 18 : 15);
    var bw = isModal ? 180 : 150;
    var bh = isModal ? 36 : 30;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = isLight ? '#b45309' : '#fbbf24';
    ctx.font = '600 ' + (isModal ? '11px' : '9px') + ' "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HIGH-Z (FLOATING INPUT)', padL + plotW / 2, by + (isModal ? 22 : 19));
    ctx.restore();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawVtcGraph() {
  var st = calcCmosState(currentVin);

  var inlineCanvas = document.getElementById('iv-canvas');
  if (inlineCanvas) {
    renderSingleVtcGraph(inlineCanvas, st, false);
  }

  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalCanvas = document.getElementById('iv-modal-canvas');
  if (modalCanvas && modalBackdrop && modalBackdrop.style.display !== 'none') {
    renderSingleVtcGraph(modalCanvas, st, true);
  }

  // Update modal readouts if present
  var mVin = document.getElementById('iv-m-vin');
  var mVout = document.getElementById('iv-m-vout');
  var mNmos = document.getElementById('iv-m-nmos-reg');
  var mPmos = document.getElementById('iv-m-pmos-reg');
  if (mVin) mVin.textContent = (st.vin === 'off') ? 'OFF' : st.vin.toFixed(2) + ' V';
  if (mVout) mVout.textContent = (st.vin === 'off') ? 'FLOATING' : st.vout.toFixed(2) + ' V';
  if (mNmos) mNmos.textContent = st.nmosRegion;
  if (mPmos) mPmos.textContent = st.pmosRegion;
}
window.drawVtcGraph = drawVtcGraph;
window.drawIdsVdsGraph = drawVtcGraph; // Alias for shared resize hook

// =====================================================================
// INTERACTIVE CONTROLS & EVENT BINDINGS
// =====================================================================
function initLogicStateControls() {
  // Continuous VIN Slider
  var vinSlider = document.getElementById('vin-slider');
  if (vinSlider) {
    vinSlider.addEventListener('input', function(e) {
      setVinState(e.target.value);
    });
  }

  // Preset buttons
  function applyPreset(preset) {
    if (preset === '0') setVinState(0.00);
    else if (preset === 'vm') setVinState(0.50);
    else if (preset === '1') setVinState(1.00);
    else if (preset === 'off') setVinState('off');
  }

  document.querySelectorAll('[data-preset]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      applyPreset(btn.dataset.preset);
    });
  });

  // Topbar and workbench IN buttons
  document.querySelectorAll('#in-seg button, #wb-in-seg button').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var raw = btn.dataset.in;
      if (raw === 'off') setVinState('off');
      else if (raw === '0') setVinState(0.00);
      else if (raw === '1') setVinState(1.00);
    });
  });

  // Interactive Graph Canvas: Drag or Click to modulate VIN
  function bindCanvasPointer(c, isModal) {
    if (!c) return;
    var isDragging = false;

    function handleGraphPointer(e) {
      var rect = c.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var scaleX = c.width / rect.width;
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      var canvasX = (clientX - rect.left) * scaleX;

      var padL = (isModal ? 46 : VTC_GRAPH_PAD.L) * (scaleX || 1);
      var padR = (isModal ? 36 : VTC_GRAPH_PAD.R) * (scaleX || 1);
      var plotW = c.width - padL - padR;

      var clickX = canvasX - padL;
      var normX = Math.max(0.00, Math.min(1.00, clickX / plotW));
      var newVin = Math.round(normX * 100) / 100;

      setVinState(newVin);
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

  var inlineCanvas = document.getElementById('iv-canvas');
  if (inlineCanvas) bindCanvasPointer(inlineCanvas, false);

  var modalCanvas = document.getElementById('iv-modal-canvas');
  if (modalCanvas) bindCanvasPointer(modalCanvas, true);

  // Expandable Graph Modal Controls
  var expandBtn = document.getElementById('iv-expand-btn');
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalCloseBtn = document.getElementById('iv-modal-close');

  function openIvModal() {
    if (!modalBackdrop) return;
    modalBackdrop.style.display = 'flex';
    drawVtcGraph();
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
