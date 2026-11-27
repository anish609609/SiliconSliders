/**
 * main.js - NMOS CAD Viewer
 * Side-panel drawer toggles, collapse toggles, Reset-to-default routine,
 * and final bootstrap calls that start the application. Load this file LAST.
 */

/**
 * main.js - NMOS CAD Viewer
 * Left Workbench collapse/expand toggles, smooth resize transition, Reset-to-default routine,
 * and final bootstrap calls that start the application. Load this file LAST.
 */

var leftWorkbench = document.getElementById('left-workbench');
var workbenchToggleBtn = document.getElementById('workbench-toggle') || document.getElementById('left-toggle');

var resizeAnimId = null;
function animateResizeTransition() {
  var start = performance.now();
  var duration = 280; // ms
  if (resizeAnimId) cancelAnimationFrame(resizeAnimId);
  function step(now) {
    if (typeof resize === 'function') resize();
    if (typeof drawIdsVdsGraph === 'function') drawIdsVdsGraph();
    if (now - start < duration) {
      resizeAnimId = requestAnimationFrame(step);
    } else {
      if (typeof resize === 'function') resize();
      if (typeof drawIdsVdsGraph === 'function') drawIdsVdsGraph();
      resizeAnimId = null;
    }
  }
  resizeAnimId = requestAnimationFrame(step);
}
window.animateResizeTransition = animateResizeTransition;

// =====================================================================
// DRAG-TO-RESIZE LEFT WORKBENCH
// =====================================================================
var MIN_WB_WIDTH = 300;

function getMaxWbWidth() {
  return Math.min(520, Math.round(window.innerWidth * 0.45));
}

function getDefaultWbWidth() {
  return window.innerWidth >= 768 ? getMaxWbWidth() : 330;
}

function setWorkbenchWidth(w) {
  var clamped = Math.max(MIN_WB_WIDTH, Math.min(getMaxWbWidth(), Math.round(w)));
  document.documentElement.style.setProperty('--wb-width', clamped + 'px');
  if (typeof resize === 'function') resize();
  if (typeof drawIdsVdsGraph === 'function') drawIdsVdsGraph();
  return clamped;
}
window.setWorkbenchWidth = setWorkbenchWidth;

function initWorkbenchResize() {
  var handle = document.getElementById('wb-resize-handle');
  if (!handle || !leftWorkbench) return;

  var isResizing = false;

  function onPointerMove(e) {
    if (!isResizing) return;
    var clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
    if (clientX === undefined) return;
    setWorkbenchWidth(clientX);
  }

  function onPointerUp() {
    if (!isResizing) return;
    isResizing = false;
    leftWorkbench.classList.remove('resizing');
    document.body.classList.remove('wb-resizing');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('touchmove', onPointerMove);
    window.removeEventListener('touchend', onPointerUp);
    if (typeof resize === 'function') resize();
    if (typeof drawIdsVdsGraph === 'function') drawIdsVdsGraph();
  }

  handle.addEventListener('pointerdown', function(e) {
    if (e.button !== 0) return;
    if (leftWorkbench.classList.contains('collapsed')) return;
    isResizing = true;
    leftWorkbench.classList.add('resizing');
    document.body.classList.add('wb-resizing');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    e.preventDefault();
  });

  handle.addEventListener('touchstart', function(e) {
    if (leftWorkbench.classList.contains('collapsed')) return;
    isResizing = true;
    leftWorkbench.classList.add('resizing');
    document.body.classList.add('wb-resizing');
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  }, { passive: false });

  // Double-click resets to default width (max width on desktop)
  handle.addEventListener('dblclick', function(e) {
    e.stopPropagation();
    leftWorkbench.classList.remove('resizing');
    document.body.classList.remove('wb-resizing');
    setWorkbenchWidth(getDefaultWbWidth());
    animateResizeTransition();
  });
}
initWorkbenchResize();

function toggleWorkbench(forceExpanded) {
  if (!leftWorkbench) return;
  var willBeCollapsed = (typeof forceExpanded === 'boolean') ? !forceExpanded : !leftWorkbench.classList.contains('collapsed');
  leftWorkbench.classList.toggle('collapsed', willBeCollapsed);
  if (workbenchToggleBtn) {
    workbenchToggleBtn.setAttribute('aria-expanded', willBeCollapsed ? 'false' : 'true');
  }
  // When expanding workbench, hide floating popover; if a component is selected, ensure inspect tab is active
  if (!willBeCollapsed) {
    if (typeof hidePopover === 'function') hidePopover();
    if (typeof lastSelectedId !== 'undefined' && lastSelectedId) {
      if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('inspect');
    }
  }
  animateResizeTransition();
}
window.toggleWorkbench = toggleWorkbench;

