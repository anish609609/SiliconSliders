/**
 * Silicon Sliders - Unified 3D Viewer Core Orchestrator
 * Coordinates module configuration, shared topbar, panels, dimensions, and theme.
 */

(function (root) {
  'use strict';

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
