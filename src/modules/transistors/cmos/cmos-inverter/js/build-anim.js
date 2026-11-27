/**
 * build-anim.js - Local Step-by-Step 3D Planar CMOS Inverter Fabrication Process Tour
 * Fully offline/local sequential build animation with Previous / Pause-Resume / Next
 * controls, progress bar, auto-collapsing workbench, and clean reset.
 */

var FAB_STEPS = [
  {
    badge: 'STEP 1 OF 9',
    title: 'P-Type Silicon Substrate',
    desc: 'Single-crystal P-type silicon wafer provides mechanical support and the bulk semiconductor body for the complementary MOSFET pair.',
    layers: ['substrate'],
    camPos: [0, 14, 24],
    camTarget: [0, 1.5, 0]
  },
  {
    badge: 'STEP 2 OF 9',
    title: 'Twin-Well Formation (N-Well & P-Well)',
    desc: 'Phosphorus forms the deep N-Well body for the pull-up PMOS (Z > 0), while boron tailors the retrograde P-Well body for the pull-down NMOS (Z < 0).',
    layers: ['well'],
    camPos: [-12, 13, 21],
    camTarget: [0, 2.0, 0]
  },
  {
    badge: 'STEP 3 OF 9',
    title: 'Gate Dielectric Stack (SiO₂ + HfO₂)',
    desc: 'Ultra-thin interfacial SiO₂ (~0.8 nm) and high-κ HfO₂ gate dielectric are deposited over both PMOS (Wp) and NMOS (Wn) channel regions.',
    layers: ['oxide', 'highk'],
    camPos: [10, 12, 19],
    camTarget: [0, 2.2, 0]
  },
  {
    badge: 'STEP 4 OF 9',
    title: 'Polysilicon Gate Patterning (L & Wp/Wn)',
    desc: 'A continuous polysilicon strip of gate length L (20–200 nm) spans both PMOS (Wp) and NMOS (Wn), coupling βp/βn sizing directly to switching threshold VM.',
    layers: ['poly'],
    camPos: [-14, 13, 20],
    camTarget: [0, 2.5, 0]
  },
  {
    badge: 'STEP 5 OF 9',
    title: 'Self-Aligned LDD / SDE Extensions',
    desc: 'Before sidewall spacers are formed, shallow BF₂ (P-SDE) and arsenic (N-SDE) lightly doped extensions align directly to the gate edges to suppress hot-carrier effects.',
    layers: ['sde'],
    camPos: [13, 12, 18],
    camTarget: [0, 2.2, 0]
  },
  {
    badge: 'STEP 6 OF 9',
    title: 'Si₃N₄ Gate Sidewall Spacers',
    desc: 'Conformal silicon nitride (Si₃N₄) is etched anisotropically to form self-aligned sidewall spacers anchored flush to both gate edges across any channel length L.',
    layers: ['spacer'],
    camPos: [-10, 11, 16],
    camTarget: [0, 2.3, 0]
  },
  {
    badge: 'STEP 7 OF 9',
    title: 'Deep N+/P+ S/D, Depletion & Well Taps',
    desc: 'With spacers masking the LDD regions, heavy P+ source/drain (PMOS), N+ source/drain (NMOS), and N+/P+ well-tie body taps are implanted, establishing PN space-charge depletion junctions.',
    layers: ['active', 'depletion'],
    camPos: [14, 14, 21],
    camTarget: [0, 2.2, 0]
  },
  {
    badge: 'STEP 8 OF 9',
    title: 'Self-Aligned NiSi Silicide (Salicide)',
    desc: 'Nickel reacts selectively with exposed silicon over the S/D regions, body taps, and polysilicon gate to form low-resistance NiSi contact pads.',
    layers: ['silicide'],
    camPos: [-12, 13, 20],
    camTarget: [0, 2.5, 0]
  },
  {
    badge: 'STEP 9 OF 9',
    title: 'Tungsten Contacts & Metal-1 Interconnects',
    desc: 'Tungsten (W) vias land on the NiSi pads and bridge into Metal-1 routing: VDD rail, GND rail, shared input strap (IN), and merged PMOS+NMOS output bar (OUT).',
    layers: ['contact', 'metal'],
    camPos: [16, 15, 22],
    camTarget: [0, 2.8, 0]
  }
];

