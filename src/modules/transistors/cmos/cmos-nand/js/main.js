/* Drawer toggles, HUD right/left offset synchronization, resetAll & startup ready */

function updateViewHudPosition() {
  var rightPanel = document.getElementById('right-panel');
  var leftPanel = document.getElementById('left-panel');
  var viewHud = document.getElementById('view-hud');
  var vaLauncher = document.getElementById('va-launcher-btn');
  var vaWidget = document.getElementById('voice-assistant-widget');
  var stateBadge = document.getElementById('state-badge');

  var rightCollapsed = !rightPanel || rightPanel.classList.contains('collapsed');
  var rightOffset = rightCollapsed ? 38 : ((rightPanel.offsetWidth || 262) + 20);

  if (viewHud) {
    viewHud.style.right = rightOffset + 'px';
    viewHud.style.bottom = '14px';
  }

  if (vaLauncher) {
    var viewHudWidth = (viewHud && !viewHud.classList.contains('collapsed')) ? (viewHud.offsetWidth || 222) : 48;
    var launcherOffset = rightOffset + viewHudWidth + 12;
    vaLauncher.style.right = launcherOffset + 'px';
    vaLauncher.style.bottom = '14px';
  }

  if (vaWidget) {
    vaWidget.style.right = rightOffset + 'px';
    vaWidget.style.bottom = '14px';
  }

  var leftCollapsed = !leftPanel || leftPanel.classList.contains('collapsed');
  var leftOffset = leftCollapsed ? 14 : ((leftPanel.offsetWidth || 262) + 20);
  if (stateBadge) {
    stateBadge.style.left = leftOffset + 'px';
    stateBadge.style.bottom = '14px';
  }

  var scaleNote = document.getElementById('scale-note-wrap');
  if (scaleNote) {
    scaleNote.style.left = leftOffset + 'px';
  }
}

function resetAll() {
  if (typeof isTourRunning !== 'undefined' && isTourRunning && typeof stopTour === 'function') {
    stopTour();
  }

  if (typeof resetExplodeAndScrub === 'function') {
    resetExplodeAndScrub();
  }

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

  camera.position.copy(TOP_VIEW_POS);
  controls.target.copy(INITIAL_TARGET);
  controls.update();
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
  var leftPanel = document.getElementById('left-panel');
  var rightPanel = document.getElementById('right-panel');
  var toggleLeft = document.getElementById('toggle-left');
  var toggleRight = document.getElementById('toggle-right');

  if (leftPanel) leftPanel.classList.add('collapsed');
  if (rightPanel) rightPanel.classList.add('collapsed');

  function syncToggleArrows() {
    if (toggleLeft && leftPanel) {
      toggleLeft.textContent = leftPanel.classList.contains('collapsed') ? '›' : '‹';
    }
    if (toggleRight && rightPanel) {
      toggleRight.textContent = rightPanel.classList.contains('collapsed') ? '‹' : '›';
    }
  }

  if (toggleLeft && leftPanel) {
    toggleLeft.addEventListener('click', function () {
      leftPanel.classList.toggle('collapsed');
      syncToggleArrows();
      updateViewHudPosition();
    });
  }

  if (toggleRight && rightPanel) {
    toggleRight.addEventListener('click', function () {
      rightPanel.classList.toggle('collapsed');
      syncToggleArrows();
      updateViewHudPosition();
    });
  }

  var btnTheme = document.getElementById('btn-theme');
  if (btnTheme && typeof toggleTheme === 'function') {
    btnTheme.addEventListener('click', toggleTheme);
  }

  var btnReset = document.getElementById('btn-reset');
  if (btnReset) {
    btnReset.addEventListener('click', resetAll);
  }

  initScaleNote();
  syncToggleArrows();
  updateViewHudPosition();

  var overlay = document.getElementById('loading-overlay');
  if (overlay) {
    setTimeout(function () {
      overlay.classList.add('fade-out');
      setTimeout(function () {
        overlay.classList.add('hidden');
      }, 280);
    }, 120);
  }
}

initMainUi();
