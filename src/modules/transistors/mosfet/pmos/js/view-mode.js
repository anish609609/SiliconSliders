/**
 * view-mode.js - PMOS CAD Viewer
 * View mode switching (3D Layout vs 2D Schematic), camera presets (Top, Front, Side, Iso),
 * and interactive 2D schematic SVG element bindings.
 */

var currentViewMode = 'layout'; // 'layout' | 'schematic'
var viewModeSeg = document.getElementById('view-mode-seg');
var schContainer = document.getElementById('schematic-container');
var canvasHost = document.getElementById('canvas-host');

function setViewMode(mode) {
  currentViewMode = mode;
  if (viewModeSeg) {
    viewModeSeg.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
  }

  if (mode === 'schematic') {
    if (schContainer) schContainer.style.display = 'flex';
    if (canvasHost) canvasHost.style.visibility = 'hidden';
  } else {
    if (schContainer) schContainer.style.display = 'none';
    if (canvasHost) canvasHost.style.visibility = 'visible';
    resize();
  }
}

if (viewModeSeg) {
  viewModeSeg.querySelectorAll('button').forEach(function(b) {
    b.addEventListener('click', function() {
      setViewMode(b.dataset.mode);
    });
  });
}

// Camera Presets
var btnPresetIso = document.getElementById('btn-preset-iso');
var btnPresetTop = document.getElementById('btn-preset-top');
var btnPresetFront = document.getElementById('btn-preset-front');
var btnPresetSide = document.getElementById('btn-preset-side');

if (btnPresetIso) {
  btnPresetIso.addEventListener('click', function() {
    activeCamera.position.set(18, 16, 22);
    controls.target.set(0, 0, 0);
    controls.update();
  });
}
if (btnPresetTop) {
  btnPresetTop.addEventListener('click', function() {
    activeCamera.position.set(0, 38, 0.01);
    controls.target.set(0, 0, 0);
    controls.update();
  });
}
if (btnPresetFront) {
  btnPresetFront.addEventListener('click', function() {
    activeCamera.position.set(0, 2, 32);
    controls.target.set(0, 0, 0);
    controls.update();
  });
}
if (btnPresetSide) {
  btnPresetSide.addEventListener('click', function() {
    activeCamera.position.set(32, 2, 0);
    controls.target.set(0, 0, 0);
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

// 2D Schematic SVG element click handlers
document.querySelectorAll('#schematic-svg .sch-el').forEach(function(el) {
  el.addEventListener('click', function(e) {
    e.stopPropagation();
    var id = el.dataset.id;
    if (id && typeof selectById === 'function') {
      selectById(id);
    }
  });
});
