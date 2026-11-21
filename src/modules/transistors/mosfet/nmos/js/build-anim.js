/**
 * build-anim.js - NMOS CAD Viewer
 * Step-by-step IC fabrication process sequence animation with audio narration support:
 * 1. P-Substrate bulk silicon wafer preparation
 * 2. Active area lithography & STI isolation
 * 3. Gate dielectric stack (Interfacial SiO2 + High-k HfO2 ALD)
 * 4. Polysilicon / Metal gate deposition & anisotropic etching
 * 5. Low-energy self-aligned N-SDE / LDD ion implantation
 * 6. Gate spacer deposition & heavy N+ Source/Drain implant
 * 7. Interlayer Dielectric (ILD) & Tungsten contact via fill
 * 8. Metal-1 metallization & CMP planarization
 */

var FAB_STEPS = [
  {
    step: 1,
    title: 'P-Substrate Preparation',
    desc: 'Starts with a p-type single-crystal silicon wafer (Na ≈ 1×10¹⁵ cm⁻³) with (100) crystal orientation.',
    layers: ['substrate'],
    narration: 'We start with a single-crystal P-type silicon wafer lightly doped with boron, providing mechanical structure and bulk holes.'
  },
  {
    step: 2,
    title: 'Active Area & Body Tap',
    desc: 'Thermal oxidation, Si3N4 pad masking, and shallow trench isolation (STI) define the active transistor region and P+ body tap.',
    layers: ['substrate'],
    narration: 'Shallow trench isolation planarizes the field oxide, defining the active silicon window and substrate ground tap.'
  },
  {
    step: 3,
    title: 'High-k Gate Dielectric Stack',
    desc: 'Ultra-thin chemical SiO2 interfacial layer (~0.6 nm) is grown, followed by Atomic Layer Deposition (ALD) of high-permittivity HfO2 (k ≈ 25).',
    layers: ['substrate', 'oxide', 'highk'],
    narration: 'An atomically thin interfacial silicon dioxide layer passivates interface traps, capped by hafnium dioxide to eliminate gate tunneling leakage.'
  },
  {
    step: 4,
    title: 'Gate Electrode Patterning',
    desc: 'Polysilicon or workfunction metal is deposited by CVD and etched via reactive ion etching (RIE) to define gate length L.',
    layers: ['substrate', 'oxide', 'highk', 'poly'],
    narration: 'Polysilicon is deposited and dry-etched to form the conductive gate electrode runner directly crossing the channel.'
  },
  {
    step: 5,
    title: 'N-SDE / LDD Extension Implant',
    desc: 'Shallow, low-energy arsenic/phosphorus ion implantation creates self-aligned N-extensions (Nd ≈ 1×10¹⁸ cm⁻³) flanking gate edges.',
    layers: ['substrate', 'oxide', 'highk', 'poly', 'active'],
    narration: 'Lightly doped source and drain extensions are implanted self-aligned to the gate to curb peak lateral electric fields and hot carrier injection.'
  },
  {
    step: 6,
    title: 'Spacers & Heavy N+ S/D Implant',
    desc: 'Si3N4 sidewall spacers are deposited and etched. Heavy N+ implantation (Nd ≈ 1×10²⁰ cm⁻³) forms low-resistance Source and Drain regions.',
    layers: ['substrate', 'oxide', 'highk', 'poly', 'active'],
    narration: 'Dielectric sidewall spacers are formed, masking the deep, heavily doped N-plus source and drain implants.'
  },
  {
    step: 7,
    title: 'ILD & Tungsten Contact Vias',
    desc: 'Interlayer dielectric (ILD SiO2) is deposited, contact holes are etched, and filled with CVD Tungsten (W) with TiN barrier.',
    layers: ['substrate', 'oxide', 'highk', 'poly', 'active', 'contact'],
    narration: 'Tungsten contact plugs are deposited and planarized, providing low-resistance vertical vias to the active and gate regions.'
  },
  {
    step: 8,
    title: 'Metal-1 Interconnect Routing',
    desc: 'First copper/aluminum interconnect layer is deposited and patterned into Source (S), Drain (D), Gate (G), and Body (B) terminals.',
    layers: ['substrate', 'oxide', 'highk', 'poly', 'active', 'contact', 'metal'],
    narration: 'Metal-1 copper runners are patterned, completing the discrete NMOS transistor with terminals for source, drain, gate, and body.'
  }
];

