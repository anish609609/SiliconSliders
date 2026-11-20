/**
 * SiliconSliders - Minimalist Homepage Logic
 * Theme persistence (Light / Dark) synchronized with 3D CAD modules
 */

(function () {
  'use strict';

  var THEME_KEY = 'silicon_sliders_theme';
  var LEGACY_KEY_INVERTER = 'cmos_viewer_theme';
  var LEGACY_KEY_NAND = 'cmos_nand_viewer_theme';

  function getStoredTheme() {
    try {
      var saved = localStorage.getItem(THEME_KEY) ||
                  localStorage.getItem(LEGACY_KEY_INVERTER) ||
                  localStorage.getItem(LEGACY_KEY_NAND);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (_) {}
    return 'dark'; // default
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem(LEGACY_KEY_INVERTER, theme);
      localStorage.setItem(LEGACY_KEY_NAND, theme);
    } catch (_) {}
  }

  function applyTheme(theme, save) {
    document.documentElement.setAttribute('data-theme', theme);
    if (save !== false) {
      setStoredTheme(theme);
    }

    var labelEl = document.getElementById('theme-toggle-label');
    var iconSun = document.getElementById('theme-icon-sun');
    var iconMoon = document.getElementById('theme-icon-moon');

    if (labelEl) {
      labelEl.textContent = theme === 'dark' ? 'Light' : 'Dark';
    }
    if (iconSun && iconMoon) {
      if (theme === 'dark') {
        iconSun.style.display = 'inline-block';
        iconMoon.style.display = 'none';
      } else {
        iconSun.style.display = 'none';
        iconMoon.style.display = 'inline-block';
      }
    }

    // Notify any registered listeners (like 3D slab renderer)
    if (typeof window.onPlatformThemeChange === 'function') {
      try { window.onPlatformThemeChange(theme); } catch (_) {}
    }
  }

  function init() {
    var initialTheme = getStoredTheme();
    applyTheme(initialTheme, false);

    var toggleBtn = document.getElementById('btn-theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme') || 'dark';
        var next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next, true);
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Auto-sync when user navigates back to homepage via browser back button or bfcache
  window.addEventListener('pageshow', function () {
    var fresh = getStoredTheme();
    applyTheme(fresh, false);
  });

  // Cross-tab sync
  window.addEventListener('storage', function (e) {
    if (e.key === THEME_KEY || e.key === LEGACY_KEY_INVERTER || e.key === LEGACY_KEY_NAND) {
      if (e.newValue === 'light' || e.newValue === 'dark') {
        applyTheme(e.newValue, false);
      }
    }
  });

  window.applyPlatformTheme = applyTheme;
  window.getPlatformTheme = getStoredTheme;
})();
