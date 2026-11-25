/**
 * selection.js - PN Junction Diode CAD Viewer
 * 3D Raycasting (6px drag threshold), non-destructive mesh highlighting,
 * popover card presentation, and cross-linking between 3D CAD,
 * Architecture Tree, and Property Inspector.
 */

var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var lastSelectedId = null;
var selectedMeshes = [];

var pointerDownCanvas = false;
var pointerDownPos = { x: 0, y: 0 };
var isDragCanvas = false;
var DRAG_DISTANCE_THRESHOLD = 6; // px

var popoverEl = document.getElementById('popover');
var popoverContentEl = document.getElementById('popover-content');
var popoverCloseBtn = document.getElementById('pop-close');

function meshesForId(id) {
  if (!id || typeof clickableMeshes === 'undefined') return [];
  var out = [];
  clickableMeshes.forEach(function (m) {
    if (!m || !m.userData) return;
    if (m.userData.id === id) {
      out.push(m);
    } else if (id === 'silicide' && (m.userData.id === 'anodeSilicide' || m.userData.id === 'cathodeSilicide')) {
      out.push(m);
    }
  });
  return out;
}

function clearSelection() {
  if (typeof SiliconSelectionHighlight !== 'undefined') {
    selectedMeshes.forEach(function (m) {
      SiliconSelectionHighlight.apply(m, false);
    });
  }
  selectedMeshes = [];
  lastSelectedId = null;

  document.querySelectorAll('.tree-node.active, .tree-node.selected').forEach(function (n) {
    n.classList.remove('active', 'selected');
  });

  var crumbSel = document.getElementById('crumb-sel');
  if (crumbSel) crumbSel.textContent = '';

  var inspector = document.getElementById('inspector');
  if (inspector) {
    inspector.innerHTML = '<div class="empty">Click any layer in the 3D model, schematic, or tree to inspect its electrical role, doping, and physics.</div>';
  }

  hidePopover();

  if (typeof window.clearVoiceAssistantContext === 'function') {
    window.clearVoiceAssistantContext();
  }
}
window.clearSelection = clearSelection;

function highlightMeshes(meshes) {
  if (typeof SiliconSelectionHighlight !== 'undefined') {
    selectedMeshes.forEach(function (m) {
      SiliconSelectionHighlight.apply(m, false);
    });
  }
  selectedMeshes = [];
  meshes.forEach(function (m) {
    if (typeof SiliconSelectionHighlight !== 'undefined') {
      SiliconSelectionHighlight.apply(m, true);
    }
    selectedMeshes.push(m);
  });
}

function initSelection() {
  if (renderer && renderer.domElement) {
    renderer.domElement.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      pointerDownCanvas = true;
      pointerDownPos.x = e.clientX;
      pointerDownPos.y = e.clientY;
      isDragCanvas = false;
    });

    window.addEventListener('pointermove', function (e) {
      if (!pointerDownCanvas) return;
      var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > DRAG_DISTANCE_THRESHOLD) {
        isDragCanvas = true;
      }
    });

    window.addEventListener('pointerup', function (e) {
      if (pointerDownCanvas) {
        var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (dist > DRAG_DISTANCE_THRESHOLD) {
          isDragCanvas = true;
        }
      }
      setTimeout(function () {
        pointerDownCanvas = false;
        isDragCanvas = false;
      }, 40);
    });

    renderer.domElement.addEventListener('click', onCanvasClick);
  }

  if (popoverCloseBtn) {
    popoverCloseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      clearSelection();
    });
  }
}

function isObjectVisibleInHierarchy(obj) {
  var cur = obj;
  while (cur) {
    if (cur.visible === false) return false;
    cur = cur.parent;
  }
  return true;
}

function onCanvasClick(e) {
  if (currentViewMode !== 'layout') return;
  if (e.target !== renderer.domElement) return;
  if (!pointerDownCanvas || isDragCanvas) return;
  var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > DRAG_DISTANCE_THRESHOLD) return;

  var rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  scene.updateMatrixWorld(true);
  raycaster.setFromCamera(mouse, activeCamera);

  var hits = raycaster.intersectObjects(clickableMeshes, true).filter(function (h) {
    var obj = h.object;
    if (!obj || (obj.userData && obj.userData._isHighlightPart)) return false;
    if (obj.isLine || obj.isLineSegments || obj.isPoints) return false;
    if (!isObjectVisibleInHierarchy(obj)) return false;
    if (obj.material && typeof obj.material.opacity === 'number' && obj.material.opacity <= 0.01) return false;
    return true;
  });

  if (hits.length > 0) {
    var hitObj = hits[0].object;
    while (hitObj && (!hitObj.userData || !hitObj.userData.id) && hitObj.parent && hitObj.parent !== scene) {
      hitObj = hitObj.parent;
    }
    var targetId = hitObj && hitObj.userData ? hitObj.userData.id : null;
    if (targetId) {
      selectComponentById(targetId, e.clientX, e.clientY);
      return;
    }
  }

  clearSelection();
}

function selectComponentById(id, clientX, clientY) {
  var info = idToInfo(id);
  if (!info) return;

  lastSelectedId = id;
  highlightMeshes(meshesForId(id));

  var crumbSel = document.getElementById('crumb-sel');
  if (crumbSel) {
    crumbSel.textContent = '— ' + info.title;
  }

  // 1. Update Property Inspector in Left Workbench
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
    n.classList.toggle('selected', n.dataset.id === id);
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