var currentFabStep = FAB_STEPS.length; // Default to fully completed layout
var isFabPlaying = false;
var fabPlayInterval = null;

function applyFabStep(stepNum) {
  currentFabStep = Math.max(1, Math.min(FAB_STEPS.length, stepNum));
  var stepData = FAB_STEPS[currentFabStep - 1];

  LAYER_ORDER.forEach(function(layerKey) {
    if (groups[layerKey]) {
      groups[layerKey].visible = stepData.layers.indexOf(layerKey) !== -1;
    }
  });

  // Update layer checkboxes
  document.querySelectorAll('#layers-body input').forEach(function(cb) {
    var lk = cb.dataset.layer;
    cb.checked = stepData.layers.indexOf(lk) !== -1;
  });

  var stepNumEl = document.getElementById('fab-step-num');
  if (stepNumEl) stepNumEl.textContent = currentFabStep + ' / ' + FAB_STEPS.length;
  var titleEl = document.getElementById('fab-step-title');
  if (titleEl) titleEl.textContent = stepData.title;
  var descEl = document.getElementById('fab-step-desc');
  if (descEl) descEl.textContent = stepData.desc;

  var progressEl = document.getElementById('fab-progress-bar');
  if (progressEl) progressEl.style.width = ((currentFabStep / FAB_STEPS.length) * 100) + '%';
}

function stopBuildAnimation() {
  if (fabPlayInterval) {
    clearInterval(fabPlayInterval);
    fabPlayInterval = null;
  }
  isFabPlaying = false;
  var playBtn = document.getElementById('btn-fab-play');
  if (playBtn) playBtn.innerHTML = '▶ Play Sequence';
  var topbarTourBtn = document.getElementById('btn-build-anim');
  if (topbarTourBtn) {
    topbarTourBtn.classList.remove('active');
    var label = topbarTourBtn.querySelector('.play-label');
    if (label) label.textContent = 'PLAY';
  }
}

function startBuildAnimation() {
  stopBuildAnimation();
  isFabPlaying = true;
  var playBtn = document.getElementById('btn-fab-play');
  if (playBtn) playBtn.innerHTML = '⏸ Pause Sequence';
  var topbarTourBtn = document.getElementById('btn-build-anim');
  if (topbarTourBtn) {
    topbarTourBtn.classList.add('active');
    var label = topbarTourBtn.querySelector('.play-label');
    if (label) label.textContent = 'PAUSE';
  }

  if (currentFabStep >= FAB_STEPS.length) {
    applyFabStep(1);
  }

  fabPlayInterval = setInterval(function() {
    if (currentFabStep < FAB_STEPS.length) {
      applyFabStep(currentFabStep + 1);
    } else {
      stopBuildAnimation();
    }
  }, 2400);
}

function updateBuildAnimation() {
  // Hook for per-frame animation if needed
}

var btnFabPlay = document.getElementById('btn-fab-play');
if (btnFabPlay) {
  btnFabPlay.addEventListener('click', function() {
    if (isFabPlaying) stopBuildAnimation();
    else startBuildAnimation();
  });
}

var btnBuildAnim = document.getElementById('btn-build-anim');
if (btnBuildAnim) {
  btnBuildAnim.addEventListener('click', function() {
    if (isFabPlaying) stopBuildAnimation();
    else startBuildAnimation();
  });
}

var btnFabNext = document.getElementById('btn-fab-next');
if (btnFabNext) {
  btnFabNext.addEventListener('click', function() {
    stopBuildAnimation();
    if (currentFabStep < FAB_STEPS.length) applyFabStep(currentFabStep + 1);
  });
}

var btnFabPrev = document.getElementById('btn-fab-prev');
if (btnFabPrev) {
  btnFabPrev.addEventListener('click', function() {
    stopBuildAnimation();
    if (currentFabStep > 1) applyFabStep(currentFabStep - 1);
  });
}

var btnFabReset = document.getElementById('btn-fab-reset');
if (btnFabReset) {
  btnFabReset.addEventListener('click', function() {
    stopBuildAnimation();
    applyFabStep(FAB_STEPS.length);
  });
}
