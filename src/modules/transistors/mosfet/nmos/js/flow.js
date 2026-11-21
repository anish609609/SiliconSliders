/**
 * flow.js - NMOS CAD Viewer
 * Dynamic 3D carrier flow & conventional current simulation:
 * - Carrier flow: Electrons (e-, cyan/blue) stream from N+ Source through inversion channel into N+ Drain.
 * - Current flow: Conventional current (ID, gold/amber) flows from Drain to Source.
 * - Dynamic path updates when layers are exploded.
 */

var flowMode = 'carrier'; // 'carrier' | 'current' | 'off'
var flowSeg = document.getElementById('flow-seg');
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
scene.add(flowGroup);

var flowCurves = [];
var flowMarkers = [];
var MARKER_COUNT = 32;

var markerGeom = new THREE.SphereGeometry(0.18, 12, 12);
var carrierMat = new THREE.MeshBasicMaterial({ color: 0x4fd1ff });
var currentMat = new THREE.MeshBasicMaterial({ color: 0xffcf4d });

function createFlowCurve(points, colorHex) {
  var curve = new THREE.CatmullRomCurve3(points);
  return curve;
}

function rebuildFlowCurves() {
  // Clear old markers
  while (flowGroup.children.length > 0) {
    flowGroup.remove(flowGroup.children[0]);
  }
  flowCurves = [];
  flowMarkers = [];

  if (flowMode === 'off' || currentIn === 0) {
    var caption = document.getElementById('flow-caption');
    if (caption) {
      caption.textContent = currentIn === 0 ? 'CHANNEL CUTOFF: No conduction carriers flowing.' : 'FLOW: OFF';
    }
    return;
  }

  // Get active layer offset (if exploded)
  var actOffset = groups['active'] ? groups['active'].position : new THREE.Vector3();
  var isCarrier = flowMode === 'carrier';

  // Construct 3 parallel flow paths along the transistor width (Z: -2.0, 0, 2.0)
  [-2.2, 0, 2.2].forEach(function(zOff) {
    var pts = [];
    if (isCarrier) {
      // Electrons flow: Source (N+) -> Channel -> Drain (N+)
      pts.push(new THREE.Vector3(-4.5 + actOffset.x, -0.4 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(-1.8 + actOffset.x, -0.2 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(0.0 + actOffset.x, -0.08 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(1.8 + actOffset.x, -0.2 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(4.5 + actOffset.x, -0.4 + actOffset.y, zOff + actOffset.z));
    } else {
      // Conventional Current flows: Drain (+VDS) -> Channel -> Source (GND)
      pts.push(new THREE.Vector3(4.5 + actOffset.x, -0.4 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(1.8 + actOffset.x, -0.2 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(0.0 + actOffset.x, -0.08 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(-1.8 + actOffset.x, -0.2 + actOffset.y, zOff + actOffset.z));
      pts.push(new THREE.Vector3(-4.5 + actOffset.x, -0.4 + actOffset.y, zOff + actOffset.z));
    }

    var curve = new THREE.CatmullRomCurve3(pts);
    flowCurves.push(curve);

    // Add particle markers along each path
    for (var i = 0; i < 10; i++) {
      var m = new THREE.Mesh(markerGeom, isCarrier ? carrierMat : currentMat);
      m.userData = {
        curve: curve,
        progress: (i / 10) + Math.random() * 0.05,
        speed: 0.006 + Math.random() * 0.002
      };
      flowGroup.add(m);
      flowMarkers.push(m);
    }
  });

  var captionEl = document.getElementById('flow-caption');
  if (captionEl) {
    if (isCarrier) {
      captionEl.textContent = 'CARRIER FLOW: Electrons (e-) drift from Source (N+) through inversion channel to Drain (N+).';
    } else {
      captionEl.textContent = 'CONVENTIONAL CURRENT: Positive charge flow (ID) from Drain (+VDS) to Source (GND).';
    }
  }
}

function stepFlowMarkers(dt) {
  updateFlowMarkers(dt);
}

function updateFlowMarkers() {
  if (flowMode === 'off' || currentIn === 0 || !flowMarkers.length) return;

  for (var i = 0; i < flowMarkers.length; i++) {
    var m = flowMarkers[i];
    m.userData.progress += m.userData.speed;
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
