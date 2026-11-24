/**
 * graph.js - PN Junction Diode Interactive Graph Renderer
 * High-DPI Canvas Rendering:
 * 1. I-V Characteristic Curve:
 *    - Plots I vs VA from -20.0V to +0.8V.
 *    - Labeled background regions (Breakdown, Reverse Bias, Equilibrium, Forward Conduction).
 *    - Dynamic vertical dashed line at -VBR with regime tag.
 *    - Animated live operating marker dot (VA, I) with interactive click/drag to set VA.
 * 2. Space-Charge rho(x) & Electric Field E(x) Profile:
 *    - Asymmetric step profile rho(x) across -xp to +xn.
 *    - Triangular field profile E(x) with peak |Emax| and dashed critical field Ecrit line.
 */

var activeGraphMode = 'iv'; // 'iv' | 'field'
var ivCanvas = document.getElementById('iv-canvas');
var fieldCanvas = document.getElementById('field-canvas');

var isDraggingIV = false;

var modalCanvas = document.getElementById('iv-modal-canvas');
var modalBackdrop = document.getElementById('iv-modal-backdrop');
var isModalOpen = false;

function openIvModal() {
  if (!modalBackdrop) return;
  modalBackdrop.style.display = 'flex';
  isModalOpen = true;
  renderGraphs();
}

function closeIvModal() {
  if (!modalBackdrop) return;
  modalBackdrop.style.display = 'none';
  isModalOpen = false;
}

function initIvModal() {
  var expandBtn = document.getElementById('iv-expand-btn');
  var closeBtn = document.getElementById('iv-modal-close');

  if (expandBtn) expandBtn.addEventListener('click', openIvModal);
  if (closeBtn) closeBtn.addEventListener('click', closeIvModal);

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', function(e) {
      if (e.target === modalBackdrop) closeIvModal();
    });
  }

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isModalOpen) closeIvModal();
  });

  if (modalCanvas) {
    modalCanvas.addEventListener('mousedown', function(e) {
      isDraggingIV = true;
      updateVAFromPointer(e.clientX, modalCanvas);
    });
    modalCanvas.addEventListener('touchstart', function(e) {
      if (!e.touches[0]) return;
      isDraggingIV = true;
      updateVAFromPointer(e.touches[0].clientX, modalCanvas);
      e.preventDefault();
    }, { passive: false });
  }
}

function initGraphs() {
  initIvModal();
  if (ivCanvas) {
    ivCanvas.addEventListener('mousedown', onCanvasMouseDown);
    window.addEventListener('mousemove', onCanvasMouseMove);
    window.addEventListener('mouseup', onCanvasMouseUp);
    ivCanvas.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
  }

  var btnTabIv = document.getElementById('btn-graph-iv');
  var btnTabField = document.getElementById('btn-graph-field');

  if (btnTabIv && btnTabField) {
    btnTabIv.addEventListener('click', function () {
      activeGraphMode = 'iv';
      btnTabIv.classList.add('active');
      btnTabField.classList.remove('active');
      if (ivCanvas) ivCanvas.style.display = 'block';
      if (fieldCanvas) fieldCanvas.style.display = 'none';
      renderGraphs();
    });

    btnTabField.addEventListener('click', function () {
      activeGraphMode = 'field';
      btnTabField.classList.add('active');
      btnTabIv.classList.remove('active');
      if (ivCanvas) ivCanvas.style.display = 'none';
      if (fieldCanvas) fieldCanvas.style.display = 'block';
      renderGraphs();
    });
  }

  renderGraphs();
}

function updateModalReadouts(state) {
  var mVa = document.getElementById('iv-m-va');
  var mI = document.getElementById('iv-m-i');
  var mVbi = document.getElementById('iv-m-vbi');
  var mW = document.getElementById('iv-m-w');
  var mVbr = document.getElementById('iv-m-vbr');

  if (mVa) mVa.textContent = state.va.toFixed(2) + ' V';
  if (mI) mI.textContent = state.iCurrent.toFixed(2) + ' mA';
  if (mVbi) mVbi.textContent = state.vbi.toFixed(2) + ' V';
  if (mW) mW.textContent = (state.w * 1000).toFixed(0) + ' nm';
  if (mVbr) mVbr.textContent = state.vbr.toFixed(1) + ' V';
}

function renderGraphs() {
  var state = (typeof window.getDiodeState === 'function') ? window.getDiodeState() : null;
  if (!state) return;

  if (activeGraphMode === 'iv') {
    renderIVCurve(state, ivCanvas);
  } else {
    renderFieldProfile(state, fieldCanvas);
  }

  if (isModalOpen && modalCanvas) {
    renderIVCurve(state, modalCanvas);
    updateModalReadouts(state);
  }
}

