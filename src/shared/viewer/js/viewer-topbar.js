/**
 * Silicon Sliders - Unified Viewer Topbar Engine
 * Manages View Mode (Layout/Schematic), Carrier Flow (Current/Electrons),
 * Play Tour, Camera Reset, and dynamic module logic state inputs (e.g. IN, A, B).
 */

(function (root) {
  'use strict';

  function initTopbar(config) {
    config = config || {};

    // 1. Module-Specific Input Controls (e.g., IN = 0, 1, OFF or A = 0, 1, OFF and B = 0, 1, OFF)
    var inputs = config.inputs || [];
    inputs.forEach(function (inp) {
      var container = document.getElementById(inp.containerId || ('input-' + inp.id + '-group')) ||
                      document.getElementById(inp.id + '-seg');
      if (!container) return;

      var buttons = container.querySelectorAll('button[data-' + inp.id + '], button[data-in]');
      buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          buttons.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');

          var val = btn.getAttribute('data-' + inp.id) || btn.getAttribute('data-in');
          if (typeof config.onInputChange === 'function') {
            config.onInputChange(inp.id, val);
          }
        });
      });
    });

    // 2. View Mode Toggle (Layout vs Schematic)
    var modeSeg = document.getElementById('mode-seg') || document.getElementById('view-mode-group');
    if (modeSeg) {
      var modeButtons = modeSeg.querySelectorAll('button[data-mode], button[data-view]');
      modeButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          modeButtons.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');

          var mode = btn.getAttribute('data-mode') || btn.getAttribute('data-view');
          if (typeof config.onViewModeChange === 'function') {
            config.onViewModeChange(mode);
          } else if (typeof root.setViewMode === 'function') {
            root.setViewMode(mode);
          }
        });
      });
    }

    // 3. Carrier Flow Mode (Current vs Electrons)
    var flowSeg = document.getElementById('flow-seg') || document.getElementById('flow-mode-group');
    if (flowSeg) {
      var flowButtons = flowSeg.querySelectorAll('button[data-flow]');
      flowButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          flowButtons.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');

          var flow = btn.getAttribute('data-flow');
          if (typeof config.onFlowChange === 'function') {
            config.onFlowChange(flow);
          } else if (typeof root.setFlowMode === 'function') {
            root.setFlowMode(flow);
          }
        });
      });
    }

    // 4. Play Tour Button
    var tourBtn = document.getElementById('btn-build-anim') || document.getElementById('btn-tour-play');
    if (tourBtn && typeof config.onPlayTour === 'function') {
      tourBtn.addEventListener('click', config.onPlayTour);
    }

    // 5. Reset Camera Button
    var resetBtn = document.getElementById('btn-reset-cam') || document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (typeof config.onResetCamera === 'function') {
          config.onResetCamera();
        } else if (typeof root.resetCamera === 'function') {
          root.resetCamera();
        }
      });
    }
  }

  root.ViewerTopbar = {
    init: initTopbar
  };

})(typeof window !== 'undefined' ? window : this);
