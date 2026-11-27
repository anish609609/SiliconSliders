/**
 * build-anim.js - Depletion-Mode PMOS CAD Viewer
 * Step-by-step drop-down IC fabrication process sequence animation:
 * 1. Substrate & N-Well Preparation
 * 2. Threshold / P-Channel Implant (Normally-ON built-in channel)
 * 3. Gate Dielectric Stack (SiO2 / HfO2)
 * 4. Gate Electrode Patterning (Polysilicon / Metal Gate)
 * 5. Shallow P-LDD / SDE Implant
 * 6. Si3N4 Sidewall Spacer Formation
 * 7. Deep P+ Source/Drain & N+ Well Tap Implant
 * 8. Self-Aligned Silicide (Salicide / NiSi)
 * 9. Contacts (W) & Metal-1 Interconnect
 */

var FAB_STEPS = [
  {
    step: 1,
    title: 'Substrate & N-Well Preparation',
    desc: 'P-type silicon wafer with deep phosphorus N-Well implant and thermal drive-in diffusion (Nd ≈ 1×10¹⁷ cm⁻³) to isolate and host the PMOS device.',
    layers: ['substrate', 'well'],
    newLayers: ['substrate', 'well'],
    narration: 'Starting from a P-type wafer, high-energy phosphorus implantation and thermal drive-in create the deep N-Well tub.'
  },
  {
    step: 2,
    title: 'Threshold / P-Channel Implant',
    desc: 'Shallow boron ion implant (Na ≈ 2×10¹⁷ cm⁻³) into the N-Well surface creates a built-in P-channel bridging the future Source and Drain (Normally ON).',
    layers: ['substrate', 'well', 'dchannel'],
    newLayers: ['dchannel'],
    narration: 'A shallow boron threshold implant patterns the built-in P-channel at the N-Well surface between Source and Drain.'
  },
  {
    step: 3,
    title: 'Gate Dielectric Stack (SiO2 / HfO2)',
    desc: 'Thermal growth of ultra-thin interfacial SiO2 (~0.6 nm) followed by ALD High-k HfO2 deposition (κ ≈ 25) to suppress gate tunneling leakage.',
    layers: ['substrate', 'well', 'dchannel', 'oxide', 'highk'],
    newLayers: ['oxide', 'highk'],
    narration: 'Interfacial silicon dioxide is grown and capped with ALD hafnium dioxide to maximize gate capacitance with minimal leakage.'
  },
  {
    step: 4,
    title: 'Gate Electrode Patterning',
    desc: 'Polysilicon / workfunction-tuned metal gate deposition and anisotropic lithographic dry etching establish physical gate length L (Wp ≈ 2Wn).',
    layers: ['substrate', 'well', 'dchannel', 'oxide', 'highk', 'poly'],
    newLayers: ['poly'],
    narration: 'The polysilicon gate electrode is deposited and etched over the high-k dielectric to define the transistor gate length.'
  },
  {
    step: 5,
    title: 'Shallow P-LDD / SDE Implant',
    desc: 'Self-aligned low-energy P- (BF2) source/drain extension implant using the gate stack as a mask to reduce peak lateral electric fields.',
    layers: ['substrate', 'well', 'dchannel', 'oxide', 'highk', 'poly', 'sde'],
    newLayers: ['sde'],
    narration: 'Low-energy boron implantation self-aligns to the gate edges to form shallow lightly doped P-LDD extensions.'
  },
  {
    step: 6,
    title: 'Si3N4 Sidewall Spacer Formation',
    desc: 'Conformal Si3N4 deposition and anisotropic RIE plasma etch leaving sidewall spacers flush over the shallow P-LDD extensions.',
    layers: ['substrate', 'well', 'dchannel', 'oxide', 'highk', 'poly', 'sde', 'spacer'],
    newLayers: ['spacer'],
    narration: 'Conformal silicon nitride is anisotropically etched into sidewall spacers sitting flush over the shallow LDD extensions.'
  },
  {
    step: 7,
    title: 'Deep P+ S/D & N+ Well Tap Implant',
    desc: 'High-dose P+ Source/Drain implant (Na ≈ 1×10²⁰ cm⁻³) self-aligned to the outer edge of the Si3N4 spacers, plus N+ Well Tap implant.',
    layers: ['substrate', 'well', 'depletion', 'dchannel', 'oxide', 'highk', 'poly', 'sde', 'spacer', 'active'],
    newLayers: ['active', 'depletion'],
    narration: 'Deep P-plus source/drain and N-plus well tap implants self-align to the outer spacer edges and form the PN junction depletion envelope.'
  },
  {
    step: 8,
    title: 'Self-Aligned Silicide (Salicide / NiSi)',
    desc: 'Nickel silicide (NiSi) contact pads formed over exposed P+ S/D and N-Well Tap silicon, electrically isolated from the gate by the Si3N4 spacers.',
    layers: ['substrate', 'well', 'depletion', 'dchannel', 'oxide', 'highk', 'poly', 'sde', 'spacer', 'active', 'silicide'],
    newLayers: ['silicide'],
    narration: 'Self-aligned nickel silicide pads form on exposed silicon terminals while Si3N4 spacers prevent bridging to the gate.'
  },
  {
    step: 9,
    title: 'Contacts (W) & Metal-1 Interconnect',
    desc: 'Tungsten (W) contact vias land on the NiSi pads and gate, followed by patterned Metal-1 routing pads for Source, Drain, Gate, and N-Well Body.',
    layers: ['substrate', 'well', 'depletion', 'dchannel', 'oxide', 'highk', 'poly', 'sde', 'spacer', 'active', 'silicide', 'contact', 'metal'],
    newLayers: ['contact', 'metal'],
    narration: 'Tungsten vias land onto the silicide pads and gate, connected by Metal-1 interconnect pads to complete the D-PMOS device.'
  }
];

