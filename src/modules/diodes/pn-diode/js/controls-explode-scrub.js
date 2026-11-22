/**
 * controls-explode-scrub.js - PN Junction Diode CAD Viewer
 * Layer explosion offsets, clipping planes (section scrubbing),
 * and 3D floating billboard labels visibility toggle.
 */

var clipPlaneX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 30);
var clipPlaneY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 30);
var clipPlaneZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 30);

function initExplodeAndScrub() {
  // 1. Explode Sliders
  var expX = document.getElementById('explode-x-slider');
  var expY = document.getElementById('explode-y-slider');
  var expZ = document.getElementById('explode-z-slider');

  var expValX = document.getElementById('explode-x-val');
  var expValY = document.getElementById('explode-y-val');
  var expValZ = document.getElementById('explode-z-val');

  function updateExplosion() {
    var pctX = expX ? parseFloat(expX.value) / 100.0 : 0;
    var pctY = expY ? parseFloat(expY.value) / 100.0 : 0;
    var pctZ = expZ ? parseFloat(expZ.value) / 100.0 : 0;

    if (expValX) expValX.textContent = Math.round(pctX * 100) + '%';
    if (expValY) expValY.textContent = Math.round(pctY * 100) + '%';
    if (expValZ) expValZ.textContent = Math.round(pctZ * 100) + '%';

    // Displace layer groups
    if (groups.contacts) {
      groups.contacts.position.y = pctY * 5.0;
    }
    if (groups.passivation) {
      groups.passivation.position.y = pctY * 3.0;
    }
    if (groups.ions) {
      groups.ions.position.y = pctY * 1.5;
    }
    if (groups.semiconductor) {
      pBlockMesh.position.x = -BLOCK_HALF_L + pBlockMesh.scale.x / 2.0 - pctX * 3.5;
      nBlockMesh.position.x = BLOCK_HALF_L - nBlockMesh.scale.x / 2.0 + pctX * 3.5;
    }
  }

  if (expX) expX.addEventListener('input', updateExplosion);
  if (expY) expY.addEventListener('input', updateExplosion);
  if (expZ) expZ.addEventListener('input', updateExplosion);

  // 2. Section Scrub Sliders (Clipping planes)
  var scrubX = document.getElementById('scrub-x-slider');
  var scrubY = document.getElementById('scrub-y-slider');
  var scrubZ = document.getElementById('scrub-z-slider');

  var scrubValX = document.getElementById('scrub-x-val');
  var scrubValY = document.getElementById('scrub-y-val');
  var scrubValZ = document.getElementById('scrub-z-val');

  // Assign clipping planes to materials
  var allMats = [
    diodeMaterials.pRegion,
    diodeMaterials.nRegion,
    diodeMaterials.depletion,
    diodeMaterials.metal,
    diodeMaterials.passivation
  ];

  allMats.forEach(function (m) {
    if (m) {
      m.clippingPlanes = [clipPlaneX, clipPlaneY, clipPlaneZ];
      m.clipShadows = true;
    }
  });

  function updateScrub() {
    var vX = scrubX ? parseFloat(scrubX.value) : 30;
    var vY = scrubY ? parseFloat(scrubY.value) : 30;
    var vZ = scrubZ ? parseFloat(scrubZ.value) : 30;

    clipPlaneX.constant = vX;
    clipPlaneY.constant = vY;
    clipPlaneZ.constant = vZ;

    if (scrubValX) scrubValX.textContent = vX >= 25 ? 'off' : vX.toFixed(1);
    if (scrubValY) scrubValY.textContent = vY >= 25 ? 'off' : vY.toFixed(1);
    if (scrubValZ) scrubValZ.textContent = vZ >= 25 ? 'off' : vZ.toFixed(1);
  }

  if (scrubX) scrubX.addEventListener('input', updateScrub);
  if (scrubY) scrubY.addEventListener('input', updateScrub);
  if (scrubZ) scrubZ.addEventListener('input', updateScrub);

  // 3. Toggle 3D Floating Labels Checkbox
  var toggleLabelsChk = document.getElementById('toggle-labels');
  if (toggleLabelsChk) {
    toggleLabelsChk.addEventListener('change', function () {
      var isVisible = toggleLabelsChk.checked;
      interactiveLabels.forEach(function (lbl) {
        lbl.visible = isVisible;
      });
    });
  }
}
