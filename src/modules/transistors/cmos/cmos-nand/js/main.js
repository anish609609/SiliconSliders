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
  if (typeof stopBuildAnimation === 'function') {
    stopBuildAnimation(true);
  } else if (typeof isTourRunning !== 'undefined' && isTourRunning && typeof stopTour === 'function') {
    stopTour();
  }

  // Reset explode to Y=18% and others 0%
  var expY = document.getElementById('explode-y'); if (expY) expY.value = 18;
  var expX = document.getElementById('explode-x'); if (expX) expX.value = 0;
  var expZ = document.getElementById('explode-z'); if (expZ) expZ.value = 0;
  var vey = document.getElementById('val-explode-y'); if (vey) vey.textContent = '18%';
  var vex = document.getElementById('val-explode-x'); if (vex) vex.textContent = '0%';
  var vez = document.getElementById('val-explode-z'); if (vez) vez.textContent = '0%';
  if (typeof explodeX !== 'undefined') explodeX = 0;
  if (typeof explodeY !== 'undefined') explodeY = 18;
  if (typeof explodeZ !== 'undefined') explodeZ = 0;
  if (typeof applyExplode === 'function') applyExplode();

  for (var k in layerVisibility) {
    if (Object.prototype.hasOwnProperty.call(layerVisibility, k)) {
      layerVisibility[k] = true;
    }
  }
  showLabels3D = true;
  var toggleLabelsChk = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
  if (toggleLabelsChk) toggleLabelsChk.checked = true;
  if (typeof window.toggleLabels === 'function') {
    window.toggleLabels(true);
  }

  // Reset Bulk Carriers toggle OFF (clean default landing view)
  var toggleHolesChk = document.getElementById('toggle-holes');
  if (toggleHolesChk) toggleHolesChk.checked = false;
  if (typeof window.toggleSubstrateHoles === 'function') {
    window.toggleSubstrateHoles(false);
  }

  if (typeof syncVisibilityCheckboxes === 'function') {
    syncVisibilityCheckboxes();
  }

  // Reset Device Geometry to Balanced (2:2) preset (Wp=240, Wn=240, L=28)
  if (typeof window.setNandGeometryPreset === 'function') {
    window.setNandGeometryPreset('balanced');
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

  if (camera && INITIAL_POS) camera.position.copy(INITIAL_POS);
  if (controls && INITIAL_TARGET) {
    controls.target.copy(INITIAL_TARGET);
    controls.update();
  }
  if (typeof resize === 'function') resize();
  if (typeof drawTransferGraph === 'function') drawTransferGraph();
}

