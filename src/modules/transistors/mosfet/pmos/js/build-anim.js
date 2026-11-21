/**
 * build-anim.js - PMOS CAD Viewer
 * Step-by-step IC fabrication process sequence animation with audio narration support:
 * 1. P-Substrate bulk silicon wafer preparation
 * 2. Deep N-Well tub ion implantation & thermal drive-in
 * 3. Active area lithography & STI trench isolation
 * 4. High-k gate dielectric stack (Interfacial SiO2 + High-k HfO2 ALD)
 * 5. Polysilicon / Metal gate deposition & anisotropic etching
 * 6. Low-energy self-aligned P-SDE / LDD ion implantation
 * 7. Gate spacer deposition & heavy P+ Source/Drain implant + N+ Well tap
 * 8. Interlayer Dielectric (ILD) & Tungsten contact via fill
 * 9. Metal-1 metallization & CMP planarization
 */

var FAB_STEPS = [
  {
    step: 1,
    title: 'P-Substrate Preparation',
    desc: 'Starts with a p-type single-crystal silicon wafer (Na ≈ 1×10¹⁵ cm⁻³) with (100) crystal orientation.',
    layers: ['substrate'],
    narration: 'We begin with a single-crystal P-type silicon wafer that provides mechanical support and the base substrate.'
  },
  {
    step: 2,
    title: 'N-Well Tub Implantation',
    desc: 'Phosphorus retrograde ion implantation and high-temperature thermal drive-in form the deep N-Well tub (Nd ≈ 1×10¹⁷ cm⁻³).',
    layers: ['substrate', 'well'],
    narration: 'A deep N-well tub is formed by phosphorus implantation and drive-in diffusion to isolate the PMOS transistor from the p-substrate.'
  },
  {
    step: 3,
    title: 'High-k Gate Dielectric Stack',
    desc: 'Ultra-thin chemical SiO2 interfacial layer (~0.6 nm) is grown, followed by Atomic Layer Deposition (ALD) of high-permittivity HfO2 (k ≈ 25).',
    layers: ['substrate', 'well', 'oxide', 'highk'],
    narration: 'An interfacial oxide and high-k hafnium dioxide dielectric stack are deposited to enable strong capacitive coupling without gate leakage.'
  },
  {
    step: 4,
    title: 'Gate Electrode Patterning',
    desc: 'Workfunction-tuned metal gate or polysilicon is deposited and dry-etched, sized with Wp ≈ 2x Wn to compensate for hole mobility.',
    layers: ['substrate', 'well', 'oxide', 'highk', 'poly'],
    narration: 'The gate electrode is patterned across the wide N-well channel, sized wider than NMOS to account for lower hole mobility.'
  },
  {
    step: 5,
    title: 'P-SDE / LDD Extension Implant',
    desc: 'Shallow, low-energy boron (BF2) ion implantation forms self-aligned P-extensions (Na ≈ 1×10¹⁸ cm⁻³) flanking gate edges.',
    layers: ['substrate', 'well', 'oxide', 'highk', 'poly', 'active'],
    narration: 'Shallow lightly doped extensions are implanted self-aligned to the gate to curb peak electric fields and short-channel effects.'
  },
  {
    step: 6,
    title: 'Spacers & Heavy P+ S/D + Well Tap',
    desc: 'Si3N4 sidewall spacers mask the heavy P+ Source/Drain boron implant (Na ≈ 1×10²⁰ cm⁻³) and N+ Well tap implant.',
    layers: ['substrate', 'well', 'oxide', 'highk', 'poly', 'active'],
    narration: 'Dielectric spacers mask deep P-plus source and drain implants, alongside the N-plus ohmic well tap.'
  },
  {
    step: 7,
    title: 'ILD & Tungsten Contact Vias',
    desc: 'Interlayer dielectric (ILD SiO2) is deposited, contact vias are etched, and filled with CVD Tungsten (W) with TiN barrier.',
    layers: ['substrate', 'well', 'oxide', 'highk', 'poly', 'active', 'contact'],
    narration: 'Tungsten contact plugs are filled and polished, creating low-resistance vertical connections.'
  },
  {
    step: 8,
    title: 'Metal-1 Interconnect Routing',
    desc: 'First copper/aluminum interconnect layer is patterned into Source (S/VDD), Drain (D/OUT), Gate (G), and Well (B/VDD) terminals.',
    layers: ['substrate', 'well', 'oxide', 'highk', 'poly', 'active', 'contact', 'metal'],
    narration: 'Metal-1 copper runners are deposited, completing the PMOS transistor with terminals for source, drain, gate, and N-well body.'
  }
];

var currentFabStep = FAB_STEPS.length;
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
}

function startBuildAnimation() {
  stopBuildAnimation();
  isFabPlaying = true;
  var playBtn = document.getElementById('btn-fab-play');
  if (playBtn) playBtn.innerHTML = '⏸ Pause Sequence';

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
  // Hook for per-frame animation
}

var btnFabPlay = document.getElementById('btn-fab-play');
if (btnFabPlay) {
  btnFabPlay.addEventListener('click', function() {
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
