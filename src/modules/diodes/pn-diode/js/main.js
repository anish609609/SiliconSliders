/**
 * main.js - PN Junction Diode CAD Viewer
 * Application orchestrator and bootstrapping entry point.
 */

window.addEventListener('DOMContentLoaded', function () {
  try {
    // 1. Initialize Theme (Light / Dark)
    initTheme();

    // 2. Build 3D Physical Geometry
    buildDiodeGeometry();

    // 3. Initialize Left and Right Panels
    initUIPanels();

    // 4. Initialize Lambda Rules & Scaling Dimensions
    initDimensions();

    // 5. Initialize Raycasting & Selection Inspector
    initSelection();

    // 6. Initialize Layer Explosion & Section Scrubbing
    initExplodeAndScrub();

    // 7. Initialize View Switcher (Theory vs 3D Layout vs Schematic)
    initViewMode();

    // 8. Initialize Carrier Flow Mode Controls
    initFlowControls();

    // 9. Initialize Interactive I-V & Field Profiles Graphs
    initGraphs();

    // 10. Initialize Sliders, Presets, and Physics Telemetry
    initLogicControls();

    // 11. Initial WebGL Canvas Sizing
    resize();

    // 12. Start Three.js Animation Loop
    animate();

    // 13. Dismiss Loading Screen
    var loading = document.getElementById('loading');
    if (loading) {
      setTimeout(function () {
        loading.classList.add('fade-out');
        setTimeout(function () {
          loading.style.display = 'none';
        }, 350);
      }, 300);
    }
  } catch (err) {
    console.error('Initialization error in PN Diode viewer:', err);
    var loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">' +
                          '<b>ERROR INITIALIZING VIEWPORT</b><br>' + err.message + '</div>';
    }
  }
});
