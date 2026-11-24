/**
 * view-2d-junction.js - Dedicated Interactive 2D Abrupt PN Junction Cross-Section
 * Silicon Sliders — Authentic semiconductor physical cross-section rendering.
 */

var View2DJunction = (function () {
  var canvas = null;
  var ctx = null;
  var isInitialized = false;
  var animFrameId = null;

  // Interaction & Hover state
  var mousePos = { x: -1, y: -1, active: false };
  var hoveredRegion = null; // 'anode' | 'cathode' | 'p-neutral' | 'n-neutral' | 'depletion'

  // Carrier simulation pool
  var holes = [];
  var electrons = [];
  var currentParticles = [];
  var recombinationSparks = [];
  var lastMinoritySpawn = 0;

  var NUM_MAJORITY = 54;
  var NUM_CURRENT = 60;

  function init() {
    canvas = document.getElementById('canvas-2d-junction');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('click', onClick);

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    initCarrierPool();
    isInitialized = true;
    resize();
  }

  function initCarrierPool() {
    holes = [];
    electrons = [];
    currentParticles = [];
    recombinationSparks = [];

    for (var i = 0; i < NUM_MAJORITY; i++) {
      holes.push({
        xRel: Math.random(),
        yRel: 0.12 + Math.random() * 0.76,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2,
        state: 'neutral' // 'neutral' | 'crossing'
      });

      electrons.push({
        xRel: Math.random(),
        yRel: 0.12 + Math.random() * 0.76,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.6,
        phase: Math.random() * Math.PI * 2,
        state: 'neutral'
      });
    }

    for (var j = 0; j < NUM_CURRENT; j++) {
      currentParticles.push({
        t: Math.random(),
        yRel: 0.15 + Math.random() * 0.70,
        speed: 0.006 + Math.random() * 0.006,
        jitterY: (Math.random() - 0.5) * 12
      });
    }
  }

  function resize() {
    if (!canvas) return;
    var host = document.getElementById('junction-2d-overlay') || canvas.parentElement;
    if (!host) return;

    var w = host.clientWidth || window.innerWidth;
    var h = host.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    if (ctx) {
      ctx.resetTransform && ctx.resetTransform();
    }
  }

  function onMouseMove(e) {
    var rect = canvas.getBoundingClientRect();
    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
    mousePos.active = true;
  }

  function onMouseLeave() {
    mousePos.active = false;
    hoveredRegion = null;
    if (canvas) canvas.style.cursor = 'default';
  }

  function onClick(e) {
    if (!hoveredRegion) return;
    var targetId = null;

    if (hoveredRegion === 'depletion') {
      targetId = 'depletionRegion';
    } else if (hoveredRegion === 'p-neutral') {
      targetId = 'pRegion';
    } else if (hoveredRegion === 'n-neutral') {
      targetId = 'nRegion';
    } else if (hoveredRegion === 'anode') {
      targetId = 'anodeMetal';
    } else if (hoveredRegion === 'cathode') {
      targetId = 'cathodeMetal';
    }

    if (targetId && typeof selectComponentById === 'function') {
      selectComponentById(targetId, e.clientX, e.clientY);
    }
  }

  function onTouchStart(e) {
    if (!e.touches[0]) return;
    var rect = canvas.getBoundingClientRect();
    mousePos.x = e.touches[0].clientX - rect.left;
    mousePos.y = e.touches[0].clientY - rect.top;
    mousePos.active = true;
  }

  function onTouchMove(e) {
    if (!e.touches[0]) return;
    var rect = canvas.getBoundingClientRect();
    mousePos.x = e.touches[0].clientX - rect.left;
    mousePos.y = e.touches[0].clientY - rect.top;
    mousePos.active = true;
    e.preventDefault();
  }

  function onTouchEnd(e) {
    if (hoveredRegion) {
      onClick({ clientX: mousePos.x, clientY: mousePos.y });
    }
    mousePos.active = false;
  }

  /**
   * Main rendering loop for 2D Junction View
   */
  function render() {
    if (!canvas || !ctx) return;
    var host = document.getElementById('junction-2d-overlay');
    if (!host || host.style.display === 'none' || !host.classList.contains('visible')) {
      return;
    }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = canvas.width / dpr;
    var h = canvas.height / dpr;
    if (w <= 0 || h <= 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    var state = (typeof window.getDiodeState === 'function') ? window.getDiodeState() : {
      va: 0.0, currentMa: 0.0, vbi: 0.78, wNm: 350, xpNm: 35, xnNm: 315,
      na: 1e17, nd: 1e16, emax: 4.4e5, vbr: 12.4, regime: 'EQUILIBRIUM', regimeLabel: 'Equilibrium'
    };

    var isCarrierMode = (typeof flowMode === 'undefined' || flowMode === 'carrier');

    // -------------------------------------------------------------------------
    // 1. LAYOUT GEOMETRY
    // -------------------------------------------------------------------------
    var padH = Math.max(28, w * 0.04);
    var contactW = Math.min(46, Math.max(30, w * 0.045));
    var maxBlockW = Math.min(1060, w - padH * 2 - contactW * 2);
    var blockW = Math.max(280, maxBlockW);
    var blockH = Math.min(320, Math.max(180, h * 0.44));

    var blockX = (w - blockW) / 2;
    var blockY = (h - blockH) / 2 + 18;

    var xMid = w / 2; // Metallurgical junction x = 0
    var xAnode = blockX;
    var xCathode = blockX + blockW;
    var halfW = blockW / 2;

    // Asymmetric depletion pixel mapping (NA * xp = ND * xn)
    var totalWNm = Math.max(10, state.xpNm + state.xnNm);
    var pFrac = state.xpNm / totalWNm; // Fraction on P-side
    var nFrac = state.xnNm / totalWNm; // Fraction on N-side

    // Base visual span for total W (dynamic expansion with bias)
    var refW = 450.0;
    var wScaleNorm = Math.pow(Math.max(20, totalWNm) / refW, 0.62);
    var totalWVis = Math.max(28, Math.min(blockW * 0.86, halfW * 1.15 * wScaleNorm));

    var xpVis = Math.max(10, Math.min(halfW * 0.88, totalWVis * pFrac));
    var xnVis = Math.max(10, Math.min(halfW * 0.88, totalWVis * nFrac));

    var xDepLeft = xMid - xpVis;
    var xDepRight = xMid + xnVis;

    // Detect Hover Region
    hoveredRegion = null;
    if (mousePos.active) {
      var mx = mousePos.x, my = mousePos.y;
      if (my >= blockY && my <= blockY + blockH) {
        if (mx >= xAnode - contactW && mx < xAnode) {
          hoveredRegion = 'anode';
        } else if (mx >= xCathode && mx <= xCathode + contactW) {
          hoveredRegion = 'cathode';
        } else if (mx >= xDepLeft && mx <= xDepRight) {
          hoveredRegion = 'depletion';
        } else if (mx >= xAnode && mx < xDepLeft) {
          hoveredRegion = 'p-neutral';
        } else if (mx > xDepRight && mx <= xCathode) {
          hoveredRegion = 'n-neutral';
        }
      }
    }
    if (canvas) {
      canvas.style.cursor = hoveredRegion ? 'pointer' : 'default';
    }

    // -------------------------------------------------------------------------
    // 2. BACKGROUND SEMICONDUCTOR BLOCKS (P-SIDE & N-SIDE)
    // -------------------------------------------------------------------------
    // Left Half: P-Type Neutral Region (Orange/Amber family)
    var pGrad = ctx.createLinearGradient(xAnode, blockY, xMid, blockY);
    if (isLight) {
      pGrad.addColorStop(0, '#fed7aa');
      pGrad.addColorStop(1, '#ffedd5');
    } else {
      pGrad.addColorStop(0, '#7c2d12');
      pGrad.addColorStop(1, '#9a3412');
    }
    ctx.fillStyle = pGrad;
    ctx.beginPath();
    ctx.rect(xAnode, blockY, halfW, blockH);
    ctx.fill();

    // Right Half: N-Type Neutral Region (Blue family)
    var nGrad = ctx.createLinearGradient(xMid, blockY, xCathode, blockY);
    if (isLight) {
      nGrad.addColorStop(0, '#e0f2fe');
      nGrad.addColorStop(1, '#bfdbfe');
    } else {
      nGrad.addColorStop(0, '#1e3a8a');
      nGrad.addColorStop(1, '#172554');
    }
    ctx.fillStyle = nGrad;
    ctx.beginPath();
    ctx.rect(xMid, blockY, halfW, blockH);
    ctx.fill();

    // Semiconductor Outer Border
    ctx.strokeStyle = isLight ? '#94a3b8' : '#334155';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(xAnode, blockY, blockW, blockH);

    // -------------------------------------------------------------------------
    // 3. ASYMMETRIC DEPLETION REGION (-xp to +xn)
    // -------------------------------------------------------------------------
    // Translucent dark charcoal/slate overlay
    ctx.fillStyle = isLight ? 'rgba(30, 41, 59, 0.70)' : 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(xDepLeft, blockY, xDepRight - xDepLeft, blockH);

    // Subtle edge boundary glow / stroke
    ctx.strokeStyle = (hoveredRegion === 'depletion') ? 'var(--accent, #5fd9c4)' : (isLight ? '#64748b' : '#475569');
    ctx.lineWidth = (hoveredRegion === 'depletion') ? 2.5 : 1.5;
    ctx.strokeRect(xDepLeft, blockY, xDepRight - xDepLeft, blockH);

    // High-Field Breakdown Glow inside depletion zone
    var isBreakdown = (state.regime === 'ZENER' || state.regime === 'AVALANCHE' || state.regime === 'MIXED');
    if (isBreakdown) {
      var pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.01);
      ctx.fillStyle = state.regime === 'ZENER'
        ? 'rgba(244, 63, 94, ' + (0.18 + 0.14 * pulse) + ')'
        : 'rgba(139, 92, 246, ' + (0.18 + 0.14 * pulse) + ')';
      ctx.fillRect(xDepLeft, blockY, xDepRight - xDepLeft, blockH);
    }

    // Metallurgical Junction Line at x = 0 (Center)
    ctx.strokeStyle = isLight ? '#cbd5e1' : '#94a3b8';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(xMid, blockY - 14);
    ctx.lineTo(xMid, blockY + blockH + 14);
    ctx.stroke();
    ctx.setLineDash([]);

    // -------------------------------------------------------------------------
    // 4. ORDERLY FIXED SPACE-CHARGE IONS GRID
    // -------------------------------------------------------------------------
    var ionRows = 4;
    var ionRadius = Math.min(10.5, Math.max(7.5, blockH * 0.038));
    var ySpacing = blockH / (ionRows + 1);

    // P-Side Acceptor Ions NA- (-) inside [-xp, 0]
    var pCols = Math.max(1, Math.min(8, Math.floor(xpVis / (ionRadius * 2.5))));
    var pColSpacing = xpVis / (pCols + 0.5);

    for (var pc = 0; pc < pCols; pc++) {
      var ionX_p = xMid - (pc + 0.75) * pColSpacing;
      var alphaP = Math.min(1.0, (xMid - ionX_p) / Math.max(1, xpVis));

      for (var pr = 1; pr <= ionRows; pr++) {
        var ionY_p = blockY + pr * ySpacing;
        drawIonBadge(ctx, ionX_p, ionY_p, ionRadius, '−', '#ea580c', alphaP, isLight);
      }
    }

    // N-Side Donor Ions ND+ (+) inside [0, +xn]
    var nCols = Math.max(1, Math.min(8, Math.floor(xnVis / (ionRadius * 2.5))));
    var nColSpacing = xnVis / (nCols + 0.5);

    for (var nc = 0; nc < nCols; nc++) {
      var ionX_n = xMid + (nc + 0.75) * nColSpacing;
      var alphaN = Math.min(1.0, (ionX_n - xMid) / Math.max(1, xnVis));

      for (var nr = 1; nr <= ionRows; nr++) {
        var ionY_n = blockY + nr * ySpacing;
        drawIonBadge(ctx, ionX_n, ionY_n, ionRadius, '+', '#1d4ed8', alphaN, isLight);
      }
    }

    // -------------------------------------------------------------------------
    // 5. ELECTRIC FIELD INDICATOR (N -> P) INSIDE DEPLETION ZONE
    // -------------------------------------------------------------------------
    var fieldSpan = xDepRight - xDepLeft;
    if (fieldSpan > 34) {
      var eFrac = Math.min(1.0, state.emax / 1.0e6);
      var eAlpha = 0.25 + 0.65 * eFrac;
      var arrowY = blockY + blockH - 24;

      ctx.save();
      ctx.strokeStyle = isLight ? '#0d9488' : '#14b8a6';
      ctx.fillStyle = isLight ? '#0d9488' : '#14b8a6';
      ctx.globalAlpha = eAlpha;
      ctx.lineWidth = 1.8 + eFrac * 1.5;

      // Draw horizontal field vector pointing Left (N -> P)
      var arrowStartX = xDepRight - 16;
      var arrowEndX = xDepLeft + 16;

      ctx.beginPath();
      ctx.moveTo(arrowStartX, arrowY);
      ctx.lineTo(arrowEndX, arrowY);
      ctx.stroke();

      // Arrow head pointing left
      ctx.beginPath();
      ctx.moveTo(arrowEndX, arrowY);
      ctx.lineTo(arrowEndX + 8, arrowY - 4);
      ctx.lineTo(arrowEndX + 8, arrowY + 4);
      ctx.closePath();
      ctx.fill();

      // Field label
      ctx.font = '600 9.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      var eLabel = '← E-FIELD (N → P) · |Emax| = ' + (state.emax / 1e5).toFixed(1) + '×10⁵ V/cm';
      ctx.fillText(eLabel, (arrowStartX + arrowEndX) / 2, arrowY - 6);
      ctx.restore();
    }

    // -------------------------------------------------------------------------
    // 6. ANIMATED MOBILE CARRIERS & CURRENT SIMULATION
    // -------------------------------------------------------------------------
    if (isCarrierMode) {
      renderMobileCarriers(ctx, state, xAnode, xMid, xCathode, xDepLeft, xDepRight, blockY, blockH, isLight);
    } else {
      renderConventionalCurrent(ctx, state, xAnode, xCathode, blockY, blockH, isLight);
    }

    // -------------------------------------------------------------------------
    // 7. METAL CONTACT BARS (ANODE & CATHODE)
    // -------------------------------------------------------------------------
    var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
    var metalCol = pal ? pal.metal : (isLight ? '#475569' : '#94A3B8');

    // Left Anode Metal Bar (A)
    var anodeHov = (hoveredRegion === 'anode');
    ctx.fillStyle = anodeHov ? (isLight ? '#64748B' : '#CBD5E1') : metalCol;
    ctx.fillRect(xAnode - contactW, blockY, contactW, blockH);
    ctx.strokeStyle = anodeHov ? '#ffffff' : (isLight ? '#334155' : '#64748B');
    ctx.lineWidth = anodeHov ? 2.5 : 1.5;
    ctx.strokeRect(xAnode - contactW, blockY, contactW, blockH);

    // Anode Vertical Label
    ctx.save();
    ctx.translate(xAnode - contactW / 2, blockY + blockH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = 'bold 11px "IBM Plex Mono", monospace';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ANODE (A) [VA]', 0, 0);
    ctx.restore();

    // Right Cathode Metal Bar (K)
    var cathHov = (hoveredRegion === 'cathode');
    ctx.fillStyle = cathHov ? (isLight ? '#64748B' : '#CBD5E1') : metalCol;
    ctx.fillRect(xCathode, blockY, contactW, blockH);
    ctx.strokeStyle = cathHov ? '#ffffff' : (isLight ? '#334155' : '#64748B');
    ctx.lineWidth = cathHov ? 2.5 : 1.5;
    ctx.strokeRect(xCathode, blockY, contactW, blockH);

    // Cathode Vertical Label
    ctx.save();
    ctx.translate(xCathode + contactW / 2, blockY + blockH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.font = 'bold 11px "IBM Plex Mono", monospace';
    ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CATHODE (K) [GND]', 0, 0);
    ctx.restore();

    // -------------------------------------------------------------------------
    // 8. REGION WATERMARK LABELS (P-TYPE & N-TYPE)
    // -------------------------------------------------------------------------
    ctx.font = 'bold 13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';

    // P-Region Label (Left Neutral)
    var pTextX = (xAnode + xDepLeft) / 2;
    if (pTextX > xAnode + 30) {
      ctx.fillStyle = isLight ? '#ea580c' : '#fb923c';
      ctx.fillText('P-TYPE SILICON', pTextX, blockY + 28);
      ctx.font = '600 10.5px "IBM Plex Mono", monospace';
      ctx.fillStyle = isLight ? '#9a3412' : '#fdba74';
      ctx.fillText('NA = ' + formatDopingShort(state.na), pTextX, blockY + 44);
    }

    // N-Region Label (Right Neutral)
    ctx.font = 'bold 13px "IBM Plex Mono", monospace';
    var nTextX = (xCathode + xDepRight) / 2;
    if (nTextX < xCathode - 30) {
      ctx.fillStyle = isLight ? '#1d4ed8' : '#60a5fa';
      ctx.fillText('N-TYPE SILICON', nTextX, blockY + 28);
      ctx.font = '600 10.5px "IBM Plex Mono", monospace';
      ctx.fillStyle = isLight ? '#1e3a8a' : '#93c5fd';
      ctx.fillText('ND = ' + formatDopingShort(state.nd), nTextX, blockY + 44);
    }

    // Metallurgical Junction Label at top of center line
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = isLight ? '#475569' : '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText('x = 0 (Metallurgical Junction)', xMid, blockY - 20);

    // -------------------------------------------------------------------------
    // 9. CAD-STYLE DIMENSION BRACKETS (xp, xn, W)
    // -------------------------------------------------------------------------
    var bracketY1 = blockY + blockH + 26; // Sub-brackets xp and xn
    var bracketY2 = blockY + blockH + 54; // Master bracket W

    // 9a. Bracket for xp (P-Side width)
    drawCadBracket(ctx, xDepLeft, xMid, bracketY1, 'xp = ' + state.xpNm.toFixed(0) + ' nm', '#ea580c', isLight);

    // 9b. Bracket for xn (N-Side width)
    drawCadBracket(ctx, xMid, xDepRight, bracketY1, 'xn = ' + state.xnNm.toFixed(0) + ' nm', '#1d4ed8', isLight);

    // 9c. Master Bracket for total W
    var wText = 'W = xp + xn = ' + (state.wNm < 1000 ? state.wNm.toFixed(0) + ' nm' : state.wUm.toFixed(2) + ' μm') + ' (Depletion Width)';
    drawCadBracket(ctx, xDepLeft, xDepRight, bracketY2, wText, isLight ? '#0d9488' : '#14b8a6', isLight, true);

    // -------------------------------------------------------------------------
    // 10. TOP HUD STATUS STRIP (Operating Regime & Telemetry)
    // -------------------------------------------------------------------------
    drawTopHudStrip(ctx, state, w, isLight);

    ctx.restore();
    animFrameId = requestAnimationFrame(render);
  }

  // ---------------------------------------------------------------------------
  // HELPER: Fixed Ion Badges
  // ---------------------------------------------------------------------------
  function drawIonBadge(c, x, y, r, sign, col, alpha, isLight) {
    c.save();
    c.globalAlpha = Math.max(0.08, Math.min(0.95, alpha));

    // Outer circle
    c.fillStyle = col;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();

    c.strokeStyle = '#ffffff';
    c.lineWidth = 1.2;
    c.stroke();

    // Center symbol (+ or -)
    c.fillStyle = '#ffffff';
    c.font = 'bold ' + Math.round(r * 1.35) + 'px "IBM Plex Mono", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(sign, x, sign === '+' ? y + 0.5 : y - 0.5);

    c.restore();
  }

  // ---------------------------------------------------------------------------
  // HELPER: CAD Dimension Bracket
  // ---------------------------------------------------------------------------
  function drawCadBracket(c, x1, x2, y, label, col, isLight, isBold) {
    var span = Math.abs(x2 - x1);
    if (span < 4) return;

    var leftX = Math.min(x1, x2);
    var rightX = Math.max(x1, x2);

    c.save();
    c.strokeStyle = col;
    c.fillStyle = col;
    c.lineWidth = isBold ? 1.8 : 1.2;

    // Vertical extension ticks
    var tickH = 6;
    c.beginPath();
    c.moveTo(leftX, y - tickH);
    c.lineTo(leftX, y + tickH);
    c.moveTo(rightX, y - tickH);
    c.lineTo(rightX, y + tickH);

    // Horizontal dimension line with arrows
    c.moveTo(leftX, y);
    c.lineTo(rightX, y);
    c.stroke();

    // Arrow heads
    var arrowSize = Math.min(5, span * 0.2);
    c.beginPath();
    c.moveTo(leftX, y);
    c.lineTo(leftX + arrowSize, y - 3);
    c.lineTo(leftX + arrowSize, y + 3);
    c.closePath();
    c.fill();

    c.beginPath();
    c.moveTo(rightX, y);
    c.lineTo(rightX - arrowSize, y - 3);
    c.lineTo(rightX - arrowSize, y + 3);
    c.closePath();
    c.fill();

    // Text Label
    c.font = (isBold ? 'bold ' : '500 ') + '10px "IBM Plex Mono", monospace';
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillText(label, (leftX + rightX) / 2, y - 3);

    c.restore();
  }

  // ---------------------------------------------------------------------------
  // HELPER: Mobile Carriers Simulation
  // ---------------------------------------------------------------------------
  function renderMobileCarriers(c, state, xAnode, xMid, xCathode, xDepLeft, xDepRight, blockY, blockH, isLight) {
    var va = state.va;
    var currentMa = state.currentMa;
    var absI = Math.abs(currentMa);
    var regime = state.regime;

    var isForward = (regime === 'FORWARD' || va > 0.05);
    var isBreakdown = (regime === 'ZENER' || regime === 'AVALANCHE' || regime === 'MIXED');

    var pNeutralWidth = Math.max(10, xDepLeft - xAnode);
    var nNeutralWidth = Math.max(10, xCathode - xDepRight);

    var driftSpeed = 0.6 + 2.8 * Math.min(1.0, absI / 25.0);
    var carrierRadius = 3.6;

    var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
    var holeCoreCol = pal ? pal.holeFlow : (isLight ? '#BE123C' : '#F43F5E');
    var holeGlowCol = isLight ? '#FB7185' : '#FDA4AF';
    var elecCoreCol = pal ? pal.electronFlow : (isLight ? '#D97706' : '#F59E0B');
    var elecGlowCol = isLight ? '#FBBF24' : '#FDE68A';

    // 1. Render Holes (h+)
    for (var i = 0; i < holes.length; i++) {
      var h = holes[i];

      if (isForward) {
        // Forward conduction: holes drift from Anode (left) across junction into N-side
        h.xRel += 0.003 * driftSpeed;
        if (h.xRel > 1.25) {
          h.xRel = 0.02 + Math.random() * 0.15;
          h.yRel = 0.12 + Math.random() * 0.76;
        }

        var curX_h;
        if (h.xRel < 0.60) {
          // Inside P-neutral region
          curX_h = xAnode + (h.xRel / 0.60) * pNeutralWidth;
        } else if (h.xRel < 0.85) {
          // Crossing depletion region
          var crossFrac = (h.xRel - 0.60) / 0.25;
          curX_h = xDepLeft + crossFrac * (xDepRight - xDepLeft);
        } else {
          // Injected into N-side (minority hole)
          var nFracInj = (h.xRel - 0.85) / 0.40;
          curX_h = xDepRight + nFracInj * nNeutralWidth;

          // Recombination spark occasionally
          if (Math.random() < 0.02) {
            spawnRecombinationSpark(curX_h, blockY + h.yRel * blockH, '#ea580c');
            h.xRel = 0.02; // Recycle back to anode
          }
        }

        drawCarrierDot(c, curX_h, blockY + h.yRel * blockH, carrierRadius, holeCoreCol, holeGlowCol);

      } else if (isBreakdown) {
        // Breakdown avalanche streaming
        h.xRel += 0.015 * driftSpeed;
        if (h.xRel > 1.0) h.xRel = 0.0;
        var bX = xDepLeft + h.xRel * (xDepRight - xDepLeft);
        drawCarrierDot(c, bX, blockY + h.yRel * blockH, carrierRadius + 0.5, holeCoreCol, holeGlowCol);

      } else {
        // Equilibrium / Reverse: subtle Brownian thermal jitter inside neutral P-region
        h.phase += 0.05;
        var jitterX = Math.sin(h.phase) * 1.8;
        var jitterY = Math.cos(h.phase * 1.3) * 1.4;

        var posX_h = xAnode + h.xRel * (pNeutralWidth - 12) + jitterX;
        var posY_h = blockY + h.yRel * blockH + jitterY;

        // Repelled at depletion boundary xDepLeft
        if (posX_h > xDepLeft - 6) posX_h = xDepLeft - 6 - Math.abs(jitterX);

        drawCarrierDot(c, posX_h, posY_h, carrierRadius, holeCoreCol, holeGlowCol);
      }
    }

    // 2. Render Electrons (e-)
    for (var j = 0; j < electrons.length; j++) {
      var e = electrons[j];

      if (isForward) {
        // Forward conduction: electrons drift from Cathode (right) across junction into P-side
        e.xRel -= 0.003 * driftSpeed;
        if (e.xRel < -0.25) {
          e.xRel = 0.98 - Math.random() * 0.15;
          e.yRel = 0.12 + Math.random() * 0.76;
        }

        var curX_e;
        if (e.xRel > 0.40) {
          // Inside N-neutral region
          var nFracE = (e.xRel - 0.40) / 0.60;
          curX_e = xDepRight + nFracE * nNeutralWidth;
        } else if (e.xRel > 0.15) {
          // Crossing depletion region
          var crossFracE = (e.xRel - 0.15) / 0.25;
          curX_e = xDepLeft + crossFracE * (xDepRight - xDepLeft);
        } else {
          // Injected into P-side (minority electron)
          var pFracInj = e.xRel / 0.15;
          curX_e = xAnode + pFracInj * pNeutralWidth;

          if (Math.random() < 0.02) {
            spawnRecombinationSpark(curX_e, blockY + e.yRel * blockH, '#0284c7');
            e.xRel = 0.98;
          }
        }

        drawCarrierDot(c, curX_e, blockY + e.yRel * blockH, carrierRadius, elecCoreCol, elecGlowCol);

      } else if (isBreakdown) {
        // Avalanche reverse streaming
        e.xRel -= 0.015 * driftSpeed;
        if (e.xRel < 0.0) e.xRel = 1.0;
        var bXe = xDepLeft + e.xRel * (xDepRight - xDepLeft);
        drawCarrierDot(c, bXe, blockY + e.yRel * blockH, carrierRadius + 0.5, elecCoreCol, elecGlowCol);

      } else {
        // Equilibrium / Reverse: Brownian thermal jitter inside neutral N-region
        e.phase += 0.05;
        var jX = Math.sin(e.phase + 1.2) * 1.8;
        var jY = Math.cos(e.phase * 1.4) * 1.4;

        var posX_e = xDepRight + 6 + e.xRel * (nNeutralWidth - 12) + jX;
        var posY_e = blockY + e.yRel * blockH + jY;

        // Repelled at depletion boundary xDepRight
        if (posX_e < xDepRight + 6) posX_e = xDepRight + 6 + Math.abs(jX);

        drawCarrierDot(c, posX_e, posY_e, carrierRadius, elecCoreCol, elecGlowCol);
      }
    }

    // 3. Render Recombination Sparks
    renderSparks(c);
  }

  // ---------------------------------------------------------------------------
  // HELPER: Conventional Current Simulation (I mode)
  // ---------------------------------------------------------------------------
  function renderConventionalCurrent(c, state, xAnode, xCathode, blockY, blockH, isLight) {
    var va = state.va;
    var currentMa = state.currentMa;
    var absI = Math.abs(currentMa);
    var isReverseFlow = (currentMa < -0.05); // Breakdown current flows K -> A
    var speed = 0.004 + 0.016 * Math.min(1.0, absI / 25.0);

    for (var k = 0; k < currentParticles.length; k++) {
      var cp = currentParticles[k];

      if (isReverseFlow) {
        cp.t -= speed;
        if (cp.t < 0) cp.t = 1.0;
      } else if (absI > 0.02) {
        cp.t += speed;
        if (cp.t > 1.0) cp.t = 0.0;
      }

      var px = xAnode + cp.t * (xCathode - xAnode);
      var py = blockY + cp.yRel * blockH + cp.jitterY;

      drawCarrierDot(c, px, py, 3.8, isLight ? '#d97706' : '#fde047', isLight ? '#b45309' : '#eab308');
    }
  }

  function drawCarrierDot(c, x, y, r, coreCol, glowCol) {
    c.save();
    // Subtle outer glow
    c.fillStyle = glowCol;
    c.globalAlpha = 0.45;
    c.beginPath();
    c.arc(x, y, r + 2.0, 0, Math.PI * 2);
    c.fill();

    // Solid core
    c.globalAlpha = 0.95;
    c.fillStyle = coreCol;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  function spawnRecombinationSpark(x, y, col) {
    recombinationSparks.push({
      x: x, y: y, radius: 2.0, maxR: 12.0, alpha: 0.9, col: col
    });
  }

  function renderSparks(c) {
    for (var i = recombinationSparks.length - 1; i >= 0; i--) {
      var s = recombinationSparks[i];
      s.radius += 0.8;
      s.alpha -= 0.05;

      if (s.alpha <= 0) {
        recombinationSparks.splice(i, 1);
        continue;
      }

      c.save();
      c.strokeStyle = s.col;
      c.globalAlpha = s.alpha;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  // ---------------------------------------------------------------------------
  // HELPER: Top Telemetry & Status HUD Strip
  // ---------------------------------------------------------------------------
  function drawTopHudStrip(c, state, w, isLight) {
    c.save();
    var hudY = 24;

    c.font = 'bold 12px "IBM Plex Mono", monospace';
    c.textAlign = 'left';
    c.fillStyle = isLight ? '#0f172a' : '#ffffff';
    c.fillText('2D ABRUPT PN JUNCTION · CROSS-SECTION VIEW', 24, hudY);

    // Regime pill
    var pillText = state.regimeLabel || 'THERMAL EQUILIBRIUM';
    c.font = 'bold 10px "IBM Plex Mono", monospace';
    c.textAlign = 'right';

    var pillCol = '#14b8a6';
    if (state.regime === 'FORWARD') pillCol = '#10b981';
    else if (state.regime === 'REVERSE') pillCol = '#f59e0b';
    else if (state.regime === 'ZENER' || state.regime === 'AVALANCHE') pillCol = '#ef4444';

    c.fillStyle = pillCol;
    c.fillText('REGIME: ' + pillText.toUpperCase() + ' · VA = ' + (state.va >= 0 ? '+' : '') + state.va.toFixed(2) + 'V', w - 24, hudY);

    c.restore();
  }

  function formatDopingShort(val) {
    var exp = Math.floor(Math.log10(val));
    var coeff = (val / Math.pow(10, exp)).toFixed(1);
    var superscripts = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
    var expStr = exp.toString().split('').map(function (ch) { return superscripts[ch] || ch; }).join('');
    return coeff + '×10' + expStr + ' cm⁻³';
  }

  function start() {
    if (!isInitialized) init();
    if (!animFrameId) {
      animFrameId = requestAnimationFrame(render);
    }
  }

  function stop() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  return {
    init: init,
    resize: resize,
    start: start,
    stop: stop,
    render: render
  };
})();

window.View2DJunction = View2DJunction;
