/**
 * Silicon Sliders - Unified 3D Viewer Core Orchestrator
 * Coordinates module configuration, shared topbar, panels, dimensions, and theme.
 */

(function (root) {
  'use strict';

  // Synchronous Material Palette fallback matching src/shared/materialPalette.js
  var SHARED_PALETTE = {
    dark: {
      pSubstrate: '#2B3442',
      nWell: '#2D5A4C',
      nSubstrate: '#2D5A4C',
      pWell: '#2E4366',
      nPlusDiffusion: '#2563EB',
      pPlusDiffusion: '#EA580C',
      implantedNChannel: '#38BDF8',
      implantedPChannel: '#FB923C',
      gateOxide: '#67E8F9',
      gateOxideOpacity: 0.35,
      fieldOxide: '#475569',
      fieldOxideOpacity: 0.45,
      polysilicon: '#DC2626',
      metal: '#94A3B8',
      via: '#CBD5E1',
      electronFlow: '#F59E0B',
      electronChannel: '#F59E0B',
      holeFlow: '#F43F5E',
      holeChannel: '#F43F5E',
      depletion: '#64748B',
      depletionOpacity: 0.26
    },
    light: {
      pSubstrate: '#64748B',
      nWell: '#52B788',
      nSubstrate: '#52B788',
      pWell: '#93C5FD',
      nPlusDiffusion: '#1D4ED8',
      pPlusDiffusion: '#C2410C',
      implantedNChannel: '#0284C7',
      implantedPChannel: '#D97706',
      gateOxide: '#0891B2',
      gateOxideOpacity: 0.28,
      fieldOxide: '#64748B',
      fieldOxideOpacity: 0.35,
      polysilicon: '#B91C1C',
      metal: '#475569',
      via: '#334155',
      electronFlow: '#D97706',
      electronChannel: '#D97706',
      holeFlow: '#BE123C',
      holeChannel: '#BE123C',
      depletion: '#475569',
      depletionOpacity: 0.26
    }
  };

  function getMatPal(theme) {
    var t = (theme === 'light') ? 'light' : 'dark';
    return SHARED_PALETTE[t];
  }

  if (typeof root.MATERIAL_PALETTE === 'undefined') {
    root.MATERIAL_PALETTE = SHARED_PALETTE;
  }
  if (typeof root.getMaterialPalette === 'undefined') {
    root.getMaterialPalette = getMatPal;
  }

  // Dynamic import of ES module src/shared/materialPalette.js
  try {
    import('../../materialPalette.js').then(function (mod) {
      if (mod && mod.getMaterialPalette) {
        root.MATERIAL_PALETTE = mod.MATERIAL_PALETTE;
        root.getMaterialPalette = mod.getMaterialPalette;
      }
    }).catch(function () {});
  } catch (_) {}

  var SiliconViewer = {
    version: '1.0.0',
    activeConfig: null,

    init: function (config) {
      this.activeConfig = config || {};

      // 1. Initialize Theme Engine & Sync with localStorage
      if (root.ViewerTheme) {
        root.ViewerTheme.init();
      }

      // 2. Initialize Topbar Controls
      if (root.ViewerTopbar) {
        root.ViewerTopbar.init(this.activeConfig);
      }

      // 3. Initialize Shared Panels
      if (root.ViewerPanels) {
        root.ViewerPanels.initCollapsiblePanels();
        if (this.activeConfig.dimRules) {
          root.ViewerPanels.initDimensions(this.activeConfig);
        }
        if (this.activeConfig.legend) {
          root.ViewerPanels.initLayersAndLegend(this.activeConfig);
        }
      }

      // 4. Bind Global Responsive Drawer Toggles
      var leftToggle = document.getElementById('left-toggle');
      var leftPanel = document.getElementById('left-panel');
      if (leftToggle && leftPanel) {
        leftToggle.addEventListener('click', function () {
          var isClosed = leftPanel.classList.toggle('collapsed');
          leftToggle.classList.toggle('closed', isClosed);
        });
      }

      var rightToggle = document.getElementById('right-toggle');
      var rightPanel = document.getElementById('right-panel');
      if (rightToggle && rightPanel) {
        rightToggle.addEventListener('click', function () {
          var isClosed = rightPanel.classList.toggle('collapsed');
          rightToggle.classList.toggle('closed', isClosed);
        });
      }

      return this;
    }
  };

  root.SiliconViewer = SiliconViewer;

})(typeof window !== 'undefined' ? window : this);
