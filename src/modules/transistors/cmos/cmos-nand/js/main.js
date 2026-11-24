/**
 * main.js - CMOS NAND2 CAD Viewer
 * Drag-resizable Left Workbench controls, camera hint initialization,
 * and final bootstrap calls that start the application. Load this file LAST.
 */

var resizeAnimId = null;
function animateResizeTransition() {
  var start = performance.now();
  var duration = 280; // ms
  if (resizeAnimId) cancelAnimationFrame(resizeAnimId);
  function step(now) {
    if (typeof resize === 'function') resize();
    if (typeof drawTransferGraph === 'function') drawTransferGraph();
    if (now - start < duration) {
      resizeAnimId = requestAnimationFrame(step);
    } else {
      if (typeof resize === 'function') resize();
      if (typeof drawTransferGraph === 'function') drawTransferGraph();
      resizeAnimId = null;
    }
  }
  resizeAnimId = requestAnimationFrame(step);
}
window.animateResizeTransition = animateResizeTransition;

// =====================================================================
// DRAG-RESIZABLE LEFT WORKBENCH
// =====================================================================
var leftWorkbench = document.getElementById('left-workbench');
var workbenchToggleBtn = document.getElementById('workbench-toggle');
var wbResizeHandle = document.getElementById('wb-resize-handle');

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
  if (workbenchToggleBtn && leftWorkbench && !leftWorkbench.classList.contains('collapsed')) {
    workbenchToggleBtn.style.left = clamped + 'px';
  }
  if (typeof resize === 'function') resize();
  if (typeof drawTransferGraph === 'function') drawTransferGraph();
  return clamped;
}
window.setWorkbenchWidth = setWorkbenchWidth;

function initWorkbenchResize() {
  var handle = document.getElementById('wb-resize-handle');
  if (!handle || !leftWorkbench) return;

  var isDragging = false;
  var startX = 0;
  var startW = 0;

  handle.addEventListener('mousedown', function(e) {
    if (leftWorkbench.classList.contains('collapsed')) return;
    isDragging = true;
    startX = e.clientX;
    startW = leftWorkbench.getBoundingClientRect().width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    leftWorkbench.classList.add('resizing');
    e.preventDefault();
  });

  window.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var dx = e.clientX - startX;
    setWorkbenchWidth(startW + dx);
  });

  window.addEventListener('mouseup', function() {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    leftWorkbench.classList.remove('resizing');
    if (typeof resize === 'function') resize();
    if (typeof drawTransferGraph === 'function') drawTransferGraph();
  });

  handle.addEventListener('dblclick', function() {
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
    workbenchToggleBtn.classList.toggle('is-collapsed', willBeCollapsed);
    if (willBeCollapsed) {
      workbenchToggleBtn.style.left = '0px';
    } else {
      var curW = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--wb-width')) || getDefaultWbWidth();
      workbenchToggleBtn.style.left = curW + 'px';
    }
  }
  if (!willBeCollapsed) {
    var pop = document.getElementById('popover');
    if (pop) pop.classList.add('hidden');
    if (typeof selectedId !== 'undefined' && selectedId) {
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
    if (typeof drawTransferGraph === 'function') drawTransferGraph();
  });
}

window.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    toggleWorkbench();
  }
});

// Default initial state: Left Workbench is expanded on desktop, collapsed on mobile (<768px)
(function initWorkbench() {
  if (leftWorkbench) {
    var defaultW = getDefaultWbWidth();
    document.documentElement.style.setProperty('--wb-width', defaultW + 'px');
    if (window.innerWidth < 768) {
      leftWorkbench.classList.add('collapsed');
      if (workbenchToggleBtn) {
        workbenchToggleBtn.setAttribute('aria-expanded', 'false');
        workbenchToggleBtn.classList.add('is-collapsed');
        workbenchToggleBtn.style.left = '0px';
      }
    } else {
      leftWorkbench.classList.remove('collapsed');
      if (workbenchToggleBtn) {
        workbenchToggleBtn.setAttribute('aria-expanded', 'true');
        workbenchToggleBtn.classList.remove('is-collapsed');
        workbenchToggleBtn.style.left = defaultW + 'px';
      }
    }
  }
})();

// Camera Hint: fade out on interaction
function initCameraHint() {
  var hint = document.getElementById('camera-hint');
  if (!hint) return;
  var dismissed = false;
  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    hint.style.opacity = '0';
    setTimeout(function() { hint.style.display = 'none'; }, 400);
  }
  window.addEventListener('pointerdown', dismiss, { once: true });
}
initCameraHint();

function resetAll() {
  if (typeof isTourRunning !== 'undefined' && isTourRunning && typeof stopTour === 'function') {
    stopTour();
  }

  // Reset explode to Y=1% and others 0%
  var expY = document.getElementById('explode-y'); if (expY) expY.value = 1;
  var expX = document.getElementById('explode-x'); if (expX) expX.value = 0;
  var expZ = document.getElementById('explode-z'); if (expZ) expZ.value = 0;
  var vey = document.getElementById('val-explode-y'); if (vey) vey.textContent = '1%';
  var vex = document.getElementById('val-explode-x'); if (vex) vex.textContent = '0%';
  var vez = document.getElementById('val-explode-z'); if (vez) vez.textContent = '0%';
  if (typeof explodeX !== 'undefined') explodeX = 0;
  if (typeof explodeY !== 'undefined') explodeY = 1;
  if (typeof explodeZ !== 'undefined') explodeZ = 0;
  if (typeof applyExplode === 'function') applyExplode();

  for (var k in layerVisibility) {
    if (Object.prototype.hasOwnProperty.call(layerVisibility, k)) {
      layerVisibility[k] = true;
    }
  }
  showLabels3D = true;
  if (typeof syncVisibilityCheckboxes === 'function') {
    syncVisibilityCheckboxes();
  }

  if (typeof setFlowMode === 'function') {
    setFlowMode('current');
  }
  if (typeof setInputs === 'function') {
    setInputs('off', 'off');
  }
  if (typeof setViewMode === 'function') {
    setViewMode('layout');
  }
  if (typeof clearSelection === 'function') {
    clearSelection();
  }
  if (typeof switchWorkbenchTab === 'function') {
    switchWorkbenchTab('controls');
  }

  if (camera && TOP_VIEW_POS) camera.position.copy(TOP_VIEW_POS);
  if (controls && INITIAL_TARGET) {
    controls.target.copy(INITIAL_TARGET);
    controls.update();
  }
  if (typeof resize === 'function') resize();
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

function initMainUi() {
  var btnTheme = document.getElementById('btn-theme-toggle') || document.getElementById('btn-theme');
  if (btnTheme && typeof toggleTheme === 'function') {
    btnTheme.addEventListener('click', toggleTheme);
  }

  var btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', resetAll);
  }

  initScaleNote();

  var overlay = document.getElementById('loading') || document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.transition = 'opacity 0.25s ease';
    overlay.style.opacity = '0';
    setTimeout(function () {
      overlay.style.display = 'none';
    }, 260);
  }
}

initMainUi();
if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('controls');
