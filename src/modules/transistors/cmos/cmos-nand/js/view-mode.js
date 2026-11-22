/* PHYSICAL LAYOUT <-> SCHEMATIC <-> THEORY switcher with SVG [data-id] cross-probing */

var viewMode = 'layout'; // 'theory' | 'layout' | 'schematic'

function setViewMode(mode) {
  viewMode = mode;
  var overlay = document.getElementById('schematic-overlay');
  var theoryOverlay = document.getElementById('theory-overlay');
  var canvasHost = document.getElementById('canvas-host');
  var btnLayout = document.getElementById('btn-view-layout');
  var btnSch = document.getElementById('btn-view-schematic');
  var btnTheory = document.getElementById('btn-view-theory');

  if (btnTheory) btnTheory.classList.toggle('active', mode === 'theory');
  if (btnLayout) btnLayout.classList.toggle('active', mode === 'layout');
  if (btnSch) btnSch.classList.toggle('active', mode === 'schematic');

  var isTheory = (mode === 'theory');
  var isSchematic = (mode === 'schematic');
  var isLayout = (mode === 'layout');

  if (theoryOverlay) {
    theoryOverlay.classList.toggle('visible', isTheory);
    theoryOverlay.style.display = isTheory ? 'block' : 'none';
  }

  if (overlay) {
    overlay.classList.toggle('hidden', !isSchematic);
    overlay.style.display = isSchematic ? 'flex' : 'none';
  }

  if (canvasHost) {
    canvasHost.style.visibility = isLayout ? 'visible' : 'hidden';
    canvasHost.style.display = isLayout ? 'block' : 'none';
  }

  // 3D HUD & floating controls
  var inToggles = document.querySelectorAll('.in-toggle');
  inToggles.forEach(function(el){ el.style.display = isTheory ? 'none' : ''; });

  var flowModeGroup = document.getElementById('flow-mode-group');
  if (flowModeGroup) flowModeGroup.style.display = isLayout ? '' : 'none';

  var btnBuildAnim = document.getElementById('btn-build-anim');
  if (btnBuildAnim) btnBuildAnim.style.display = isLayout ? '' : 'none';

  var btnResetCam = document.getElementById('btn-reset-cam') || document.getElementById('btn-reset');
  if (btnResetCam) btnResetCam.style.display = isLayout ? '' : 'none';

  var leftToggle = document.getElementById('left-toggle');
  if (leftToggle) leftToggle.style.display = isLayout ? '' : 'none';

  var rightToggle = document.getElementById('right-toggle');
  if (rightToggle) rightToggle.style.display = isLayout ? '' : 'none';

  var noteEl = document.getElementById('note') || document.getElementById('scale-note-wrap');
  if (noteEl) noteEl.style.display = isLayout ? '' : 'none';

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

  var vaLauncher = document.getElementById('va-launcher-btn');
  if (vaLauncher) vaLauncher.style.display = isTheory ? 'none' : '';

  if (isSchematic || isTheory) {
    var pop = document.getElementById('popover');
    if (pop) pop.classList.add('hidden');
  } else {
    // Returning to 3D layout
    window.dispatchEvent(new Event('resize'));
    if (typeof controls !== 'undefined' && controls && controls.update) controls.update();
  }
}

function updateSchematicVisuals(state) {
  if (!state) return;
  var map = [
    { id: 'pmosA', val: state.mp1, lblId: 'sch-mp1-state', name: 'PMOS A' },
    { id: 'pmosB', val: state.mp2, lblId: 'sch-mp2-state', name: 'PMOS B' },
    { id: 'nmosA', val: state.mn1, lblId: 'sch-mn1-state', name: 'NMOS A' },
    { id: 'nmosB', val: state.mn2, lblId: 'sch-mn2-state', name: 'NMOS B' }
  ];

  for (var i = 0; i < map.length; i++) {
    var item = map[i];
    var el = document.querySelector('#nand2-schematic-svg .sch-el[data-id="' + item.id + '"]');
    var lbl = document.getElementById(item.lblId);
    if (el) {
      el.classList.remove('sch-on', 'sch-off', 'sch-leak');
      if (item.val === true) el.classList.add('sch-on');
      else if (item.val === false) el.classList.add('sch-off');
      else el.classList.add('sch-leak');
    }
    if (lbl) {
      var stText = item.val === true ? 'ON' : (item.val === false ? 'OFF' : 'LEAK');
      lbl.textContent = item.name + ' · ' + stText;
    }
  }

  var aTxt = document.getElementById('sch-a-state');
  var bTxt = document.getElementById('sch-b-state');
  var outTxt = document.getElementById('sch-out-state');
  if (aTxt) aTxt.textContent = state.a === 'off' ? 'OFF' : String(state.a);
  if (bTxt) bTxt.textContent = state.b === 'off' ? 'OFF' : String(state.b);
  if (outTxt) {
    outTxt.textContent = state.out === 0 || state.out === 1 ? 'OUT = ' + state.out : state.out;
  }
}

function initViewMode() {
  var btnTheory = document.getElementById('btn-view-theory');
  var btnLayout = document.getElementById('btn-view-layout');
  var btnSch = document.getElementById('btn-view-schematic');
  var schBack = document.getElementById('sch-btn-layout');
  var schReset = document.getElementById('sch-btn-reset');
  var svg = document.getElementById('nand2-schematic-svg');
  var theoryOverlay = document.getElementById('theory-overlay');

  if (btnTheory) {
    btnTheory.addEventListener('click', function () { setViewMode('theory'); });
  }
  if (btnLayout) {
    btnLayout.addEventListener('click', function () { setViewMode('layout'); });
  }
  if (btnSch) {
    btnSch.addEventListener('click', function () { setViewMode('schematic'); });
  }
  if (schBack) {
    schBack.addEventListener('click', function () { setViewMode('layout'); });
  }
  if (schReset) {
    schReset.addEventListener('click', function () {
      if (typeof clearSelection === 'function') clearSelection();
      if (typeof resetAll === 'function') resetAll();
    });
  }

  if (svg) {
    svg.addEventListener('click', function (e) {
      var el = e.target.closest('.sch-el[data-id]');
      if (!el) return;
      var id = el.getAttribute('data-id');
      setViewMode('layout');
      if (typeof selectById === 'function') {
        selectById(id);
      }
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
}

initViewMode();
