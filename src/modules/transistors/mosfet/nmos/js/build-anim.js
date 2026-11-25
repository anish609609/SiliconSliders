/**
 * build-anim.js - NMOS CAD Viewer
 * Step-by-step drop-down IC fabrication process sequence animation:
 * 1. P-Substrate (Bulk)
 * 2. Interfacial Gate Oxide (SiO2) & High-k Dielectric (HfO2)
 * 3. Polysilicon / Metal Gate
 * 4. Shallow N-SDE / LDD Extensions & Gate Sidewall Spacers (Si3N4)
 * 5. Heavily Doped N+ Source/Drain & P+ Body Tap
 * 6. Tungsten (W) Contacts
 * 7. Metal-1 Interconnects
 */

var FAB_STEPS = [
  {
    step: 1,
    title: 'P-Substrate Preparation',
    desc: 'Single-crystal P-type silicon wafer (Na ≈ 1×10¹⁵ cm⁻³) provides mechanical support and the bulk semiconductor body.',
    layers: ['substrate'],
    newLayers: ['substrate'],
    narration: 'We start with a single-crystal P-type silicon wafer lightly doped with boron, providing mechanical structure and bulk holes.'
  },
  {
    step: 2,
    title: 'Gate Dielectric Stack (SiO2 / HfO2)',
    desc: 'Ultra-thin interfacial SiO2 (~0.6 nm) passivates surface states, capped by ALD High-k HfO2 (k ≈ 25) to provide high gate capacitance without tunneling leakage.',
    layers: ['substrate', 'oxide', 'highk'],
    newLayers: ['oxide', 'highk'],
    narration: 'An atomically thin interfacial silicon dioxide layer passivates interface traps, capped by hafnium dioxide to eliminate gate tunneling leakage.'
  },
  {
    step: 3,
    title: 'Polysilicon / Metal Gate',
    desc: 'Workfunction-tuned gate electrode deposited and patterned by anisotropic dry etching to establish physical gate length L.',
    layers: ['substrate', 'oxide', 'highk', 'poly'],
    newLayers: ['poly'],
    narration: 'Polysilicon is deposited and dry-etched to form the conductive gate electrode runner directly crossing the channel.'
  },
  {
    step: 4,
    title: 'Shallow Extensions (N-SDE) & Spacers (Si3N4)',
    desc: 'Low-energy self-aligned N-SDE / LDD implant reduces peak lateral electric field. Conformal Si3N4 sidewall spacers mask subsequent deep implants.',
    layers: ['substrate', 'oxide', 'highk', 'poly', 'sde', 'spacer'],
    newLayers: ['sde', 'spacer'],
    narration: 'Lightly doped extensions curb peak lateral electric fields, flanked by silicon nitride sidewall spacers to self-align deep implants.'
  },
  {
    step: 5,
    title: 'Heavy N+ Source/Drain & P+ Body Tap',
    desc: 'High-dose ion implantation forms heavily doped N+ Source/Drain regions (Nd ≈ 1×10²⁰ cm⁻³) and P+ ohmic body tap, establishing the built-in Source/Drain depletion shells after RTA.',
    layers: ['substrate', 'depletion', 'oxide', 'highk', 'poly', 'sde', 'spacer', 'active'],
    newLayers: ['active', 'depletion'],
    narration: 'Deep self-aligned arsenic implantation forms low-resistance N-plus Source and Drain terminals alongside the P-plus body tap and built-in junction depletion shells.'
  },
  {
    step: 6,
    title: 'NiSi Salicide & Tungsten (W) Contacts',
    desc: 'Self-aligned Nickel Silicide (NiSi) pads form over exposed S/D and Body Tap silicon outside the Si3N4 spacers, followed by ILD deposition and CVD Tungsten contact plugs.',
    layers: ['substrate', 'depletion', 'oxide', 'highk', 'poly', 'sde', 'spacer', 'active', 'silicide', 'contact'],
    newLayers: ['silicide', 'contact'],
    narration: 'Self-aligned nickel silicide pads lower contact resistance on active regions, and tungsten contact plugs connect down cleanly onto the silicide pads.'
  },
  {
    step: 7,
    title: 'Metal-1 Interconnects',
    desc: 'First metallization layer patterned into Source (S/GND), Drain (D/VDS), Gate (G/VGS), and Body (B/GND) pads, completing the discrete NMOS transistor.',
    layers: ['substrate', 'depletion', 'oxide', 'highk', 'poly', 'sde', 'spacer', 'active', 'silicide', 'contact', 'metal'],
    newLayers: ['metal'],
    narration: 'Metal-1 copper runners are patterned, completing the discrete NMOS transistor with terminals for source, drain, gate, and body.'
  }
];

