/**
 * Silicon Sliders - Unified Viewer Theme Engine
 * Synchronizes Light / Dark mode across the landing page and all 3D CAD modules
 */

(function (root) {
  'use strict';

  var THEME_KEY = 'silicon_sliders_theme';
  var LEGACY_KEY_INVERTER = 'cmos_viewer_theme';
  var LEGACY_KEY_NAND = 'cmos_nand_viewer_theme';

  var currentTheme = 'dark';
  var listeners = [];

  function getStoredTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY) ||
                  localStorage.getItem(LEGACY_KEY_INVERTER) ||
                  localStorage.getItem(LEGACY_KEY_NAND);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return 'dark';
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(LEGACY_KEY_INVERTER, theme);
      localStorage.setItem(LEGACY_KEY_NAND, theme);
    } catch (_) {}
  }

  function applyTheme(theme, save) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (save !== false) setStoredTheme(theme);

    // Update theme toggle buttons if present
    var labelEl = document.getElementById('theme-btn-label') || document.getElementById('theme-toggle-label');
    if (labelEl) {
      labelEl.textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
    }

    var sunIcon = document.getElementById('theme-icon-sun');
    var moonIcon = document.getElementById('theme-icon-moon');
    if (sunIcon && moonIcon) {
      sunIcon.style.display = theme === 'dark' ? 'inline-block' : 'none';
      moonIcon.style.display = theme === 'dark' ? 'none' : 'inline-block';
    }

    // Call registered scene and material listeners
    listeners.forEach(function (fn) {
      try { fn(theme); } catch (e) { console.warn('Theme listener error:', e); }
    });

    // Global callbacks if defined on window (e.g. applySceneTheme, updateMaterialsTheme)
    if (typeof root.applySceneTheme === 'function') {
      root.applySceneTheme(theme);
    }
    if (typeof root.updateMaterialsTheme === 'function') {
      root.updateMaterialsTheme();
    }
  }

  function toggleTheme() {
    var next = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    return next;
  }

  function onThemeChange(fn) {
    if (typeof fn === 'function') listeners.push(fn);
  }

  function init() {
    var saved = getStoredTheme();
    applyTheme(saved, false);

    var btn = document.getElementById('btn-theme-toggle') || document.getElementById('theme-toggle-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        toggleTheme();
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', function () {
        var fresh = getStoredTheme();
        if (fresh !== currentTheme) {
          applyTheme(fresh, false);
        }
      });
      window.addEventListener('storage', function (e) {
        if (e.key === THEME_KEY || e.key === LEGACY_KEY_INVERTER || e.key === LEGACY_KEY_NAND) {
          if (e.newValue === 'light' || e.newValue === 'dark') {
            applyTheme(e.newValue, false);
          }
        }
      });
    }
  }

  root.ViewerTheme = {
    init: init,
    getTheme: function () { return currentTheme; },
    setTheme: applyTheme,
    toggleTheme: toggleTheme,
    onThemeChange: onThemeChange
  };

  // Run immediately on script load so documentElement has attribute
  init();

})(typeof window !== 'undefined' ? window : this);
