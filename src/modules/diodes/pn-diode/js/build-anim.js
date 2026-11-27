/**
 * build-anim.js - PN Junction Diode CAD Viewer
 * Step-by-step drop-down IC fabrication process sequence animation:
 * 1. P-Substrate Preparation
 * 2. N-Well Cathode Implantation & Drive-In
 * 3. Shallow Trench Isolation (STI)
 * 4. Active Diffusions (P+ Anode Tub & N+ Cathode Tap)
 * 5. Metallurgical Junction & Space-Charge Depletion Formation
 * 6. ILD Passivation & Tungsten Contact Vias
 * 7. Metal-1 Interconnects & Terminal Callouts
 */

var FAB_STEPS = [
  {
    step: 1,
    title: 'P-Substrate Wafer Preparation',
    desc: 'Single-crystal P-type silicon wafer lightly doped with Boron (Na ≈ 1×10¹⁵ cm⁻³) provides mechanical support and the base substrate.',
    layers: ['substrate'],
    newLayers: ['substrate'],
    camPos: { x: 2.0, y: 22, z: 28 },
    camTarget: { x: 0, y: -2, z: 0 }
  },
  {
    step: 2,
    title: 'N-Well Implantation & Drive-In',
    desc: 'Deep high-energy Phosphorus/Arsenic implantation followed by high-temperature thermal drive-in diffusion forms the N-type cathode body tub.',
    layers: ['substrate', 'nwell'],
    newLayers: ['nwell'],
    camPos: { x: 2.0, y: 20, z: 26 },
    camTarget: { x: 0, y: -1.5, z: 0 }
  },
  {
    step: 3,
    title: 'Shallow Trench Isolation (STI)',
    desc: 'Dielectric trenches etched into silicon and filled with CVD SiO₂ isolate active diffusion regions to prevent surface punch-through and leakage.',
    layers: ['substrate', 'nwell', 'passivation'],
    newLayers: ['passivation'],
    camPos: { x: 1.5, y: 19, z: 25 },
    camTarget: { x: 0, y: 0, z: 0 }
  },
  {
    step: 4,
    title: 'Active Diffusions (P+ Anode & N+ Cathode)',
    desc: 'Selective ion implantation forms the heavily doped P+ Anode tub (Na ≈ 10¹⁷ cm⁻³) alongside the degenerate N+ Cathode ohmic contact tap.',
    layers: ['substrate', 'nwell', 'passivation', 'active'],
    newLayers: ['active'],
    camPos: { x: 1.0, y: 18, z: 24 },
    camTarget: { x: 0, y: 0, z: 0 }
  },
  {
    step: 5,
    title: 'Conformal Depletion & Space-Charge Formation',
    desc: 'Mobile carrier diffusion uncovers fixed uncompensated ionized donor (ND⁺) and acceptor (NA⁻) cores, establishing built-in potential barrier Vbi.',
    layers: ['substrate', 'nwell', 'passivation', 'active', 'depletion', 'ions', 'field'],
    newLayers: ['depletion', 'ions'],
    camPos: { x: -1.5, y: 16, z: 22 },
    camTarget: { x: -2.0, y: -0.8, z: 0 }
  },
  {
    step: 6,
    title: 'NiSi Silicide, ILD & Tungsten Contact Vias',
    desc: 'Self-aligned Nickel Silicide (NiSi) pads form over P+ Anode and N+ Cathode contact windows, capped by ILD SiO₂ and vertical CVD Tungsten (W) via plugs.',
    layers: ['substrate', 'nwell', 'passivation', 'active', 'depletion', 'ions', 'field', 'silicide', 'contact'],
    newLayers: ['silicide', 'contact'],
    camPos: { x: 1.5, y: 20, z: 26 },
    camTarget: { x: 0, y: 0.8, z: 0 }
  },
  {
    step: 7,
    title: 'Metal-1 Interconnects & Terminal Callouts',
    desc: 'First metallization layer patterned into Anode (A / VA) and Cathode (K / GND) pads, completing the discrete planar silicon diode.',
    layers: ['substrate', 'nwell', 'passivation', 'active', 'depletion', 'ions', 'field', 'silicide', 'contact', 'metal', 'labels'],
    newLayers: ['metal', 'labels'],
    camPos: { x: 1.5, y: 24, z: 32 },
    camTarget: { x: 1.5, y: 0, z: 0 }
  }
];