var FAB_STEP_INTERVAL_MS = 2600;
var currentFabStep = 1;
var isTourActive = false;
var isFabPlaying = false;
var fabPlayInterval = null;
var dropOffsets = {};

LAYER_ORDER.forEach(function(k) {
  dropOffsets[k] = 0;
});

function syncTourControls() {
  var topbarTourBtn = document.getElementById('btn-build-anim');
  if (topbarTourBtn) {
    topbarTourBtn.classList.toggle('active', isTourActive);
    var icon = topbarTourBtn.querySelector('.play-icon');
    var label = topbarTourBtn.querySelector('.play-label');
    var extra = topbarTourBtn.querySelector('.play-extra');
    if (icon) icon.textContent = isTourActive ? '■' : '▶';
    if (label) label.textContent = isTourActive ? 'STOP' : 'FAB';
    if (extra) extra.innerHTML = isTourActive ? '&nbsp;FAB' : '&nbsp;STEPS';
    topbarTourBtn.setAttribute('aria-label', isTourActive ? 'Stop 3D Fabrication Steps' : 'Run 3D Fabrication Steps');
    topbarTourBtn.title = isTourActive ? 'Stop fabrication sequence and restore complete transistor' : 'Watch step-by-step 3D fabrication sequence';
  }

  var pauseBtn = document.getElementById('tb-btn-pause');
  if (pauseBtn) {
    if (isFabPlaying) {
      pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
      pauseBtn.title = 'Pause tour';
      pauseBtn.setAttribute('aria-label', 'Pause tour');
    } else {
      pauseBtn.innerHTML = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><polygon points="6,4 20,12 6,20"></polygon></svg>';
      pauseBtn.title = 'Resume tour';
      pauseBtn.setAttribute('aria-label', 'Resume tour');
    }
  }

  var prevBtn = document.getElementById('tb-btn-prev');
  if (prevBtn) {
    prevBtn.disabled = currentFabStep <= 1;
  }

  var nextBtn = document.getElementById('tb-btn-next');
  if (nextBtn) {
    var isLast = currentFabStep >= FAB_STEPS.length;
    nextBtn.title = isLast ? 'Finish and reset tour' : 'Next step';
    nextBtn.setAttribute('aria-label', isLast ? 'Finish tour' : 'Next step');
  }
}

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

  syncTourControls();
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

