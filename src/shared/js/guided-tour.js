/**
 * guided-tour.js - Shared Interactive UI Onboarding Tour for Solid-State CAD Modules
 * Zero-build IIFE global exposing window.SiliconGuidedTour (100% file:// compatible).
 *
 * Features:
 *  - 4-panel dim backdrop around spotlight cutout (controls inside remain 100% interactive).
 *  - Multi-element union spotlighting (includes Controls|Layers|Inspect tab bar + active-tab pulse).
 *  - Smart camera lerp & auto-explode transitions via step `onEnter` hooks.
 *  - Peek Mode: fades overlay on slider/graph drag so the 3D device is 100% bright & unobstructed.
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

  // =========================================================================
  // Smooth Camera & Auto-Explode Animation Helpers
  // =========================================================================
  var camAnimId = null;
  var explodeAnimId = null;
  var userManuallyOrbited = false;
  var orbitHookedCtrl = null;

  function onOrbitStart() {
    if (isTourRunning) {
      userManuallyOrbited = true;
      cancelCameraTween();
    }
  }

  function ensureOrbitListener() {
    var ctrl = root.controls;
    if (ctrl && typeof ctrl.addEventListener === 'function' && orbitHookedCtrl !== ctrl) {
      orbitHookedCtrl = ctrl;
      ctrl.addEventListener('start', onOrbitStart);
    }
  }

  function cancelCameraTween() {
    if (camAnimId) {
      cancelAnimationFrame(camAnimId);
      camAnimId = null;
    }
  }

  function toVec3(v) {
    if (!v) return null;
    if (Array.isArray(v)) return { x: Number(v[0]) || 0, y: Number(v[1]) || 0, z: Number(v[2]) || 0 };
    if (typeof v.x === 'number') return { x: v.x, y: v.y, z: v.z };
    return null;
  }

  function animateCameraTo(posLike, targetLike, durationMs) {
    if (userManuallyOrbited) return;
    var cam = root.activeCamera || root.camera;
    var ctrl = root.controls;
    var toPos = toVec3(posLike);
    var toTgt = toVec3(targetLike);
    if (!cam || !ctrl || !toPos || !toTgt) return;

    ensureOrbitListener();
    cancelCameraTween();

    var fromPos = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    var fromTgt = { x: ctrl.target.x, y: ctrl.target.y, z: ctrl.target.z };
    var dur = durationMs || 650;
    var startT = performance.now();

    function step(now) {
      if (userManuallyOrbited) {
        camAnimId = null;
        return;
      }
      var t = Math.min(1, (now - startT) / dur);
      var ease = 1 - Math.pow(1 - t, 3);
      cam.position.set(
        fromPos.x + (toPos.x - fromPos.x) * ease,
        fromPos.y + (toPos.y - fromPos.y) * ease,
        fromPos.z + (toPos.z - fromPos.z) * ease
      );
      ctrl.target.set(
        fromTgt.x + (toTgt.x - fromTgt.x) * ease,
        fromTgt.y + (toTgt.y - fromTgt.y) * ease,
        fromTgt.z + (toTgt.z - fromTgt.z) * ease
      );
      ctrl.update();
      if (t < 1) {
        camAnimId = requestAnimationFrame(step);
      } else {
        camAnimId = null;
      }
    }

    camAnimId = requestAnimationFrame(step);
  }

  function cancelExplodeTween() {
    if (explodeAnimId) {
      cancelAnimationFrame(explodeAnimId);
      explodeAnimId = null;
    }
  }

  function getExplodeYSlider() {
    return document.getElementById('explode-y-slider') || document.getElementById('explode-y');
  }

  function setExplodeYImmediate(pct) {
    var val = Math.max(0, Math.min(100, Math.round(pct)));
    var slider = getExplodeYSlider();
    if (slider) {
      slider.value = val;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (typeof root.applyExplode === 'function') {
      root.applyExplode(undefined, val, undefined);
    }
  }

  function animateExplodeY(targetPct, durationMs) {
    var slider = getExplodeYSlider();
    if (!slider) return;
    cancelExplodeTween();

    var fromVal = parseFloat(slider.value) || 0;
    var toVal = Math.max(0, Math.min(100, Number(targetPct) || 0));
    if (Math.abs(fromVal - toVal) < 0.5) {
      setExplodeYImmediate(toVal);
      return;
    }

    var dur = durationMs || 550;
    var startT = performance.now();

    function step(now) {
      var t = Math.min(1, (now - startT) / dur);
      var ease = 1 - Math.pow(1 - t, 3);
      setExplodeYImmediate(fromVal + (toVal - fromVal) * ease);
      if (t < 1) {
        explodeAnimId = requestAnimationFrame(step);
      } else {
        setExplodeYImmediate(toVal);
        explodeAnimId = null;
      }
    }

    explodeAnimId = requestAnimationFrame(step);
  }

  function getCloseupCamera() {
    var cfg = root.SILICON_TOUR_CONFIG || {};
    if (cfg.closeupPos && cfg.closeupTarget) {
      return { pos: cfg.closeupPos, target: cfg.closeupTarget };
    }
    if (root.TOUR_CLOSEUP_POS && root.TOUR_CLOSEUP_TARGET) {
      return { pos: root.TOUR_CLOSEUP_POS, target: root.TOUR_CLOSEUP_TARGET };
    }
    var tgt = toVec3(root.INITIAL_TARGET) || { x: 0.4, y: 2.8, z: 0 };
    return {
      pos: [tgt.x + 6.2, tgt.y + 7.6, 17.5],
      target: [tgt.x - 1.6, tgt.y + 0.8, tgt.z]
    };
  }

  function returnToHeroCamera() {
    if (userManuallyOrbited) return;
    if (root.INITIAL_POS && root.INITIAL_TARGET) {
      animateCameraTo(root.INITIAL_POS, root.INITIAL_TARGET, 680);
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
      description: 'Drag the voltage, doping, or input sliders—or scrub directly on the characteristic curve—while watching the channel and depletion regions react in real time.',
      targets: [
        ['#left-workbench .wb-header', '.wb-tabs'],
        ['#wb-physics-section', '#wb-pane-controls .wb-bias-controls']
      ],
      pulseSelector: '#wb-tab-controls',
      beforeEnter: function () {
        activateWorkbenchTab('controls');
        var body = document.getElementById('wb-body');
        if (body) body.scrollTop = 0;
      },
      onEnter: function () {
        animateExplodeY(14, 520);
        var closeCam = getCloseupCamera();
        animateCameraTo(closeCam.pos, closeCam.target, 720);
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
      },
      onEnter: function () {
        animateExplodeY(38, 600);
        returnToHeroCamera();
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
      },
      onEnter: function () {
        returnToHeroCamera();
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
      },
      onEnter: function () {
        returnToHeroCamera();
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
      },
      onEnter: function () {
        returnToHeroCamera();
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

  // Peek Mode state (fade overlay while dragging sliders / graph canvas)
  var isPeeking = false;
  var peekResumeTimer = null;

  function getOverlayParts() {
    return [dimTopEl, dimBottomEl, dimLeftEl, dimRightEl, spotlightEl, popoverEl];
  }

  function isInteractiveDragTarget(node) {
    if (!node || typeof node.closest !== 'function') return false;
    if (popoverEl && popoverEl.contains(node)) return false;
    if (node.classList && node.classList.contains('ss-tour-dim-panel')) return false;
    var control = node.closest('input[type="range"], canvas');
    if (!control) return false;
    var peekSel = (root.SILICON_TOUR_CONFIG && root.SILICON_TOUR_CONFIG.peekContainerSelector) ||
                  '#left-workbench, #process-controls-aside, #ox-chamber-controls, [data-tour-peek-zone]';
    return Boolean(control.closest(peekSel));
  }

  function setPeekClass(peeking) {
    isPeeking = peeking;
    getOverlayParts().forEach(function (el) {
      if (el) el.classList.toggle('ss-tour-peeking', peeking);
    });
  }

  function clearPeekTimer() {
    if (peekResumeTimer) {
      clearTimeout(peekResumeTimer);
      peekResumeTimer = null;
    }
  }

  function onPeekDragStart(e) {
    if (!isTourRunning) return;
    if (!isInteractiveDragTarget(e.target)) return;
    clearPeekTimer();
    if (!isPeeking) setPeekClass(true);
  }

  function onPeekDragEnd() {
    if (!isTourRunning || !isPeeking) return;
    clearPeekTimer();
    peekResumeTimer = setTimeout(function () {
      peekResumeTimer = null;
      if (!isTourRunning) return;
      setPeekClass(false);
      onReposition();
    }, 800);
  }

  function onPeekSliderInput(e) {
    if (!isTourRunning || !isPeeking) return;
    if (e.target && e.target.type === 'range') {
      clearPeekTimer();
    }
  }

  function attachPeekListeners() {
    document.addEventListener('pointerdown', onPeekDragStart, true);
    document.addEventListener('mousedown', onPeekDragStart, true);
    document.addEventListener('touchstart', onPeekDragStart, true);
    document.addEventListener('input', onPeekSliderInput, true);
    window.addEventListener('pointerup', onPeekDragEnd, true);
    window.addEventListener('mouseup', onPeekDragEnd, true);
    window.addEventListener('touchend', onPeekDragEnd, true);
    window.addEventListener('pointercancel', onPeekDragEnd, true);
  }

  function detachPeekListeners() {
    clearPeekTimer();
    setPeekClass(false);
    document.removeEventListener('pointerdown', onPeekDragStart, true);
    document.removeEventListener('mousedown', onPeekDragStart, true);
    document.removeEventListener('touchstart', onPeekDragStart, true);
    document.removeEventListener('input', onPeekSliderInput, true);
    window.removeEventListener('pointerup', onPeekDragEnd, true);
    window.removeEventListener('mouseup', onPeekDragEnd, true);
    window.removeEventListener('touchend', onPeekDragEnd, true);
    window.removeEventListener('pointercancel', onPeekDragEnd, true);
  }

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
        descriptionHtml: s.descriptionHtml,
        selectors: mapped && !Array.isArray(s.targets) ? mapped : s.selectors,
        targets: Array.isArray(mapped) && Array.isArray(s.targets) ? mapped : s.targets,
        pulseSelector: s.pulseSelector,
        beforeEnter: s.beforeEnter,
        onEnter: s.onEnter
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
    void el.offsetWidth;
    el.classList.add('ss-tour-tab-pulse');
    pulsedEl = el;
    pulseTimer = setTimeout(clearTabPulse, 1900);
  }

  function setDimVisibility(show) {
    var disp = show ? 'block' : 'none';
    getOverlayParts().forEach(function (el) {
      if (el) el.style.display = disp;
    });
  }

  function positionSpotlightAndPopover(rawRect) {
    if (!spotlightEl || !popoverEl || !rawRect) return;
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var pad = 6;

    var left = Math.max(4, Math.round(rawRect.left - pad));
    var top = Math.max(4, Math.round(rawRect.top - pad));
    var right = Math.min(vw - 4, Math.round(rawRect.right + pad));
    var bottom = Math.min(vh - 4, Math.round(rawRect.bottom + pad));
    var width = Math.max(24, right - left);
    var height = Math.max(24, bottom - top);

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

    clearPeekTimer();
    setPeekClass(false);

    if (typeof step.beforeEnter === 'function') {
      try { step.beforeEnter(); } catch (_) {}
    }

    var targets = resolveTargetElements(step);
    var union = computeUnionRect(targets);
    if (!union) {
      // Deferred retry once on next frame for async UI libraries (e.g. React tab state updates)
      requestAnimationFrame(function () {
        if (!isTourRunning || activeSteps[currentIdx] !== step) return;
        var delayedTargets = resolveTargetElements(step);
        var delayedUnion = computeUnionRect(delayedTargets);
        if (delayedUnion) {
          positionSpotlightAndPopover(delayedUnion);
        } else if (currentIdx < activeSteps.length - 1) {
          currentIdx += 1;
          renderStep();
        } else {
          stop(true);
        }
      });
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
    if (descEl) {
      if (step.descriptionHtml) descEl.innerHTML = step.descriptionHtml;
      else descEl.textContent = step.description || '';
    }
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

    if (typeof step.onEnter === 'function') {
      try {
        step.onEnter({
          animateCameraTo: animateCameraTo,
          animateExplodeY: animateExplodeY,
          returnToHeroCamera: returnToHeroCamera
        });
      } catch (_) {}
    }

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

    userManuallyOrbited = false;
    ensureOrbitListener();
    isTourRunning = true;
    currentIdx = Math.max(0, Math.min(activeSteps.length - 1, startIndex || 0));

    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('keydown', onKeyDown);
    attachPeekListeners();

    renderStep();
  }

  function stop(saveSeen) {
    if (!isTourRunning) return;
    isTourRunning = false;

    window.removeEventListener('resize', onReposition);
    window.removeEventListener('scroll', onReposition, true);
    window.removeEventListener('keydown', onKeyDown);
    detachPeekListeners();

    cancelExplodeTween();
    clearTabPulse();
    setDimVisibility(false);

    if (saveSeen !== false) markSeen();

    var cfg = root.SILICON_TOUR_CONFIG || {};
    if (typeof cfg.onStop === 'function') {
      try { cfg.onStop(saveSeen); } catch (_) {}
    } else if (document.getElementById('wb-tab-controls') || document.getElementById('wb-pane-controls')) {
      activateWorkbenchTab('controls');
      var body = document.getElementById('wb-body');
      if (body) body.scrollTop = 0;
    }

    returnToHeroCamera();
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
    var cfg = root.SILICON_TOUR_CONFIG || {};
    if (cfg.autoStart === false) return;
    var attempts = 0;
    var maxAttempts = 30;

    function isElHidden(el) {
      if (!el) return true;
      var st = window.getComputedStyle(el);
      return st.display === 'none' || st.opacity === '0' || el.classList.contains('hidden');
    }

    function poll() {
      attempts += 1;
      var curCfg = root.SILICON_TOUR_CONFIG || {};
      var loading = document.getElementById('loading');
      var oxLoading = document.getElementById('oxidation-loading');
      var loadingHidden = isElHidden(loading) && isElHidden(oxLoading);
      var readyMatch = !curCfg.readySelector || Boolean(document.querySelector(curCfg.readySelector));

      if ((loadingHidden && readyMatch && resolveActiveSteps().length > 0) || attempts >= maxAttempts) {
        if (!hasSeen() && !isTourRunning && curCfg.autoStart !== false && resolveActiveSteps().length > 0) {
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

  var launcherDelegatedBound = false;
  function bindLauncherButton() {
    if (!launcherDelegatedBound && typeof document !== 'undefined') {
      launcherDelegatedBound = true;
      document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('#btn-guided-tour') : null;
        if (!btn) return;
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
    refresh: init,
    animateCameraTo: animateCameraTo,
    animateExplodeY: animateExplodeY,
    isActive: function () { return isTourRunning; },
    isPeeking: function () { return isPeeking; },
    resetSeen: function () {
      var key = (root.SILICON_TOUR_CONFIG && root.SILICON_TOUR_CONFIG.storageKey) || STORAGE_KEY;
      try { localStorage.removeItem(key); } catch (_) {}
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
