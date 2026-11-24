/**
 * scene.js - PN Junction Diode CAD Viewer
 * Three.js bootstrap: scene, perspective camera, OrbitControls, lights, ground grid, shadow plane, and theme lighting.
 */

var host = document.getElementById('canvas-host');
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d12);
scene.fog = new THREE.Fog(0x0a0d12, 50, 200);

var W = function(){ return host.clientWidth || window.innerWidth; };
var H = function(){ return host.clientHeight || window.innerHeight; };

var camPersp = new THREE.PerspectiveCamera(40, W()/H(), 0.1, 1000);
var INITIAL_POS = new THREE.Vector3(1.5, 24, 32);
var INITIAL_TARGET = new THREE.Vector3(1.5, 0, 0);
camPersp.position.copy(INITIAL_POS);

var renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
host.appendChild(renderer.domElement);

var activeCamera = camPersp;
var controls = new THREE.OrbitControls(activeCamera, renderer.domElement);
controls.target.copy(INITIAL_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 6;
controls.maxDistance = 140;
controls.maxPolarAngle = Math.PI; // Full orbit
controls.minPolarAngle = 0;
controls.update();

function resize(){
  if (!host) return;
  var w = W(), h = H();
  if (w <= 0 || h <= 0) return;
  camPersp.aspect = w / h;
  camPersp.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (renderer && scene && activeCamera) {
    renderer.render(scene, activeCamera);
  }
}
window.addEventListener('resize', resize);

if (window.ResizeObserver && host) {
  var ro = new ResizeObserver(function() {
    resize();
  });
  ro.observe(host);
  if (host.parentElement) {
    ro.observe(host.parentElement);
  }
}

// Lights setup
var ambientLight = new THREE.AmbientLight(0x384152, 1.55);
scene.add(ambientLight);

var key = new THREE.DirectionalLight(0xffffff, 1.60);
key.position.set(16, 26, 18);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -25; key.shadow.camera.right = 25;
key.shadow.camera.top = 25; key.shadow.camera.bottom = -25;
key.shadow.camera.far = 90;
key.shadow.bias = -0.0015;
scene.add(key);

var fill = new THREE.DirectionalLight(0x5fa8d9, 0.55);
fill.position.set(-16, 12, -12);
scene.add(fill);

var rim = new THREE.DirectionalLight(0x5fd9c4, 0.40);
rim.position.set(0, 8, -20);
scene.add(rim);

// Subtle ground grid (soft studio floor)
var grid = new THREE.GridHelper(50, 40, 0x475569, 0x334155);
grid.position.y = -3.5;
grid.renderOrder = -10;
if (grid.material) {
  grid.material.transparent = true;
  grid.material.opacity = 0.10;
  grid.material.depthTest = true;
  grid.material.depthWrite = false;
}
scene.add(grid);

// Ground shadow plane
var shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.ShadowMaterial({ opacity: 0.16 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -3.48;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// Reset camera button hook
var btnResetCam = document.getElementById('btn-reset-cam');
if (btnResetCam) {
  btnResetCam.addEventListener('click', function () {
    if (typeof stopBuildAnimation === 'function') stopBuildAnimation(true);
    controls.reset();
    camPersp.position.copy(INITIAL_POS);
    controls.target.copy(INITIAL_TARGET);
    controls.update();
  });
}

// Adaptive Theme Handler
function applySceneTheme(theme) {
  var isLight = theme === 'light';
  if (isLight) {
    scene.background = new THREE.Color(0xf4f6f8);
    if (scene.fog) {
      scene.fog.color.setHex(0xf4f6f8);
      scene.fog.near = 50;
      scene.fog.far = 220;
    }
    ambientLight.color.setHex(0xe2e8f0);
    ambientLight.intensity = 0.92;
    key.color.setHex(0xffffff);
    key.intensity = 0.92;
    fill.color.setHex(0x94a3b8);
    fill.intensity = 0.30;
    rim.color.setHex(0x0d9488);
    rim.intensity = 0.20;
    if (grid && grid.material) {
      grid.material.color.setHex(0x94a3b8);
      grid.material.opacity = 0.12;
    }
  } else {
    scene.background = new THREE.Color(0x0a0d12);
    if (scene.fog) {
      scene.fog.color.setHex(0x0a0d12);
      scene.fog.near = 50;
      scene.fog.far = 200;
    }
    ambientLight.color.setHex(0x384152);
    ambientLight.intensity = 1.55;
    key.color.setHex(0xffffff);
    key.intensity = 1.60;
    fill.color.setHex(0x5fa8d9);
    fill.intensity = 0.55;
    rim.color.setHex(0x5fd9c4);
    rim.intensity = 0.40;
    if (grid && grid.material) {
      grid.material.color.setHex(0x475569);
      grid.material.opacity = 0.10;
    }
  }
}
