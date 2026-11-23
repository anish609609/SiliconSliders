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
    if (now - start < duration) {
      resizeAnimId = requestAnimationFrame(step);
    } else {
      if (typeof resize === 'function') resize();
      resizeAnimId = null;
    }
  }
  resizeAnimId = requestAnimationFrame(step);
}
window.animateResizeTransition = animateResizeTransition;

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

  if (typeof applyExplode === 'function') applyExplode(0, 0, 0);
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

  // Sliders mode: workbench is expanded by default
  expandWorkbench();
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
