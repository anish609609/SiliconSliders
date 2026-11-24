/**
 * selection.js - PN Junction Diode CAD Viewer
 * 3D Raycasting, element picking, popover card presentation,
 * and cross-linking between 3D CAD, Architecture Tree, and Property Inspector.
 */

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var lastSelectedId = null;

var popoverEl = document.getElementById('popover');
var popoverContentEl = document.getElementById('popover-content');
var popoverCloseBtn = document.getElementById('pop-close');

function initSelection() {
  if (renderer && renderer.domElement) {
    renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
  }

  if (popoverCloseBtn) {
    popoverCloseBtn.addEventListener('click', hidePopover);
  }
}

function onCanvasPointerDown(e) {
  if (currentViewMode !== 'layout') return;
  // Ignore clicks that originated from overlays or controls
  if (e.target !== renderer.domElement) return;

  var rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, activeCamera);
  var hits = raycaster.intersectObjects(clickableMeshes, true);

  if (hits.length > 0) {
    var hitObj = hits[0].object;
    // Climb up to find userData.id if child line or sub-mesh was clicked
    while (hitObj && (!hitObj.userData || !hitObj.userData.id) && hitObj.parent && hitObj.parent !== scene) {
      hitObj = hitObj.parent;
    }
    var targetId = hitObj && hitObj.userData ? hitObj.userData.id : null;
    if (targetId) {
      selectComponentById(targetId, e.clientX, e.clientY);
    }
  } else {
    hidePopover();
  }
}

function selectComponentById(id, clientX, clientY) {
  lastSelectedId = id;
  var info = idToInfo(id);
  if (!info) return;

  // 1. Update Property Inspector in Right Panel
  updateInspector(info);

  // 2. Highlight Architecture Tree Node
  highlightTreeNode(id);

  // 3. Left Workbench integration: if workbench open, switch to Inspect tab; if collapsed, show floating popover
  var wb = document.getElementById('left-workbench');
  var isCollapsed = wb && wb.classList.contains('collapsed');

  if (!isCollapsed) {
    hidePopover();
    if (typeof switchWorkbenchTab === 'function') {
      switchWorkbenchTab('inspect');
    }
    var wbBody = document.getElementById('wb-body');
    if (wbBody) wbBody.scrollTop = 0;
  } else {
    showPopover(info, clientX, clientY);
  }

  // 4. Update AI Tutor Context bar if open
  var ctxVal = document.getElementById('va-ctx-val');
  if (ctxVal) {
    ctxVal.textContent = info.title;
  }
  var chipSelected = document.getElementById('va-chip-selected');
  if (chipSelected) {
    chipSelected.style.display = 'inline-block';
    chipSelected.dataset.q = 'Explain the role and physics of ' + info.name;
    chipSelected.textContent = 'Explain ' + info.name.split(' ')[0];
  }
}

function updateInspector(info) {
  var inspector = document.getElementById('inspector');
  if (!inspector) return;

  var state = (typeof window.getDiodeState === 'function') ? window.getDiodeState() : null;

  var html = '<div class="insp-title">' + info.title + '</div>';
  html += '<div class="insp-meta">';
  html += '<div class="insp-row"><span class="insp-key">LAYER</span><span class="insp-val">' + info.layer + '</span></div>';
  html += '<div class="insp-row"><span class="insp-key">THICKNESS</span><span class="insp-val">' + info.thickness + '</span></div>';
  html += '<div class="insp-row"><span class="insp-key">AREA</span><span class="insp-val">' + info.area + '</span></div>';
  html += '<div class="insp-row"><span class="insp-key">DOPING</span><span class="insp-val">' + info.doping + '</span></div>';

  if (state && (info.id === 'depletionRegion' || info.id === 'fixedIonsP' || info.id === 'fixedIonsN' || info.id === 'breakdownGlow')) {
    html += '<div class="insp-row"><span class="insp-key">BIAS VA</span><span class="insp-val" style="color:var(--accent); font-weight:700;">' + (state.va >= 0 ? '+' : '') + state.va.toFixed(2) + ' V</span></div>';
    html += '<div class="insp-row"><span class="insp-key">WIDTH W</span><span class="insp-val" style="color:var(--accent); font-weight:700;">' + (state.wNm < 1000 ? state.wNm.toFixed(0) + ' nm' : state.wUm.toFixed(2) + ' μm') + '</span></div>';
    html += '<div class="insp-row"><span class="insp-key">xp (P-SIDE)</span><span class="insp-val">' + state.xpNm.toFixed(0) + ' nm</span></div>';
    html += '<div class="insp-row"><span class="insp-key">xn (N-SIDE)</span><span class="insp-val">' + state.xnNm.toFixed(0) + ' nm</span></div>';
    html += '<div class="insp-row"><span class="insp-key">|E_MAX|</span><span class="insp-val">' + (state.emax / 1e5).toFixed(1) + '×10⁵ V/cm</span></div>';
    html += '<div class="insp-row"><span class="insp-key">REGIME</span><span class="insp-val" style="color:var(--accent); font-weight:700;">' + state.regimeLabel + '</span></div>';
  }

  html += '</div>';
  html += '<p class="insp-desc"><b>Function:</b> ' + info.fn + '</p>';
  html += '<p class="insp-desc"><b>Physical Role:</b> ' + info.role + '</p>';

  inspector.innerHTML = html;
}

function highlightTreeNode(id) {
  var treeNodes = document.querySelectorAll('.tree-node');
  treeNodes.forEach(function (n) {
    n.classList.toggle('active', n.dataset.id === id);
  });
}

function showPopover(info, clientX, clientY) {
  if (!popoverEl || !popoverContentEl) return;

  var state = (typeof window.getDiodeState === 'function') ? window.getDiodeState() : null;

  var html = '<div style="font-family:var(--mono); font-size:12px; font-weight:700; color:var(--text); margin-bottom:4px;">' + info.name + '</div>';
  html += '<div style="font-size:11px; color:var(--text-dim); line-height:1.4;">' + info.fn + '</div>';

  if (state && (info.id === 'depletionRegion' || info.id === 'fixedIonsP' || info.id === 'fixedIonsN')) {
    html += '<div style="margin-top:6px; font-family:var(--mono); font-size:10.5px; color:var(--accent); font-weight:600;">' +
      'W = ' + state.wNm.toFixed(0) + ' nm (xp = ' + state.xpNm.toFixed(0) + ' nm, xn = ' + state.xnNm.toFixed(0) + ' nm) · ' + state.regimeLabel + '</div>';
  } else {
    html += '<div style="margin-top:6px; font-family:var(--mono); font-size:10px; color:var(--accent);">' + info.doping + '</div>';
  }

  popoverContentEl.innerHTML = html;

  var x = clientX || (window.innerWidth / 2);
  var y = clientY || (window.innerHeight / 2 - 80);

  // Position popover and clamp to viewport
  popoverEl.style.left = Math.min(window.innerWidth - 300, Math.max(20, x - 140)) + 'px';
  popoverEl.style.top = Math.min(window.innerHeight - 150, Math.max(60, y - 90)) + 'px';
  popoverEl.classList.add('visible');
  popoverEl.classList.remove('hidden');
}

function hidePopover() {
  if (popoverEl) {
    popoverEl.classList.remove('visible');
    popoverEl.classList.add('hidden');
  }
}
