/**
 * controls-explode-scrub.js - PN Junction Diode CAD Viewer
 * Full 3-axis layer explosion (Y, X, Z), clipping planes (section scrubbing),
 * and 3D floating billboard labels visibility toggle for planar diode model.
 */

var clipPlaneX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 30);
var clipPlaneY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 30);
var clipPlaneZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), 30);

window.pnExplodeState = {
  pctX: 0,
  pctY: 0,
  pctZ: 0
};

function initExplodeAndScrub() {
  // 1. Explode Sliders
  var expX = document.getElementById('explode-x-slider');
  var expY = document.getElementById('explode-y-slider');
  var expZ = document.getElementById('explode-z-slider');

  var expValX = document.getElementById('explode-x-val');
  var expValY = document.getElementById('explode-y-val');
  var expValZ = document.getElementById('explode-z-val');

  var viaBaseY = 0.071 + (1.8 - 0.071) / 2;
  var viaZOffsets = [-2.4, 0.0, 2.4];

  function updateExplosion() {
    var pctX = expX ? parseFloat(expX.value) / 100.0 : 0;
    var pctY = expY ? parseFloat(expY.value) / 100.0 : 0;
    var pctZ = expZ ? parseFloat(expZ.value) / 100.0 : 0;

    window.pnExplodeState.pctX = pctX;
    window.pnExplodeState.pctY = pctY;
    window.pnExplodeState.pctZ = pctZ;

    if (expValX) expValX.textContent = Math.round(pctX * 100) + '%';
    if (expValY) expValY.textContent = Math.round(pctY * 100) + '%';
    if (expValZ) expValZ.textContent = Math.round(pctZ * 100) + '%';

    // Symmetric Z-axis spread (centered around Z=0 so carrier & junction alignment holds)
    var zSub = -pctZ * 7.5;
    var zWell = -pctZ * 4.5;
    var zDep = -pctZ * 1.8;
    var zActive = pctZ * 0.8;
    var zPass = pctZ * 3.2;
    var zSil = pctZ * 5.2;
    var zVia = pctZ * 6.8;
    var zMetal = pctZ * 8.5;

    // 1. P-Substrate (Bulk anchor)
    if (groups.substrate) {
      groups.substrate.position.set(0, 0, zSub);
    }

    // 2. N-Well Tub
    if (groups.nwell) {
      groups.nwell.position.set(0, pctY * 3.8, zWell);
    }

    // 3. Depletion Shell + Fixed Space-Charge Ions + High-Field Glow (locked together for alignment)
    var depX = -pctX * 2.0;
    var depY = pctY * 6.8;
    if (groups.depletion) {
      groups.depletion.position.set(depX, depY, zDep);
    }
    if (groups.ions) {
      groups.ions.position.set(depX, depY, zDep);
    }
    if (groups.field) {
      groups.field.position.set(depX, depY, zDep);
    }

    // 4. Active Regions: P+ Anode & N+ Cathode separate in BOTH X (left/right) and Y (vertical tiers)
    if (groups.active) {
      groups.active.position.set(0, 0, zActive);
    }
    if (pTubMesh) {
      pTubMesh.position.set(-4.8 - pctX * 4.0, -P_TUB_D / 2 + 0.004 + pctY * 9.0, 0);
    }
    if (nTapMesh) {
      nTapMesh.position.set(4.8 + pctX * 4.0, -N_TAP_D / 2 + 0.004 + pctY * 10.8, 0);
    }

    // 5. Dielectric Stack (STI & ILD Passivation)
    if (groups.passivation) {
      groups.passivation.position.set(0, pctY * 12.2, zPass);
    }
    if (stiRimMesh1) stiRimMesh1.position.x = -9.25 - pctX * 4.4;
    if (stiRimMesh2) stiRimMesh2.position.x = 9.25 + pctX * 4.4;
    if (ildOuterLeft) ildOuterLeft.position.x = -9.25 - pctX * 4.4;
    if (ildOuterRight) ildOuterRight.position.x = 9.25 + pctX * 4.4;

    // 6. Self-Aligned NiSi Silicide Pads
    if (groups.silicide) {
      groups.silicide.position.set(0, pctY * 14.4, zSil);
    }
    if (anodeSilicideMesh) anodeSilicideMesh.position.x = -4.8 - pctX * 4.0;
    if (cathodeSilicideMesh) cathodeSilicideMesh.position.x = 4.8 + pctX * 4.0;

    // 7. Tungsten Contact Vias (track Anode/Cathode X symmetrically)
    if (groups.contact) {
      groups.contact.position.set(0, pctY * 15.2, zVia);
    }
    if (anodeVias && anodeVias.length) {
      anodeVias.forEach(function (v, idx) {
        v.position.set(-4.8 - pctX * 4.0, viaBaseY, viaZOffsets[idx] || 0);
      });
    }
    if (cathodeVias && cathodeVias.length) {
      cathodeVias.forEach(function (v, idx) {
        v.position.set(4.8 + pctX * 4.0, viaBaseY, viaZOffsets[idx] || 0);
      });
    }

    // 8. Metal-1 Interconnect Pads
    if (groups.metal) {
      groups.metal.position.set(0, pctY * 16.0, zMetal);
    }
    if (anodeMesh) anodeMesh.position.x = -4.8 - pctX * 4.0;
    if (cathodeMesh) cathodeMesh.position.x = 4.8 + pctX * 4.0;

    // 9. 3D Floating Terminal & Junction Labels (track their respective layers)
    if (groups.labels) {
      groups.labels.position.set(0, 0, 0);
    }
    if (lblAnode) {
      lblAnode.position.set(-4.8 - pctX * 4.0, 4.05 + pctY * 16.0, zMetal);
    }
    if (lblCathode) {
      lblCathode.position.set(4.8 + pctX * 4.0, 4.05 + pctY * 16.0, zMetal);
    }
    if (lblJunction) {
      lblJunction.position.set(-1.6 - pctX * 2.0, -P_TUB_D - 1.2 + pctY * 6.8, zDep);
    }

    if (typeof scene !== 'undefined' && scene) {
      scene.updateMatrixWorld(true);
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

  var clipList = [clipPlaneX, clipPlaneY, clipPlaneZ];
  var allMats = [
    diodeMaterials.substrate,
    diodeMaterials.nwell,
    diodeMaterials.pRegion,
    diodeMaterials.nRegion,
    diodeMaterials.depletion,
    diodeMaterials.breakdownGlow,
    diodeMaterials.sti,
    diodeMaterials.passivation,
    diodeMaterials.silicide,
    diodeMaterials.contact,
    diodeMaterials.metal
  ];

  allMats.forEach(function (m) {
    if (m) {
      m.clippingPlanes = clipList;
      m.clipShadows = true;
    }
  });

  // Also apply clipping planes to edge/line helpers inside device groups (excluding labels/ions)
  ['substrate', 'nwell', 'active', 'depletion', 'passivation', 'silicide', 'contact', 'metal'].forEach(function (gk) {
    if (!groups[gk]) return;
    groups[gk].traverse(function (child) {
      if (child.material) {
        child.material.clippingPlanes = clipList;
      }
    });
  });

  function updateScrub() {
    var vX = scrubX ? parseFloat(scrubX.value) : 30;
    var vY = scrubY ? parseFloat(scrubY.value) : 30;
    var vZ = scrubZ ? parseFloat(scrubZ.value) : 30;

    clipPlaneX.constant = vX;
    clipPlaneY.constant = vY;
    clipPlaneZ.constant = vZ;

    if (scrubValX) scrubValX.textContent = vX >= 29.5 ? 'off' : vX.toFixed(1);
    if (scrubValY) scrubValY.textContent = vY >= 29.5 ? 'off' : vY.toFixed(1);
    if (scrubValZ) scrubValZ.textContent = vZ >= 29.5 ? 'off' : vZ.toFixed(1);
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

  window.resetExplodeAndScrub = function () {
    if (expX) expX.value = 0;
    if (expY) expY.value = 0;
    if (expZ) expZ.value = 0;
    updateExplosion();

    if (scrubX) scrubX.value = scrubX.max || 30;
    if (scrubY) scrubY.value = scrubY.max || 30;
    if (scrubZ) scrubZ.value = scrubZ.max || 30;
    updateScrub();

    if (toggleLabelsChk) {
      toggleLabelsChk.checked = true;
      interactiveLabels.forEach(function (lbl) {
        lbl.visible = true;
      });
    }
  };

  updateExplosion();
  updateScrub();
}
