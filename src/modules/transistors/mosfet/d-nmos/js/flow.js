/**
 * flow.js - NMOS CAD Viewer
 * Dynamic 3D carrier flow & conventional current simulation:
 * - Ultra-fine quantum electron particles (radius 0.042) streaming from Source to Drain.
 * - Dynamic particle velocity, count, and path directly coupled to MOSFET IDS and operating region.
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
var markerGeom = new THREE.SphereGeometry(0.045, 8, 8);
var carrierMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: true, depthWrite: false });
var currentMat = new THREE.MeshBasicMaterial({ color: 0xffcf4d, depthTest: true, depthWrite: false });
flowGroup.renderOrder = 999;

function createFlowCurve(points) {
  return new THREE.CatmullRomCurve3(points);
}

function rebuildFlowCurves(optIds, optRegion, optDeltaL) {
  // Clear old markers
  while (flowGroup.children.length > 0) {
    flowGroup.remove(flowGroup.children[0]);
  }
  flowCurves = [];
  flowMarkers = [];

  var state = (typeof window.getMosfetPhysicsState === 'function') ? window.getMosfetPhysicsState() : {
    ids: (typeof optIds === 'number' ? optIds : 0.20),
    region: optRegion || 'SATURATION',
    deltaL: optDeltaL || 0.4
  };

  var ids = (typeof optIds === 'number') ? optIds : state.ids;
  var region = optRegion || state.region;
  var deltaL = (typeof optDeltaL === 'number') ? optDeltaL : state.deltaL;

  if (flowMode === 'off' || region === 'CUTOFF' || ids <= 0.0001) {
    flowGroup.visible = false;
    var caption = document.getElementById('flow-caption');
    if (caption) {
      if (flowMode === 'off') {
        caption.textContent = 'CARRIER FLOW: OFF (Simulation Paused)';
      } else {
        caption.textContent = 'CUTOFF REGION (VGS ≤ -0.80V): Negative gate bias fully depletes implanted N-channel; zero electron flow.';
      }
      caption.classList.add('visible');
    }
    return;
  }

  flowGroup.visible = true;

  // Active/Channel layer explosion offset
  var actOffset = groups['dchannel'] ? groups['dchannel'].position : (groups['active'] ? groups['active'].position : new THREE.Vector3());
  var isCarrier = flowMode === 'carrier';

  // Base speed directly driven by calculated drain current IDS
  var currentNorm = Math.min(1.0, Math.max(0.05, ids / 0.5));
  var baseSpeed = 0.0035 + 0.014 * currentNorm;

  // Saturation pinch-off location
  var pinchX = (region === 'SATURATION') ? Math.max(-0.2, 1.0 - deltaL) : 1.0;

  // 5 parallel tracks along transistor width Z (-2.4 to +2.4)
  var zTracks = [-2.4, -1.2, 0.0, 1.2, 2.4];
  var particlesPerTrack = Math.round(7 + 7 * currentNorm);

  zTracks.forEach(function(zOff) {
    var pts = [];
    if (isCarrier) {
      // Electron drift: Source (N+) -> Inversion Channel -> Drain (N+)
      pts.push(new THREE.Vector3(-4.5 + actOffset.x, 2.60 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(-1.8 + actOffset.x, 2.82 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(-1.0 + actOffset.x, 2.94 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(pinchX + actOffset.x, 2.94 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(1.8 + actOffset.x, 2.82 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(4.5 + actOffset.x, 2.60 + actOffset.y, zOff + actOffset.z));
    } else {
      // Conventional current ID: Drain (+VDS) -> Channel -> Source (GND)
      pts.push(new THREE.Vector3(4.5 + actOffset.x, 2.60 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(1.8 + actOffset.x, 2.82 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(pinchX + actOffset.x, 2.94 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(-1.0 + actOffset.x, 2.94 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(-1.8 + actOffset.x, 2.82 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(-4.5 + actOffset.x, 2.60 + actOffset.y, zOff + actOffset.z));
    }

    var curve = createFlowCurve(pts);
    flowCurves.push(curve);

    for (var i = 0; i < particlesPerTrack; i++) {
      var m = new THREE.Mesh(markerGeom, isCarrier ? carrierMat : currentMat);
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
    if (isCarrier) {
      if (region === 'SATURATION') {
        captionEl.textContent = 'SATURATION (PINCH-OFF): Channel pinches off at Leff. High space-charge field sweeps electrons into Drain at velocity saturation.';
      } else {
        captionEl.textContent = 'LINEAR / TRIODE: Continuous inversion channel. Electron drift velocity v = µ·E ∝ VDS.';
      }
    } else {
      captionEl.textContent = 'CONVENTIONAL CURRENT: Positive charge flow (ID = ' + ids.toFixed(2) + ' mA) from Drain to Source.';
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

    // In Saturation, electrons accelerate through the high-field space-charge pinch-off gap
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
