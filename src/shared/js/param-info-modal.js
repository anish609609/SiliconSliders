/**
 * param-info-modal.js - Shared Parameter Info Modal Component (SiliconParamInfoModal)
 * Matches the Process Engineering Lab (Chamber Controls) "(i)" glyph + frosted-blur modal dialog
 * with "Dive Deep into Theory" deep-link support. Zero dependencies; reusable across all MOS/CAD modules.
 */
(function (root) {
  'use strict';

  var INFO_SVG =
    '<svg class="param-info-glyph" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<line x1="7" y1="6.2" x2="7" y2="11"></line>' +
      '<circle cx="7" cy="3.2" r="1.1" fill="currentColor" stroke="none"></circle>' +
    '</svg>';

  var registry = {};
  var onDiveDeepHandler = null;
  var backdropEl = null;
  var titleEl = null;
  var paramEl = null;
  var formulaEl = null;
  var mechEl = null;
  var tradeoffEl = null;
  var diveBtnEl = null;
  var activeId = null;
  var activeTrigger = null;
  var boundKeyListener = false;

  function ensureModalDom() {
    if (backdropEl || typeof document === 'undefined' || !document.body) return;

    backdropEl = document.createElement('div');
    backdropEl.id = 'ss-param-info-modal';
    backdropEl.className = 'ss-param-modal-backdrop';
    backdropEl.setAttribute('role', 'dialog');
    backdropEl.setAttribute('aria-modal', 'true');
    backdropEl.setAttribute('aria-hidden', 'true');
    backdropEl.setAttribute('aria-labelledby', 'ss-param-modal-title');

    backdropEl.innerHTML =
      '<div class="ss-param-modal-dialog">' +
        '<div class="ss-param-modal-header">' +
          '<div class="ss-param-modal-title-wrap">' +
            '<span class="ss-param-modal-badge">' + INFO_SVG + '</span>' +
            '<h3 class="ss-param-modal-title" id="ss-param-modal-title"></h3>' +
          '</div>' +
          '<button type="button" class="ss-param-modal-close" aria-label="Close dialog">&times;</button>' +
        '</div>' +
        '<div class="ss-param-modal-body">' +
          '<div>' +
            '<span class="ss-param-section-lbl lbl-param">Parameter / Telemetry Metric:</span>' +
            '<p class="ss-param-subtitle" id="ss-param-modal-param"></p>' +
          '</div>' +
          '<div>' +
            '<span class="ss-param-section-lbl lbl-formula">Governing Relation / Equation:</span>' +
            '<div class="ss-param-formula-box" id="ss-param-modal-formula"></div>' +
          '</div>' +
          '<div>' +
            '<span class="ss-param-section-lbl lbl-mech">Physical Mechanism &amp; Scaling Effects:</span>' +
            '<div class="ss-param-mech-list" id="ss-param-modal-mech"></div>' +
          '</div>' +
          '<div id="ss-param-modal-tradeoff-wrap">' +
            '<span class="ss-param-section-lbl lbl-tradeoff">Device Engineering Trade-Offs:</span>' +
            '<p class="ss-param-tradeoff-box" id="ss-param-modal-tradeoff"></p>' +
          '</div>' +
        '</div>' +
        '<div class="ss-param-modal-footer">' +
          '<button type="button" class="ss-param-btn-theory" id="ss-param-btn-theory" title="Jump directly to detailed physical theory section">' +
            '<span>Dive Deep into Theory</span>' +
          '</button>' +
          '<button type="button" class="ss-param-btn-gotit" id="ss-param-btn-gotit">Got It</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(backdropEl);

    titleEl = backdropEl.querySelector('#ss-param-modal-title');
    paramEl = backdropEl.querySelector('#ss-param-modal-param');
    formulaEl = backdropEl.querySelector('#ss-param-modal-formula');
    mechEl = backdropEl.querySelector('#ss-param-modal-mech');
    tradeoffEl = backdropEl.querySelector('#ss-param-modal-tradeoff');
    diveBtnEl = backdropEl.querySelector('#ss-param-btn-theory');

    var dialogEl = backdropEl.querySelector('.ss-param-modal-dialog');
    if (dialogEl) {
      dialogEl.addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }

    backdropEl.addEventListener('click', function () {
      close();
    });

    var closeBtn = backdropEl.querySelector('.ss-param-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', close);

    var gotItBtn = backdropEl.querySelector('#ss-param-btn-gotit');
    if (gotItBtn) gotItBtn.addEventListener('click', close);

    if (diveBtnEl) {
      diveBtnEl.addEventListener('click', function () {
        var id = activeId;
        var entry = id ? registry[id] : null;
        close();
        if (typeof onDiveDeepHandler === 'function' && entry) {
          onDiveDeepHandler(id, entry);
        } else if (entry && entry.theorySection && typeof root.setViewMode === 'function') {
          root.setViewMode('theory');
          setTimeout(function () {
            var el = document.getElementById(entry.theorySection);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              el.classList.remove('section-highlight-pulse');
              void el.offsetWidth;
              el.classList.add('section-highlight-pulse');
              setTimeout(function () {
                el.classList.remove('section-highlight-pulse');
              }, 1600);
            }
          }, 60);
        }
      });
    }
  }

  function bindGlobalEsc() {
    if (boundKeyListener || typeof window === 'undefined') return;
    boundKeyListener = true;
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.code === 'Escape') && backdropEl && backdropEl.classList.contains('open')) {
        close();
      }
    });
  }

  function renderEntry(entry) {
    ensureModalDom();
    if (!backdropEl) return;

    if (titleEl) titleEl.innerHTML = entry.title || '';
    if (paramEl) paramEl.innerHTML = entry.param || entry.relation || '';
    if (formulaEl) formulaEl.innerHTML = entry.formula || entry.relation || '';

    if (mechEl) {
      var html = '';
      if (entry.increase) {
        html +=
          '<div class="ss-param-mech-item">' +
            '<span class="ss-param-mech-dir dir-up">↑ Increase</span>' +
            '<span>' + entry.increase + '</span>' +
          '</div>';
      }
      if (entry.decrease) {
        html +=
          '<div class="ss-param-mech-item">' +
            '<span class="ss-param-mech-dir dir-down">↓ Decrease</span>' +
            '<span>' + entry.decrease + '</span>' +
          '</div>';
      }
      if (!html && entry.explanation) {
        html = '<div class="ss-param-mech-item"><span>' + entry.explanation + '</span></div>';
      }
      mechEl.innerHTML = html;
    }

    var tradeoffWrap = backdropEl.querySelector('#ss-param-modal-tradeoff-wrap');
    if (tradeoffWrap && tradeoffEl) {
      if (entry.tradeoff) {
        tradeoffWrap.style.display = '';
        tradeoffEl.innerHTML = entry.tradeoff;
      } else {
        tradeoffWrap.style.display = 'none';
      }
    }

    if (diveBtnEl) {
      diveBtnEl.style.display = (entry.theorySection || typeof onDiveDeepHandler === 'function') ? '' : 'none';
    }
  }

  function open(id, triggerEl) {
    var entry = registry[id];
    if (!entry) return;

    if (activeId === id && backdropEl && backdropEl.classList.contains('open')) {
      close();
      return;
    }

    if (activeTrigger && activeTrigger !== triggerEl) {
      activeTrigger.classList.remove('active');
      activeTrigger.setAttribute('aria-expanded', 'false');
    }

    ensureModalDom();
    bindGlobalEsc();

    activeId = id;
    activeTrigger = triggerEl || null;
    if (activeTrigger) {
      activeTrigger.classList.add('active');
      activeTrigger.setAttribute('aria-expanded', 'true');
    }

    renderEntry(entry);
    if (backdropEl) {
      backdropEl.classList.add('open');
      backdropEl.setAttribute('aria-hidden', 'false');
    }
  }

  function close() {
    activeId = null;
    if (activeTrigger) {
      activeTrigger.classList.remove('active');
      activeTrigger.setAttribute('aria-expanded', 'false');
      activeTrigger = null;
    }
    if (backdropEl) {
      backdropEl.classList.remove('open');
      backdropEl.setAttribute('aria-hidden', 'true');
    }
  }

  function attachAll(container) {
    if (typeof document === 'undefined') return;
    bindGlobalEsc();
    var scope = container || document;
    scope.querySelectorAll('[data-info-modal], [data-info-popover]').forEach(function (btn) {
      if (!btn.innerHTML.trim() || btn.innerHTML.trim() === 'ⓘ') {
        btn.innerHTML = INFO_SVG;
      }
      if (btn.dataset.infoBound === '1') return;
      btn.dataset.infoBound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var key = btn.dataset.infoModal || btn.dataset.infoPopover;
        open(key, btn);
      });
    });
  }

  function register(entries, options) {
    if (!entries || typeof entries !== 'object') return;
    Object.keys(entries).forEach(function (k) {
      registry[k] = entries[k];
    });
    if (options && typeof options.onDiveDeep === 'function') {
      onDiveDeepHandler = options.onDiveDeep;
    }
    if (!options || options.autoAttach !== false) {
      attachAll(typeof document !== 'undefined' ? document : null);
    }
  }

  var api = {
    INFO_SVG: INFO_SVG,
    register: register,
    attachAll: attachAll,
    open: open,
    close: close
  };

  root.SiliconParamInfoModal = api;
  root.SiliconInfoPopover = api; // Backward-compatible alias
})(typeof window !== 'undefined' ? window : globalThis);
