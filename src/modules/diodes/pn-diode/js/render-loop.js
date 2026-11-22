/**
 * render-loop.js - PN Junction Diode CAD Viewer
 * Main WebGL rendering loop, particle tick, and dynamic emission animation.
 */

var clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  var delta = clock.getDelta();

  if (controls && controls.update) {
    controls.update();
  }

  // Update carrier/current particle drift & thermal jitter
  if (typeof updateFlowParticles === 'function') {
    updateFlowParticles(delta);
  }

  // Dynamic breakdown high-field glow pulsing
  if (breakdownGlowMesh && breakdownGlowMesh.visible && diodeMaterials.breakdownGlow) {
    diodeMaterials.breakdownGlow.opacity = 0.38 + 0.28 * Math.sin(Date.now() * 0.009);
  }

  if (renderer && scene && activeCamera) {
    renderer.render(scene, activeCamera);
  }
}
