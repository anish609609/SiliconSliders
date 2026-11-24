/**
 * selection.js
 * Click-to-inspect: the shared info-HTML builder, the Property Inspector panel, the anchored component popover (position tracked every frame), and the raycaster click handler that ties 3D clicks to both.
 */

// =====================================================================
// SELECTION / INSPECTOR
// =====================================================================
var selectedMeshes = [];
var HIGHLIGHT_COLOR = new THREE.Color(cssVar('--highlight')); // bright magenta — kept far from the well's teal-green and every layer color so selection is unambiguous

function applyEmissive(obj, color, intensity) {
  if (!obj) return;
  if (obj.isMesh && obj.material && obj.material.emissive) {
    if (color !== null) {
      if (obj.userData.baseEmissive === undefined) {
        obj.userData.baseEmissive = obj.material.emissive.getHex();
        obj.userData.baseEmissiveIntensity = obj.material.emissiveIntensity || 0;
      }
      obj.material.emissive.copy(color);
      obj.material.emissiveIntensity = intensity;
    } else {
      var baseHex = (typeof obj.userData.baseEmissive === 'number') ? obj.userData.baseEmissive : 0;
      var baseIntensity = (typeof obj.userData.baseEmissiveIntensity === 'number') ? obj.userData.baseEmissiveIntensity : 0;
      obj.material.emissive.setHex(baseHex);
      obj.material.emissiveIntensity = baseIntensity;
    }
  }
  if (obj.children && obj.children.length) {
    obj.children.forEach(function(child) {
      applyEmissive(child, color, intensity);
    });
  }
}

function clearSelection(){
  selectedMeshes.forEach(function(m){
    applyEmissive(m, null, 0);
  });
  selectedMeshes = [];
  lastSelectedId = null;
  document.querySelectorAll('#tree .node.selected').forEach(function(n){ n.classList.remove('selected'); });
  document.getElementById('crumb-sel').textContent = '';
  if (typeof window.clearVoiceAssistantContext === 'function'){
    window.clearVoiceAssistantContext();
  }
}

function highlightMeshes(meshes){
  clearSelection();
  meshes.forEach(function(m){
    applyEmissive(m, HIGHLIGHT_COLOR, 0.55);
    selectedMeshes.push(m);
  });
}

var lastSelectedId = null;

function buildInfoHtml(id, info){
  if (!info) return '<div class="empty">No inspector data for this element.</div>';
  return '<div class="title">'+info.title+'</div>'+
    '<div class="field"><div class="k">FUNCTION</div><div class="v">'+info.fn+'</div></div>'+
    '<div class="field"><div class="k">ELECTRICAL ROLE</div><div class="v">'+info.role+'</div></div>'+
    '<div class="field"><div class="k">CONNECTION</div><div class="v">'+info.conn+'</div></div>'+
    '<div class="field"><div class="k">PHYSICAL RELATIONSHIP</div><div class="v">'+info.rel+'</div></div>'+
    (info.doping ? '<div class="field"><div class="k">DOPING CONCENTRATION</div><div class="v">'+info.doping+'</div></div>' : '') +
    dimsHtmlForId(id);
}

function showInspector(id, info){
  document.getElementById('inspector').innerHTML = buildInfoHtml(id, info);
}

// ---- anchored component popover ----
var popoverEl = document.getElementById('popover');
var popoverMeshes = [];
var popoverWorldPos = new THREE.Vector3();

function showPopoverFor(meshes, id, info){
  popoverMeshes = meshes;
  document.getElementById('popover-content').innerHTML = buildInfoHtml(id, info);
  popoverEl.classList.add('visible');
  updatePopoverPosition();
}
function hidePopover(){
  popoverMeshes = [];
  popoverEl.classList.remove('visible');
}
function updatePopoverPosition(){
  if (!popoverMeshes.length) return;
  scene.updateMatrixWorld(true);
  popoverWorldPos.set(0,0,0);
  var tmp = new THREE.Vector3();
  popoverMeshes.forEach(function(m){ m.getWorldPosition(tmp); popoverWorldPos.add(tmp); });
  popoverWorldPos.multiplyScalar(1/popoverMeshes.length);

  var proj = popoverWorldPos.clone().project(activeCamera);
  if (proj.z > 1){ popoverEl.classList.remove('visible'); return; } // behind camera
  if (!popoverMeshes.length) return;
  var rect = renderer.domElement.getBoundingClientRect();
  var x = (proj.x*0.5+0.5) * rect.width;
  var y = (-proj.y*0.5+0.5) * rect.height;
  x = Math.max(70, Math.min(rect.width-70, x));
  y = Math.max(50, Math.min(rect.height-16, y));

  var card = popoverEl.querySelector('.pop-card');
  var cardH = card ? card.offsetHeight : 320;
  if (y - cardH < 56) {
    popoverEl.classList.add('flip-below');
  } else {
    popoverEl.classList.remove('flip-below');
  }

  popoverEl.style.left = x + 'px';
  popoverEl.style.top = y + 'px';
  popoverEl.classList.add('visible');
}
window.updatePopoverPosition = updatePopoverPosition;

