/**
 * Silicon Sliders - Unified 3D Viewer Core Orchestrator
 * Coordinates module configuration, shared topbar, panels, dimensions, and theme.
 */

(function (root) {
  'use strict';

  // Synchronous Material Palette fallback matching src/shared/materialPalette.js
  var SHARED_PALETTE = {
    dark: {
      pSubstrate: '#1E3A5F',
      pWell: '#1D4ED8',
      pSDE: '#60A5FA',
      pPlusDiffusion: '#3B82F6',
      implantedPChannel: '#60A5FA',
      nSubstrate: '#14532D',
      nWell: '#166534',
      nSDE: '#4ADE80',
      nPlusDiffusion: '#22C55E',
      implantedNChannel: '#4ADE80',
      gateOxide: '#67E8F9',
      gateOxideOpacity: 0.35,
      fieldOxide: '#475569',
      fieldOxideOpacity: 0.45,
      polysilicon: '#DC2626',
      metal: '#94A3B8',
      via: '#CBD5E1',
      electronFlow: '#F59E0B',
      electronChannel: '#34D399',
      holeFlow: '#F43F5E',
      holeChannel: '#38BDF8',
      depletion: '#64748B',
      depletionOpacity: 0.26
    },
    light: {
      pSubstrate: '#7BA7E1',
      pWell: '#4A86E8',
      pSDE: '#3B82F6',
      pPlusDiffusion: '#2563EB',
      implantedPChannel: '#2563EB',
      nSubstrate: '#86EFAC',
      nWell: '#4ADE80',
      nSDE: '#22C55E',
      nPlusDiffusion: '#16A34A',
      implantedNChannel: '#16A34A',
      gateOxide: '#0891B2',
      gateOxideOpacity: 0.28,
      fieldOxide: '#64748B',
      fieldOxideOpacity: 0.35,
      polysilicon: '#B91C1C',
      metal: '#475569',
      via: '#334155',
      electronFlow: '#D97706',
      electronChannel: '#4ADE80',
      holeFlow: '#BE123C',
      holeChannel: '#60A5FA',
      depletion: '#475569',
      depletionOpacity: 0.26
    }
  };

  var SHARED_PROPERTIES = {
    dark: {
      substrate:    { color: '#1E3A5F', roughness: 0.85, metalness: 0.05, opacity: 1.0, emissive: 0x000000, emissiveIntensity: 0 },
      nWell:        { color: '#166534', roughness: 0.60, metalness: 0.15, opacity: 0.85, outlineColor: '#5fd9c4', emissive: 0x000000, emissiveIntensity: 0 },
      pWell:        { color: '#1D4ED8', roughness: 0.60, metalness: 0.15, opacity: 0.80, outlineColor: '#5a7799', emissive: 0x000000, emissiveIntensity: 0 },
      nPlusImplant: { color: '#22C55E', roughness: 0.50, metalness: 0.15, opacity: 0.88, outlineColor: '#4ade80', emissive: 0x000000, emissiveIntensity: 0 },
      pPlusImplant: { color: '#3B82F6', roughness: 0.50, metalness: 0.15, opacity: 0.88, outlineColor: '#60a5fa', emissive: 0x000000, emissiveIntensity: 0 },
      nSDE:         { color: '#4ADE80', roughness: 0.50, metalness: 0.15, opacity: 0.72, outlineColor: '#86efac', emissive: 0x000000, emissiveIntensity: 0 },
      pSDE:         { color: '#60A5FA', roughness: 0.50, metalness: 0.15, opacity: 0.72, outlineColor: '#93c5fd', emissive: 0x000000, emissiveIntensity: 0 },
      depletion:    { colorHex: 0x94a3b8, emissiveHex: 0x475569, emissiveIntensity: 0.14, opacity: 0.38, roughness: 0.55, metalness: 0.08, edgeOpacity: 0.55 }
    },
    light: {
      substrate:    { color: '#7BA7E1', roughness: 0.85, metalness: 0.05, opacity: 1.0, emissive: 0x000000, emissiveIntensity: 0 },
      nWell:        { color: '#4ADE80', roughness: 0.75, metalness: 0.15, opacity: 0.85, outlineColor: '#5fd9c4', emissive: 0x000000, emissiveIntensity: 0 },
      pWell:        { color: '#4A86E8', roughness: 0.75, metalness: 0.15, opacity: 0.80, outlineColor: '#5a7799', emissive: 0x000000, emissiveIntensity: 0 },
      nPlusImplant: { color: '#16A34A', roughness: 0.50, metalness: 0.15, opacity: 0.88, outlineColor: '#22c55e', emissive: 0x000000, emissiveIntensity: 0 },
      pPlusImplant: { color: '#2563EB', roughness: 0.50, metalness: 0.15, opacity: 0.88, outlineColor: '#3b82f6', emissive: 0x000000, emissiveIntensity: 0 },
      nSDE:         { color: '#22C55E', roughness: 0.50, metalness: 0.15, opacity: 0.72, outlineColor: '#4ade80', emissive: 0x000000, emissiveIntensity: 0 },
      pSDE:         { color: '#3B82F6', roughness: 0.50, metalness: 0.15, opacity: 0.72, outlineColor: '#60a5fa', emissive: 0x000000, emissiveIntensity: 0 },
      depletion:    { colorHex: 0x64748b, emissiveHex: 0x334155, emissiveIntensity: 0.14, opacity: 0.38, roughness: 0.55, metalness: 0.08, edgeOpacity: 0.55 }
    }
  };

  function getMatPal(theme) {
    var t = (theme === 'light') ? 'light' : 'dark';
    return SHARED_PALETTE[t];
  }
  function getMatProps(theme) {
    var t = (theme === 'light') ? 'light' : 'dark';
    return SHARED_PROPERTIES[t];
  }

  if (typeof root.MATERIAL_PALETTE === 'undefined') {
    root.MATERIAL_PALETTE = SHARED_PALETTE;
  }
  if (typeof root.getMaterialPalette === 'undefined') {
    root.getMaterialPalette = getMatPal;
  }
  if (typeof root.MATERIAL_PROPERTIES === 'undefined') {
    root.MATERIAL_PROPERTIES = SHARED_PROPERTIES;
  }
  if (typeof root.getMaterialProperties === 'undefined') {
    root.getMaterialProperties = getMatProps;
  }

  // Dynamic import of ES module src/shared/materialPalette.js
  try {
    import('../../materialPalette.js').then(function (mod) {
      if (mod && mod.getMaterialPalette) {
        root.MATERIAL_PALETTE = mod.MATERIAL_PALETTE;
        root.getMaterialPalette = mod.getMaterialPalette;
      }
      if (mod && mod.getMaterialProperties) {
        root.MATERIAL_PROPERTIES = mod.MATERIAL_PROPERTIES;
        root.getMaterialProperties = mod.getMaterialProperties;
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

  // =========================================================================
  // Shared Non-Destructive 3D Selection Highlight Engine
  // Attaches a translucent tint overlay + crisp CAD edge outline without
  // mutating base material colors or leaking across shared materials.
  // =========================================================================
  function resolveHighlightColor(colorOverride) {
    if (typeof THREE === 'undefined') return null;
    if (colorOverride && colorOverride.isColor) return colorOverride.clone();
    if (typeof colorOverride === 'string' || typeof colorOverride === 'number') {
      return new THREE.Color(colorOverride);
    }
    try {
      var css = getComputedStyle(document.documentElement).getPropertyValue('--highlight').trim();
      if (css) return new THREE.Color(css);
    } catch (_) {}
    return new THREE.Color('#ff2fb0');
  }

  function clearNodeHighlight(node) {
    if (!node || !node.userData) return;
    if (node.userData._hlOverlay) {
      if (node.userData._hlOverlay.parent) node.userData._hlOverlay.parent.remove(node.userData._hlOverlay);
      if (node.userData._hlOverlay.material) node.userData._hlOverlay.material.dispose();
      node.userData._hlOverlay = null;
    }
    if (node.userData._hlEdge) {
      if (node.userData._hlEdge.parent) node.userData._hlEdge.parent.remove(node.userData._hlEdge);
      if (node.userData._hlEdge.geometry) node.userData._hlEdge.geometry.dispose();
      if (node.userData._hlEdge.material) node.userData._hlEdge.material.dispose();
      node.userData._hlEdge = null;
    }
    if (node.isSprite && node.userData._hlSpriteSaved) {
      if (node.material && node.material.color && node.userData._hlOrigColor) {
        node.material.color.copy(node.userData._hlOrigColor);
      }
      if (node.userData._hlOrigScale) {
        node.scale.copy(node.userData._hlOrigScale);
      }
      node.userData._hlSpriteSaved = false;
    }
  }

  function applyNodeHighlight(node, on, hlColor) {
    if (!node || typeof THREE === 'undefined') return;
    if (node.userData && node.userData._isHighlightPart) return;

    clearNodeHighlight(node);
    if (!on) return;

    if (node.isSprite) {
      if (!node.userData._hlSpriteSaved) {
        node.userData._hlOrigScale = node.scale.clone();
        node.userData._hlOrigColor = (node.material && node.material.color) ? node.material.color.clone() : null;
        node.userData._hlSpriteSaved = true;
      }
      if (node.material && node.material.color) {
        node.material.color.copy(hlColor);
      }
      node.scale.set(node.userData._hlOrigScale.x * 1.35, node.userData._hlOrigScale.y * 1.35, node.userData._hlOrigScale.z);
      return;
    }

    if (!node.isMesh || (node.userData && node.userData.decorative) || !node.geometry) return;

    var clipPlanes = (node.material && node.material.clippingPlanes) ||
                     (typeof root.renderer !== 'undefined' && root.renderer && root.renderer.clippingPlanes) ||
                     null;

    var ovMat = new THREE.MeshBasicMaterial({
      color: hlColor.clone(),
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      clippingPlanes: clipPlanes
    });
    var ovMesh = new THREE.Mesh(node.geometry, ovMat);
    ovMesh.userData._isHighlightPart = true;
    ovMesh.renderOrder = 60;
    ovMesh.raycast = function () {};
    node.add(ovMesh);
    node.userData._hlOverlay = ovMesh;

    try {
      var edgeGeo = new THREE.EdgesGeometry(node.geometry, 24);
      var edgeMat = new THREE.LineBasicMaterial({
        color: hlColor.clone(),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        clippingPlanes: clipPlanes
      });
      var edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
      edgeLines.userData._isHighlightPart = true;
      edgeLines.renderOrder = 61;
      edgeLines.raycast = function () {};
      node.add(edgeLines);
      node.userData._hlEdge = edgeLines;
    } catch (_) {}
  }

  var SiliconSelectionHighlight = {
    apply: function (obj, on, colorOverride, rootObj) {
      if (!obj) return;
      if (root.SiliconLayerHighlight && typeof root.SiliconLayerHighlight.apply === 'function') {
        root.SiliconLayerHighlight.apply(obj, on, colorOverride, rootObj);
        return;
      }
      var hlColor = on ? resolveHighlightColor(colorOverride) : null;
      if (typeof obj.traverse === 'function') {
        obj.traverse(function (child) {
          if (child.userData && child.userData._isHighlightPart) return;
          applyNodeHighlight(child, !!on, hlColor);
        });
      } else {
        applyNodeHighlight(obj, !!on, hlColor);
      }
    },
    updateColor: function (meshes, colorOverride) {
      if (root.SiliconLayerHighlight && typeof root.SiliconLayerHighlight.updateColor === 'function') {
        root.SiliconLayerHighlight.updateColor(meshes, colorOverride);
        return;
      }
      if (!meshes || !meshes.length) return;
      var hlColor = resolveHighlightColor(colorOverride);
      if (!hlColor) return;
      for (var i = 0; i < meshes.length; i++) {
        var obj = meshes[i];
        if (!obj || typeof obj.traverse !== 'function') continue;
        obj.traverse(function (child) {
          if (child.userData && child.userData._hlOverlay && child.userData._hlOverlay.material) {
            child.userData._hlOverlay.material.color.copy(hlColor);
          }
          if (child.userData && child.userData._hlEdge && child.userData._hlEdge.material) {
            child.userData._hlEdge.material.color.copy(hlColor);
          }
        });
      }
    }
  };
  root.SiliconSelectionHighlight = SiliconSelectionHighlight;

  // =========================================================================
  // Shared 3-State Viewport Auto-Rotation Control (Off -> CW -> CCW -> Off)
  // =========================================================================
  var AUTO_ROTATE_STATES = ['off', 'cw', 'ccw'];
  var autoRotateState = 'off';

  function getAutoRotateButtonHtml(state) {
    var iconSvg = '';
    var labelText = 'Auto-Rotate: Off';
    if (state === 'cw') {
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"></path><polyline points="21 3 21 9 15 9"></polyline></svg>';
      labelText = 'Auto-Rotate: CW';
    } else if (state === 'ccw') {
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 2.64-6.36"></path><polyline points="3 3 3 9 9 9"></polyline></svg>';
      labelText = 'Auto-Rotate: CCW';
    } else {
      iconSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><polyline points="21 3 21 8 16 8"></polyline></svg>';
      labelText = 'Auto-Rotate: Off';
    }
    return '<span class="ar-icon">' + iconSvg + '</span><span class="ar-label">' + labelText + '</span>';
  }

  function applyAutoRotateState(state) {
    autoRotateState = state;
    var ctrl = root.controls;
    if (ctrl) {
      if (state === 'cw') {
        ctrl.autoRotate = true;
        ctrl.autoRotateSpeed = -2.0;
      } else if (state === 'ccw') {
        ctrl.autoRotate = true;
        ctrl.autoRotateSpeed = 2.0;
      } else {
        ctrl.autoRotate = false;
      }
    }

    var btn = document.getElementById('btn-auto-rotate');
    if (btn) {
      btn.setAttribute('data-rotate-state', state);
      btn.classList.toggle('is-active', state !== 'off');
      btn.innerHTML = getAutoRotateButtonHtml(state);
      var tip = state === 'cw'
        ? 'Auto-Rotate: Clockwise (CW) — Click for Counter-Clockwise (CCW)'
        : (state === 'ccw'
          ? 'Auto-Rotate: Counter-Clockwise (CCW) — Click to Stop'
          : 'Auto-Rotate: Off — Click for Clockwise (CW)');
      btn.title = tip;
      btn.setAttribute('aria-label', tip);
    }
  }

  function syncAutoRotateVisibility() {
    var btn = document.getElementById('btn-auto-rotate');
    if (!btn) return;
    var theoryEl = document.getElementById('theory-overlay');
    var schEl = document.getElementById('schematic-overlay');
    var j2dEl = document.getElementById('junction-2d-overlay');
    var isHiddenOverlay = function (el) {
      if (!el) return false;
      return el.classList.contains('visible') || el.style.display === 'block' || el.style.display === 'flex';
    };
    var hide = isHiddenOverlay(theoryEl) || isHiddenOverlay(schEl) || isHiddenOverlay(j2dEl);
    btn.style.display = hide ? 'none' : '';
  }

  function initAutoRotateControl() {
    var vp = document.getElementById('viewport-wrap');
    if (!vp) return;
    var btn = document.getElementById('btn-auto-rotate');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'btn-auto-rotate';
      btn.className = 'auto-rotate-btn';
      vp.appendChild(btn);
    }
    if (!btn.dataset.arBound) {
      btn.dataset.arBound = '1';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = AUTO_ROTATE_STATES.indexOf(autoRotateState);
        var next = AUTO_ROTATE_STATES[(idx + 1) % AUTO_ROTATE_STATES.length];
        applyAutoRotateState(next);
      });
    }
    applyAutoRotateState(autoRotateState);
    syncAutoRotateVisibility();

    if (typeof MutationObserver !== 'undefined') {
      ['theory-overlay', 'schematic-overlay', 'junction-2d-overlay'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && !el.dataset.arObserved) {
          el.dataset.arObserved = '1';
          var obs = new MutationObserver(syncAutoRotateVisibility);
          obs.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
        }
      });
    }
  }

  root.SiliconAutoRotate = {
    init: initAutoRotateControl,
    setState: applyAutoRotateState,
    getState: function () { return autoRotateState; }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAutoRotateControl);
    } else {
      initAutoRotateControl();
    }
  }

  root.SiliconViewer = SiliconViewer;

})(typeof window !== 'undefined' ? window : this);