// =====================================================================
// CMOS NAND2 GUIDED TOUR CONFIGURATION (Includes Geometry & Series Scaling)
// =====================================================================
window.SILICON_TOUR_CONFIG = {
  storageKey: 'siliconsliders_cad_tour_seen',
  readySelector: '#wb-physics-section',
  steps: [
    {
      id: 'theory',
      title: '1. Start with CMOS NAND2 Theory',
      description: 'Open THEORY anytime to review parallel PMOS pull-up, series NMOS pull-down stacking, body effect, charge sharing, and β-ratio sizing.',
      selectors: ['#mode-seg button[data-mode="theory"]', '#btn-view-theory'],
      pulseSelector: '#mode-seg button[data-mode="theory"]',
      beforeEnter: function () {
        var b = document.querySelector('#mode-seg button[data-mode="theory"]');
        if (b && !b.classList.contains('active')) b.click();
        else if (typeof setViewMode === 'function') setViewMode('theory');
      }
    },
    {
      id: 'logic-vtc',
      title: '2. Dual Input Bias & Transfer Curve',
      description: 'Sweep VA, VB, or BOTH (VA = VB) — or scrub directly on the VTC graph — to observe parallel pull-up vs series pull-down switching and internal node Vx.',
      targets: [
        ['#left-workbench .wb-header', '.wb-tabs'],
        ['#wb-physics-section', '#wb-pane-controls .wb-bias-controls']
      ],
      pulseSelector: '#wb-tab-controls',
      beforeEnter: function () {
        if (typeof setViewMode === 'function') setViewMode('layout');
        if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('controls');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      },
      onEnter: function (api) {
        if (api && api.animateExplodeY) api.animateExplodeY(14, 520);
        if (api && api.animateCameraTo && typeof TOUR_CLOSEUP_POS !== 'undefined' && typeof TOUR_CLOSEUP_TARGET !== 'undefined') {
          api.animateCameraTo(TOUR_CLOSEUP_POS, TOUR_CLOSEUP_TARGET, 720);
        }
      }
    },
    {
      id: 'device-geometry',
      title: '3. Series/Parallel Geometry & β-Ratio Sizing',
      description: 'Scale PMOS Width (Wp), Series NMOS Width (Wn), and Shared Length (L: 20–200 nm) — or compare Balanced (2:2), Min Area (1:1), and Strong Pull-Down — to shift VM live and deform the 4-FET NAND2 silicon cell.',
      selectors: ['#wb-geometry-section'],
      pulseSelector: '#wb-geometry-section .wb-accordion-head',
      beforeEnter: function () {
        if (typeof setViewMode === 'function') setViewMode('layout');
        if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('controls');
        var geomBody = document.getElementById('device-geometry-body');
        if (geomBody && geomBody.classList.contains('hidden')) {
          var head = document.querySelector('#wb-geometry-section .wb-accordion-head');
          if (head) head.click();
          else geomBody.classList.remove('hidden');
        }
        var sec = document.getElementById('wb-geometry-section');
        if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      },
      onEnter: function (api) {
        if (api && api.animateExplodeY) api.animateExplodeY(18, 520);
        if (api && api.animateCameraTo && typeof INITIAL_POS !== 'undefined' && typeof INITIAL_TARGET !== 'undefined') {
          api.animateCameraTo(INITIAL_POS, INITIAL_TARGET, 680);
        }
      }
    },
    {
      id: 'view-controls',
      title: '4. Explode Stack, Carriers & Section Scrub',
      description: 'Peel Metal-1, Dual Poly Gates A/B, and Active diffusions along X/Y/Z, toggle Show Bulk Carriers, or slice junctions using Section Scrub.',
      selectors: ['#wb-view-controls-section', '#view-controls-body'],
      beforeEnter: function () {
        if (typeof setViewMode === 'function') setViewMode('layout');
        if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('controls');
        var bodyEl = document.getElementById('view-controls-body');
        if (bodyEl && bodyEl.classList.contains('hidden')) {
          var head = document.querySelector('#wb-view-controls-section .wb-accordion-head');
          if (head) head.click();
          else bodyEl.classList.remove('hidden');
        }
        var sec = document.getElementById('wb-view-controls-section');
        if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      },
      onEnter: function (api) {
        if (api && api.animateExplodeY) api.animateExplodeY(38, 600);
        if (api && api.returnToHeroCamera) api.returnToHeroCamera();
      }
    },
    {
      id: 'layers',
      title: '5. Toggle & Isolate 3D Layers',
      description: 'Use the Layers tab to isolate N-Well, P-Well, SDE, High-κ/SiO2 dielectrics, NiSi salicide, tungsten vias, or Metal-1 interconnects.',
      targets: [
        ['#left-workbench .wb-header', '.wb-tabs'],
        ['#layers-body', '#wb-pane-layers']
      ],
      pulseSelector: '#wb-tab-layers',
      beforeEnter: function () {
        if (typeof setViewMode === 'function') setViewMode('layout');
        if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('layers');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      },
      onEnter: function (api) {
        if (api && api.returnToHeroCamera) api.returnToHeroCamera();
      }
    },
    {
      id: 'inspect',
      title: '6. Inspect Materials & Structure',
      description: 'Switch to Inspect to review physical roles of MP1, MP2, MN1, MN2, the series N+ bridge, and the Architecture Tree.',
      targets: [
        ['#left-workbench .wb-header', '.wb-tabs'],
        ['#wb-pane-inspect', '#inspector-body']
      ],
      pulseSelector: '#wb-tab-inspect',
      beforeEnter: function () {
        if (typeof setViewMode === 'function') setViewMode('layout');
        if (typeof switchWorkbenchTab === 'function') switchWorkbenchTab('inspect');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      },
      onEnter: function (api) {
        if (api && api.returnToHeroCamera) api.returnToHeroCamera();
      }
    },
    {
      id: 'schematic',
      title: '7. Circuit Schematic View',
      description: 'Switch to SCHEMATIC anytime to compare the 3D 4-transistor silicon layout against its schematic symbol and live node states.',
      selectors: ['#mode-seg button[data-mode="schematic"]', '#btn-view-schematic'],
      pulseSelector: '#mode-seg button[data-mode="schematic"]',
      beforeEnter: function () {
        var b = document.querySelector('#mode-seg button[data-mode="schematic"]');
        if (b && !b.classList.contains('active')) b.click();
        else if (typeof setViewMode === 'function') setViewMode('schematic');
      }
    }
  ]
};

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

  var btnReset = document.getElementById('btn-reset') || document.getElementById('btn-reset-cam');
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