var isBuildAnimating = false;
var isTourActive = false;
var isFabPlaying = false;
var currentFabStep = 0;
var fabAutoTimer = null;
var fabState = { phase: 'idle', layerTimers: {} };

var SVG_PAUSE_ICON = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
var SVG_PLAY_ICON = '<svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>';

function syncTourControls() {
  var prevBtn = document.getElementById('tb-btn-prev');
  var pauseBtn = document.getElementById('tb-btn-pause');
  var nextBtn = document.getElementById('tb-btn-next');
  var btnAnim = document.getElementById('btn-build-anim');

  if (prevBtn) prevBtn.disabled = currentFabStep <= 0;
  if (nextBtn) nextBtn.disabled = false;

  if (pauseBtn) {
    pauseBtn.innerHTML = isFabPlaying ? SVG_PAUSE_ICON : SVG_PLAY_ICON;
    pauseBtn.title = isFabPlaying ? 'Pause tour' : 'Resume tour';
    pauseBtn.setAttribute('aria-label', pauseBtn.title);
  }

  if (btnAnim) {
    if (isTourActive) {
      btnAnim.classList.add('active');
      btnAnim.innerHTML = '<span class="play-icon">&#9632;</span><span class="play-label">STOP</span><span class="play-extra">&nbsp;FAB</span>';
      btnAnim.title = 'Stop 3D fabrication steps';
      btnAnim.setAttribute('aria-label', 'Stop 3D Fabrication Steps');
    } else {
      btnAnim.classList.remove('active');
      btnAnim.innerHTML = '<span class="play-icon">▶</span><span class="play-label">FAB</span><span class="play-extra">&nbsp;STEPS</span>';
      btnAnim.title = 'Watch step-by-step 3D fabrication sequence';
      btnAnim.setAttribute('aria-label', 'Run 3D Fabrication Steps');
    }
  }
}

function updateTourBanner(stepIndex) {
  var step = FAB_STEPS[stepIndex];
  if (!step) return;
  var badgeEl = document.getElementById('tb-step-badge');
  var titleEl = document.getElementById('tb-step-title');
  var descEl = document.getElementById('tb-step-desc');
  var fillEl = document.getElementById('tb-progress-fill');

  if (badgeEl) badgeEl.textContent = step.badge;
  if (titleEl) titleEl.textContent = step.title;
  if (descEl) descEl.textContent = step.desc;
  if (fillEl) fillEl.style.width = (((stepIndex + 1) / FAB_STEPS.length) * 100) + '%';
}

function scheduleFabAdvance() {
  if (fabAutoTimer) {
    clearTimeout(fabAutoTimer);
    fabAutoTimer = null;
  }
  if (!isTourActive || !isFabPlaying) return;
  fabAutoTimer = setTimeout(function() {
    fabAutoTimer = null;
    if (!isTourActive || !isFabPlaying) return;
    if (currentFabStep < FAB_STEPS.length - 1) {
      applyFabStep(currentFabStep + 1, true);
    } else {
      stopBuildAnimation(true);
    }
  }, 3200);
}