var LAYER_KEYS = [
  'substrate', 'nwell', 'active', 'depletion', 'ions', 'field', 'passivation', 'silicide', 'contact', 'metal', 'labels'
];

var currentFabStep = FAB_STEPS.length;
var isFabPlaying = false;
var fabPlayInterval = null;
var dropOffsets = {};

LAYER_KEYS.forEach(function (k) {
  dropOffsets[k] = 0;
});

function applyFabStep(stepNum, shouldAnimateDrop) {
  currentFabStep = Math.max(1, Math.min(FAB_STEPS.length, stepNum));
  var stepData = FAB_STEPS[currentFabStep - 1];

  LAYER_KEYS.forEach(function (layerKey) {
    if (!groups[layerKey]) return;
    var isIncluded = (stepData.layers.indexOf(layerKey) !== -1);
    var isNew = stepData.newLayers && (stepData.newLayers.indexOf(layerKey) !== -1);

    groups[layerKey].visible = isIncluded;

    if (!isIncluded) {
      dropOffsets[layerKey] = 0;
      groups[layerKey].position.y = 0;
    } else if (shouldAnimateDrop && isNew) {
      dropOffsets[layerKey] = 12.0;
      groups[layerKey].position.y = 12.0;
    } else {
      dropOffsets[layerKey] = 0;
      groups[layerKey].position.y = 0;
    }
  });

  // Sync left panel layer checkboxes
  document.querySelectorAll('#layers-body input').forEach(function (cb) {
    var lk = cb.dataset.layer;
    cb.checked = (stepData.layers.indexOf(lk) !== -1);
  });

  // Smooth camera interpolation
  if (controls && activeCamera && stepData.camPos) {
    var startPos = activeCamera.position.clone();
    var targetPos = new THREE.Vector3(stepData.camPos.x, stepData.camPos.y, stepData.camPos.z);
    var startTgt = controls.target.clone();
    var endTgt = new THREE.Vector3(stepData.camTarget.x, stepData.camTarget.y, stepData.camTarget.z);

    var camStartTime = Date.now();
    var camDuration = 600; // ms
    function animCam() {
      var elapsed = Date.now() - camStartTime;
      var progress = Math.min(1.0, elapsed / camDuration);
      var ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);
      activeCamera.position.lerpVectors(startPos, targetPos, ease);
      controls.target.lerpVectors(startTgt, endTgt, ease);
      controls.update();
      if (progress < 1.0) {
        requestAnimationFrame(animCam);
      }
    }
    animCam();
  }

  // Update Top-Center Tour Banner
  var banner = document.getElementById('tour-banner');
  if (banner) {
    banner.style.display = 'flex';
  }
  var badgeEl = document.getElementById('tb-step-badge');
  if (badgeEl) badgeEl.textContent = 'STEP ' + currentFabStep + ' OF ' + FAB_STEPS.length;
  var titleEl = document.getElementById('tb-step-title');
  if (titleEl) titleEl.textContent = stepData.title;
  var descEl = document.getElementById('tb-step-desc');
  if (descEl) descEl.textContent = stepData.desc;
  var progressEl = document.getElementById('tb-progress-fill');
  if (progressEl) progressEl.style.width = ((currentFabStep / FAB_STEPS.length) * 100) + '%';
}

function updateBuildAnimation(dt) {
  if (!dt) return;
  LAYER_KEYS.forEach(function (key) {
    if (dropOffsets[key] > 0.001) {
      dropOffsets[key] = Math.max(0, dropOffsets[key] - dt * 24.0);
      if (groups[key]) {
        groups[key].position.y = dropOffsets[key];
      }
    } else if (dropOffsets[key] !== 0) {
      dropOffsets[key] = 0;
      if (groups[key]) {
        groups[key].position.y = 0;
      }
    }
  });
}

var _savedTourVa = null;

