/**
 * main.js - PN Junction Diode CAD Viewer
 * Left Workbench collapse/expand toggles, drag resize, 1-line camera hint,
 * reset-to-default routine, and bootstrap entry point.
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
    if (typeof renderGraphs === 'function') renderGraphs();
    if (now - start < duration) {
      resizeAnimId = requestAnimationFrame(step);
    } else {
      if (typeof resize === 'function') resize();
      if (typeof renderGraphs === 'function') renderGraphs();
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
  if (typeof renderGraphs === 'function') renderGraphs();
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
    if (typeof renderGraphs === 'function') renderGraphs();
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

function toggleWorkbench(forceExpanded) {
  if (!leftWorkbench) return;
  var willBeCollapsed = (typeof forceExpanded === 'boolean') ? !forceExpanded : !leftWorkbench.classList.contains('collapsed');
  leftWorkbench.classList.toggle('collapsed', willBeCollapsed);
  if (workbenchToggleBtn) {
    workbenchToggleBtn.setAttribute('aria-expanded', willBeCollapsed ? 'false' : 'true');
  }
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

// =====================================================================
// 1-LINE CAMERA CONTROLS HINT
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

function resetAll() {
  if (typeof stopBuildAnimation === 'function') stopBuildAnimation(true);
  var tourBanner = document.getElementById('tour-banner');
  if (tourBanner) tourBanner.style.display = 'none';

  if (typeof activeCamera !== 'undefined' && typeof controls !== 'undefined') {
    activeCamera.position.copy(INITIAL_POS);
    controls.target.copy(INITIAL_TARGET);
    controls.update();
  }

  // Reset sliders and presets
  var vaSlider = document.getElementById('va-slider');
  if (vaSlider) { vaSlider.value = 0.00; vaSlider.dispatchEvent(new Event('input')); }
  var naSlider = document.getElementById('na-slider');
  if (naSlider) { naSlider.value = 17.0; naSlider.dispatchEvent(new Event('input')); }
  var ndSlider = document.getElementById('nd-slider');
  if (ndSlider) { ndSlider.value = 16.0; ndSlider.dispatchEvent(new Event('input')); }
  var tempSlider = document.getElementById('temp-slider');
  if (tempSlider) { tempSlider.value = 300; tempSlider.dispatchEvent(new Event('input')); }

  if (typeof window.resetExplodeAndScrub === 'function') {
    window.resetExplodeAndScrub();
  } else {
    var expY = document.getElementById('explode-y-slider');
    if (expY) { expY.value = 0; expY.dispatchEvent(new Event('input')); }
    var expX = document.getElementById('explode-x-slider');
    if (expX) { expX.value = 0; expX.dispatchEvent(new Event('input')); }
    var expZ = document.getElementById('explode-z-slider');
    if (expZ) { expZ.value = 0; expZ.dispatchEvent(new Event('input')); }
  }

  if (typeof clearSelection === 'function') clearSelection();
  if (typeof hidePopover === 'function') hidePopover();

  // Reset flow mode to default Carrier
  if (typeof flowMode !== 'undefined') flowMode = 'carrier';
  var flowSeg = document.getElementById('flow-seg');
  if (flowSeg) {
    flowSeg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.flow === 'carrier');
    });
  }
  if (typeof rebuildFlowSimulation === 'function') rebuildFlowSimulation();

  // Reset workbench tab to Controls (default)
  if (typeof switchWorkbenchTab === 'function') {
    switchWorkbenchTab('controls');
  }

  expandWorkbench();
  setWorkbenchWidth(getDefaultWbWidth());
}

window.addEventListener('DOMContentLoaded', function () {
  try {
    initTheme();
    buildDiodeGeometry();
    initUIPanels();
    initDimensions();
    initSelection();
    initExplodeAndScrub();
    initViewMode();
    initFlowControls();
    initGraphs();
    initLogicControls();
    initScaleNote();
    initCameraHint();
    initWorkbenchResize();

    if (window.View2DJunction) {
      window.View2DJunction.init();
    }

    window.addEventListener('resize', function () {
      initCameraHint();
      if (window.View2DJunction) window.View2DJunction.resize();
    });

    // Initial sizing and workbench setup
    expandWorkbench();
    setWorkbenchWidth(getDefaultWbWidth());
    resize();
    if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('controls');

    // Reset button binding
    var btnReset = document.getElementById('btn-reset-cam');
    if (btnReset) {
      btnReset.addEventListener('click', resetAll);
    }

    animate();

    var loading = document.getElementById('loading');
    if (loading) {
      setTimeout(function () {
        loading.classList.add('fade-out');
        setTimeout(function () {
          loading.style.display = 'none';
        }, 350);
      }, 300);
    }
  } catch (err) {
    console.error('Initialization error in PN Diode viewer:', err);
  }
});