var popCloseBtn = document.getElementById('pop-close');
if (popCloseBtn) {
  popCloseBtn.addEventListener('click', function(e){
    e.stopPropagation();
    clearSelection();
    hidePopover();
    var insp = document.getElementById('inspector');
    if (insp) insp.innerHTML = '<div class="empty">Select a layer, region, or tree node to inspect its function, electrical role, and physical relationships.</div>';
    document.getElementById('crumb-sel').textContent = '';
    if (typeof window.clearVoiceAssistantContext === 'function'){
      window.clearVoiceAssistantContext();
    }
  });
}

function selectById(id){
  var meshes = meshesForId(id);
  if (!meshes.length) return;
  highlightMeshes(meshes);
  lastSelectedId = id;
  var info = idToInfo(id);
  showInspector(id, info);

  document.getElementById('crumb-sel').textContent = '— ' + (info ? info.title : id);
  document.querySelectorAll('#tree .node').forEach(function(n){
    if (n.dataset.id === id) n.classList.add('selected');
    else n.classList.remove('selected');
  });

  var wb = document.getElementById('left-workbench');
  var isCollapsed = wb && wb.classList.contains('collapsed');

  if (!isCollapsed) {
    // 1. Hide floating popover if open
    hidePopover();
    // 2. Automatically switch Left Workbench to Inspect tab
    if (typeof switchWorkbenchTab === 'function'){
      switchWorkbenchTab('inspect');
    }
    // 3. Ensure inspector content at the top of the workbench is scrolled into view
    var wbBody = document.getElementById('wb-body');
    if (wbBody) wbBody.scrollTop = 0;
  } else {
    // Left Workbench is collapsed: show floating card over canvas without opening workbench
    showPopoverFor(meshes, id, info);
  }

  if (typeof window.updateVoiceAssistantContext === 'function'){
    window.updateVoiceAssistantContext(id, info);
  }
}

// raycaster click — hitting the model selects + anchors the popover;
// clicking empty background dismisses it.
// Uses pointerdown/move tracking to ensure drags/orbits never trigger false selections.
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();

var pointerDownCanvas = false;
var pointerDownPos = { x: 0, y: 0 };
var isDragCanvas = false;
var DRAG_DISTANCE_THRESHOLD = 6; // px

renderer.domElement.addEventListener('pointerdown', function(e){
  if (e.button !== 0) return;
  pointerDownCanvas = true;
  pointerDownPos.x = e.clientX;
  pointerDownPos.y = e.clientY;
  isDragCanvas = false;
});

window.addEventListener('pointermove', function(e){
  if (!pointerDownCanvas) return;
  var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > DRAG_DISTANCE_THRESHOLD){
    isDragCanvas = true;
  }
});

window.addEventListener('pointerup', function(e){
  if (pointerDownCanvas){
    var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > DRAG_DISTANCE_THRESHOLD){
      isDragCanvas = true;
    }
  }
  setTimeout(function(){
    pointerDownCanvas = false;
    isDragCanvas = false;
  }, 40);
});

renderer.domElement.addEventListener('click', function(e){
  // Reject false clicks: dragged orbits, or mouse released after clicking elsewhere
  if (!pointerDownCanvas || isDragCanvas){
    return;
  }
  var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > DRAG_DISTANCE_THRESHOLD){
    return;
  }

  var rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX-rect.left)/rect.width)*2-1;
  pointer.y = -((e.clientY-rect.top)/rect.height)*2+1;

  scene.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, activeCamera);

  var hits = raycaster.intersectObjects(selectable, true).filter(function(h){
    var cur = h.object;
    while (cur) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }
    if (h.object.isLine || h.object.isLineSegments || h.object.isPoints) return false;
    return true;
  });

  hits.sort(function(a, b){ return a.distance - b.distance; });

  if (hits.length){
    var targetId = null;
    for (var i = 0; i < hits.length; i++) {
      var cur = hits[i].object;
      while (cur && !targetId) {
        if (cur.userData && cur.userData.id) {
          targetId = cur.userData.id;
          break;
        }
        if (cur === scene) break;
        cur = cur.parent;
      }
      if (targetId) break;
    }
    if (targetId) {
      selectById(targetId);
      return;
    }
  }

  clearSelection();
  hidePopover();
  document.getElementById('inspector').innerHTML = '<div class="empty">Select a layer, region, or tree node to inspect its function, electrical role, and physical relationships.</div>';
  document.getElementById('crumb-sel').textContent = '';
});
