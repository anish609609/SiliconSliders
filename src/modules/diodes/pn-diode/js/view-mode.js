/**
 * view-mode.js - PN Junction Diode CAD Viewer
 * View mode switching (Theory vs 3D CAD Layout vs 2D Schematic),
 * responsive layout preservation, and interactive 2D schematic SVG element bindings.
 */

var currentViewMode = 'layout'; // 'theory' | 'layout' | 'schematic'
var modeSeg = document.getElementById('mode-seg');
var schematicOverlay = document.getElementById('schematic-overlay');
var theoryOverlay = document.getElementById('theory-overlay');
var canvasHost = document.getElementById('canvas-host');

function setViewMode(mode) {
  currentViewMode = mode;
  if (modeSeg) {
    modeSeg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', (b.dataset.mode === mode));
    });
  }

  var isTheory = (mode === 'theory');
  var isSchematic = (mode === 'schematic');
  var isLayout = (mode === 'layout');

  // Theory overlay
  if (theoryOverlay) {
    theoryOverlay.classList.toggle('visible', isTheory);
    theoryOverlay.style.display = isTheory ? 'block' : 'none';
  }

  // Schematic overlay
  if (schematicOverlay) {
    schematicOverlay.classList.toggle('visible', isSchematic);
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

  var topLeftHud = document.getElementById('top-left-hud');
  if (topLeftHud) topLeftHud.style.display = isLayout ? '' : 'none';

  var dockedPanel = document.getElementById('docked-panel');
  if (dockedPanel) dockedPanel.style.display = isLayout ? '' : 'none';

  var leftToggle = document.getElementById('left-toggle');
  if (leftToggle) leftToggle.style.display = isLayout ? '' : 'none';

  var rightToggle = document.getElementById('right-toggle');
  if (rightToggle) rightToggle.style.display = isLayout ? '' : 'none';

  var leftPanel = document.getElementById('left-panel');
  if (leftPanel) {
    if (isTheory) leftPanel.style.display = 'none';
    else if (isLayout) leftPanel.style.display = '';
  }

  var rightPanel = document.getElementById('right-panel');
  if (rightPanel) {
    if (isTheory) rightPanel.style.display = 'none';
    else if (isLayout) rightPanel.style.display = '';
  }

  var flowSegEl = document.getElementById('flow-seg');
  if (flowSegEl) flowSegEl.style.display = isLayout ? '' : 'none';

  var btnResetCam = document.getElementById('btn-reset-cam');
  if (btnResetCam) btnResetCam.style.display = isLayout ? '' : 'none';

  var vaLauncher = document.getElementById('va-launcher-btn');
  if (vaLauncher) vaLauncher.style.display = isTheory ? 'none' : '';

  if (isSchematic || isTheory) {
    if (typeof hidePopover === 'function') hidePopover();
    var pop = document.getElementById('popover');
    if (pop) pop.classList.add('hidden');
  } else {
    // Returning to 3D physical layout: cleanly resize WebGL viewport without distortion
    if (typeof resize === 'function') resize();
    window.dispatchEvent(new Event('resize'));
    if (typeof controls !== 'undefined' && controls && controls.update) {
      controls.update();
    }
    if (typeof renderGraphs === 'function') {
      renderGraphs();
    }
  }
}

function initViewMode() {
  if (modeSeg) {
    modeSeg.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mode = btn.dataset.mode;
        setViewMode(mode);
      });
    });
  }

  // Interactive 2D schematic element clicking to highlight in 3D
  var schElements = document.querySelectorAll('.sch-el');
  schElements.forEach(function (el) {
    el.addEventListener('click', function () {
      var id = el.dataset.id;
      if (id && typeof selectComponentById === 'function') {
        selectComponentById(id);
      }
    });
  });
}