var currentFabStep = FAB_STEPS.length;
var isFabPlaying = false;
var fabPlayInterval = null;
var dropOffsets = {};

LAYER_ORDER.forEach(function(k) {
  dropOffsets[k] = 0;
});

function applyFabStep(stepNum, shouldAnimateDrop) {
  currentFabStep = Math.max(1, Math.min(FAB_STEPS.length, stepNum));
  var stepData = FAB_STEPS[currentFabStep - 1];

  LAYER_ORDER.forEach(function(layerKey) {
    if (!groups[layerKey]) return;
    var isIncluded = stepData.layers.indexOf(layerKey) !== -1;
    var isNew = stepData.newLayers && stepData.newLayers.indexOf(layerKey) !== -1;

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
  document.querySelectorAll('#layers-body input').forEach(function(cb) {
    var lk = cb.dataset.layer;
    cb.checked = stepData.layers.indexOf(lk) !== -1;
  });

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
  LAYER_ORDER.forEach(function(key) {
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
    if (label) label.textContent = 'PLAY';
  }

  var pauseBtn = document.getElementById('tb-btn-pause');
  if (pauseBtn) {
    pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><polygon points="6,4 20,12 6,20"></polygon></svg>';
    pauseBtn.title = 'Resume tour';
  }

  if (restoreAll) {
    currentFabStep = FAB_STEPS.length;
    LAYER_ORDER.forEach(function(layerKey) {
      dropOffsets[layerKey] = 0;
      if (groups[layerKey]) {
        groups[layerKey].visible = true;
        groups[layerKey].position.y = 0;
      }
    });
    document.querySelectorAll('#layers-body input').forEach(function(cb) {
      cb.checked = true;
    });
    var banner = document.getElementById('tour-banner');
    if (banner) banner.style.display = 'none';
  }
}

function startBuildAnimation() {
  if (fabPlayInterval) clearInterval(fabPlayInterval);
  isFabPlaying = true;

  var topbarTourBtn = document.getElementById('btn-build-anim');
  if (topbarTourBtn) {
    topbarTourBtn.classList.add('active');
    var label = topbarTourBtn.querySelector('.play-label');
    if (label) label.textContent = 'PAUSE';
  }

  var pauseBtn = document.getElementById('tb-btn-pause');
  if (pauseBtn) {
    pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    pauseBtn.title = 'Pause tour';
  }

  // If tour was at the end, restart from step 1
  if (currentFabStep >= FAB_STEPS.length) {
    applyFabStep(1, true);
  } else {
    applyFabStep(currentFabStep, true);
  }

  fabPlayInterval = setInterval(function() {
    if (currentFabStep < FAB_STEPS.length) {
      applyFabStep(currentFabStep + 1, true);
    } else {
      stopBuildAnimation(false);
    }
  }, 2400);
}

// Event Listeners for Tour Controls
var btnBuildAnim = document.getElementById('btn-build-anim');
if (btnBuildAnim) {
  btnBuildAnim.addEventListener('click', function() {
    if (isFabPlaying) {
      stopBuildAnimation(false);
    } else {
      startBuildAnimation();
    }
  });
}

var tbBtnPause = document.getElementById('tb-btn-pause');
if (tbBtnPause) {
  tbBtnPause.addEventListener('click', function() {
    if (isFabPlaying) {
      stopBuildAnimation(false);
    } else {
      startBuildAnimation();
    }
  });
}

var tbBtnClose = document.getElementById('tb-btn-close');
if (tbBtnClose) {
  tbBtnClose.addEventListener('click', function() {
    stopBuildAnimation(true);
  });
}