function stopBuildAnimation(restoreAll) {
  if (fabPlayInterval) {
    clearInterval(fabPlayInterval);
    fabPlayInterval = null;
  }
  isFabPlaying = false;

  var topbarTourBtn = document.getElementById('btn-build-anim');
  if (topbarTourBtn) {
    topbarTourBtn.classList.remove('active');
    var label = topbarTourBtn.querySelector('.play-label');
    var extra = topbarTourBtn.querySelector('.play-extra');
    if (label) label.textContent = 'FAB';
    if (extra) extra.innerHTML = '&nbsp;STEPS';
    topbarTourBtn.title = 'Watch step-by-step 3D fabrication sequence with AI Voice Tutor';
    topbarTourBtn.setAttribute('aria-label', 'Run 3D Fabrication Steps');
  }

  var pauseBtn = document.getElementById('tb-btn-pause');
  if (pauseBtn) pauseBtn.textContent = '▶';

  if (restoreAll) {
    window.isTourActive = false;
    currentFabStep = FAB_STEPS.length;
    LAYER_KEYS.forEach(function (layerKey) {
      dropOffsets[layerKey] = 0;
      if (groups[layerKey]) {
        groups[layerKey].visible = true;
        groups[layerKey].position.y = 0;
      }
    });
    document.querySelectorAll('#layers-body input').forEach(function (cb) {
      cb.checked = true;
    });
    var banner = document.getElementById('tour-banner');
    if (banner) banner.style.display = 'none';

    if (_savedTourVa !== null && typeof window.setDiodeBiasVoltage === 'function') {
      var restoredVa = _savedTourVa;
      _savedTourVa = null;
      window.setDiodeBiasVoltage(restoredVa);
    } else if (typeof rebuildFlowSimulation === 'function') {
      rebuildFlowSimulation();
    }

    // Reset camera to default
    if (controls && activeCamera && typeof INITIAL_POS !== 'undefined') {
      activeCamera.position.copy(INITIAL_POS);
      controls.target.copy(INITIAL_TARGET);
      controls.update();
    }
  }
}

function startBuildAnimation() {
  if (fabPlayInterval) clearInterval(fabPlayInterval);
  isFabPlaying = true;
  window.isTourActive = true;

  if (_savedTourVa === null && typeof window.getDiodeState === 'function') {
    var st = window.getDiodeState();
    _savedTourVa = st ? st.va : 0.0;
  }
  if (typeof window.setDiodeBiasVoltage === 'function') {
    window.setDiodeBiasVoltage(0.0);
  }
  if (typeof rebuildFlowSimulation === 'function') {
    rebuildFlowSimulation();
  }

  var topbarTourBtn = document.getElementById('btn-build-anim');
  if (topbarTourBtn) {
    topbarTourBtn.classList.add('active');
    var label = topbarTourBtn.querySelector('.play-label');
    var extra = topbarTourBtn.querySelector('.play-extra');
    if (label) label.textContent = 'PAUSE';
    if (extra) extra.innerHTML = '&nbsp;FAB';
    topbarTourBtn.title = 'Pause 3D fabrication steps';
    topbarTourBtn.setAttribute('aria-label', 'Pause 3D Fabrication Steps');
  }

  var pauseBtn = document.getElementById('tb-btn-pause');
  if (pauseBtn) pauseBtn.textContent = '⏸';

  if (currentFabStep >= FAB_STEPS.length) {
    applyFabStep(1, true);
  } else {
    applyFabStep(currentFabStep, true);
  }

  fabPlayInterval = setInterval(function () {
    if (currentFabStep < FAB_STEPS.length) {
      applyFabStep(currentFabStep + 1, true);
    } else {
      stopBuildAnimation(true);
    }
  }, 2500);
}

// Event Listeners for Tour Controls
document.addEventListener('DOMContentLoaded', function () {
  var btnBuildAnim = document.getElementById('btn-build-anim');
  if (btnBuildAnim) {
    btnBuildAnim.addEventListener('click', function () {
      if (isFabPlaying) {
        stopBuildAnimation(false);
      } else {
        startBuildAnimation();
      }
    });
  }

  var tbBtnPause = document.getElementById('tb-btn-pause');
  if (tbBtnPause) {
    tbBtnPause.addEventListener('click', function () {
      if (isFabPlaying) {
        stopBuildAnimation(false);
      } else {
        startBuildAnimation();
      }
    });
  }

  var tbBtnClose = document.getElementById('tb-btn-close');
  if (tbBtnClose) {
    tbBtnClose.addEventListener('click', function () {
      stopBuildAnimation(true);
    });
  }
});