// ---------------------------------------------------------------------------
// 1. RENDER I-V CHARACTERISTIC CURVE
// ---------------------------------------------------------------------------
function renderIVCurve(state, targetCanvas) {
  var canvas = targetCanvas || ivCanvas;
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var w = canvas.clientWidth;
  var h = canvas.clientHeight;
  if (w <= 0 || h <= 0) return;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  if (!ivCanvas) return;
  var ctx = ivCanvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var w = ivCanvas.clientWidth;
  var h = ivCanvas.clientHeight;
  if (w <= 0 || h <= 0) return;

  if (ivCanvas.width !== w * dpr || ivCanvas.height !== h * dpr) {
    ivCanvas.width = w * dpr;
    ivCanvas.height = h * dpr;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  var isLight = currentTheme === 'light';
  var textColor = isLight ? '#334155' : '#94a3b8';
  var textDim = isLight ? '#64748b' : '#64748b';
  var gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  var axisColor = isLight ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.18)';

  // Margin setup
  var padL = 38, padR = 30, padT = 16, padB = 24;
  var plotW = w - padL - padR;
  var plotH = h - padT - padB;

  // Voltage range: -20.0V to +0.8V
  var vMin = -20.0, vMax = 0.8;
  // Current range in mA: -40 mA to +40 mA
  var iMin = -40.0, iMax = 40.0;

  function xToPx(v) {
    return padL + ((v - vMin) / (vMax - vMin)) * plotW;
  }
  function yToPx(i) {
    return padT + plotH - ((i - iMin) / (iMax - iMin)) * plotH;
  }

  // 1. Background Region Tinting
  var vbr = state.vbr || 12.0;
  var xBr = xToPx(-vbr);
  var x0 = xToPx(0.0);

  // Breakdown region: [-20 to -VBR]
  ctx.fillStyle = isLight ? 'rgba(239, 68, 68, 0.08)' : 'rgba(244, 63, 94, 0.10)';
  ctx.fillRect(padL, padT, Math.max(0, xBr - padL), plotH);

  // Reverse bias region: [-VBR to 0]
  ctx.fillStyle = isLight ? 'rgba(245, 158, 11, 0.05)' : 'rgba(234, 179, 8, 0.05)';
  ctx.fillRect(xBr, padT, Math.max(0, x0 - xBr), plotH);

  // Forward conduction region: [0 to +0.8]
  ctx.fillStyle = isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.10)';
  ctx.fillRect(x0, padT, Math.max(0, padL + plotW - x0), plotH);

  // 2. Region Header Labels
  ctx.font = 'bold 8.5px "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? '#dc2626' : '#f43f5e';
  ctx.textAlign = 'left';
  ctx.fillText('BREAKDOWN', padL + 4, padT + 10);

  ctx.fillStyle = isLight ? '#d97706' : '#eab308';
  ctx.textAlign = 'center';
  ctx.fillText('REVERSE', (xBr + x0) / 2, padT + 10);

  ctx.fillStyle = isLight ? '#059669' : '#10b981';
  ctx.textAlign = 'right';
  ctx.fillText('FORWARD', padL + plotW - 4, padT + 10);

  // 3. Gridlines & Axes
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  // Horizontal voltage zero axis
  var y0 = yToPx(0.0);
  ctx.beginPath();
  ctx.moveTo(padL, y0);
  ctx.lineTo(padL + plotW, y0);
  ctx.stroke();

  // Vertical VA = 0 axis
  ctx.beginPath();
  ctx.moveTo(x0, padT);
  ctx.lineTo(x0, padT + plotH);
  ctx.stroke();

  // Major voltage ticks
  var vTicks = [-20, -15, -10, -5, 0];
  ctx.font = '9px "IBM Plex Mono", monospace';
  ctx.fillStyle = textDim;
  ctx.textAlign = 'center';
  for (var i = 0; i < vTicks.length; i++) {
    var vt = vTicks[i];
    var xt = xToPx(vt);
    ctx.fillText(vt + 'V', xt, padT + plotH + 14);
  }
  // +0.8V tick
  ctx.fillText('+0.8V', padL + plotW, padT + plotH + 14);

  // Major current ticks
  var iTicks = [-30, 0, 30];
  ctx.textAlign = 'right';
  for (var j = 0; j < iTicks.length; j++) {
    var it = iTicks[j];
    var yt = yToPx(it);
    ctx.fillText(it + 'mA', padL - 4, yt + 3);
  }

  // 4. Dynamic Vertical Dashed Line at -VBR
  ctx.strokeStyle = state.regime === 'ZENER' ? '#f43f5e' : '#8b5cf6';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(xBr, padT);
  ctx.lineTo(xBr, padT + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // -VBR label pill
  ctx.font = 'bold 8.5px "IBM Plex Mono", monospace';
  ctx.fillStyle = state.regime === 'ZENER' ? '#f43f5e' : '#a78bfa';
  ctx.textAlign = 'center';
  var vbrText = '-VBR (' + (-vbr).toFixed(1) + 'V)';
  ctx.fillText(vbrText, xBr, padT + plotH - 6);

  // 5. Draw Complete I-V Curve
  var curve = DiodePhysics.generateIVCurve(state.na, state.nd, state.temperature, 240);
  ctx.beginPath();
  ctx.strokeStyle = isLight ? '#0d9488' : '#14b8a6';
  ctx.lineWidth = 2.4;
  for (var k = 0; k < curve.length; k++) {
    var pt = curve[k];
    var px = xToPx(pt.v);
    var py = yToPx(Math.max(iMin, Math.min(iMax, pt.i)));
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // 6. Draw Operating Point Marker Dot (VA, I)
  var markerX = xToPx(state.va);
  var markerY = yToPx(Math.max(iMin, Math.min(iMax, state.currentMa)));

  // Pulsing glow outer ring
  var pulseR = 7 + 2 * Math.sin(Date.now() * 0.008);
  ctx.fillStyle = isLight ? 'rgba(13, 148, 136, 0.28)' : 'rgba(20, 184, 166, 0.35)';
  ctx.beginPath();
  ctx.arc(markerX, markerY, pulseR, 0, Math.PI * 2);
  ctx.fill();

  // Center solid dot
  ctx.fillStyle = isLight ? '#0d9488' : '#5fd9c4';
  ctx.beginPath();
  ctx.arc(markerX, markerY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isLight ? '#ffffff' : '#0b0e13';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Telemetry tag above marker
  ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
  ctx.font = 'bold 9px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  var tag = '(' + state.va.toFixed(2) + 'V, ' + state.currentMa.toFixed(2) + 'mA)';
  var tagY = markerY < padT + 20 ? markerY + 16 : markerY - 8;
  ctx.fillText(tag, Math.max(padL + 45, Math.min(padL + plotW - 45, markerX)), tagY);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 2. RENDER SPACE-CHARGE rho(x) & ELECTRIC FIELD E(x) PROFILE
// ---------------------------------------------------------------------------
function renderFieldProfile(state) {
  if (!fieldCanvas) return;
  var ctx = fieldCanvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var w = fieldCanvas.clientWidth;
  var h = fieldCanvas.clientHeight;
  if (w <= 0 || h <= 0) return;

  if (fieldCanvas.width !== w * dpr || fieldCanvas.height !== h * dpr) {
    fieldCanvas.width = w * dpr;
    fieldCanvas.height = h * dpr;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  var isLight = currentTheme === 'light';
  var textDim = isLight ? '#64748b' : '#64748b';
  var gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';

  var padL = 36, padR = 30, padT = 16, padB = 22;
  var plotW = w - padL - padR;
  var halfH = (h - padT - padB) / 2.0;

  var profiles = DiodePhysics.computeSpatialProfiles(state.va, state.na, state.nd, state.temperature, 140);
  var pts = profiles.points;
  var xpNm = profiles.xpNm;
  var xnNm = profiles.xnNm;
  var emax = profiles.emax;
  var ecrit = profiles.ecrit;

  var xMin = -xpNm * 1.35;
  var xMax = xnNm * 1.35;

  function xToPx(xNm) {
    return padL + ((xNm - xMin) / (xMax - xMin)) * plotW;
  }

  var xJunction = xToPx(0.0);
  var xP = xToPx(-xpNm);
  var xN = xToPx(xnNm);

  // TOP HALF: Space Charge rho(x) [-q*NA on P-side, +q*ND on N-side]
  var yRhoZero = padT + halfH * 0.55;
  ctx.fillStyle = textDim;
  ctx.font = 'bold 8.5px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SPACE CHARGE ρ(x)', padL + 4, padT + 8);

  // Zero line
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, yRhoZero);
  ctx.lineTo(padL + plotW, yRhoZero);
  ctx.stroke();

  // P-Side space charge (-q*NA) step block
  var pHeight = halfH * 0.40;
  ctx.fillStyle = 'rgba(234, 88, 12, 0.22)';
  ctx.strokeStyle = '#ea580c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(xP, yRhoZero, Math.max(1, xJunction - xP), pHeight);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ea580c';
  ctx.font = '8px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('-q·NA', (xP + xJunction) / 2, yRhoZero + pHeight / 2 + 3);

  // N-Side space charge (+q*ND) step block
  // Note: Area conservation! q*NA*xp = q*ND*xn
  var nHeight = pHeight * (xpNm / Math.max(1, xnNm));
  nHeight = Math.max(6, Math.min(halfH * 0.48, nHeight));
  ctx.fillStyle = 'rgba(29, 78, 216, 0.22)';
  ctx.strokeStyle = '#1d4ed8';
  ctx.beginPath();
  ctx.rect(xJunction, yRhoZero - nHeight, Math.max(1, xN - xJunction), nHeight);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#1d4ed8';
  ctx.fillText('+q·ND', (xJunction + xN) / 2, yRhoZero - nHeight / 2 + 3);

  // BOTTOM HALF: Electric Field Profile E(x)
  var yFieldBase = padT + halfH * 2.0;
  var fieldTopY = padT + halfH + 8;
  var maxFieldSpan = Math.max(ecrit * 1.15, emax * 1.15);

  ctx.fillStyle = textDim;
  ctx.font = 'bold 8.5px "IBM Plex Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ELECTRIC FIELD |E(x)|', padL + 4, padT + halfH + 10);

  // Base line
  ctx.strokeStyle = gridColor;
  ctx.beginPath();
  ctx.moveTo(padL, yFieldBase);
  ctx.lineTo(padL + plotW, yFieldBase);
  ctx.stroke();

  // Peak field point
  var peakY = yFieldBase - (emax / maxFieldSpan) * (halfH - 14);

  // Triangular E(x) profile (Unified Teal-Green Palette)
  ctx.fillStyle = isLight ? 'rgba(13, 148, 136, 0.20)' : 'rgba(20, 184, 166, 0.24)';
  ctx.strokeStyle = isLight ? '#0d9488' : '#14b8a6';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(xP, yFieldBase);
  ctx.lineTo(xJunction, peakY);
  ctx.lineTo(xN, yFieldBase);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Dashed Ecrit line
  var ecritY = yFieldBase - (ecrit / maxFieldSpan) * (halfH - 14);
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padL, ecritY);
  ctx.lineTo(padL + plotW, ecritY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '8px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#f43f5e';
  ctx.textAlign = 'right';
  ctx.fillText('Ecrit = ' + (ecrit / 1e5).toFixed(1) + '×10⁵ V/cm', padL + plotW - 4, ecritY - 3);

  // Label xp and xn at bottom
  ctx.fillStyle = textDim;
  ctx.textAlign = 'center';
  ctx.fillText('-xp', xP, yFieldBase + 12);
  ctx.fillText('x=0', xJunction, yFieldBase + 12);
  ctx.fillText('+xn', xN, yFieldBase + 12);

  ctx.restore();
}

// ---------------------------------------------------------------------------
// INTERACTIVE MOUSE / TOUCH DRAGGING ON I-V GRAPH
// ---------------------------------------------------------------------------
function updateVAFromPointer(clientX, targetCanvas) {
  var canvas = targetCanvas || (isModalOpen && modalCanvas ? modalCanvas : ivCanvas);
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  var padL = 38, padR = 30;
  var plotW = rect.width - padL - padR;
  var xRel = Math.max(0, Math.min(plotW, (clientX - rect.left) - padL));
  var frac = xRel / plotW;
  var newVa = -20.0 + frac * 20.8; // [-20.0, +0.8]

  // Snap close to 0.0V
  if (Math.abs(newVa) < 0.15) newVa = 0.0;

  if (typeof window.setDiodeBiasVoltage === 'function') {
    window.setDiodeBiasVoltage(newVa);
  }
}

function onCanvasMouseDown(e) {
  if (activeGraphMode !== 'iv') return;
  isDraggingIV = true;
  updateVAFromPointer(e.clientX);
}

function onCanvasMouseMove(e) {
  if (isDraggingIV) {
    updateVAFromPointer(e.clientX);
  }
}

function onCanvasMouseUp() {
  isDraggingIV = false;
}

function onTouchStart(e) {
  if (activeGraphMode !== 'iv' || !e.touches[0]) return;
  isDraggingIV = true;
  updateVAFromPointer(e.touches[0].clientX);
  e.preventDefault();
}

function onTouchMove(e) {
  if (isDraggingIV && e.touches[0]) {
    updateVAFromPointer(e.touches[0].clientX);
    e.preventDefault();
  }
}

function onTouchEnd() {
  isDraggingIV = false;
}
