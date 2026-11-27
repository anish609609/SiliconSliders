/**
 * guided-tour.js - Shared Interactive UI Onboarding Tour for Solid-State CAD Modules
 * Zero-build IIFE global exposing window.SiliconGuidedTour (100% file:// compatible).
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'siliconsliders_cad_tour_seen';

  function queryFirst(selectors) {
    if (!selectors) return null;
    var list = Array.isArray(selectors) ? selectors : [selectors];
    for (var i = 0; i < list.length; i++) {
      var el = document.querySelector(list[i]);
      if (el) return el;
    }
    return null;
  }

  function isElementVisible(el) {
    if (!el) return false;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function ensureLayoutMode() {
    var layoutBtn = queryFirst([
      '#mode-seg button[data-mode="layout"]',
      '#btn-view-layout'
    ]);
    if (layoutBtn && !layoutBtn.classList.contains('active')) {
      layoutBtn.click();
    } else if (typeof root.setViewMode === 'function') {
      try { root.setViewMode('layout'); } catch (_) {}
    }
  }

  function ensureSidebarExpanded() {
    var wb = document.getElementById('left-workbench');
    if (wb && wb.classList.contains('collapsed')) {
      var toggle = document.getElementById('workbench-toggle') || document.getElementById('left-toggle');
      if (toggle) toggle.click();
      else wb.classList.remove('collapsed');
    }
  }

  function activateWorkbenchTab(tabName) {
    ensureLayoutMode();
    ensureSidebarExpanded();
    var tabBtn = document.getElementById('wb-tab-' + tabName) ||
                 document.querySelector('.wb-tab-btn[data-tab="' + tabName + '"]');
    if (tabBtn && !tabBtn.classList.contains('active')) {
      tabBtn.click();
    } else if (typeof root.switchWorkbenchTab === 'function') {
      try { root.switchWorkbenchTab(tabName); } catch (_) {}
    }
  }

  function scrollTargetIntoWorkbench(targetEl) {
    var body = document.getElementById('wb-body');
    if (!body || !targetEl) return;
    if (body.contains(targetEl)) {
      targetEl.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  }

  var DEFAULT_STEPS = [
    {
      id: 'theory',
      title: '1. Start with Device Theory',
      description: 'Open THEORY anytime to review semiconductor physics, energy band diagrams, and governing equations before adjusting bias.',
      selectors: ['#mode-seg button[data-mode="theory"]', '#btn-view-theory'],
      beforeEnter: function () {
        ensureLayoutMode();
      }
    },
    {
      id: 'bias-sliders',
      title: '2. Bias Sliders & Live Curve',
      description: 'Drag the voltage, doping, or input sliders—or scrub directly on the characteristic curve—to update the 3D device and operating regime in real time.',
      selectors: ['#wb-physics-section', '#wb-pane-controls .wb-bias-controls'],
      beforeEnter: function () {
        activateWorkbenchTab('controls');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      }
    },
    {
      id: 'view-controls',
      title: '3. Explode Stack & Section Scrub',
      description: 'Peel apart the 3D fabrication stack along X/Y/Z with Explode Layers, or slice open internal junctions using Section Scrub.',
      selectors: ['#wb-view-controls-section', '#view-controls-body'],
      beforeEnter: function () {
        activateWorkbenchTab('controls');
        var bodyEl = document.getElementById('view-controls-body');
        if (bodyEl && bodyEl.classList.contains('hidden')) {
          var head = document.querySelector('#wb-view-controls-section .wb-accordion-head');
          if (head) head.click();
          else bodyEl.classList.remove('hidden');
        }
        var sec = document.getElementById('wb-view-controls-section');
        scrollTargetIntoWorkbench(sec);
      }
    },
    {
      id: 'layers',
      title: '4. Toggle & Isolate 3D Layers',
      description: 'Switch to Layers to turn individual substrate, oxide, gate, contact, or metal layers on and off to reveal buried structures.',
      selectors: ['#layers-body', '#wb-pane-layers'],
      beforeEnter: function () {
        activateWorkbenchTab('layers');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      }
    },
    {
      id: 'inspect',
      title: '5. Inspect Materials & Structure',
      description: 'Use Inspect to view doping concentrations, materials, dimensions, and the full Architecture Tree of every 3D component.',
      selectors: ['#wb-pane-inspect', '#inspector-body'],
      beforeEnter: function () {
        activateWorkbenchTab('inspect');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      }
    },
    {
      id: 'schematic',
      title: '6. Circuit Schematic View',
      description: 'Switch to SCHEMATIC anytime to compare the 3D physical silicon layout with its circuit-level symbol and live node voltages.',
      selectors: ['#mode-seg button[data-mode="schematic"]', '#btn-view-schematic'],
      beforeEnter: function () {
        activateWorkbenchTab('controls');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      }
    }
  ];

  // Tour Runtime State
  var activeSteps = [];
  var currentIdx = 0;
  var isTourRunning = false;
  var overlayEl = null;
  var spotlightEl = null;
  var popoverEl = null;
  var rafId = null;

  function resolveActiveSteps() {
    var cfg = root.SILICON_TOUR_CONFIG || {};
    var rawSteps = Array.isArray(cfg.steps) && cfg.steps.length ? cfg.steps : DEFAULT_STEPS;
    var selectorMap = cfg.selectors || {};
    var resolved = [];

    for (var i = 0; i < rawSteps.length; i++) {
      var s = rawSteps[i];
      var sels = selectorMap[s.id] || s.selectors;
      var target = queryFirst(sels);
      if (target) {
        resolved.push({
          id: s.id,
          title: s.title,
          description: s.description,
          selectors: sels,
          beforeEnter: s.beforeEnter
        });
      }
    }
    return resolved;
  }

  function createDomIfNeeded() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'ss-tour-overlay';
    overlayEl.className = 'ss-tour-overlay';

    spotlightEl = document.createElement('div');
    spotlightEl.id = 'ss-tour-spotlight';
    spotlightEl.className = 'ss-tour-spotlight';

    popoverEl = document.createElement('div');
    popoverEl.id = 'ss-tour-popover';
    popoverEl.className = 'ss-tour-popover';
    popoverEl.setAttribute('role', 'dialog');
    popoverEl.setAttribute('aria-modal', 'true');
    popoverEl.setAttribute('aria-labelledby', 'ss-tour-title');

    popoverEl.innerHTML =
      '<div class="ss-tour-head">' +
        '<span class="ss-tour-step" id="ss-tour-step">Step 1 of 6</span>' +
        '<button type="button" class="ss-tour-skip" id="ss-tour-skip">Skip</button>' +
      '</div>' +
      '<h3 class="ss-tour-title" id="ss-tour-title"></h3>' +
      '<p class="ss-tour-desc" id="ss-tour-desc"></p>' +
      '<div class="ss-tour-footer">' +
        '<div class="ss-tour-dots" id="ss-tour-dots"></div>' +
        '<div class="ss-tour-actions">' +
          '<button type="button" class="ss-tour-btn" id="ss-tour-back">Back</button>' +
          '<button type="button" class="ss-tour-btn ss-tour-btn-primary" id="ss-tour-next">Next</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlayEl);
    document.body.appendChild(spotlightEl);
    document.body.appendChild(popoverEl);

    document.getElementById('ss-tour-skip').addEventListener('click', function () {
      stop(true);
    });
    document.getElementById('ss-tour-back').addEventListener('click', prev);
    document.getElementById('ss-tour-next').addEventListener('click', next);
  }

  function positionSpotlightAndPopover(targetEl) {
    if (!spotlightEl || !popoverEl || !targetEl) return;
    var raw = targetEl.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var pad = 6;

    // Clamp spotlight inside visible viewport so tall panels stay clean
    var left = Math.max(4, raw.left - pad);
    var top = Math.max(4, raw.top - pad);
    var right = Math.min(vw - 4, raw.right + pad);
    var bottom = Math.min(vh - 4, raw.bottom + pad);
    var width = Math.max(24, right - left);
    var height = Math.max(24, bottom - top);

    spotlightEl.style.left = left + 'px';
    spotlightEl.style.top = top + 'px';
    spotlightEl.style.width = width + 'px';
    spotlightEl.style.height = height + 'px';

    var popRect = popoverEl.getBoundingClientRect();
    var pw = popRect.width || 340;
    var ph = popRect.height || 185;
    var gap = 14;
    var px, py;

    // Prefer right of sidebar targets, else below, else above, else left
    if (right + gap + pw <= vw - 12) {
      px = right + gap;
      py = Math.min(Math.max(12, top), vh - ph - 12);
    } else if (bottom + gap + ph <= vh - 12) {
      px = Math.min(Math.max(12, left), vw - pw - 12);
      py = bottom + gap;
    } else if (top - gap - ph >= 12) {
      px = Math.min(Math.max(12, left), vw - pw - 12);
      py = top - gap - ph;
    } else if (left - gap - pw >= 12) {
      px = left - gap - pw;
      py = Math.min(Math.max(12, top), vh - ph - 12);
    } else {
      px = Math.max(12, Math.round((vw - pw) / 2));
      py = Math.max(12, vh - ph - 16);
    }

    popoverEl.style.left = Math.round(px) + 'px';
    popoverEl.style.top = Math.round(py) + 'px';
  }

  function renderStep() {
    if (!isTourRunning || !activeSteps.length) return;
    var step = activeSteps[currentIdx];
    if (!step) return;

    if (typeof step.beforeEnter === 'function') {
      try { step.beforeEnter(); } catch (_) {}
    }

    var targetEl = queryFirst(step.selectors);
    if (!targetEl || !isElementVisible(targetEl)) {
      if (currentIdx < activeSteps.length - 1) {
        currentIdx += 1;
        renderStep();
        return;
      }
      stop(true);
      return;
    }

    var stepLabel = document.getElementById('ss-tour-step');
    var titleEl = document.getElementById('ss-tour-title');
    var descEl = document.getElementById('ss-tour-desc');
    var backBtn = document.getElementById('ss-tour-back');
    var nextBtn = document.getElementById('ss-tour-next');
    var dotsEl = document.getElementById('ss-tour-dots');

    if (stepLabel) stepLabel.textContent = 'Step ' + (currentIdx + 1) + ' of ' + activeSteps.length;
    if (titleEl) titleEl.textContent = step.title;
    if (descEl) descEl.textContent = step.description;
    if (backBtn) backBtn.disabled = currentIdx === 0;
    if (nextBtn) nextBtn.textContent = currentIdx === activeSteps.length - 1 ? 'Finish' : 'Next';

    if (dotsEl) {
      var dotsHtml = '';
      for (var d = 0; d < activeSteps.length; d++) {
        dotsHtml += '<span class="ss-tour-dot' + (d === currentIdx ? ' active' : '') + '"></span>';
      }
      dotsEl.innerHTML = dotsHtml;
    }

    // Wait one animation frame for tab/scroll layout to settle before measuring
    requestAnimationFrame(function () {
      if (!isTourRunning) return;
      var freshTarget = queryFirst(step.selectors);
      if (freshTarget) positionSpotlightAndPopover(freshTarget);
    });
  }

  function onReposition() {
    if (!isTourRunning) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      var step = activeSteps[currentIdx];
      var targetEl = step && queryFirst(step.selectors);
      if (targetEl && isElementVisible(targetEl)) {
        positionSpotlightAndPopover(targetEl);
      }
    });
  }

  function onKeyDown(e) {
    if (!isTourRunning) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      stop(true);
    } else if (e.key === 'ArrowRight') {
      next();
    } else if (e.key === 'ArrowLeft' && currentIdx > 0) {
      prev();
    }
  }

  function markSeen() {
    var key = (root.SILICON_TOUR_CONFIG && root.SILICON_TOUR_CONFIG.storageKey) || STORAGE_KEY;
    try { localStorage.setItem(key, 'true'); } catch (_) {}
  }

  function hasSeen() {
    var key = (root.SILICON_TOUR_CONFIG && root.SILICON_TOUR_CONFIG.storageKey) || STORAGE_KEY;
    try { return localStorage.getItem(key) === 'true'; } catch (_) { return false; }
  }

  function start(startIndex) {
    activeSteps = resolveActiveSteps();
    if (!activeSteps.length) return;

    createDomIfNeeded();
    overlayEl.style.display = 'block';
    spotlightEl.style.display = 'block';
    popoverEl.style.display = 'block';

    isTourRunning = true;
    currentIdx = Math.max(0, Math.min(activeSteps.length - 1, startIndex || 0));

    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('keydown', onKeyDown);

    renderStep();
  }

  function stop(saveSeen) {
    if (!isTourRunning) return;
    isTourRunning = false;

    window.removeEventListener('resize', onReposition);
    window.removeEventListener('scroll', onReposition, true);
    window.removeEventListener('keydown', onKeyDown);

    if (overlayEl) overlayEl.style.display = 'none';
    if (spotlightEl) spotlightEl.style.display = 'none';
    if (popoverEl) popoverEl.style.display = 'none';

    if (saveSeen !== false) markSeen();

    // Return sidebar to default Controls tab cleanly
    activateWorkbenchTab('controls');
    var body = document.getElementById('wb-body');
    if (body) body.scrollTop = 0;
  }

  function next() {
    if (!isTourRunning) return;
    if (currentIdx >= activeSteps.length - 1) {
      stop(true);
    } else {
      currentIdx += 1;
      renderStep();
    }
  }

  function prev() {
    if (!isTourRunning || currentIdx <= 0) return;
    currentIdx -= 1;
    renderStep();
  }

  function goTo(index) {
    if (!isTourRunning) return;
    if (index >= 0 && index < activeSteps.length) {
      currentIdx = index;
      renderStep();
    }
  }

  function waitForReadyAndAutoStart() {
    if (root.__SS_DISABLE_AUTO_TOUR__ || hasSeen()) return;
    var attempts = 0;
    var maxAttempts = 25;

    function poll() {
      attempts += 1;
      var loading = document.getElementById('loading');
      var loadingHidden = !loading ||
        window.getComputedStyle(loading).display === 'none' ||
        window.getComputedStyle(loading).opacity === '0' ||
        loading.classList.contains('hidden');

      if (loadingHidden || attempts >= maxAttempts) {
        if (!hasSeen() && !isTourRunning) {
          setTimeout(function () {
            if (!hasSeen() && !isTourRunning) start(0);
          }, 280);
        }
        return;
      }
      setTimeout(poll, 160);
    }

    setTimeout(poll, 300);
  }

  function bindLauncherButton() {
    var btn = document.getElementById('btn-guided-tour');
    if (btn && !btn.dataset.tourBound) {
      btn.dataset.tourBound = '1';
      btn.addEventListener('click', function () {
        if (isTourRunning) stop(false);
        else start(0);
      });
    }
  }

  function init() {
    bindLauncherButton();
    waitForReadyAndAutoStart();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  root.SiliconGuidedTour = {
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_STEPS: DEFAULT_STEPS,
    start: start,
    stop: stop,
    next: next,
    prev: prev,
    goTo: goTo,
    isActive: function () { return isTourRunning; },
    resetSeen: function () {
      var key = (root.SILICON_TOUR_CONFIG && root.SILICON_TOUR_CONFIG.storageKey) || STORAGE_KEY;
      try { localStorage.removeItem(key); } catch (_) {}
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
