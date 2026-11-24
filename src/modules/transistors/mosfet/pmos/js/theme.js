/**
 * theme.js
 * Light / Dark Mode theme manager with adaptive color management:
 * Persists theme preference in localStorage, toggles CSS custom properties,
 * and dynamically adapts 3D canvas lighting, background, fog, ground grid, and material contrast.
 */

var currentTheme = 'dark';

function setAllThemeKeys(theme) {
  try {
    localStorage.setItem('silicon_sliders_theme', theme);
    localStorage.setItem('cmos_viewer_theme', theme);
    localStorage.setItem('cmos_nand_viewer_theme', theme);
  } catch(e){}
}

function getStoredTheme() {
  try {
    var saved = localStorage.getItem('silicon_sliders_theme') ||
                localStorage.getItem('cmos_viewer_theme') ||
                localStorage.getItem('cmos_nand_viewer_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
  } catch(e){}
  return 'dark';
}

function initTheme(){
  currentTheme = getStoredTheme();
  applyTheme(currentTheme, false);

  var toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn){
    toggleBtn.addEventListener('click', function(){
      var nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme, true);
    });
  }

  // Auto-sync when returning via browser back button or bfcache
  window.addEventListener('pageshow', function () {
    var fresh = getStoredTheme();
    if (fresh !== currentTheme) {
      applyTheme(fresh, false);
    }
  });

  // Cross-tab sync
  window.addEventListener('storage', function (e) {
    if (e.key === 'silicon_sliders_theme' || e.key === 'cmos_viewer_theme' || e.key === 'cmos_nand_viewer_theme') {
      if (e.newValue === 'light' || e.newValue === 'dark') {
        applyTheme(e.newValue, false);
      }
    }
  });
}

function applyTheme(theme, savePreference){
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);

  if (savePreference){
    setAllThemeKeys(theme);
  }

  var btn = document.getElementById('btn-theme-toggle');
  if (btn){
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme');
    btn.title = theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme';
    var label = document.getElementById('theme-btn-label');
    if (label){
      label.textContent = theme === 'dark' ? 'LIGHT' : 'DARK';
    }
  }

  var sun = document.getElementById('theme-icon-sun');
  var moon = document.getElementById('theme-icon-moon');
  if (sun && moon) {
    sun.style.display = theme === 'dark' ? 'inline-block' : 'none';
    moon.style.display = theme === 'dark' ? 'none' : 'inline-block';
  }

  // 1. Adapt 3D Scene lighting, background, fog & grid
  if (typeof applySceneTheme === 'function'){
    applySceneTheme(theme);
  }

  // 2. Adapt 3D mesh material colors, outlines & label chips
  if (typeof updateMaterialsTheme === 'function'){
    updateMaterialsTheme();
  }

  // 3. Update selection highlight color
  if (typeof HIGHLIGHT_COLOR !== 'undefined' && typeof cssVar === 'function'){
    var hlHex = cssVar('--highlight');
    if (hlHex) HIGHLIGHT_COLOR.set(hlHex);
  }

  // 4. Redraw IV graph in active theme
  if (typeof applyLogicState === 'function'){
    applyLogicState();
  }
  if (typeof updateFlowTheme === 'function'){
    updateFlowTheme(theme);
  }
}
