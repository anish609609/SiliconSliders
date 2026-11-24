/**
 * view-mode.js
 * Physical-layout <-> Schematic <-> Theory toggle (including the clickable schematic SVG -> 3D id mapping) and the camera Reset button wiring.
 */

var currentViewMode = 'layout';
var modeSeg = document.getElementById('mode-seg');
var schematicOverlay = document.getElementById('schematic-overlay');
var theoryOverlay = document.getElementById('theory-overlay');
var canvasHost = document.getElementById('canvas-host');

function setViewMode(mode){
  currentViewMode = mode;
  if (modeSeg) {
    modeSeg.querySelectorAll('button, .seg-btn').forEach(function(b){
      b.classList.toggle('active', (b.dataset.mode === mode || b.dataset.view === mode));
    });
  }

  var isTheory = (mode === 'theory');
  var isSchematic = (mode === 'schematic');
  var isLayout = (mode === 'layout');

  if (theoryOverlay) {
    theoryOverlay.classList.toggle('visible', isTheory);
    theoryOverlay.style.display = isTheory ? 'block' : 'none';
  }

  if (schematicOverlay) {
    schematicOverlay.classList.toggle('visible', isSchematic);
    schematicOverlay.classList.toggle('hidden', !isSchematic);
    schematicOverlay.style.display = isSchematic ? 'flex' : 'none';
  }

  if (canvasHost) {
    canvasHost.style.visibility = isLayout ? 'visible' : 'hidden';
    canvasHost.style.display = isLayout ? 'block' : 'none';
  }

  // Hide 3D floating HUDs on Theory
  var inToggles = document.querySelectorAll('.in-toggle');
  inToggles.forEach(function(el){ el.style.display = isTheory ? 'none' : ''; });

  var flowSeg = document.getElementById('flow-seg') || document.getElementById('flow-mode-group');
  if (flowSeg) flowSeg.style.display = isLayout ? '' : 'none';

  var btnBuildAnim = document.getElementById('btn-build-anim');
  if (btnBuildAnim) btnBuildAnim.style.display = isLayout ? '' : 'none';

  var btnResetCam = document.getElementById('btn-reset-cam');
  if (btnResetCam) btnResetCam.style.display = isLayout ? '' : 'none';

  var leftWorkbench = document.getElementById('left-workbench');
  if (leftWorkbench) leftWorkbench.style.display = isTheory ? 'none' : '';

  var wbToggle = document.getElementById('workbench-toggle') || document.getElementById('left-toggle');
  if (wbToggle) wbToggle.style.display = isTheory ? 'none' : '';

  if (isLayout && typeof expandWorkbench === 'function') {
    expandWorkbench();
  }

  var noteEl = document.getElementById('note') || document.getElementById('scale-note-wrap');
  if (noteEl) noteEl.style.display = isLayout ? '' : 'none';

  var vaLauncher = document.getElementById('va-launcher-btn');
  if (vaLauncher) vaLauncher.style.display = isTheory ? 'none' : '';

  if (isSchematic || isTheory) {
    if (typeof hidePopover === 'function') hidePopover();
    var pop = document.getElementById('popover');
    if (pop) pop.classList.add('hidden');
  } else {
    if (typeof resize === 'function') resize();
    window.dispatchEvent(new Event('resize'));
    if (typeof controls !== 'undefined' && controls && controls.update) controls.update();
  }
}

if (modeSeg) {
  modeSeg.addEventListener('click', function(e){
    var btn = e.target.closest('button, .seg-btn');
    if (!btn) return;
    var mode = btn.dataset.mode || btn.dataset.view;
    if (mode) setViewMode(mode);
  });
}

// Schematic components map onto the SAME ids used by the 3D model and the
// architecture tree. Clicking a terminal, gate or net in the schematic jumps
// back to the physical layout with that element highlighted.
if (schematicOverlay) {
  schematicOverlay.querySelectorAll('[data-id]').forEach(function(el){
    el.addEventListener('click', function(e){
      e.stopPropagation();
      var id = el.dataset.id;
      setViewMode('layout');
      if (typeof selectById === 'function') selectById(id);
    });
  });
}

// 3D Floating Labels Checkbox
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

// Camera reset button wiring
var btnReset = document.getElementById('btn-reset-cam');
if (btnReset) {
  btnReset.addEventListener('click', function(){
    if (typeof resetAll === 'function') resetAll();
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
