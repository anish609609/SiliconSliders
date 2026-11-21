/**
 * view-mode.js - NMOS CAD Viewer
 * View mode switching (3D Layout vs 2D Schematic), camera presets,
 * and interactive 2D schematic SVG element bindings.
 */

var currentViewMode = 'layout'; // 'layout' | 'schematic'
var modeSeg = document.getElementById('mode-seg') || document.getElementById('view-mode-seg');
var schematicOverlay = document.getElementById('schematic-overlay') || document.getElementById('schematic-container');
var canvasHost = document.getElementById('canvas-host');

function setViewMode(mode) {
  currentViewMode = mode;
  if (modeSeg) {
    modeSeg.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  if (schematicOverlay) {
    schematicOverlay.classList.toggle('visible', mode === 'schematic');
    schematicOverlay.style.display = mode === 'schematic' ? 'flex' : 'none';
  }

  if (canvasHost) {
    canvasHost.style.visibility = mode === 'schematic' ? 'hidden' : 'visible';
  }

  var flowCap = document.getElementById('flow-caption');
  if (flowCap) {
    flowCap.style.display = mode === 'schematic' ? 'none' : '';
  }
  var axisInd = document.getElementById('axis-indicator');
  if (axisInd) {
    axisInd.style.display = mode === 'schematic' ? 'none' : '';
  }
  var noteEl = document.getElementById('note');
  if (noteEl) {
    noteEl.style.display = mode === 'schematic' ? 'none' : '';
  }

  if (mode === 'schematic') {
    if (typeof hidePopover === 'function') hidePopover();
  } else {
    if (typeof resize === 'function') resize();
  }
}

if (modeSeg) {
  modeSeg.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn || !btn.dataset.mode) return;
    setViewMode(btn.dataset.mode);
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
    activeCamera.position.set(16, 17, 20);
    controls.target.set(-0.5, 3.2, 0);
    controls.update();
  });
}
if (btnPresetTop) {
  btnPresetTop.addEventListener('click', function() {
    activeCamera.position.set(-0.5, 42, 0.01);
    controls.target.set(-0.5, 3.2, 0);
    controls.update();
  });
}
if (btnPresetFront) {
  btnPresetFront.addEventListener('click', function() {
    activeCamera.position.set(-0.5, 5.2, 30);
    controls.target.set(-0.5, 3.2, 0);
    controls.update();
  });
}
if (btnPresetSide) {
  btnPresetSide.addEventListener('click', function() {
    activeCamera.position.set(30, 5.2, 0);
    controls.target.set(-0.5, 3.2, 0);
    controls.update();
  });
}

// Label toggle checkbox
var toggleLabelsChk = document.getElementById('toggle-labels');
if (toggleLabelsChk) {
  toggleLabelsChk.addEventListener('change', function(e) {
    if (typeof toggleLabels === 'function') {
      toggleLabels(e.target.checked);
    }
  });
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
