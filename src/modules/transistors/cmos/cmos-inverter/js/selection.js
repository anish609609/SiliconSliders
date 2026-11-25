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
  if (typeof SiliconSelectionHighlight !== 'undefined') {
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
    if (typeof SiliconSelectionHighlight !== 'undefined') {
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
  lastSelectedId = id;
  highlightMeshes(meshes);
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
    if (n.dataset.id === id) n.classList.add('selected');
  });
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
  var hits = (typeof SiliconLayerHighlight !== 'undefined')
    ? SiliconLayerHighlight.raycastLayer(raycaster, scene)
    : raycaster.intersectObjects(selectable, true).filter(function(h){
        if (h.object.userData && h.object.userData._isHighlightPart) return false;
        if (h.object.isLine || h.object.isLineSegments || h.object.isPoints) return false;
        var cur = h.object;
        while (cur) {
          if (cur.visible === false) return false;
          cur = cur.parent;
        }
        return true;
      });
  if (hits.length){
    var m = hits[0].object;
    while (m && (!m.userData || (!m.userData.layerId && !m.userData.id)) && m.parent && m.parent !== scene) {
      m = m.parent;
    }
    var hitId = m && m.userData ? (m.userData.layerId || m.userData.id) : null;
    if (hitId) {
      selectById(hitId);
      return;
    }
  }
  clearSelection();
  hidePopover();
  document.getElementById('inspector').innerHTML = '<div class="empty">Select a layer, region, or tree node to inspect its function, electrical role, and physical relationships.</div>';
  document.getElementById('crumb-sel').textContent = '';
});
