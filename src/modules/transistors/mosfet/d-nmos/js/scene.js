/**
 * scene.js
 * Three.js bootstrap: scene, camera, renderer, OrbitControls, lighting, ground grid and shadow catcher. No CMOS-specific geometry lives here.
 */

// =====================================================================
// THREE.JS SETUP
// =====================================================================
var host = document.getElementById('canvas-host');
var scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d12);
scene.fog = new THREE.Fog(0x0a0d12, 60, 220);

var W = function(){ return host.clientWidth; };
var H = function(){ return host.clientHeight; };

var camPersp = new THREE.PerspectiveCamera(42, W()/H(), 0.1, 1000);
var INITIAL_POS = new THREE.Vector3(19.0, 19.2, 24.0);
var INITIAL_TARGET = new THREE.Vector3(0.4, 3.8, 0.0);
var TOUR_CLOSEUP_POS = [3.6, 5.8, 12.6];
var TOUR_CLOSEUP_TARGET = [0.2, 3.0, 0.0];
var TOP_VIEW_POS = new THREE.Vector3(1.2, 55, 0.05); // straight overhead, captures full 100% exploded stack
camPersp.position.copy(INITIAL_POS);

var renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
host.appendChild(renderer.domElement);

var activeCamera = camPersp;
var controls = new THREE.OrbitControls(activeCamera, renderer.domElement);
controls.target.copy(INITIAL_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 160;
controls.maxPolarAngle = Math.PI;   // full orbit — including looking up from underneath
controls.minPolarAngle = 0;
controls.update();

function resize(){
  var w = W(), h = H();
  if (w <= 0 || h <= 0) return;
  camPersp.aspect = w/h; camPersp.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (renderer && scene && activeCamera) {
    renderer.render(scene, activeCamera);
  }
}
window.addEventListener('resize', resize);
if (typeof ResizeObserver !== 'undefined' && host) {
  var ro = new ResizeObserver(function() { resize(); });
  ro.observe(host);
  if (host.parentElement) ro.observe(host.parentElement);
}

// lights
var ambientLight = new THREE.AmbientLight(0x384152, 1.45);
scene.add(ambientLight);
var key = new THREE.DirectionalLight(0xffffff, 1.50);
key.position.set(16, 24, 12);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -24; key.shadow.camera.right = 24;
key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
key.shadow.camera.far = 85;
key.shadow.bias = -0.0015;
scene.add(key);
var fill = new THREE.DirectionalLight(0x5fa8d9, 0.48);
fill.position.set(-14, 10, -10);
scene.add(fill);
var rim = new THREE.DirectionalLight(0x5fd9c4, 0.35);
rim.position.set(0, 6, -18);
scene.add(rim);

// grid + ground shadow catcher
var grid = new THREE.GridHelper(60, 40, 0x1c2530, 0x141a22);
grid.position.y = -0.02;
grid.renderOrder = -10;
if (grid.material) {
  grid.material.depthTest = true;
  grid.material.depthWrite = false;
}
scene.add(grid);
var shadowPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(90,90),
  new THREE.ShadowMaterial({ opacity: 0.28 })
);
shadowPlane.rotation.x = -Math.PI/2;
shadowPlane.position.y = -0.01;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// Adaptive 3D Canvas Lighting & Environment for Light/Dark Mode
function applySceneTheme(theme){
  var isLight = theme === 'light';
  var themeBg = isLight ? '#f4f6f8' : '#0a0d12';
  if (host) host.style.backgroundColor = themeBg;
  var vw = document.getElementById('viewport-wrap');
  if (vw) vw.style.backgroundColor = themeBg;

  if (isLight){
    scene.background = new THREE.Color(0xf4f6f8);
    if (scene.fog){
      scene.fog.color.setHex(0xf4f6f8);
      scene.fog.near = 60;
      scene.fog.far = 240;
    }
    ambientLight.color.setHex(0xe2e8f0);
    ambientLight.intensity = 0.92;
    key.color.setHex(0xffffff);
    key.intensity = 0.92;
    fill.color.setHex(0x94a3b8);
    fill.intensity = 0.30;
    rim.color.setHex(0x64748b);
    rim.intensity = 0.20;
    shadowPlane.material.opacity = 0.16;
  } else {
    scene.background = new THREE.Color(0x0a0d12);
    if (scene.fog){
      scene.fog.color.setHex(0x0a0d12);
      scene.fog.near = 60;
      scene.fog.far = 220;
    }
    ambientLight.color.setHex(0x384152);
    ambientLight.intensity = 1.45;
    key.color.setHex(0xffffff);
    key.intensity = 1.50;
    fill.color.setHex(0x5fa8d9);
    fill.intensity = 0.48;
    rim.color.setHex(0x5fd9c4);
    rim.intensity = 0.35;
    shadowPlane.material.opacity = 0.28;
  }
  updateGridTheme(isLight);
}

function updateGridTheme(isLight){
  if (grid) scene.remove(grid);
  var c1 = isLight ? 0x94a3b8 : 0x1c2530;
  var c2 = isLight ? 0xcbd5e1 : 0x141a22;
  grid = new THREE.GridHelper(60, 40, c1, c2);
  grid.position.y = -0.02;
  grid.renderOrder = -10;
  if (grid.material) {
    grid.material.depthTest = true;
    grid.material.depthWrite = false;
  }
  scene.add(grid);
}
