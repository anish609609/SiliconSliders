/**
 * selection.js
 * Click-to-inspect: the shared info-HTML builder, the Property Inspector panel, the anchored component popover (position tracked every frame), and the raycaster click handler that ties 3D clicks to both.
 */

// =====================================================================
// SELECTION / INSPECTOR
// =====================================================================
var selectedMeshes = [];
var HIGHLIGHT_COLOR = new THREE.Color(cssVar('--highlight')); // bright magenta — kept far from the well's teal-green and every layer color so selection is unambiguous

function clearSelection(){
  if (typeof SiliconLayerHighlight !== 'undefined' && typeof scene !== 'undefined') {
    SiliconLayerHighlight.clearHighlight(scene);
  } else if (typeof SiliconSelectionHighlight !== 'undefined') {
    selectedMeshes.forEach(function(m){
      SiliconSelectionHighlight.apply(m, false);
    });
  }
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
    if (typeof SiliconLayerHighlight !== 'undefined' && typeof scene !== 'undefined') {
      SiliconLayerHighlight.apply(m, true, HIGHLIGHT_COLOR, scene);
    } else if (typeof SiliconSelectionHighlight !== 'undefined') {
      SiliconSelectionHighlight.apply(m, true, HIGHLIGHT_COLOR);
    }
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
  popoverEl.classList.remove('hidden');
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
  var box = new THREE.Box3();
  var count = 0;
  popoverMeshes.forEach(function(m){
    if (m && m.visible !== false) {
      box.expandByObject(m);
      count++;
    }
  });
  if (count && !box.isEmpty()) {
    box.getCenter(popoverWorldPos);
  } else {
    popoverWorldPos.set(0,0,0);
    var tmp = new THREE.Vector3();
    popoverMeshes.forEach(function(m){ m.getWorldPosition(tmp); popoverWorldPos.add(tmp); });
    popoverWorldPos.multiplyScalar(1/popoverMeshes.length);
  }

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
    document.getElementById('inspector').innerHTML = '<div class="empty">Select a layer, region, or tree node to inspect its function, electrical role, and physical relationships.</div>';
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
  var wb = document.getElementById('left-workbench');
  if (wb && !wb.classList.contains('collapsed')) {
    if (typeof window.switchWorkbenchTab === 'function') {
      window.switchWorkbenchTab('inspect');
    }
    var wbBody = document.getElementById('wb-body');
    if (wbBody) wbBody.scrollTop = 0;
    hidePopover();
  } else {
    showPopoverFor(meshes, id, info);
  }
  document.getElementById('crumb-sel').textContent = '— ' + (info ? info.title : id);
  document.querySelectorAll('#tree .node').forEach(function(n){
    var isAct = n.dataset.id === id;
    n.classList.toggle('selected', isAct);
    if (isAct && typeof n.scrollIntoView === 'function') {
      try { n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (_) {}
    }
  });
  if (typeof window.updateVoiceAssistantContext === 'function'){
    window.updateVoiceAssistantContext(id, info);
  }
}
window.selectById = selectById;

// raycaster click — hitting the model selects + anchors the popover;
// clicking empty background dismisses it.
// Uses pointerdown/move tracking to ensure drags/orbits never trigger false selections.
var raycaster = new THREE.Raycaster();
var pointer = new THREE.Vector2();

var pointerDownCanvas = false;
var pointerDownPos = null;
var isDragCanvas = false;
var DRAG_DISTANCE_THRESHOLD = 5; // px

renderer.domElement.addEventListener('pointerdown', function(e){
  if (e.button !== 0) return;
  pointerDownCanvas = true;
  pointerDownPos = { x: e.clientX, y: e.clientY };
  isDragCanvas = false;
});

window.addEventListener('pointerdown', function(e){
  if (e.target !== renderer.domElement) {
    pointerDownCanvas = false;
    pointerDownPos = null;
    isDragCanvas = false;
  }
});

window.addEventListener('pointermove', function(e){
  if (!pointerDownCanvas || !pointerDownPos) return;
  var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  if (dist > DRAG_DISTANCE_THRESHOLD){
    isDragCanvas = true;
  }
});

window.addEventListener('pointerup', function(e){
  if (pointerDownCanvas && pointerDownPos){
    var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > DRAG_DISTANCE_THRESHOLD){
      isDragCanvas = true;
    }
  }
});

renderer.domElement.addEventListener('click', function(e){
  if (isDragCanvas){
    pointerDownCanvas = false;
    pointerDownPos = null;
    isDragCanvas = false;
    return;
  }
  if (pointerDownPos) {
    var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (dist > DRAG_DISTANCE_THRESHOLD){
      pointerDownCanvas = false;
      pointerDownPos = null;
      return;
    }
  }
  pointerDownCanvas = false;
  pointerDownPos = null;
  isDragCanvas = false;

  var rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((e.clientX-rect.left)/rect.width)*2-1;
  pointer.y = -((e.clientY-rect.top)/rect.height)*2+1;
  scene.updateMatrixWorld(true);
  raycaster.setFromCamera(pointer, activeCamera);

  if (typeof SiliconLayerHighlight !== 'undefined' && typeof scene !== 'undefined') {
    var hitRes = SiliconLayerHighlight.raycastLayer(raycaster, scene);
    if (hitRes && hitRes.layerId) {
      selectById(hitRes.layerId);
      return;
    }
  }

  clearSelection();
  hidePopover();
  document.getElementById('inspector').innerHTML = '<div class="empty">Select a layer, region, or tree node to inspect its function, electrical role, and physical relationships.</div>';
  document.getElementById('crumb-sel').textContent = '';
});
