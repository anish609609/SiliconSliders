/**
 * build-anim.js - Local Step-by-Step 3D Planar CMOS NAND2 Fabrication Process Tour
 * Fully offline/local sequential build animation with Previous / Pause-Resume / Next
 * controls, progress bar, auto-collapsing workbench, and clean reset.
 */

var FAB_STEPS = [
  {
    badge: 'STEP 1 OF 9',
    title: 'P-Type Silicon Substrate',
    desc: 'Single-crystal P-type silicon wafer provides mechanical support and the common bulk substrate for the 4-transistor CMOS NAND2 cell.',
    layers: ['substrate'],
    camPos: [0, 15, 25],
    camTarget: [0, 1.5, 0]
  },
  {
    badge: 'STEP 2 OF 9',
    title: 'Twin-Well Formation (N-Well & P-Well)',
    desc: 'Dual retrograde wells isolate the parallel PMOS pull-up pair (N-Well at Z > 0) from the series NMOS pull-down pair (P-Well at Z < 0).',
    layers: ['well'],
    camPos: [-13, 14, 22],
    camTarget: [0, 2.0, 0]
  },
  {
    badge: 'STEP 3 OF 9',
    title: 'Gate Dielectric Stack (SiO₂ + HfO₂)',
    desc: 'Interfacial SiO₂ and high-κ HfO₂ gate dielectrics are formed beneath both dual-gate channels (Gate A and Gate B) across pull-up and pull-down pairs.',
    layers: ['oxide', 'highk'],
    camPos: [11, 13, 20],
    camTarget: [0, 2.2, 0]
  },
  {
    badge: 'STEP 4 OF 9',
    title: 'Polysilicon Gate Patterning (Gates A & B)',
    desc: 'Two parallel polysilicon gate stripes route Input A (MP1 + MN1) and Input B (MP2 + MN2) along the Euler layout path.',
    layers: ['poly'],
    camPos: [-15, 14, 21],
    camTarget: [0, 2.5, 0]
  },
  {
    badge: 'STEP 5 OF 9',
    title: 'Self-Aligned LDD / SDE Extensions',
    desc: 'Shallow BF₂ (P-SDE) and arsenic (N-SDE) extensions self-align to Gate A and Gate B edges before spacer formation to control short-channel fields.',
    layers: ['sde'],
    camPos: [14, 13, 19],
    camTarget: [0, 2.2, 0]
  },
  {
    badge: 'STEP 6 OF 9',
    title: 'Si₃N₄ Gate Sidewall Spacers',
    desc: 'Anisotropic etch-back of conformal Si₃N₄ forms dielectric sidewall spacers along both Gate A and Gate B.',
    layers: ['spacer'],
    camPos: [-11, 12, 18],
    camTarget: [0, 2.3, 0]
  },
  {
    badge: 'STEP 7 OF 9',
    title: 'Deep N+/P+ S/D, Series Bridge & Well Taps',
    desc: 'Heavy P+ and N+ implants define MP1/MP2 sources and shared drain, the series MN1–MN2 N+ bridge diffusion, and N+/P+ well-tie body taps.',
    layers: ['active'],
    camPos: [15, 14, 22],
    camTarget: [0, 2.2, 0]
  },
  {
    badge: 'STEP 8 OF 9',
    title: 'Self-Aligned NiSi Silicide (Salicide)',
    desc: 'Nickel reacts selectively with exposed silicon across every active diffusion, series bridge, body tap, and poly gate contact area to form NiSi.',
    layers: ['silicide'],
    camPos: [-13, 14, 21],
    camTarget: [0, 2.5, 0]
  },
  {
    badge: 'STEP 9 OF 9',
    title: 'Tungsten Contacts & Metal-1 Interconnects',
    desc: 'Tungsten (W) vias connect S/D diffusions, body taps, and gates to Metal-1 power rails (VDD, GND), Input A/B straps, and the wired Output bus (OUT).',
    layers: ['contact', 'metal'],
    camPos: [17, 16, 23],
    camTarget: [0, 2.8, 0]
  }
];

