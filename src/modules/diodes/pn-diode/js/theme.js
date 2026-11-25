/**
 * theme.js - PN Junction Diode CAD Viewer
 * Light / Dark Mode theme manager syncing with SiliconSliders globals.
 */

var currentTheme = 'dark';

function setAllThemeKeys(theme) {
  try {
    localStorage.setItem('siliconsliders-theme', theme);
    localStorage.setItem('silicon_sliders_theme', theme);
    localStorage.setItem('cmos_viewer_theme', theme);
    localStorage.setItem('cmos_nand_viewer_theme', theme);
  } catch(e){}
}

function getStoredTheme() {
  try {
    var saved = localStorage.getItem('siliconsliders-theme') ||
                localStorage.getItem('silicon_sliders_theme') ||
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

  window.addEventListener('pageshow', function () {
    var fresh = getStoredTheme();
    if (fresh !== currentTheme) {
      applyTheme(fresh, false);
    }
  });

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
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');

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

  if (typeof applySceneTheme === 'function'){
    applySceneTheme(theme);
  }

  if (typeof updateMaterialsTheme === 'function'){
    updateMaterialsTheme();
  }

  if (typeof SiliconSelectionHighlight !== 'undefined' && typeof selectedMeshes !== 'undefined' && typeof cssVar === 'function'){
    var hlHex = cssVar('--highlight');
    if (hlHex) SiliconSelectionHighlight.updateColor(selectedMeshes, hlHex);
  }

  if (typeof renderGraphs === 'function'){
    renderGraphs();
  }

  if (typeof updateFlowTheme === 'function'){
    updateFlowTheme(theme);
  }
}