function applyFabStep(stepNum, shouldAnimate) {
  if (fabAutoTimer) {
    clearTimeout(fabAutoTimer);
    fabAutoTimer = null;
  }
  currentFabStep = Math.max(0, Math.min(FAB_STEPS.length - 1, stepNum));

  var activeLayers = {};
  var prevLayers = {};
  for (var i = 0; i <= currentFabStep; i++) {
    var st = FAB_STEPS[i];
    for (var j = 0; j < st.layers.length; j++) {
      var lk = st.layers[j];
      activeLayers[lk] = true;
      if (i < currentFabStep) prevLayers[lk] = true;
    }
  }

  fabState.layerTimers = {};
  LAYER_ORDER.forEach(function(k) {
    var grp = groups[k];
    if (!grp) return;
    if (activeLayers[k]) {
      grp.visible = true;
      if (shouldAnimate && !prevLayers[k]) {
        grp.position.y = 3.5;
        fabState.layerTimers[k] = { dropY: 3.5, active: true };
      } else {
        grp.position.y = 0;
        fabState.layerTimers[k] = { dropY: 0, active: false };
      }
    } else {
      grp.visible = false;
      grp.position.y = 0;
    }
  });

  // Sync Layers tab checkboxes with visible steps
  document.querySelectorAll('#layers-body input[data-layer]').forEach(function(inp) {
    inp.checked = !!activeLayers[inp.dataset.layer];
  });

  // Smooth camera transition for step
  var curStep = FAB_STEPS[currentFabStep];
  if (curStep && typeof activeCamera !== 'undefined' && typeof controls !== 'undefined') {
    if (curStep.camPos) activeCamera.position.set(curStep.camPos[0], curStep.camPos[1], curStep.camPos[2]);
    if (curStep.camTarget) controls.target.set(curStep.camTarget[0], curStep.camTarget[1], curStep.camTarget[2]);
    controls.update();
  }

  fabState.phase = shouldAnimate ? 'animating' : 'idle';
  updateTourBanner(currentFabStep);
  syncTourControls();
  if (!shouldAnimate && isFabPlaying) {
    scheduleFabAdvance();
  }
}

function updateBuildAnimation(dt) {
  if (!isTourActive || fabState.phase !== 'animating') return;

  var allSettled = true;
  Object.keys(fabState.layerTimers).forEach(function(k) {
    var st = fabState.layerTimers[k];
    if (st && st.active) {
      st.dropY -= dt * 8.5;
      if (st.dropY <= 0) {
        st.dropY = 0;
        st.active = false;
      } else {
        allSettled = false;
      }
      if (groups[k]) {
        groups[k].position.y = st.dropY;
      }
    }
  });

  if (allSettled) {
    fabState.phase = 'idle';
    if (isFabPlaying) {
      scheduleFabAdvance();
    }
  }
}

var _savedTourVin = null;

function startBuildAnimation() {
  if (typeof clearSelection === 'function') clearSelection();
  if (typeof toggleWorkbench === 'function') toggleWorkbench(false);

  // Save current input state and force CUTOFF/OFF during fabrication tour
  if (_savedTourVin === null && typeof currentVin !== 'undefined') {
    _savedTourVin = currentVin;
  }

  // Reset explode & section clipping to assemble cleanly
  if (typeof applyExplode === 'function') applyExplode(0, 0, 0);
  if (typeof resetScrub === 'function') resetScrub();
  var exEl = document.getElementById('explode-x'); if (exEl) exEl.value = '0';
  var eyEl = document.getElementById('explode-y'); if (eyEl) eyEl.value = '0';
  var ezEl = document.getElementById('explode-z'); if (ezEl) ezEl.value = '0';
  var vexEl = document.getElementById('val-explode-x'); if (vexEl) vexEl.textContent = '0%';
  var veyEl = document.getElementById('val-explode-y'); if (veyEl) veyEl.textContent = '0%';
  var vezEl = document.getElementById('val-explode-z'); if (vezEl) vezEl.textContent = '0%';

  isTourActive = true;
  window.isTourActive = true;
  isBuildAnimating = true;
  isFabPlaying = true;
  currentFabStep = 0;

  if (typeof setVinState === 'function') {
    setVinState('off');
  } else if (typeof currentVin !== 'undefined') {
    currentVin = 'off';
    if (typeof applyLogicState === 'function') applyLogicState();
  }

  var banner = document.getElementById('tour-banner');
  if (banner) banner.style.display = 'flex';

  applyFabStep(0, true);
}

function pauseBuildAnimation() {
  if (!isTourActive) return;
  isFabPlaying = false;
  if (fabAutoTimer) {
    clearTimeout(fabAutoTimer);
    fabAutoTimer = null;
  }
  syncTourControls();
}

