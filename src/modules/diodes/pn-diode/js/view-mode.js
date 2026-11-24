/**
 * view-mode.js - PN Junction Diode CAD Viewer
 * View mode switching (Theory vs Layout vs Schematic),
 * Dual-View subview switching (3D IC VIEW vs 2D JUNCTION),
 * responsive layout preservation, and interactive element bindings.
 */

var currentViewMode = 'layout'; // 'theory' | 'layout' | 'schematic'
var currentSubView = '3d';      // '3d' | '2d'

var modeSeg = document.getElementById('mode-seg');
var viewToggleSeg = document.getElementById('view-toggle-seg');
var schematicOverlay = document.getElementById('schematic-overlay');
var theoryOverlay = document.getElementById('theory-overlay');
var junction2dOverlay = document.getElementById('junction-2d-overlay');
var canvasHost = document.getElementById('canvas-host');

function setSubView(subview) {
  currentSubView = subview;

  // If currently in Theory or Schematic, return to Layout mode
  if (currentViewMode !== 'layout') {
    setViewMode('layout');
  }

  // Update button states in view-toggle-seg
  if (viewToggleSeg) {
    viewToggleSeg.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', (b.dataset.subview === subview));
    });
  }

  var is3D = (subview === '3d');
  var is2D = (subview === '2d');

  // Stop 3D tour if leaving 3D
  if (!is3D && typeof stopBuildAnimation === 'function') {
    stopBuildAnimation(true);
  }

  // 3D Canvas Host
  if (canvasHost) {
    canvasHost.style.visibility = is3D ? 'visible' : 'hidden';
    canvasHost.style.display = is3D ? 'block' : 'none';
  }

  // 2D Junction Overlay
  if (junction2dOverlay) {
    junction2dOverlay.classList.toggle('visible', is2D);
    junction2dOverlay.style.display = is2D ? 'flex' : 'none';
  }

  // 3D-only HUD elements
  var axisInd = document.getElementById('axis-indicator');
  if (axisInd) axisInd.style.display = is3D ? '' : 'none';

  var topLeftHud = document.getElementById('top-left-hud');
  if (topLeftHud) topLeftHud.style.display = is3D ? '' : 'none';

  var btnTour = document.getElementById('btn-build-anim');
  if (btnTour) btnTour.style.display = is3D ? '' : 'none';

  if (is2D) {
    if (window.View2DJunction) {
      window.View2DJunction.resize();
      window.View2DJunction.start();
    }
  } else {
    if (window.View2DJunction) {
      window.View2DJunction.stop();
    }
    if (typeof resize === 'function') resize();
    window.dispatchEvent(new Event('resize'));
    if (typeof controls !== 'undefined' && controls && controls.update) {
      controls.update();
    }
  }

  if (typeof renderGraphs === 'function') {
    renderGraphs();
  }
}
window.setSubView = setSubView;

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

  // If tour is playing and leaving layout, stop it cleanly
  if (!isLayout && typeof stopBuildAnimation === 'function') {
    stopBuildAnimation(true);
  }

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

  // Dual-view subview handling for layout mode
  if (isLayout) {
    setSubView(currentSubView);
  } else {
    if (canvasHost) {
      canvasHost.style.visibility = 'hidden';
      canvasHost.style.display = 'none';
    }
    if (junction2dOverlay) {
      junction2dOverlay.classList.remove('visible');
      junction2dOverlay.style.display = 'none';
    }
    if (window.View2DJunction) {
      window.View2DJunction.stop();
    }
  }

  // Topbar subview toggle visibility
  if (viewToggleSeg) {
    viewToggleSeg.style.display = isLayout ? '' : 'none';
  }

  // 3D HUD & Controls Visibility
  var flowCap = document.getElementById('flow-caption');
  if (flowCap) flowCap.style.display = isLayout ? '' : 'none';

  var noteEl = document.getElementById('note') || document.getElementById('scale-note-wrap');
  if (noteEl) noteEl.style.display = (isLayout && currentSubView === '3d') ? '' : 'none';

  var leftWorkbench = document.getElementById('left-workbench');
  if (leftWorkbench) leftWorkbench.style.display = isTheory ? 'none' : '';

  var wbToggle = document.getElementById('workbench-toggle') || document.getElementById('left-toggle');
  if (wbToggle) wbToggle.style.display = isTheory ? 'none' : '';

  if (isLayout && typeof expandWorkbench === 'function') {
    expandWorkbench();
  }

  var flowSegEl = document.getElementById('flow-seg');
  if (flowSegEl) flowSegEl.style.display = (isLayout || isSchematic) ? '' : 'none';

  var btnResetCam = document.getElementById('btn-reset-cam');
  if (btnResetCam) btnResetCam.style.display = isLayout ? '' : 'none';

  var vaLauncher = document.getElementById('va-launcher-btn');
  if (vaLauncher) vaLauncher.style.display = isTheory ? 'none' : '';

  if (isSchematic || isTheory) {
    if (typeof hidePopover === 'function') hidePopover();
    var pop = document.getElementById('popover');
    if (pop) pop.classList.add('hidden');
  } else if (isLayout && currentSubView === '3d') {
    if (typeof resize === 'function') resize();
    window.dispatchEvent(new Event('resize'));
    if (typeof controls !== 'undefined' && controls && controls.update) {
      controls.update();
    }
  }

  if (typeof renderGraphs === 'function') {
    renderGraphs();
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

  if (viewToggleSeg) {
    viewToggleSeg.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var sub = btn.dataset.subview;
        if (sub) setSubView(sub);
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
