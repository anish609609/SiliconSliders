/* Dark / Light theme state, CSS variable reader & localStorage persistence */

var THEME_STORAGE_KEY = 'cmos_nand_viewer_theme';
var currentTheme = 'dark';

var THEME_COLOR_FALLBACKS = {
  dark: {
    '--c-substrate': '#1E3A5F',
    '--c-well': '#166534',
    '--c-pwell': '#1D4ED8',
    '--c-active-p': '#3B82F6',
    '--c-active-n': '#22C55E',
    '--c-sde-p': '#60A5FA',
    '--c-sde-n': '#4ADE80',
    '--c-oxide': '#67E8F9',
    '--c-highk': '#a855f7',
    '--c-poly': '#DC2626',
    '--c-silicide': '#6e7887',
    '--c-depletion': '#94A3B8',
    '--c-contact': '#CBD5E1',
    '--c-metal': '#94A3B8',
    '--c-vdd': '#e35d5d',
    '--c-gnd': '#6b7686',
    '--c-in': '#e6c94a',
    '--c-out': '#57cf8f',
    '--highlight': '#ff2fb0',
    '--accent': '#5fd9c4'
  },
  light: {
    '--c-substrate': '#7BA7E1',
    '--c-well': '#4ADE80',
    '--c-pwell': '#4A86E8',
    '--c-active-p': '#2563EB',
    '--c-active-n': '#16A34A',
    '--c-sde-p': '#3B82F6',
    '--c-sde-n': '#22C55E',
    '--c-oxide': '#0891B2',
    '--c-highk': '#7c3aed',
    '--c-poly': '#dc2626',
    '--c-silicide': '#647082',
    '--c-depletion': '#64748B',
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
  safeStorageSet('siliconsliders-theme', theme);
  safeStorageSet('silicon_sliders_theme', theme);
  safeStorageSet('cmos_viewer_theme', theme);
  safeStorageSet('cmos_nand_viewer_theme', theme);
  safeStorageSet(THEME_STORAGE_KEY, theme);
}

function getTimeOfDayTheme() {
  try {
    var h = new Date().getHours();
    return (h >= 6 && h < 18) ? 'light' : 'dark';
  } catch (_) {}
  return 'dark';
}

function loadSavedTheme() {
  var saved = safeStorageGet('siliconsliders-theme') || safeStorageGet('silicon_sliders_theme') || safeStorageGet(THEME_STORAGE_KEY) || safeStorageGet('cmos_viewer_theme');
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return getTimeOfDayTheme();
}

function applyTheme(theme, savePreference) {
  currentTheme = theme === 'light' ? 'light' : 'dark';
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    document.documentElement.classList.toggle('light', currentTheme === 'light');
    document.documentElement.classList.toggle('dark', currentTheme === 'dark');
  }
  if (savePreference) {
    setAllThemeKeys(currentTheme);
  }

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
    if (typeof SiliconSelectionHighlight !== 'undefined' && typeof selectedMeshes !== 'undefined') {
      SiliconSelectionHighlight.updateColor(selectedMeshes, cssVar('--highlight'));
    }
  } catch (err) {
    console.error('SiliconSelectionHighlight.updateColor failed:', err);
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
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark', true);
}

// Auto-sync when returning via browser back button or bfcache
if (typeof window !== 'undefined') {
  window.addEventListener('pageshow', function () {
    var fresh = loadSavedTheme();
    if (fresh !== currentTheme) {
      applyTheme(fresh, false);
    }
  });

  window.addEventListener('storage', function (e) {
    if (e.key === 'silicon_sliders_theme' || e.key === 'cmos_viewer_theme' || e.key === 'cmos_nand_viewer_theme' || e.key === THEME_STORAGE_KEY) {
      if (e.newValue === 'light' || e.newValue === 'dark') {
        applyTheme(e.newValue, false);
      }
    }
  });
}

try {
  currentTheme = loadSavedTheme();
  applyTheme(currentTheme, false);
} catch (err) {
  console.error('Theme initialization failed:', err);
}
