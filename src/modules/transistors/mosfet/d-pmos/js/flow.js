/**
 * flow.js - PMOS CAD Viewer
 * Dynamic 3D carrier flow & conventional current simulation:
 * - Ultra-fine quantum hole particles (radius 0.042) streaming from Source (at VDD) to Drain (OUT).
 * - Dynamic particle velocity, count, and path directly coupled to PMOS ISD and operating region.
 * - Saturation pinch-off acceleration across space-charge depletion field.
 * - Dynamic path updates when layers are exploded.
 */

var flowMode = 'carrier'; // 'carrier' | 'current' | 'off'
var flowSeg = document.getElementById('flow-seg');
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
scene.add(flowGroup);

var flowCurves = [];
var flowMarkers = [];

// Fine, small particle sphere geometry (very small fine particles, not bowling balls)
var markerGeom = new THREE.SphereGeometry(0.042, 8, 8);
var isInitialLight = (document.documentElement.getAttribute('data-theme') === 'light');
var palInitFlow = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isInitialLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isInitialLight ? 'light' : 'dark') : null);

var HOLE_COLOR_DARK = palInitFlow ? palInitFlow.holeFlow : '#F43F5E';
var HOLE_COLOR_LIGHT = '#BE123C';
var CURRENT_COLOR_DARK = '#FFCF4D';
var CURRENT_COLOR_LIGHT = '#D97706';

var holeMat = new THREE.MeshBasicMaterial({ color: isInitialLight ? HOLE_COLOR_LIGHT : HOLE_COLOR_DARK, depthTest: true, depthWrite: false });
var currentMat = new THREE.MeshBasicMaterial({ color: isInitialLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK, depthTest: true, depthWrite: false });

window.updateFlowTheme = function(theme) {
  var isLight = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light';
  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
  var hCol = pal ? pal.holeFlow : (isLight ? HOLE_COLOR_LIGHT : HOLE_COLOR_DARK);

  if (holeMat) holeMat.color.set(hCol);
  if (currentMat) currentMat.color.set(isLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK);
};

function createFlowCurve(points) {
  return new THREE.CatmullRomCurve3(points);
}