function expandWorkbench() {
  if (!leftWorkbench) return;
  if (leftWorkbench.classList.contains('collapsed')) {
    toggleWorkbench(true);
  }
}
window.expandWorkbench = expandWorkbench;

if (workbenchToggleBtn) {
  workbenchToggleBtn.addEventListener('click', function() {
    toggleWorkbench();
  });
}

if (leftWorkbench) {
  leftWorkbench.addEventListener('transitionend', function() {
    if (typeof resize === 'function') resize();
  });
}

// Default entry state: Left Workbench is expanded by default in SLIDERS mode
if (leftWorkbench) {
  leftWorkbench.classList.remove('collapsed');
  if (workbenchToggleBtn) workbenchToggleBtn.setAttribute('aria-expanded', 'true');
}

// =====================================================================
// RESET TO DEFAULT
// =====================================================================
function resetAll() {
  if (typeof stopBuildAnimation === 'function') stopBuildAnimation(true);
  var tourBanner = document.getElementById('tour-banner');
  if (tourBanner) tourBanner.style.display = 'none';

  if (typeof activeCamera !== 'undefined' && typeof controls !== 'undefined') {
    activeCamera.position.copy(INITIAL_POS);
    controls.target.copy(INITIAL_TARGET);
    controls.update();
  }

  if (typeof applyExplode === 'function') applyExplode(0, 18, 0);
  if (typeof resetScrub === 'function') resetScrub();

  currentVgs = 1.00;
  currentVds = 0.80;
  currentIn = 1;
  var inSeg = document.getElementById('in-seg');
  if (inSeg) {
    inSeg.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.in === '1');
    });
  }

  flowMode = 'carrier';
  var flowSeg = document.getElementById('flow-seg');
  if (flowSeg) {
    flowSeg.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.flow === 'carrier');
    });
  }

  if (typeof applyLogicState === 'function') applyLogicState();
  if (typeof rebuildFlowCurves === 'function') rebuildFlowCurves();
  window.showDepletionLayer = true;

  if (typeof clearSelection === 'function') clearSelection();
  lastSelectedId = null;
  if (typeof hidePopover === 'function') hidePopover();

  var inspector = document.getElementById('inspector');
  if (inspector) {
    inspector.innerHTML = '<div class="empty">Select a layer, region, or tree node to inspect its function, electrical role, and physical relationships.</div>';
  }
  var crumbSel = document.getElementById('crumb-sel');
  if (crumbSel) crumbSel.textContent = '';

  // Reset workbench tab to Controls (default)
  if (typeof switchWorkbenchTab === 'function') {
    switchWorkbenchTab('controls');
  }

  // Reset 3D Floating Labels toggle
  var toggleLabelsChk = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
  if (toggleLabelsChk) toggleLabelsChk.checked = true;
  if (typeof window.toggleLabels === 'function') window.toggleLabels(true);

  // Sliders mode: workbench is expanded by default at max desktop width
  expandWorkbench();
  setWorkbenchWidth(getDefaultWbWidth());
}

// =====================================================================
// SUBTLE 1-LINE CAMERA CONTROLS HINT
// =====================================================================
function initCameraHint() {
  var hint = document.getElementById('camera-hint');
  if (!hint) return;
  var isCoarse = window.matchMedia('(pointer: coarse)').matches;
  if (isCoarse) {
    hint.innerHTML = '<span class="camera-hint-text"><b>1-Finger</b> Orbit · <b>2-Finger</b> Pan &amp; Zoom</span>';
  } else {
    hint.innerHTML = '<span class="camera-hint-text"><b>Drag</b> Orbit · <b>Shift + Drag</b> Pan · <b>Scroll</b> Zoom</span>';
  }
}
initCameraHint();
window.addEventListener('resize', function() {
  initCameraHint();
});

// Collapsible Scale Note Popover Handler
function initScaleNote() {
  var wrap = document.getElementById('scale-note-wrap') || document.getElementById('note');
  if (!wrap) return;
  var btn = wrap.querySelector('.scale-note-btn');
  var popover = wrap.querySelector('.scale-note-popover');
  if (!btn || !popover) return;

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var isOpen = popover.classList.toggle('open');
    btn.classList.toggle('active', isOpen);
    btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  document.addEventListener('click', function(e) {
    if (!wrap.contains(e.target)) {
      popover.classList.remove('open');
      btn.classList.remove('active');
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}
initScaleNote();

// Bootstrap
resize();
if (typeof initTheme === 'function') initTheme();
var sb = document.getElementById('state-badge');
if (sb) sb.classList.add('visible');
resetAll();

// Direct to SLIDERS mode with Controls tab active and workbench expanded
if (typeof setViewMode === 'function') setViewMode('layout');
if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('controls');
expandWorkbench();

requestAnimationFrame(function() {
  var loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
});

if (typeof animate === 'function') {
  animate();
}
