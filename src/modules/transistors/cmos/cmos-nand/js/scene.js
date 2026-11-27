/* Three.js scene, camera, renderer, OrbitControls, 3-point lighting, grid & theme sync */

var wrapEl = document.getElementById('canvas-host') || document.getElementById('canvas-wrap');

function W() {
  return (wrapEl && wrapEl.clientWidth) || window.innerWidth;
}

function H() {
  return (wrapEl && wrapEl.clientHeight) || (window.innerHeight - 80);
}

var TOP_VIEW_POS = typeof THREE !== 'undefined' ? new THREE.Vector3(0.8, 58, 0.05) : null;
var INITIAL_POS = typeof THREE !== 'undefined' ? new THREE.Vector3(23.5, 21.8, 29.8) : null;
var INITIAL_TARGET = typeof THREE !== 'undefined' ? new THREE.Vector3(0.4, 2.8, 0.0) : null;
var TOUR_CLOSEUP_POS = [6.0, 6.8, 17.6];
var TOUR_CLOSEUP_TARGET = [0.4, 2.3, 0.0];

var scene = null;
var camera = null;
var renderer = null;
var controls = null;
var ambientLight = null;
var keyLight = null;
var fillLight = null;
var rimLight = null;
var studioEnvMap = null;
var gridHelper = null;
var shadowMat = null;
var shadowPlane = null;
var cellGroup = null;

try {
  if (typeof THREE === 'undefined') {
    throw new Error('Three.js (THREE) is not loaded');
  }

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d12);
  scene.fog = new THREE.Fog(0x0a0d12, 60, 220);

  camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 1000);
  camera.position.copy(INITIAL_POS);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(W(), H());
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.localClippingEnabled = true;

  if (wrapEl) {
    wrapEl.appendChild(renderer.domElement);
  }

  if (typeof THREE.OrbitControls === 'function') {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 180;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.target.copy(INITIAL_TARGET);
    controls.update();
  } else {
    console.error('THREE.OrbitControls is not loaded');
  }

  /* 3-Point Studio Lighting */
  ambientLight = new THREE.AmbientLight(0x384152, 1.45);
  scene.add(ambientLight);

  keyLight = new THREE.DirectionalLight(0xffffff, 1.50);
  keyLight.position.set(16, 24, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -28;
  keyLight.shadow.camera.right = 28;
  keyLight.shadow.camera.top = 28;
  keyLight.shadow.camera.bottom = -28;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 85;
  keyLight.shadow.bias = -0.0015;
  scene.add(keyLight);

  fillLight = new THREE.DirectionalLight(0x5fa8d9, 0.48);
  fillLight.position.set(-14, 10, -10);
  scene.add(fillLight);

  rimLight = new THREE.DirectionalLight(0x5fd9c4, 0.35);
  rimLight.position.set(0, 6, -18);
  scene.add(rimLight);

  /* Procedural studio environment reflection map applied to brushed Metal-1 & Tungsten Contacts only (keeps dielectrics free of IBL washout) */
  (function setupStudioEnvMap() {
    try {
      var pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      var envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x475569);

      var topBox = new THREE.Mesh(
        new THREE.PlaneGeometry(44, 44),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      topBox.position.set(0, 14, 0);
      topBox.rotation.x = Math.PI / 2;
      envScene.add(topBox);

      var sideA = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 16),
        new THREE.MeshBasicMaterial({ color: 0xe2e8f0, side: THREE.DoubleSide })
      );
      sideA.position.set(16, 4, 0);
      sideA.rotation.y = -Math.PI / 2;
      envScene.add(sideA);

      var sideB = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 16),
        new THREE.MeshBasicMaterial({ color: 0xcbd5e1, side: THREE.DoubleSide })
      );
      sideB.position.set(-16, 4, 0);
      sideB.rotation.y = Math.PI / 2;
      envScene.add(sideB);

      var rt = pmrem.fromScene(envScene, 0.04);
      studioEnvMap = rt.texture;
      pmrem.dispose();
    } catch (err) {
      console.warn('Studio envMap fallback:', err);
    }
  })();

  /* Ground Grid & Shadow Receiver Plane */
  gridHelper = new THREE.GridHelper(68, 44, 0x1c2530, 0x141a22);
  gridHelper.position.y = -0.02;
  scene.add(gridHelper);

  shadowMat = new THREE.ShadowMaterial({ opacity: 0.28 });
  shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -0.01;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  /* Root cell group */
  cellGroup = new THREE.Group();
  scene.add(cellGroup);
} catch (err) {
  console.error('Three.js / WebGL scene initialization failed:', err);
}

function rebuildGrid(c1, c2) {
  if (!scene || typeof THREE === 'undefined') return;
  if (gridHelper) {
    scene.remove(gridHelper);
    if (gridHelper.geometry) gridHelper.geometry.dispose();
    if (gridHelper.material) gridHelper.material.dispose();
  }
  gridHelper = new THREE.GridHelper(68, 44, c1, c2);
  gridHelper.position.y = -0.02;
  scene.add(gridHelper);
}

function applySceneTheme(theme) {
  if (!scene || !ambientLight || !keyLight || !fillLight || !rimLight || !shadowMat) return;
  var isLight = theme === 'light';
  var bgHex = isLight ? 0xf4f6f8 : 0x0a0d12;
  var bgCss = isLight ? '#f4f6f8' : '#0a0d12';
  scene.background.setHex(bgHex);
  scene.fog.color.setHex(bgHex);
  scene.fog.near = 60;
  scene.fog.far = isLight ? 240 : 220;

  if (wrapEl) wrapEl.style.backgroundColor = bgCss;
  var hostEl = document.getElementById('canvas-host');
  if (hostEl) hostEl.style.backgroundColor = bgCss;
  var vpEl = document.getElementById('viewport-wrap');
  if (vpEl) vpEl.style.backgroundColor = bgCss;

  if (isLight) {
    ambientLight.color.setHex(0xe2e8f0);
    ambientLight.intensity = 0.92;
    keyLight.color.setHex(0xffffff);
    keyLight.intensity = 0.92;
    fillLight.color.setHex(0x94a3b8);
    fillLight.intensity = 0.30;
    rimLight.color.setHex(0x64748b);
    rimLight.intensity = 0.20;
    shadowMat.opacity = 0.16;
    rebuildGrid(0x94a3b8, 0xcbd5e1);
  } else {
    ambientLight.color.setHex(0x384152);
    ambientLight.intensity = 1.45;
    keyLight.color.setHex(0xffffff);
    keyLight.intensity = 1.50;
    fillLight.color.setHex(0x5fa8d9);
    fillLight.intensity = 0.48;
    rimLight.color.setHex(0x5fd9c4);
    rimLight.intensity = 0.35;
    shadowMat.opacity = 0.28;
    rebuildGrid(0x1c2530, 0x141a22);
  }

  if (typeof window.updateFlowTheme === 'function') window.updateFlowTheme(theme);
  if (typeof window.updateNandChannelThemes === 'function') window.updateNandChannelThemes(theme);

  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function resize() {
  if (!camera || !renderer) return;
  var w = W(), h = H();
  if (w <= 0 || h <= 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
window.addEventListener('resize', resize);
window.resize = resize;
if (typeof ResizeObserver !== 'undefined' && wrapEl) {
  var ro = new ResizeObserver(function() { resize(); });
  ro.observe(wrapEl);
  if (wrapEl.parentElement) ro.observe(wrapEl.parentElement);
}