function rebuildFlowCurves(optIsd, optRegion, optDeltaL) {
  // Clear old markers
  while (flowGroup.children.length > 0) {
    flowGroup.remove(flowGroup.children[0]);
  }
  flowCurves = [];
  flowMarkers = [];

  var state = (typeof window.getMosfetPhysicsState === 'function') ? window.getMosfetPhysicsState() : {
    isd: (typeof optIsd === 'number' ? optIsd : 0.15),
    region: optRegion || 'SATURATION',
    deltaL: optDeltaL || 0.4
  };

  var isd = (typeof optIsd === 'number') ? optIsd : (state.isd !== undefined ? state.isd : state.ids);
  var region = optRegion || state.region;
  var deltaL = (typeof optDeltaL === 'number') ? optDeltaL : state.deltaL;

  if (flowMode === 'off' || region === 'CUTOFF' || isd <= 0.0001) {
    flowGroup.visible = false;
    var caption = document.getElementById('flow-caption');
    if (caption) {
      if (flowMode === 'off') {
        caption.textContent = 'CARRIER FLOW: OFF (Simulation Paused)';
      } else {
        caption.textContent = 'CUTOFF REGION (VGS ≥ +0.80V): Implantation channel depleted of mobile holes; conduction quenched.';
      }
      caption.classList.add('visible');
    }
    return;
  }

  flowGroup.visible = true;

  // Active / channel layer explosion offset
  var actOffset = groups['dchannel'] ? groups['dchannel'].position : (groups['active'] ? groups['active'].position : new THREE.Vector3());
  var isCarrier = flowMode === 'carrier';

  // Base speed directly driven by calculated drain current ISD
  var currentNorm = Math.min(1.0, Math.max(0.05, isd / 0.5));
  var baseSpeed = 0.0035 + 0.014 * currentNorm;

  // Saturation pinch-off location
  var pinchX = (region === 'SATURATION') ? Math.max(-0.2, 1.0 - deltaL) : 1.0;

  // 5 parallel tracks along wider PMOS transistor width Z (-3.2 to +3.2)
  var zTracks = [-3.2, -1.6, 0.0, 1.6, 3.2];
  var particlesPerTrack = Math.round(7 + 7 * currentNorm);

  zTracks.forEach(function(zOff) {
    var pts = [];
    // Mobile holes (h+) drift from Source (+VDD, left) to Drain (OUT, right)
    // Conventional current (ISD) also flows from Source (+VDD) to Drain (OUT)
    pts.push(new THREE.Vector3(-4.5 + actOffset.x, 2.60 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(-1.8 + actOffset.x, 2.82 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(-1.0 + actOffset.x, 2.84 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(pinchX + actOffset.x, 2.84 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(1.8 + actOffset.x, 2.82 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(4.5 + actOffset.x, 2.60 + actOffset.y, zOff + actOffset.z));

    var curve = createFlowCurve(pts);
    flowCurves.push(curve);

    for (var i = 0; i < particlesPerTrack; i++) {
      var m = new THREE.Mesh(markerGeom, isCarrier ? holeMat : currentMat);
      m.userData = {
        curve: curve,
        progress: (i / particlesPerTrack) + Math.random() * 0.04,
        speed: baseSpeed * (0.88 + Math.random() * 0.24),
        isSaturation: region === 'SATURATION'
      };
      flowGroup.add(m);
      flowMarkers.push(m);
    }
  });

  var captionEl = document.getElementById('flow-caption');
  if (captionEl) {
    var mode = state.mode || 'zero';
    if (isCarrier) {
      if (mode === 'depletion') {
        captionEl.textContent = 'HOLE DRIFT (DEPLETION MODE): Positive gate (0V < VGS < +0.80V) thins implanted P-channel, curbing hole transport.';
      } else if (mode === 'zero') {
        captionEl.textContent = 'HOLE DRIFT (ZERO BIAS VGS=0V): Pre-existing implanted P-channel conducts mobile holes without gate bias (Normally ON).';
      } else if (mode === 'enhancement') {
        captionEl.textContent = 'HOLE DRIFT (ENHANCEMENT MODE): Negative gate (VGS < 0V) accumulates extra mobile holes, increasing conductivity.';
      } else {
        captionEl.textContent = 'HOLE DRIFT: Mobile holes (h⁺) drift from Source (+VDD) through P-channel to Drain.';
      }
    } else {
      captionEl.textContent = 'CONVENTIONAL CURRENT (ISD): Positive charge flow from Source to Drain pulls output node towards VDD.';
    }
    captionEl.classList.add('visible');
  }
}

function stepFlowMarkers(dt) {
  updateFlowMarkers(dt);
}

function updateFlowMarkers() {
  if (flowMode === 'off' || !flowMarkers.length || !flowGroup.visible) return;

  for (var i = 0; i < flowMarkers.length; i++) {
    var m = flowMarkers[i];
    var currentSpeed = m.userData.speed;

    // Acceleration across pinch-off space-charge region in Saturation
    if (m.userData.isSaturation && m.userData.progress >= 0.55 && m.userData.progress <= 0.85) {
      currentSpeed *= 2.4;
    }

    m.userData.progress += currentSpeed;
    if (m.userData.progress > 1.0) m.userData.progress -= 1.0;

    var pt = m.userData.curve.getPointAt(m.userData.progress);
    if (pt) m.position.copy(pt);
  }
}

if (flowSeg) {
  flowSeg.querySelectorAll('button').forEach(function(b) {
    b.addEventListener('click', function() {
      flowMode = b.dataset.flow;
      flowSeg.querySelectorAll('button').forEach(function(btn) { btn.classList.remove('active'); });
      b.classList.add('active');
      rebuildFlowCurves();
    });
  });
}

if (typeof window.updateFlowTheme === "function") window.updateFlowTheme();
