/**
 * controls-explode-scrub.js - PN Junction Diode CAD Viewer
 * Layer explosion offsets, clipping planes (section scrubbing),
 * and 3D floating billboard labels visibility toggle for planar diode model.
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

    // Displace layer groups vertically along Y
    if (groups.metal) {
      groups.metal.position.y = pctY * 6.0;
    }
    if (groups.labels) {
      groups.labels.position.y = pctY * 6.0;
    }
    if (groups.contact) {
      groups.contact.position.y = pctY * 4.2;
    }
    if (groups.passivation) {
      groups.passivation.position.y = pctY * 2.8;
    }
    if (groups.active) {
      groups.active.position.y = pctY * 1.6;
    }
    if (groups.depletion) {
      groups.depletion.position.y = pctY * 1.6;
    }
    if (groups.ions) {
      groups.ions.position.y = pctY * 1.6;
    }
    if (groups.field) {
      groups.field.position.y = pctY * 1.6;
    }
    if (groups.nwell) {
      groups.nwell.position.y = pctY * 0.7;
    }

    // Lateral separation along X (Anode left, Cathode right)
    if (pTubMesh) {
      pTubMesh.position.x = -4.8 - pctX * 3.5;
    }
    if (nTapMesh) {
      nTapMesh.position.x = 4.8 + pctX * 3.5;
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

  // Assign clipping planes to all planar diode materials
  var allMats = [
    diodeMaterials.substrate,
    diodeMaterials.nwell,
    diodeMaterials.pRegion,
    diodeMaterials.nRegion,
    diodeMaterials.depletion,
    diodeMaterials.sti,
    diodeMaterials.passivation,
    diodeMaterials.contact,
    diodeMaterials.metal
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
