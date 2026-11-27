/**
 * main.js - LVDT Simulator Application Controller
 *
 * Manages 3-Stage tab switching (Theory | Sliders | Industry), slider/toggle
 * bindings, Housing Cutaway/Enclosed toggle, per-layer Eye visibility & Info
 * popovers, slider Info popovers, 5-step Guided Tour, and Industry presets.
 */
(function (root) {
  'use strict';

  var PRESETS = {
    aerospace: { xMm: 3.50, vpVrms: 7.0, freqHz: 3000, demodulatorMode: 'demod', includeResidualNull: false },
    turbine: { xMm: -4.20, vpVrms: 5.0, freqHz: 2500, demodulatorMode: 'demod', includeResidualNull: true },
    metrology: { xMm: 0.45, vpVrms: 3.0, freqHz: 5000, demodulatorMode: 'raw', includeResidualNull: true }
  };

  var SLIDER_INFOS = {
    x: {
      badge: 'SLIDER · MECHANICAL INPUT',
      title: 'Core Displacement (x)',
      whatItIs: 'Axial position of the high-permeability Ni-Fe armature relative to the magnetic center (null) inside the bobbin bore, spanning −10.0 mm to +10.0 mm.',
      whenIncreased: 'Moving toward +10 mm shifts magnetic flux into Secondary S₂ (VS2 > VS1), flipping output phase to 180°. Beyond +5 mm, fringe leakage triggers smooth tanh saturation roll-off.',
      whenDecreased: 'Moving toward −10 mm shifts magnetic flux into Secondary S₁ (VS1 > VS2) with 0° in-phase output. Near 0.00 mm, both secondaries balance cleanly to magnetic null.'
    },
    vp: {
      badge: 'SLIDER · PRIMARY EXCITATION',
      title: 'Excitation Amplitude (Vp)',
      whatItIs: 'RMS AC sinusoidal voltage driving the center Primary Coil (P), adjustable from 1.0 Vrms to 10.0 Vrms.',
      whenIncreased: 'Proportionally scales magnetic flux density, induced secondary voltages (VS1, VS2), and differential output Vout (mV/mm), improving signal-to-noise ratio.',
      whenDecreased: 'Linearly reduces both secondary voltages and Vout while lowering primary power dissipation and coil self-heating.'
    },
    freq: {
      badge: 'SLIDER · CARRIER FREQUENCY',
      title: 'Carrier Frequency (f)',
      whatItIs: 'Sinusoidal excitation frequency applied to the Primary Coil (50 Hz to 10 kHz), typically chosen at least 10× higher than the mechanical motion bandwidth.',
      whenIncreased: 'Improves inductive coupling above the 120 Hz corner and raises dynamic tracking bandwidth; near 10 kHz, core eddy currents and stray capacitance gently roll off amplitude.',
      whenDecreased: 'Below ~200 Hz, primary winding resistance dominates inductive reactance, reducing coupling gain H(f) and requiring larger magnetic cores.'
    },
    explode: {
      badge: 'SLIDER · CAD INSPECTION',
      title: 'Exploded CAD View',
      whatItIs: 'Separates the seven coaxial LVDT sub-assemblies radially and axially (0% assembled to 100% fully separated) without altering electrical physics.',
      whenIncreased: 'Lifts the outer housing, drops the PEEK bobbin, spreads S₁/P/S₂ coils axially, and separates the Ni-Fe core from the push-rod for unobstructed inspection.',
      whenDecreased: 'Re-seats all seven mechanical components back into their operational coaxial alignment inside the transducer bore.'
    }
  };

  var EYE_OPEN_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var EYE_OFF_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
  var INFO_SMALL_SVG = '<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><line x1="7" y1="6.2" x2="7" y2="11"/><circle cx="7" cy="3.2" r="1.1" fill="currentColor" stroke="none"/></svg>';

  var state = {
    activeTab: 'sliders',
    xMm: 0.0,
    vpVrms: 5.0,
    freqHz: 2500,
    explodePct: 0,
    housingView: 'cutaway',
    demodulatorMode: 'raw',
    includeResidualNull: false,
    showFlux: true,
    selectedLayer: null,
    layerVisible: {
      housing: true,
      bobbin: true,
      primary: true,
      secondary1: true,
      secondary2: true,
      core: true,
      pushrod: true
    },
    tourActive: false,
    tourIndex: 0,
    savedBeforeTour: null
  };

  var simResult = null;
  var lastFrameMs = null;
  var els = {};

  function cacheElements() {
    els.tabBtns = document.querySelectorAll('#tab-bar .stage-tab-btn');
    els.views = {
      theory: document.getElementById('view-theory'),
      sliders: document.getElementById('view-sliders'),
      industry: document.getElementById('view-industry')
    };
    els.zoneBadge = document.getElementById('zone-badge');
    els.btnTour = document.getElementById('btn-tour');
    els.btnStartTourLeft = document.getElementById('btn-start-tour-left');
    els.btnReset = document.getElementById('btn-reset');
    els.btnGoSlidersChallenge = document.getElementById('btn-go-sliders-challenge');

    // Left drawer sliders & toggles
    els.sliderX = document.getElementById('slider-x');
    els.sliderVp = document.getElementById('slider-vp');
    els.sliderFreq = document.getElementById('slider-freq');
    els.sliderExplode = document.getElementById('slider-explode');
    els.valX = document.getElementById('val-x');
    els.valVp = document.getElementById('val-vp');
    els.valFreq = document.getElementById('val-freq');
    els.valExplode = document.getElementById('val-explode');
    els.btnNullZero = document.getElementById('btn-null-zero');
    els.housingViewBtns = document.querySelectorAll('#seg-housing-view .seg-opt');
    els.demodBtns = document.querySelectorAll('#seg-demod .seg-opt');
    els.toggleNull = document.getElementById('toggle-null');
    els.toggleFlux = document.getElementById('toggle-flux');
    els.layerRows = document.querySelectorAll('#layer-btn-grid .layer-row');
    els.btnClearLayer = document.getElementById('btn-clear-layer');

    // Drawers & toggles
    els.hudLeft = document.getElementById('hud-left');
    els.hudRight = document.getElementById('hud-right');
    els.collapseLeft = document.getElementById('collapse-left');
    els.collapseRight = document.getElementById('collapse-right');
    els.reopenLeft = document.getElementById('drawer-toggle-left');
    els.reopenRight = document.getElementById('drawer-toggle-right');

    // Callout & Tour banner
    els.callout = document.getElementById('part-callout');
    els.calloutTag = document.getElementById('callout-tag');
    els.calloutName = document.getElementById('callout-name');
    els.calloutDesc = document.getElementById('callout-desc');
    els.calloutClose = document.getElementById('callout-close');

    els.tourBanner = document.getElementById('tour-banner');
    els.tourStepBadge = document.getElementById('tour-step-badge');
    els.tourTitle = document.getElementById('tour-title');
    els.tourSubtitle = document.getElementById('tour-subtitle');
    els.tourPrev = document.getElementById('tour-prev');
    els.tourNext = document.getElementById('tour-next');
    els.tourExit = document.getElementById('tour-exit');

    // Unified Info Popover Modal
    els.infoBackdrop = document.getElementById('info-popover-backdrop');
    els.infoCard = document.getElementById('info-popover-card');
    els.infoBadge = document.getElementById('info-popover-badge');
    els.infoTitle = document.getElementById('info-popover-title');
    els.infoBody = document.getElementById('info-popover-body');
    els.infoClose = document.getElementById('info-popover-close');

    // Right drawer KPIs & Industry Challenges
    els.kpiVs1 = document.getElementById('kpi-vs1');
    els.kpiVs2 = document.getElementById('kpi-vs2');
    els.kpiVout = document.getElementById('kpi-vout');
    els.kpiPhase = document.getElementById('kpi-phase');
    els.kpiSens = document.getElementById('kpi-sens');
    els.kpiLin = document.getElementById('kpi-lin');
    els.challengeProgress = document.getElementById('challenge-progress');
    els.challengeList = document.getElementById('challenge-list');
  }

  function renderLayerRowIcons() {
    els.layerRows.forEach(function (row) {
      var lid = row.getAttribute('data-layer');
      var vis = state.layerVisible[lid] !== false;
      row.classList.toggle('is-hidden', !vis);
      row.classList.toggle('active', state.selectedLayer === lid);

      var visBtn = row.querySelector('[data-action="visibility"]');
      if (visBtn) {
        visBtn.innerHTML = vis ? EYE_OPEN_SVG : EYE_OFF_SVG;
        visBtn.classList.toggle('off', !vis);
        visBtn.setAttribute('aria-pressed', String(!vis));
      }
      var infoBtn = row.querySelector('[data-action="info"]');
      if (infoBtn && !infoBtn.innerHTML) {
        infoBtn.innerHTML = INFO_SMALL_SVG;
      }
    });
  }

  function updateSliderFill(input) {
    if (!input) return;
    var min = Number(input.min);
    var max = Number(input.max);
    var val = Number(input.value);
    var pct = ((val - min) / (max - min)) * 100;
    input.style.setProperty('--pct', pct.toFixed(1) + '%');
  }

  function syncControlsToUI() {
    if (els.sliderX) {
      els.sliderX.value = state.xMm;
      updateSliderFill(els.sliderX);
    }
    if (els.sliderVp) {
      els.sliderVp.value = state.vpVrms;
      updateSliderFill(els.sliderVp);
    }
    if (els.sliderFreq) {
      els.sliderFreq.value = state.freqHz;
      updateSliderFill(els.sliderFreq);
    }
    if (els.sliderExplode) {
      els.sliderExplode.value = state.explodePct;
      updateSliderFill(els.sliderExplode);
    }

    if (els.valX) els.valX.textContent = (state.xMm > 0 ? '+' : '') + state.xMm.toFixed(2) + ' mm';
    if (els.valVp) els.valVp.textContent = state.vpVrms.toFixed(1) + ' Vrms';
    if (els.valFreq) els.valFreq.textContent = Math.round(state.freqHz) + ' Hz';
    if (els.valExplode) els.valExplode.textContent = Math.round(state.explodePct) + '%';

    els.housingViewBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-housing') === state.housingView);
    });
    els.demodBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-demod') === state.demodulatorMode);
    });
    if (els.toggleNull) els.toggleNull.checked = state.includeResidualNull;
    if (els.toggleFlux) els.toggleFlux.checked = state.showFlux;
    renderLayerRowIcons();
  }

  function renderTelemetryAndChallenges() {
    if (!simResult) return;

    if (els.kpiVs1) els.kpiVs1.textContent = simResult.vS1.toFixed(2) + ' V';
    if (els.kpiVs2) els.kpiVs2.textContent = simResult.vS2.toFixed(2) + ' V';

    if (els.kpiVout) {
      if (simResult.demodulatorMode === 'demod') {
        var dc = simResult.vOutDemodDc;
        els.kpiVout.textContent = (dc >= 0 ? '+' : '') + dc.toFixed(2) + ' Vdc';
      } else {
        els.kpiVout.textContent = simResult.vOutRms.toFixed(2) + ' V';
      }
    }

    if (els.kpiPhase) els.kpiPhase.textContent = simResult.phaseDeg.toFixed(1) + '°';
    if (els.kpiSens) els.kpiSens.textContent = simResult.sensitivityMvVmm.toFixed(1);
    if (els.kpiLin) els.kpiLin.textContent = simResult.linearityErrorPct.toFixed(2) + '%';

    if (els.zoneBadge) {
      els.zoneBadge.textContent = simResult.zoneLabel;
      els.zoneBadge.className = 'zone-badge zone-' + simResult.zoneStatus;
    }

    if (root.LVDTChallenges && els.challengeList) {
      var evalRes = root.LVDTChallenges.evaluate(simResult);
      if (els.challengeProgress) {
        els.challengeProgress.textContent = evalRes.completedCount + ' / ' + evalRes.totalCount + ' DONE';
      }
      var html = '';
      for (var i = 0; i < evalRes.results.length; i++) {
        var ch = evalRes.results[i];
        var cls = 'challenge-item' + (ch.completed ? ' passed' : '');
        var badge = ch.passedNow ? 'PASS NOW' : (ch.completed ? 'COMPLETED' : 'PENDING');
        html += '<div class="' + cls + '">' +
          '<div class="challenge-top">' +
            '<span>' + ch.step + '. ' + ch.title + '</span>' +
            '<span class="challenge-status">' + badge + '</span>' +
          '</div>' +
          '<div class="challenge-prompt">' + ch.prompt + '</div>' +
          '<div class="challenge-live">' + ch.liveText + '</div>' +
        '</div>';
      }
      els.challengeList.innerHTML = html;
    }
  }

  function recomputeSimulation() {
    if (!root.LVDTPhysics) return;
    simResult = root.LVDTPhysics.computeState({
      xMm: state.xMm,
      vpVrms: state.vpVrms,
      freqHz: state.freqHz,
      demodulatorMode: state.demodulatorMode,
      includeResidualNull: state.includeResidualNull
    });
    if (root.LVDTScene) {
      root.LVDTScene.updateState(simResult);
    }
    syncControlsToUI();
    renderTelemetryAndChallenges();
  }

  function selectLayer(layerId) {
    state.selectedLayer = layerId || null;
    if (root.LVDTScene) {
      root.LVDTScene.highlightLayer(state.selectedLayer);
    }
    renderLayerRowIcons();

    if (state.selectedLayer && root.LVDTScene && root.LVDTScene.PARTS_INFO[state.selectedLayer]) {
      var info = root.LVDTScene.PARTS_INFO[state.selectedLayer];
      if (els.calloutTag) els.calloutTag.textContent = info.tag;
      if (els.calloutName) els.calloutName.textContent = info.name;
      if (els.calloutDesc) els.calloutDesc.textContent = info.desc;
      if (els.callout) els.callout.classList.add('visible');
    } else if (els.callout) {
      els.callout.classList.remove('visible');
    }
  }

  function toggleLayerVisibility(layerId) {
    if (!layerId) return;
    var nextVis = !(state.layerVisible[layerId] !== false);
    state.layerVisible[layerId] = nextVis;
    if (root.LVDTScene) {
      root.LVDTScene.setLayerVisible(layerId, nextVis);
    }
    if (!nextVis && state.selectedLayer === layerId) {
      selectLayer(null);
    }
    renderLayerRowIcons();
  }

  function setHousingView(mode) {
    state.housingView = mode === 'enclosed' ? 'enclosed' : 'cutaway';
    if (root.LVDTScene) {
      root.LVDTScene.setHousingView(state.housingView);
    }
    syncControlsToUI();
  }

  function openInfoPopover(badge, title, blocksHtml) {
    if (!els.infoBackdrop) return;
    if (els.infoBadge) els.infoBadge.textContent = badge;
    if (els.infoTitle) els.infoTitle.textContent = title;
    if (els.infoBody) els.infoBody.innerHTML = blocksHtml;
    els.infoBackdrop.classList.add('visible');
  }

  function closeInfoPopover() {
    if (els.infoBackdrop) els.infoBackdrop.classList.remove('visible');
  }

  function openSliderInfo(key) {
    var d = SLIDER_INFOS[key];
    if (!d) return;
    var html =
      '<div class="info-block">' +
        '<span class="info-block-lbl" style="color:var(--accent-cyan);">What it is</span>' +
        '<p class="info-block-text">' + d.whatItIs + '</p>' +
      '</div>' +
      '<div class="info-block">' +
        '<span class="info-block-lbl" style="color:var(--accent-emerald);">When increased</span>' +
        '<p class="info-block-text">' + d.whenIncreased + '</p>' +
      '</div>' +
      '<div class="info-block">' +
        '<span class="info-block-lbl" style="color:var(--accent-gold);">When decreased</span>' +
        '<p class="info-block-text">' + d.whenDecreased + '</p>' +
      '</div>';
    openInfoPopover(d.badge, d.title, html);
  }

  function openLayerInfo(layerId) {
    if (!root.LVDTScene || !root.LVDTScene.PARTS_INFO[layerId]) return;
    var p = root.LVDTScene.PARTS_INFO[layerId];
    var html =
      '<div class="info-block">' +
        '<span class="info-block-lbl" style="color:var(--accent-gold);">Material</span>' +
        '<p class="info-block-text">' + p.material + '</p>' +
      '</div>' +
      '<div class="info-block">' +
        '<span class="info-block-lbl" style="color:var(--accent-cyan);">Physical Role in LVDT</span>' +
        '<p class="info-block-text">' + p.desc + '</p>' +
      '</div>';
    openInfoPopover('3D CAD COMPONENT · ' + p.tag, p.name, html);
  }

  function switchTab(tabId) {
    state.activeTab = tabId;
    els.tabBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    Object.keys(els.views).forEach(function (key) {
      if (els.views[key]) {
        els.views[key].classList.toggle('active', key === tabId);
      }
    });
    if (tabId === 'sliders') {
      setTimeout(function () {
        if (root.LVDTScene) root.LVDTScene.resize();
        if (root.LVDTPlots) root.LVDTPlots.resize();
      }, 40);
    } else if (tabId === 'industry') {
      renderTelemetryAndChallenges();
    }
  }

  function setDrawerCollapsed(side, collapsed) {
    if (side === 'left' && els.hudLeft) {
      els.hudLeft.classList.toggle('collapsed', collapsed);
      if (els.reopenLeft) els.reopenLeft.style.display = collapsed ? 'inline-flex' : 'none';
    } else if (side === 'right' && els.hudRight) {
      els.hudRight.classList.toggle('collapsed', collapsed);
      if (els.reopenRight) els.reopenRight.style.display = collapsed ? 'inline-flex' : 'none';
    }
  }

  function applyTourStepIndex(idx) {
    if (!root.LVDTScene) return;
    var steps = root.LVDTScene.TOUR_STEPS;
    state.tourIndex = (idx + steps.length) % steps.length;
    var step = root.LVDTScene.applyTourStep(state.tourIndex);
    if (!step) return;

    setHousingView('cutaway');
    state.xMm = step.xMm;
    state.explodePct = Math.round((step.explode || 0) * 100);
    recomputeSimulation();
    selectLayer(step.highlightLayer || null);

    if (els.tourStepBadge) els.tourStepBadge.textContent = 'STEP ' + (state.tourIndex + 1) + ' / ' + steps.length;
    if (els.tourTitle) els.tourTitle.textContent = step.title;
    if (els.tourSubtitle) els.tourSubtitle.textContent = step.subtitle;
    if (els.tourBanner) els.tourBanner.classList.add('visible');
  }

  function startTour() {
    switchTab('sliders');
    if (!state.tourActive) {
      state.savedBeforeTour = {
        xMm: state.xMm,
        explodePct: state.explodePct,
        housingView: state.housingView,
        selectedLayer: state.selectedLayer
      };
    }
    state.tourActive = true;
    applyTourStepIndex(0);
  }

  function stopTour(restorePrev) {
    if (!state.tourActive) return;
    state.tourActive = false;
    if (els.tourBanner) els.tourBanner.classList.remove('visible');
    if (restorePrev && state.savedBeforeTour) {
      state.xMm = state.savedBeforeTour.xMm;
      state.explodePct = state.savedBeforeTour.explodePct;
      setHousingView(state.savedBeforeTour.housingView || 'cutaway');
      if (root.LVDTScene) root.LVDTScene.setExplode(state.explodePct / 100);
      recomputeSimulation();
      selectLayer(state.savedBeforeTour.selectedLayer);
    }
    state.savedBeforeTour = null;
    if (root.LVDTScene) root.LVDTScene.resetCamera();
  }

  function applyPreset(presetKey) {
    var p = PRESETS[presetKey];
    if (!p) return;
    stopTour(false);
    state.xMm = p.xMm;
    state.vpVrms = p.vpVrms;
    state.freqHz = p.freqHz;
    state.demodulatorMode = p.demodulatorMode;
    state.includeResidualNull = p.includeResidualNull;
    switchTab('sliders');
    recomputeSimulation();
  }

  function resetAll() {
    stopTour(false);
    state.xMm = 0.0;
    state.vpVrms = 5.0;
    state.freqHz = 2500;
    state.explodePct = 0;
    state.housingView = 'cutaway';
    state.demodulatorMode = 'raw';
    state.includeResidualNull = false;
    state.showFlux = true;
    Object.keys(state.layerVisible).forEach(function (lid) {
      state.layerVisible[lid] = true;
      if (root.LVDTScene) root.LVDTScene.setLayerVisible(lid, true);
    });
    if (root.LVDTScene) {
      root.LVDTScene.setExplode(0);
      root.LVDTScene.setHousingView('cutaway');
      root.LVDTScene.setFluxVisible(true);
      root.LVDTScene.resetCamera();
    }
    selectLayer(null);
    recomputeSimulation();
  }

  function bindEvents() {
    els.tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(btn.getAttribute('data-tab'));
      });
    });

    if (els.btnGoSlidersChallenge) {
      els.btnGoSlidersChallenge.addEventListener('click', function () {
        switchTab('sliders');
      });
    }

    if (els.sliderX) {
      els.sliderX.addEventListener('input', function () {
        state.xMm = Number(els.sliderX.value);
        recomputeSimulation();
      });
    }
    if (els.sliderVp) {
      els.sliderVp.addEventListener('input', function () {
        state.vpVrms = Number(els.sliderVp.value);
        recomputeSimulation();
      });
    }
    if (els.sliderFreq) {
      els.sliderFreq.addEventListener('input', function () {
        state.freqHz = Number(els.sliderFreq.value);
        recomputeSimulation();
      });
    }
    if (els.sliderExplode) {
      els.sliderExplode.addEventListener('input', function () {
        state.explodePct = Number(els.sliderExplode.value);
        if (root.LVDTScene) root.LVDTScene.setExplode(state.explodePct / 100.0);
        syncControlsToUI();
      });
    }
    if (els.btnNullZero) {
      els.btnNullZero.addEventListener('click', function () {
        state.xMm = 0.0;
        recomputeSimulation();
      });
    }

    els.housingViewBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setHousingView(btn.getAttribute('data-housing'));
      });
    });

    els.demodBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.demodulatorMode = btn.getAttribute('data-demod');
        recomputeSimulation();
      });
    });

    if (els.toggleNull) {
      els.toggleNull.addEventListener('change', function () {
        state.includeResidualNull = Boolean(els.toggleNull.checked);
        recomputeSimulation();
      });
    }
    if (els.toggleFlux) {
      els.toggleFlux.addEventListener('change', function () {
        state.showFlux = Boolean(els.toggleFlux.checked);
        if (root.LVDTScene) root.LVDTScene.setFluxVisible(state.showFlux);
      });
    }

    // Layer rows: Select, Eye Visibility, Info
    els.layerRows.forEach(function (row) {
      var lid = row.getAttribute('data-layer');
      var selBtn = row.querySelector('[data-action="select"]');
      var visBtn = row.querySelector('[data-action="visibility"]');
      var infoBtn = row.querySelector('[data-action="info"]');
      if (selBtn) {
        selBtn.addEventListener('click', function () {
          selectLayer(state.selectedLayer === lid ? null : lid);
        });
      }
      if (visBtn) {
        visBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          toggleLayerVisibility(lid);
        });
      }
      if (infoBtn) {
        infoBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openLayerInfo(lid);
        });
      }
    });

    // Slider (i) buttons
    document.querySelectorAll('[data-slider-info]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        openSliderInfo(btn.getAttribute('data-slider-info'));
      });
    });

    // Popover close handlers (backdrop outside click + close button)
    if (els.infoClose) {
      els.infoClose.addEventListener('click', closeInfoPopover);
    }
    if (els.infoBackdrop) {
      els.infoBackdrop.addEventListener('click', function (e) {
        if (e.target === els.infoBackdrop) closeInfoPopover();
      });
    }

    if (els.btnClearLayer) {
      els.btnClearLayer.addEventListener('click', function () { selectLayer(null); });
    }
    if (els.calloutClose) {
      els.calloutClose.addEventListener('click', function () { selectLayer(null); });
    }

    if (els.collapseLeft) els.collapseLeft.addEventListener('click', function () { setDrawerCollapsed('left', true); });
    if (els.collapseRight) els.collapseRight.addEventListener('click', function () { setDrawerCollapsed('right', true); });
    if (els.reopenLeft) els.reopenLeft.addEventListener('click', function () { setDrawerCollapsed('left', false); });
    if (els.reopenRight) els.reopenRight.addEventListener('click', function () { setDrawerCollapsed('right', false); });

    if (els.btnTour) els.btnTour.addEventListener('click', function () {
      if (state.tourActive) stopTour(true);
      else startTour();
    });
    if (els.btnStartTourLeft) els.btnStartTourLeft.addEventListener('click', startTour);
    if (els.tourPrev) els.tourPrev.addEventListener('click', function () { applyTourStepIndex(state.tourIndex - 1); });
    if (els.tourNext) els.tourNext.addEventListener('click', function () { applyTourStepIndex(state.tourIndex + 1); });
    if (els.tourExit) els.tourExit.addEventListener('click', function () { stopTour(true); });
    if (els.btnReset) els.btnReset.addEventListener('click', resetAll);

    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPreset(btn.getAttribute('data-preset'));
      });
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (els.infoBackdrop && els.infoBackdrop.classList.contains('visible')) {
          closeInfoPopover();
        } else if (state.tourActive) {
          stopTour(true);
        } else if (state.selectedLayer) {
          selectLayer(null);
        }
      }
    });
  }

  function animate(nowMs) {
    if (lastFrameMs === null) lastFrameMs = nowMs;
    var dtSec = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000.0));
    lastFrameMs = nowMs;

    if (state.activeTab === 'sliders') {
      if (root.LVDTScene) root.LVDTScene.tick(dtSec);
      if (root.LVDTPlots && simResult) root.LVDTPlots.render(simResult, dtSec);
    }

    requestAnimationFrame(animate);
  }

  function init() {
    cacheElements();

    var canvasHost = document.getElementById('canvas-host');
    if (root.LVDTScene && canvasHost) {
      root.LVDTScene.init(canvasHost, {
        onSelectLayer: function (layerId) {
          selectLayer(layerId === state.selectedLayer ? null : layerId);
        }
      });
    }

    if (root.LVDTPlots) {
      root.LVDTPlots.init(
        document.getElementById('canvas-osc'),
        document.getElementById('canvas-transfer')
      );
    }

    if (root.ViewerTheme) {
      root.ViewerTheme.onThemeChange(function (theme) {
        if (root.LVDTScene) root.LVDTScene.applySceneTheme(theme);
        if (root.LVDTPlots && simResult) root.LVDTPlots.render(simResult, 0);
      });
    }

    bindEvents();
    recomputeSimulation();
    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  root.LVDTApp = {
    switchTab: switchTab,
    applyPreset: applyPreset,
    startTour: startTour,
    stopTour: stopTour,
    selectLayer: selectLayer,
    toggleLayerVisibility: toggleLayerVisibility,
    setHousingView: setHousingView,
    openSliderInfo: openSliderInfo,
    openLayerInfo: openLayerInfo,
    closeInfoPopover: closeInfoPopover,
    resetAll: resetAll,
    getState: function () { return Object.assign({}, state); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