var isBuildAnimating = false;
var isTourRunning = false;
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
    if (isBuildAnimating) {
      btnAnim.classList.add('active');
      btnAnim.innerHTML = '<span class="play-icon">&#9632;</span><span class="play-label">STOP</span><span class="play-extra">&nbsp;TOUR</span>';
      btnAnim.title = 'Stop 3D fabrication tour';
      btnAnim.setAttribute('aria-label', 'Stop 3D Fabrication Tour');
    } else {
      btnAnim.classList.remove('active');
      btnAnim.innerHTML = '<span class="play-icon">▶</span><span class="play-label">PLAY</span><span class="play-extra">&nbsp;TOUR</span>';
      btnAnim.title = 'Watch step-by-step 3D fabrication sequence';
      btnAnim.setAttribute('aria-label', 'Play 3D Fabrication Tour');
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

function applyTourPositions(activeLayers) {
  if (typeof allMeshes !== 'undefined') {
    for (var i = 0; i < allMeshes.length; i++) {
      var m = allMeshes[i];
      var layer = m.userData.layer;
      var rp = m.userData.restPos;
      if (typeof layerVisibility !== 'undefined') {
        layerVisibility[layer] = !!activeLayers[layer];
      }
      var st = fabState.layerTimers[layer];
      var dropY = (st && st.active) ? st.dropY : 0;
      if (rp) m.position.set(rp.x, rp.y + dropY, rp.z);
    }
  }
  if (typeof labelsList !== 'undefined') {
    for (var j = 0; j < labelsList.length; j++) {
      var lbl = labelsList[j];
      var lyr = lbl.userData.layer;
      var lrp = lbl.userData.restPos;
      var lst = fabState.layerTimers[lyr];
      var lDrop = (lst && lst.active) ? lst.dropY : 0;
      if (lrp) lbl.position.set(lrp.x, lrp.y + lDrop, lrp.z);
    }
  }
  if (typeof applyLayerVisibility === 'function') applyLayerVisibility();
  if (typeof syncVisibilityCheckboxes === 'function') syncVisibilityCheckboxes();
}

function scheduleFabAdvance() {
  if (fabAutoTimer) {
    clearTimeout(fabAutoTimer);
    fabAutoTimer = null;
  }
  if (!isBuildAnimating || !isFabPlaying) return;
  fabAutoTimer = setTimeout(function() {
    fabAutoTimer = null;
    if (!isBuildAnimating || !isFabPlaying) return;
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
  Object.keys(activeLayers).forEach(function(lk) {
    if (shouldAnimate && !prevLayers[lk]) {
      fabState.layerTimers[lk] = { dropY: 3.5, active: true };
    } else {
      fabState.layerTimers[lk] = { dropY: 0, active: false };
    }
  });

  applyTourPositions(activeLayers);

  var curStep = FAB_STEPS[currentFabStep];
  if (curStep && typeof camera !== 'undefined' && typeof controls !== 'undefined') {
    if (curStep.camPos) camera.position.set(curStep.camPos[0], curStep.camPos[1], curStep.camPos[2]);
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
  if (!isBuildAnimating || fabState.phase !== 'animating') return;

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
    }
  });

  if (typeof allMeshes !== 'undefined') {
    for (var i = 0; i < allMeshes.length; i++) {
      var m = allMeshes[i];
      var st = fabState.layerTimers[m.userData.layer];
      var rp = m.userData.restPos;
      if (st && rp) m.position.y = rp.y + st.dropY;
    }
  }
  if (typeof labelsList !== 'undefined') {
    for (var j = 0; j < labelsList.length; j++) {
      var lbl = labelsList[j];
      var lst = fabState.layerTimers[lbl.userData.layer];
      var lrp = lbl.userData.restPos;
      if (lst && lrp) lbl.position.y = lrp.y + lst.dropY;
    }
  }

  if (allSettled) {
    fabState.phase = 'idle';
    if (isFabPlaying) {
      scheduleFabAdvance();
    }
  }
}

function startBuildAnimation() {
  if (typeof clearSelection === 'function') clearSelection();
  if (typeof toggleWorkbench === 'function') toggleWorkbench(false);

  if (typeof explodeX !== 'undefined') explodeX = 0;
  if (typeof explodeY !== 'undefined') explodeY = 0;
  if (typeof explodeZ !== 'undefined') explodeZ = 0;
  if (typeof resetExplodeAndScrub === 'function') {
    resetExplodeAndScrub();
    explodeY = 0;
    var eyEl0 = document.getElementById('explode-y'); if (eyEl0) eyEl0.value = '0';
    var veyEl0 = document.getElementById('val-explode-y'); if (veyEl0) veyEl0.textContent = '0%';
    if (typeof applyExplode === 'function') applyExplode();
  }

  isBuildAnimating = true;
  isTourRunning = true;
  isFabPlaying = true;
  currentFabStep = 0;

  var banner = document.getElementById('tour-banner');
  if (banner) banner.style.display = 'flex';

  applyFabStep(0, true);
}

function pauseBuildAnimation() {
  if (!isBuildAnimating) return;
  isFabPlaying = false;
  if (fabAutoTimer) {
    clearTimeout(fabAutoTimer);
    fabAutoTimer = null;
  }
  syncTourControls();
}

function resumeBuildAnimation() {
  if (!isBuildAnimating) return;
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
  isBuildAnimating = false;
  isTourRunning = false;
  isFabPlaying = false;
  fabState.phase = 'idle';
  fabState.layerTimers = {};
  currentFabStep = 0;

  var banner = document.getElementById('tour-banner');
  if (banner) banner.style.display = 'none';

  if (restoreAll !== false) {
    if (typeof layerVisibility !== 'undefined') {
      for (var k in layerVisibility) {
        if (Object.prototype.hasOwnProperty.call(layerVisibility, k)) {
          layerVisibility[k] = true;
        }
      }
    }
    if (typeof resetExplodeAndScrub === 'function') {
      resetExplodeAndScrub();
    } else if (typeof applyExplode === 'function') {
      applyExplode();
    }
    if (typeof applyLayerVisibility === 'function') applyLayerVisibility();
    if (typeof syncVisibilityCheckboxes === 'function') syncVisibilityCheckboxes();

    if (typeof camera !== 'undefined' && typeof TOP_VIEW_POS !== 'undefined' && typeof controls !== 'undefined' && typeof INITIAL_TARGET !== 'undefined') {
      camera.position.copy(TOP_VIEW_POS);
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
      if (isBuildAnimating) {
        stopBuildAnimation(true);
      } else {
        startBuildAnimation();
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', function() {
      if (!isBuildAnimating || currentFabStep <= 0) return;
      applyFabStep(currentFabStep - 1, true);
    });
  }

  if (btnPause) {
    btnPause.addEventListener('click', function() {
      if (!isBuildAnimating) return;
      if (isFabPlaying) pauseBuildAnimation();
      else resumeBuildAnimation();
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', function() {
      if (!isBuildAnimating) return;
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
window.stopTour = function() { stopBuildAnimation(true); };

initBuildAnimationControls();
