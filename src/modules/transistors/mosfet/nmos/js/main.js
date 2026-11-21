/**
 * main.js - NMOS CAD Viewer
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

var dockedPanel = document.getElementById('docked-panel');
var viewHud = document.getElementById('view-hud');
function updateViewHudPosition() {
  if (window.innerWidth < 768) {
    if (dockedPanel) dockedPanel.style.right = '';
    return;
  }
  var launcher = document.getElementById('va-launcher-btn');
  var vaWidget = document.getElementById('voice-assistant-widget');
  var ivHud = document.getElementById('ids-vds-hud');
  if (rightPanel && rightPanel.classList.contains('open')) {
    var w = rightPanel.getBoundingClientRect().width;
    if (dockedPanel) dockedPanel.style.right = (w + 14) + 'px';
    if (viewHud) viewHud.style.right = (w + 14) + 'px';
    if (launcher) launcher.style.right = (w + 14) + 'px';
    if (vaWidget) vaWidget.style.right = (w + 14) + 'px';
    if (ivHud) ivHud.style.right = (w + 14) + 'px';
  } else {
    if (dockedPanel) dockedPanel.style.right = '';
    if (viewHud) viewHud.style.right = '';
    if (launcher) launcher.style.right = '';
    if (vaWidget) vaWidget.style.right = '';
    if (ivHud) ivHud.style.right = '';
  }
}
window.addEventListener('resize', updateViewHudPosition);

// Docked Panel Tabs & Collapse Controls
var dpTabs = document.querySelectorAll('.dp-tab-btn');
var dpContents = document.querySelectorAll('.dp-tab-content');
var dpCollapseBtn = document.getElementById('dp-collapse-btn');
var dpBody = document.getElementById('dp-body');

// Collapse floating panels by default on mobile viewports (< 768px)
if (window.innerWidth < 768 && dpBody && dpCollapseBtn) {
  dpBody.classList.add('collapsed');
  dpCollapseBtn.textContent = '▸';
}

dpTabs.forEach(function(tab) {
  tab.addEventListener('click', function() {
    var target = tab.dataset.tab;
    dpTabs.forEach(function(t) { t.classList.toggle('active', t === tab); });
    dpContents.forEach(function(c) {
      c.classList.toggle('active', c.id === 'tab-content-' + target);
    });
    if (dpBody && dpBody.classList.contains('collapsed')) {
      dpBody.classList.remove('collapsed');
      if (dpCollapseBtn) dpCollapseBtn.textContent = '▾';
    }
    if (target === 'physics' && typeof applyLogicState === 'function') {
      setTimeout(applyLogicState, 10);
    }
  });
});

if (dpCollapseBtn && dpBody) {
  dpCollapseBtn.addEventListener('click', function() {
    var collapsed = dpBody.classList.toggle('collapsed');
    dpCollapseBtn.textContent = collapsed ? '▸' : '▾';
  });
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

  if (typeof applyExplode === 'function') applyExplode(0, 0, 0);
  if (typeof resetScrub === 'function') resetScrub();

  currentVgs = 1.00;
  currentVds = 0.80;
  currentIn = 1;
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

  if (typeof clearSelection === 'function') clearSelection();
  lastSelectedId = null;
  if (typeof hidePopover === 'function') hidePopover();

  var inspector = document.getElementById('inspector');
  if (inspector) {
    inspector.innerHTML = '<div class="empty">Select a layer, region, or tree node to inspect its function, electrical role, and physical relationships.</div>';
  }
  var crumbSel = document.getElementById('crumb-sel');
  if (crumbSel) crumbSel.textContent = '';
}

// Bootstrap
resize();
if (typeof initTheme === 'function') initTheme();
var sb = document.getElementById('state-badge');
if (sb) sb.classList.add('visible');
resetAll();

requestAnimationFrame(function() {
  var loading = document.getElementById('loading');
  if (loading) loading.style.display = 'none';
});

if (typeof animate === 'function') {
  animate();
}