function scheduleFabAdvance() {
  if (fabPlayInterval) {
    clearInterval(fabPlayInterval);
    fabPlayInterval = null;
  }
  isFabPlaying = true;
  fabPlayInterval = setInterval(function() {
    if (currentFabStep < FAB_STEPS.length) {
      applyFabStep(currentFabStep + 1, true);
    } else {
      stopBuildAnimation(true);
    }
  }, FAB_STEP_INTERVAL_MS);
}

function pauseBuildAnimation() {
  if (fabPlayInterval) {
    clearInterval(fabPlayInterval);
    fabPlayInterval = null;
  }
  isFabPlaying = false;
  syncTourControls();
}

function resumeBuildAnimation() {
  if (!isTourActive) {
    startBuildAnimation();
    return;
  }
  scheduleFabAdvance();
  syncTourControls();
}

var _savedTourBias = null;

function stopBuildAnimation(restoreAll) {
  if (restoreAll === undefined) restoreAll = true;
  if (fabPlayInterval) {
    clearInterval(fabPlayInterval);
    fabPlayInterval = null;
  }
  isFabPlaying = false;

  if (restoreAll) {
    isTourActive = false;
    window.isTourActive = false;
    currentFabStep = 1;
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

    if (_savedTourBias !== null) {
      if (typeof currentVgs !== 'undefined') currentVgs = _savedTourBias.vgs;
      if (typeof currentVds !== 'undefined') currentVds = _savedTourBias.vds;
      _savedTourBias = null;
      if (typeof applyLogicState === 'function') applyLogicState();
    }
  }

  syncTourControls();
}

function startBuildAnimation() {
  if (typeof toggleWorkbench === 'function') {
    toggleWorkbench(false);
  }
  if (_savedTourBias === null && typeof window.getMosfetPhysicsState === 'function') {
    var st = window.getMosfetPhysicsState();
    _savedTourBias = { vgs: st.vgs, vds: st.vds };
  }
  isTourActive = true;
  window.isTourActive = true;
  // D-PMOS has VTH,p = +0.80V; VGS >= +0.80V enters full CUTOFF during fab tour
  if (typeof currentVgs !== 'undefined') currentVgs = 1.20;
  if (typeof applyLogicState === 'function') applyLogicState();
  currentFabStep = 1;
  scheduleFabAdvance();
  applyFabStep(1, true);
}

// Event Listeners for Tour Controls
var btnBuildAnim = document.getElementById('btn-build-anim');
if (btnBuildAnim) {
  btnBuildAnim.addEventListener('click', function() {
    if (isTourActive) {
      stopBuildAnimation(true);
    } else {
      startBuildAnimation();
    }
  });
}

var tbBtnPrev = document.getElementById('tb-btn-prev');
if (tbBtnPrev) {
  tbBtnPrev.addEventListener('click', function() {
    if (!isTourActive || currentFabStep <= 1) return;
    applyFabStep(currentFabStep - 1, true);
    if (isFabPlaying) scheduleFabAdvance();
  });
}

var tbBtnPause = document.getElementById('tb-btn-pause');
if (tbBtnPause) {
  tbBtnPause.addEventListener('click', function() {
    if (isFabPlaying) {
      pauseBuildAnimation();
    } else {
      resumeBuildAnimation();
    }
  });
}

var tbBtnNext = document.getElementById('tb-btn-next');
if (tbBtnNext) {
  tbBtnNext.addEventListener('click', function() {
    if (!isTourActive) return;
    if (currentFabStep < FAB_STEPS.length) {
      applyFabStep(currentFabStep + 1, true);
      if (isFabPlaying) scheduleFabAdvance();
    } else {
      stopBuildAnimation(true);
    }
  });
}

var tbBtnClose = document.getElementById('tb-btn-close');
if (tbBtnClose) {
  tbBtnClose.addEventListener('click', function() {
    stopBuildAnimation(true);
  });
}