function resumeBuildAnimation() {
  if (!isTourActive) return;
  isFabPlaying = true;
  syncTourControls();
  if (fabState.phase === 'idle') {
    scheduleFabAdvance();
  }
}

function stopBuildAnimation(restoreAll) {
  if (fabAutoTimer) {
    clearTimeout(fabAutoTimer);
    fabAutoTimer = null;
  }
  isTourActive = false;
  window.isTourActive = false;
  isBuildAnimating = false;
  isFabPlaying = false;
  fabState.phase = 'idle';
  fabState.layerTimers = {};
  currentFabStep = 0;

  var banner = document.getElementById('tour-banner');
  if (banner) banner.style.display = 'none';

  if (restoreAll !== false) {
    if (_savedTourVin !== null) {
      var prevVin = _savedTourVin;
      _savedTourVin = null;
      if (typeof setVinState === 'function') {
        setVinState(prevVin);
      } else if (typeof currentVin !== 'undefined') {
        currentVin = prevVin;
        if (typeof applyLogicState === 'function') applyLogicState();
      }
    }
    LAYER_ORDER.forEach(function(k) {
      if (groups[k]) {
        groups[k].visible = true;
        groups[k].position.y = 0;
      }
    });
    document.querySelectorAll('#layers-body input[data-layer]').forEach(function(inp) {
      inp.checked = true;
    });
    if (typeof applyExplode === 'function') applyExplode(0, 1, 0);
    var exEl = document.getElementById('explode-x'); if (exEl) exEl.value = '0';
    var eyEl = document.getElementById('explode-y'); if (eyEl) eyEl.value = '1';
    var ezEl = document.getElementById('explode-z'); if (ezEl) ezEl.value = '0';
    var vexEl = document.getElementById('val-explode-x'); if (vexEl) vexEl.textContent = '0%';
    var veyEl = document.getElementById('val-explode-y'); if (veyEl) veyEl.textContent = '1%';
    var vezEl = document.getElementById('val-explode-z'); if (vezEl) vezEl.textContent = '0%';

    var chkLabels = document.getElementById('chk-labels');
    if (chkLabels && typeof window.toggleLabels === 'function') {
      window.toggleLabels(chkLabels.checked);
    }

    if (typeof activeCamera !== 'undefined' && typeof INITIAL_POS !== 'undefined' && typeof controls !== 'undefined' && typeof INITIAL_TARGET !== 'undefined') {
      activeCamera.position.copy(INITIAL_POS);
      controls.target.copy(INITIAL_TARGET);
      controls.update();
    }
  }

  syncTourControls();
}

function initBuildAnimationControls() {
  var btnAnim = document.getElementById('btn-build-anim');
  var btnPrev = document.getElementById('tb-btn-prev');
  var btnPause = document.getElementById('tb-btn-pause');
  var btnNext = document.getElementById('tb-btn-next');
  var btnClose = document.getElementById('tb-btn-close');

  if (btnAnim) {
    btnAnim.addEventListener('click', function() {
      if (isTourActive) {
        stopBuildAnimation(true);
      } else {
        startBuildAnimation();
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', function() {
      if (!isTourActive || currentFabStep <= 0) return;
      applyFabStep(currentFabStep - 1, true);
    });
  }

  if (btnPause) {
    btnPause.addEventListener('click', function() {
      if (!isTourActive) return;
      if (isFabPlaying) pauseBuildAnimation();
      else resumeBuildAnimation();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', function() {
      if (!isTourActive) return;
      if (currentFabStep < FAB_STEPS.length - 1) {
        applyFabStep(currentFabStep + 1, true);
      } else {
        stopBuildAnimation(true);
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', function() {
      stopBuildAnimation(true);
    });
  }

  syncTourControls();
}

window.updateBuildAnimation = updateBuildAnimation;
window.startBuildAnimation = startBuildAnimation;
window.stopBuildAnimation = stopBuildAnimation;

initBuildAnimationControls();
