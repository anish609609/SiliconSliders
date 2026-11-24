/* Dark / Light theme state, CSS variable reader & localStorage persistence */

var THEME_STORAGE_KEY = 'cmos_nand_viewer_theme';
var currentTheme = 'dark';

var THEME_COLOR_FALLBACKS = {
  dark: {
    '--c-substrate': '#3a3f4b',
    '--c-well': '#3f8f6f',
    '--c-active-p': '#cf8a4a',
    '--c-active-n': '#4a92c9',
    '--c-sde-p': '#f0b47a',
    '--c-sde-n': '#8fd0f8',
    '--c-oxide': '#dff0f7',
    '--c-highk': '#a855f7',
    '--c-poly': '#d8503c',
    '--c-contact': '#e8e2d5',
    '--c-metal': '#4f86c9',
    '--c-vdd': '#e35d5d',
    '--c-gnd': '#6b7686',
    '--c-in': '#e6c94a',
    '--c-out': '#57cf8f',
    '--highlight': '#ff2fb0',
    '--accent': '#5fd9c4'
  },
  light: {
    '--c-substrate': '#64748B',
    '--c-well': '#52B788',
    '--c-active-p': '#d97706',
    '--c-active-n': '#0284c7',
    '--c-sde-p': '#f59e0b',
    '--c-sde-n': '#38bdf8',
    '--c-oxide': '#0284c7',
    '--c-highk': '#7c3aed',
    '--c-poly': '#dc2626',
    '--c-contact': '#334155',
    '--c-metal': '#2563eb',
    '--c-vdd': '#dc2626',
    '--c-gnd': '#475569',
    '--c-in': '#d97706',
    '--c-out': '#16a34a',
    '--highlight': '#db2777',
    '--accent': '#0d9488'
  }
};

function safeStorageGet(key) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch (_) {}
  return null;
}

function safeStorageSet(key, val) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, val);
    }
  } catch (_) {}
}

function cssVar(name) {
  try {
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && document.documentElement) {
      var val = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (val) return val;
    }
  } catch (_) {}
  var tbl = THEME_COLOR_FALLBACKS[currentTheme] || THEME_COLOR_FALLBACKS.dark;
  return tbl[name] || '#ffffff';
}

function setAllThemeKeys(theme) {
  safeStorageSet('silicon_sliders_theme', theme);
  safeStorageSet('cmos_viewer_theme', theme);
  safeStorageSet('cmos_nand_viewer_theme', theme);
  safeStorageSet(THEME_STORAGE_KEY, theme);
}

function loadSavedTheme() {
  var saved = safeStorageGet('silicon_sliders_theme') || safeStorageGet(THEME_STORAGE_KEY) || safeStorageGet('cmos_viewer_theme');
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return 'dark';
}

function applyTheme(theme) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }
  setAllThemeKeys(currentTheme);

  var btn = typeof document !== 'undefined' ? (document.getElementById('btn-theme-toggle') || document.getElementById('btn-theme')) : null;
  if (btn) {
    btn.setAttribute('aria-label', currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode');
    btn.title = currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
    var sun = document.getElementById('theme-icon-sun');
    var moon = document.getElementById('theme-icon-moon');
    if (sun && moon) {
      sun.style.display = currentTheme === 'light' ? 'none' : 'block';
      moon.style.display = currentTheme === 'light' ? 'block' : 'none';
    }
  }

  try {
    if (typeof applySceneTheme === 'function') {
      applySceneTheme(currentTheme);
    }
  } catch (err) {
    console.error('applySceneTheme failed:', err);
  }
  try {
    if (typeof updateMaterialsTheme === 'function') {
      updateMaterialsTheme();
    }
  } catch (err) {
    console.error('updateMaterialsTheme failed:', err);
  }
  try {
    if (typeof window.updateFlowTheme === 'function') {
      window.updateFlowTheme(currentTheme);
    }
  } catch (err) {
    console.error('updateFlowTheme failed:', err);
  }
  try {
    if (typeof applyLogicState === 'function') {
      applyLogicState();
    }
  } catch (err) {
    console.error('applyLogicState failed:', err);
  }
  try {
    if (typeof applyLogicTint === 'function') {
      applyLogicTint();
    }
  } catch (err) {
    console.error('applyLogicTint failed:', err);
  }
  try {
    if (typeof drawTransferGraph === 'function') {
      drawTransferGraph();
    }
  } catch (err) {
    console.error('drawTransferGraph failed:', err);
  }
}

function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
}

// Auto-sync when returning via browser back button or bfcache
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', function () {
    var fresh = loadSavedTheme();
    if (fresh !== currentTheme) {
      applyTheme(fresh);
    }
  });

  window.addEventListener('storage', function (e) {
    if (e.key === 'silicon_sliders_theme' || e.key === 'cmos_viewer_theme' || e.key === 'cmos_nand_viewer_theme' || e.key === THEME_STORAGE_KEY) {
      if (e.newValue === 'light' || e.newValue === 'dark') {
        applyTheme(e.newValue);
      }
    }
  });
}

try {
  currentTheme = loadSavedTheme();
  applyTheme(currentTheme);
} catch (err) {
  console.error('Theme initialization failed:', err);
}
