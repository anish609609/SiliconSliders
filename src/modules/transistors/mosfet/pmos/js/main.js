/**
 * main.js - PMOS CAD Viewer
 * Side-panel drawer toggles, collapse toggles, Reset-to-default routine,
 * and final bootstrap calls that start the application. Load this file LAST.
 */

var leftPanel = document.getElementById('left-panel');
var rightPanel = document.getElementById('right-panel');
var leftToggleBtn = document.getElementById('left-toggle');
var rightToggleBtn = document.getElementById('right-toggle');

if (leftToggleBtn && leftPanel) {
  leftToggleBtn.addEventListener('click', function() {
    var open = leftPanel.classList.toggle('open');
    leftToggleBtn.classList.toggle('is-open', open);
    leftToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

if (rightToggleBtn && rightPanel) {
  rightToggleBtn.addEventListener('click', function() {
    var open = rightPanel.classList.toggle('open');
    rightToggleBtn.classList.toggle('is-open', open);
    rightToggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    updateViewHudPosition();
  });
}

var viewHud = document.getElementById('view-hud');
function updateViewHudPosition() {
  var launcher = document.getElementById('va-launcher-btn');
  var vaWidget = document.getElementById('voice-assistant-widget');
  if (rightPanel && rightPanel.classList.contains('open')) {
    var w = rightPanel.getBoundingClientRect().width;
    if (viewHud) viewHud.style.right = (w + 14) + 'px';
    if (launcher) launcher.style.right = (w + 14) + 'px';
    if (vaWidget) vaWidget.style.right = (w + 14) + 'px';
  } else {
    if (viewHud) viewHud.style.right = '';
    if (launcher) launcher.style.right = '';
    if (vaWidget) vaWidget.style.right = '';
  }
}
window.addEventListener('resize', updateViewHudPosition);

var statusToggle = document.getElementById('status-toggle');
if (statusToggle && stateBadge) {
  statusToggle.addEventListener('click', function() {
    stateBadge.classList.toggle('mobile-open');
  });
}

var viewHudToggle = document.getElementById('view-hud-toggle');
if (viewHudToggle) {
  viewHudToggle.addEventListener('click', function() {
    var body = document.getElementById('view-hud-body');
    var chev = document.getElementById('view-hud-chev');
    if (body) {
      var collapsed = body.classList.toggle('collapsed');
      if (chev) chev.classList.toggle('closed', collapsed);
    }
  });
}

// =====================================================================
// RESET TO DEFAULT
// =====================================================================
function resetAll() {
  if (typeof stopBuildAnimation === 'function') stopBuildAnimation();
  if (typeof activeCamera !== 'undefined' && typeof controls !== 'undefined') {
    activeCamera.position.set(18, 16, 22);
    controls.target.set(0, 0, 0);
    controls.update();
  }

  if (typeof applyExplode === 'function') applyExplode(0, 0, 0);
  if (typeof resetScrub === 'function') resetScrub();

  currentIn = 0; // PMOS active state (VG = 0V)
  if (inSeg) {
    inSeg.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.in === '0');
    });
  }

  flowMode = 'carrier';
  if (flowSeg) {
    flowSeg.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.flow === 'carrier');
    });
  }

  if (typeof applyLogicState === 'function') applyLogicState();
  if (typeof rebuildFlowCurves === 'function') rebuildFlowCurves();

  if (typeof clearSelection === 'function') clearSelection();
  lastSelectedId = null;
  if (typeof hidePopover === 'function') hidePopover();

  var inspector = document.getElementById('inspector');
  if (inspector) {
    inspector.innerHTML = '<div class="empty">Select a layer, diffusion region, or tree node to inspect its function, electrical role, and physical relationships.</div>';
  }
  var crumbSel = document.getElementById('crumb-sel');
  if (crumbSel) crumbSel.textContent = '';
}

// Bootstrap
resize();
if (typeof initTheme === 'function') initTheme();
if (stateBadge) stateBadge.classList.add('visible');
resetAll();

requestAnimationFrame(function() {
  var loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
});

if (typeof animate === 'function') {
  animate();
}
