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
  if (typeof geomL !== 'undefined') geomL = 28;
  if (typeof geomW !== 'undefined') geomW = 120;
  if (typeof geomTox !== 'undefined') geomTox = 2.0;
  if (typeof lockYAxis !== 'undefined' && lockYAxis && typeof toggleLockYAxis === 'function') {
    toggleLockYAxis();
  }
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

  // Reset 3D Floating Labels & Substrate Holes toggles
  var toggleLabelsChk = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
  if (toggleLabelsChk) toggleLabelsChk.checked = true;
  if (typeof window.toggleLabels === 'function') window.toggleLabels(true);

  var toggleHolesChk = document.getElementById('toggle-holes');
  if (toggleHolesChk) toggleHolesChk.checked = true;
  if (typeof window.toggleSubstrateHoles === 'function') window.toggleSubstrateHoles(true);

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

// =====================================================================
// E-NMOS GUIDED TOUR CONFIGURATION (Includes Device Geometry Step)
// =====================================================================
window.SILICON_TOUR_CONFIG = {
  storageKey: 'siliconsliders_cad_tour_seen',
  readySelector: '#wb-physics-section',
  steps: [
    {
      id: 'theory',
      title: '1. Start with Device Theory',
      description: 'Open THEORY anytime to review MOSFET band bending, short-channel effects (VTH roll-off, DIBL, velocity saturation), and governing equations.',
      selectors: ['#mode-seg button[data-mode="theory"]', '#btn-view-theory'],
      pulseSelector: '#mode-seg button[data-mode="theory"]',
      beforeEnter: function () {
        var b = document.querySelector('#mode-seg button[data-mode="theory"]');
        if (b && !b.classList.contains('active')) b.click();
        else if (typeof setViewMode === 'function') setViewMode('theory');
      }
    },
    {
      id: 'bias-sliders',
      title: '2. Bias Sliders & Live I-V Curve',
      description: 'Drag VGS and VDS sliders—or scrub directly on the IDS–VDS curve—to observe Cutoff, Linear, and Saturation pinch-off in real time. Toggle Lock Y-Axis to compare current scaling.',
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
      title: '3. Device Geometry & Scaling',
      description: 'Scale Channel Length (L: 20–200 nm), Width (W: 40–400 nm), and Gate Oxide (tox: 1.2–10.0 nm)—or compare presets like 28nm Short-Ch vs 180nm Long-Ch—to explore DIBL, VTH roll-off, velocity saturation, and live 3D deformation.',
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
      title: '4. Explode Stack & Section Scrub',
      description: 'Peel apart the 3D fabrication stack along X/Y/Z with Explode Layers, or slice open internal junctions using Section Scrub.',
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
      description: 'Use the Layers tab to turn individual substrate, oxide, gate, contact, or metal layers on and off to reveal buried structures.',
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
      description: 'Switch to Inspect to view live bias & geometry state, doping concentrations, materials, and the full Architecture Tree of every 3D component.',
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
      description: 'Switch to SCHEMATIC anytime to compare the 3D physical silicon layout with its circuit-level symbol and live node voltages.',
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
