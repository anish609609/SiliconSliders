/**
 * guided-tour.js - Shared Interactive UI Onboarding Tour for Solid-State CAD Modules
 * Zero-build IIFE global exposing window.SiliconGuidedTour (100% file:// compatible).
 *
 * Features:
 *  - 4-panel dim backdrop around the spotlight cutout so controls inside the
 *    spotlight remain 100% interactive (clickable & draggable in real time).
 *  - Multi-element union bounding-box spotlighting (includes Controls|Layers|Inspect
 *    tab bar alongside active sidebar panels, plus brief active-tab pulse).
 *  - Auto-switches tabs/accordions and persists first-visit completion in localStorage.
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
      description: 'Drag the voltage, doping, or input sliders—or scrub directly on the characteristic curve—to update the 3D device in real time.',
      targets: [
        ['#left-workbench .wb-header', '.wb-tabs'],
        ['#wb-physics-section', '#wb-pane-controls .wb-bias-controls']
      ],
      pulseSelector: '#wb-tab-controls',
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
      description: 'Use the Layers tab to turn individual substrate, oxide, gate, contact, or metal layers on and off to reveal buried structures.',
      targets: [
        ['#left-workbench .wb-header', '.wb-tabs'],
        ['#layers-body', '#wb-pane-layers']
      ],
      pulseSelector: '#wb-tab-layers',
      beforeEnter: function () {
        activateWorkbenchTab('layers');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      }
    },
    {
      id: 'inspect',
      title: '5. Inspect Materials & Structure',
      description: 'Switch to Inspect to view doping concentrations, materials, dimensions, and the full Architecture Tree of every 3D component.',
      targets: [
        ['#left-workbench .wb-header', '.wb-tabs'],
        ['#wb-pane-inspect', '#inspector-body']
      ],
      pulseSelector: '#wb-tab-inspect',
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
  var dimTopEl = null;
  var dimBottomEl = null;
  var dimLeftEl = null;
  var dimRightEl = null;
  var spotlightEl = null;
  var popoverEl = null;
  var rafId = null;
  var pulsedEl = null;
  var pulseTimer = null;

  function resolveTargetElements(step) {
    var out = [];
    if (Array.isArray(step.targets) && step.targets.length) {
      for (var i = 0; i < step.targets.length; i++) {
        var el = queryFirst(step.targets[i]);
        if (el && isElementVisible(el) && out.indexOf(el) === -1) {
          out.push(el);
        }
      }
    } else if (step.selectors) {
      var single = queryFirst(step.selectors);
      if (single && isElementVisible(single)) out.push(single);
    }
    return out;
  }

  function hasAnyConfiguredTarget(step) {
    if (Array.isArray(step.targets) && step.targets.length) {
      for (var i = 0; i < step.targets.length; i++) {
        if (queryFirst(step.targets[i])) return true;
      }
      return false;
    }
    return Boolean(queryFirst(step.selectors));
  }

  function computeUnionRect(elements) {
    var minL = Infinity;
    var minT = Infinity;
    var maxR = -Infinity;
    var maxB = -Infinity;

    for (var i = 0; i < elements.length; i++) {
      var r = elements[i].getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.left < minL) minL = r.left;
      if (r.top < minT) minT = r.top;
      if (r.right > maxR) maxR = r.right;
      if (r.bottom > maxB) maxB = r.bottom;
    }

    if (!Number.isFinite(minL)) return null;
    return { left: minL, top: minT, right: maxR, bottom: maxB };
  }

  function resolveActiveSteps() {
    var cfg = root.SILICON_TOUR_CONFIG || {};
    var rawSteps = Array.isArray(cfg.steps) && cfg.steps.length ? cfg.steps : DEFAULT_STEPS;
    var selectorMap = cfg.selectors || {};
    var resolved = [];

    for (var i = 0; i < rawSteps.length; i++) {
      var s = rawSteps[i];
      var mapped = selectorMap[s.id];
      var stepClone = {
        id: s.id,
        title: s.title,
        description: s.description,
        selectors: mapped && !Array.isArray(s.targets) ? mapped : s.selectors,
        targets: Array.isArray(mapped) && Array.isArray(s.targets) ? mapped : s.targets,
        pulseSelector: s.pulseSelector,
        beforeEnter: s.beforeEnter
      };
      if (hasAnyConfiguredTarget(stepClone)) {
        resolved.push(stepClone);
      }
    }
    return resolved;
  }

  function createDimPanel(id) {
    var div = document.createElement('div');
    div.id = id;
    div.className = 'ss-tour-dim-panel';
    document.body.appendChild(div);
    return div;
  }

  function createDomIfNeeded() {
    if (spotlightEl) return;

    dimTopEl = createDimPanel('ss-tour-dim-top');
    dimBottomEl = createDimPanel('ss-tour-dim-bottom');
    dimLeftEl = createDimPanel('ss-tour-dim-left');
    dimRightEl = createDimPanel('ss-tour-dim-right');

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

    document.body.appendChild(spotlightEl);
    document.body.appendChild(popoverEl);

    document.getElementById('ss-tour-skip').addEventListener('click', function () {
      stop(true);
    });
    document.getElementById('ss-tour-back').addEventListener('click', prev);
    document.getElementById('ss-tour-next').addEventListener('click', next);
  }

  function clearTabPulse() {
    if (pulseTimer) {
      clearTimeout(pulseTimer);
      pulseTimer = null;
    }
    if (pulsedEl) {
      pulsedEl.classList.remove('ss-tour-tab-pulse');
      pulsedEl = null;
    }
  }

  function applyTabPulse(pulseSelector) {
    clearTabPulse();
    if (!pulseSelector) return;
    var el = queryFirst(pulseSelector);
    if (!el) return;
    // Reflow to restart animation reliably when revisiting steps
    void el.offsetWidth;
    el.classList.add('ss-tour-tab-pulse');
    pulsedEl = el;
    pulseTimer = setTimeout(clearTabPulse, 1900);
  }

  function setDimVisibility(show) {
    var disp = show ? 'block' : 'none';
    [dimTopEl, dimBottomEl, dimLeftEl, dimRightEl, spotlightEl, popoverEl].forEach(function (el) {
      if (el) el.style.display = disp;
    });
  }

  function positionSpotlightAndPopover(rawRect) {
    if (!spotlightEl || !popoverEl || !rawRect) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var pad = 6;

    // Clamp cutout inside visible viewport so tall panels stay clean & interactive
    var left = Math.max(4, Math.round(rawRect.left - pad));
    var top = Math.max(4, Math.round(rawRect.top - pad));
    var right = Math.min(vw - 4, Math.round(rawRect.right + pad));
    var bottom = Math.min(vh - 4, Math.round(rawRect.bottom + pad));
    var width = Math.max(24, right - left);
    var height = Math.max(24, bottom - top);

    // Position 4 dim panels around the cutout
    if (dimTopEl) {
      dimTopEl.style.top = '0px';
      dimTopEl.style.left = '0px';
      dimTopEl.style.width = vw + 'px';
      dimTopEl.style.height = top + 'px';
    }
    if (dimBottomEl) {
      dimBottomEl.style.top = bottom + 'px';
      dimBottomEl.style.left = '0px';
      dimBottomEl.style.width = vw + 'px';
      dimBottomEl.style.height = Math.max(0, vh - bottom) + 'px';
    }
    if (dimLeftEl) {
      dimLeftEl.style.top = top + 'px';
      dimLeftEl.style.left = '0px';
      dimLeftEl.style.width = left + 'px';
      dimLeftEl.style.height = height + 'px';
    }
    if (dimRightEl) {
      dimRightEl.style.top = top + 'px';
      dimRightEl.style.left = right + 'px';
      dimRightEl.style.width = Math.max(0, vw - right) + 'px';
      dimRightEl.style.height = height + 'px';
    }

    spotlightEl.style.left = left + 'px';
    spotlightEl.style.top = top + 'px';
    spotlightEl.style.width = width + 'px';
    spotlightEl.style.height = height + 'px';

    var popRect = popoverEl.getBoundingClientRect();
    var pw = popRect.width || 344;
    var ph = popRect.height || 185;
    var gap = 14;
    var px, py;

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

    var targets = resolveTargetElements(step);
    var union = computeUnionRect(targets);
    if (!union) {
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

    applyTabPulse(step.pulseSelector);

    requestAnimationFrame(function () {
      if (!isTourRunning) return;
      var freshTargets = resolveTargetElements(step);
      var freshUnion = computeUnionRect(freshTargets);
      if (freshUnion) positionSpotlightAndPopover(freshUnion);
    });
  }

  function onReposition() {
    if (!isTourRunning) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(function () {
      var step = activeSteps[currentIdx];
      if (!step) return;
      var freshUnion = computeUnionRect(resolveTargetElements(step));
      if (freshUnion) positionSpotlightAndPopover(freshUnion);
    });
  }

  function onKeyDown(e) {
    if (!isTourRunning) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      stop(true);
    } else if (e.key === 'ArrowRight' && document.activeElement && document.activeElement.tagName !== 'INPUT') {
      next();
    } else if (e.key === 'ArrowLeft' && currentIdx > 0 && document.activeElement && document.activeElement.tagName !== 'INPUT') {
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
    setDimVisibility(true);

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

    clearTabPulse();
    setDimVisibility(false);

    if (saveSeen !== false) markSeen();

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
