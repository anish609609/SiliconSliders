/**
 * view-mode.js - MOSFET CAD Viewer
 * View mode switching (Theory vs 3D Layout vs 2D Schematic),
 * camera presets, and interactive 2D schematic SVG element bindings.
 */

var currentViewMode = 'layout'; // 'theory' | 'layout' | 'schematic'
var modeSeg = document.getElementById('mode-seg') || document.getElementById('view-mode-seg');
var schematicOverlay = document.getElementById('schematic-overlay') || document.getElementById('schematic-container');
var theoryOverlay = document.getElementById('theory-overlay');
var canvasHost = document.getElementById('canvas-host');

function setViewMode(mode) {
  currentViewMode = mode;
  if (modeSeg) {
    modeSeg.querySelectorAll('button, .seg-btn').forEach(function(b) {
      b.classList.toggle('active', (b.dataset.mode === mode || b.dataset.view === mode));
    });
  }

  var isTheory = (mode === 'theory');
  var isSchematic = (mode === 'schematic');
  var isLayout = (mode === 'layout');

  // Theory overlay visibility
  if (theoryOverlay) {
    theoryOverlay.classList.toggle('visible', isTheory);
    theoryOverlay.style.display = isTheory ? 'block' : 'none';
  }

  // Schematic overlay visibility
  if (schematicOverlay) {
    schematicOverlay.classList.toggle('visible', isSchematic);
    schematicOverlay.classList.toggle('hidden', !isSchematic);
    schematicOverlay.style.display = isSchematic ? 'flex' : 'none';
  }

  // 3D Canvas Host
  if (canvasHost) {
    canvasHost.style.visibility = isLayout ? 'visible' : 'hidden';
    canvasHost.style.display = isLayout ? 'block' : 'none';
  }

  // 3D HUD & Controls Visibility
  var flowCap = document.getElementById('flow-caption');
  if (flowCap) flowCap.style.display = isLayout ? '' : 'none';

  var axisInd = document.getElementById('axis-indicator');
  if (axisInd) axisInd.style.display = isLayout ? '' : 'none';

  var noteEl = document.getElementById('note') || document.getElementById('scale-note-wrap');
  if (noteEl) noteEl.style.display = isLayout ? '' : 'none';

  var topLeftHud = document.getElementById('top-left-hud') || document.querySelector('.hud-top-left-stack');
  if (topLeftHud) topLeftHud.style.display = isLayout ? '' : 'none';

  var leftWorkbench = document.getElementById('left-workbench');
  if (leftWorkbench) leftWorkbench.style.display = isTheory ? 'none' : '';

  var wbToggle = document.getElementById('workbench-toggle') || document.getElementById('left-toggle');
  if (wbToggle) wbToggle.style.display = isTheory ? 'none' : '';

  if (isLayout && typeof expandWorkbench === 'function') {
    expandWorkbench();
  }

  var btnBuildAnim = document.getElementById('btn-build-anim');
  if (btnBuildAnim) btnBuildAnim.style.display = isLayout ? '' : 'none';

  var btnResetCam = document.getElementById('btn-reset-cam') || document.getElementById('btn-reset');
  if (btnResetCam) btnResetCam.style.display = isLayout ? '' : 'none';

  var flowSeg = document.getElementById('flow-seg') || document.getElementById('flow-mode-group');
  if (flowSeg) flowSeg.style.display = isLayout ? '' : 'none';

  var vaLauncher = document.getElementById('va-launcher-btn');
  if (vaLauncher) vaLauncher.style.display = isTheory ? 'none' : '';

  if (isSchematic || isTheory) {
    if (typeof hidePopover === 'function') hidePopover();
    var pop = document.getElementById('popover');
    if (pop) pop.classList.add('hidden');
  } else {
    // Returning to physical layout: restore canvas and camera without distortion
    if (typeof resize === 'function') resize();
    window.dispatchEvent(new Event('resize'));
    if (typeof controls !== 'undefined' && controls && controls.update) {
      controls.update();
    }
  }
}

if (modeSeg) {
  modeSeg.addEventListener('click', function(e) {
    var btn = e.target.closest('button, .seg-btn');
    if (!btn) return;
    var mode = btn.dataset.mode || btn.dataset.view;
    if (mode) setViewMode(mode);
  });
}

// Reset button wiring
var btnResetCam = document.getElementById('btn-reset-cam') || document.getElementById('btn-reset');
if (btnResetCam) {
  btnResetCam.addEventListener('click', function() {
    if (typeof resetAll === 'function') resetAll();
  });
}

// Camera Presets
var btnPresetIso = document.getElementById('btn-preset-iso');
var btnPresetTop = document.getElementById('btn-preset-top');
var btnPresetFront = document.getElementById('btn-preset-front');
var btnPresetSide = document.getElementById('btn-preset-side');

if (btnPresetIso) {
  btnPresetIso.addEventListener('click', function() {
    if (typeof activeCamera !== 'undefined' && activeCamera) {
      activeCamera.position.set(16, 17, 20);
      controls.target.set(-0.5, 3.2, 0);
      controls.update();
    }
  });
}
if (btnPresetTop) {
  btnPresetTop.addEventListener('click', function() {
    if (typeof activeCamera !== 'undefined' && activeCamera) {
      activeCamera.position.set(-0.5, 42, 0.01);
      controls.target.set(-0.5, 3.2, 0);
      controls.update();
    }
  });
}
if (btnPresetFront) {
  btnPresetFront.addEventListener('click', function() {
    if (typeof activeCamera !== 'undefined' && activeCamera) {
      activeCamera.position.set(-0.5, 5.2, 30);
      controls.target.set(-0.5, 3.2, 0);
      controls.update();
    }
  });
}
if (btnPresetSide) {
  btnPresetSide.addEventListener('click', function() {
    if (typeof activeCamera !== 'undefined' && activeCamera) {
      activeCamera.position.set(30, 5.2, 0);
      controls.target.set(-0.5, 3.2, 0);
      controls.update();
    }
  });
}

// Label & Bulk Carrier toggle checkboxes
var toggleLabelsChk = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
if (toggleLabelsChk) {
  toggleLabelsChk.addEventListener('change', function(e) {
    if (typeof window.toggleLabels === 'function') {
      window.toggleLabels(e.target.checked);
    }
  });
  if (typeof window.toggleLabels === 'function') {
    window.toggleLabels(toggleLabelsChk.checked);
  }
}

var toggleHolesChk = document.getElementById('toggle-holes');
if (toggleHolesChk) {
  toggleHolesChk.addEventListener('change', function(e) {
    if (typeof window.toggleSubstrateHoles === 'function') {
      window.toggleSubstrateHoles(e.target.checked);
    }
  });
  if (typeof window.toggleSubstrateHoles === 'function') {
    window.toggleSubstrateHoles(toggleHolesChk.checked);
  }
}

// 2D Schematic SVG element click handlers: jumps to 3D and highlights component
if (schematicOverlay) {
  schematicOverlay.querySelectorAll('[data-id]').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = el.dataset.id;
      setViewMode('layout');
      if (id && typeof selectById === 'function') {
        selectById(id);
      }
    });
  });
}

// Smooth scrolling for quick jump anchors inside theory view
if (theoryOverlay) {
  theoryOverlay.querySelectorAll('a[href^="#"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      e.preventDefault();
      var targetId = a.getAttribute('href').slice(1);
      var targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}
