/**
 * flow.js - PMOS CAD Viewer
 * Dynamic 3D carrier flow & conventional current simulation:
 * - Carrier flow: Holes (h+, magenta/rose) stream from P+ Source (at VDD) through channel to P+ Drain (OUT).
 * - Current flow: Conventional current (ISD, gold/amber) flows from Source to Drain.
 * - Dynamic path updates when layers are exploded.
 */

var flowMode = 'carrier'; // 'carrier' | 'current' | 'off'
var flowSeg = document.getElementById('flow-seg');
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
scene.add(flowGroup);

var flowCurves = [];
var flowMarkers = [];

var markerGeom = new THREE.SphereGeometry(0.18, 12, 12);
var holeMat = new THREE.MeshBasicMaterial({ color: 0xff4fbf });    // Magenta/rose for holes (h+)
var currentMat = new THREE.MeshBasicMaterial({ color: 0xffcf4d }); // Amber for conventional current

function rebuildFlowCurves() {
  while (flowGroup.children.length > 0) {
    flowGroup.remove(flowGroup.children[0]);
  }
  flowCurves = [];
  flowMarkers = [];

  // PMOS is OFF when currentIn === 1 (high gate voltage)
  if (flowMode === 'off' || currentIn === 1) {
    var caption = document.getElementById('flow-caption');
    if (caption) {
      caption.textContent = currentIn === 1 ? 'CHANNEL CUTOFF: VG = 1.0V keeps PMOS channel pinched off.' : 'FLOW: OFF';
    }
    return;
  }

  var actOffset = groups['active'] ? groups['active'].position : new THREE.Vector3();
  var isCarrier = flowMode === 'carrier';

  // Construct 4 parallel flow paths across the wider PMOS gate (Z: -3.0, -1.0, 1.0, 3.0)
  [-3.0, -1.0, 1.0, 3.0].forEach(function(zOff) {
    var pts = [];
    // Both holes and conventional current flow from Source (at VDD, left) to Drain (right)
    pts.push(new THREE.Vector3(-4.5 + actOffset.x, -0.4 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(-1.8 + actOffset.x, -0.2 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(0.0 + actOffset.x, -0.08 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(1.8 + actOffset.x, -0.2 + actOffset.y, zOff + actOffset.z));
    pts.push(new THREE.Vector3(4.5 + actOffset.x, -0.4 + actOffset.y, zOff + actOffset.z));

    var curve = new THREE.CatmullRomCurve3(pts);
    flowCurves.push(curve);

    for (var i = 0; i < 9; i++) {
      var m = new THREE.Mesh(markerGeom, isCarrier ? holeMat : currentMat);
      m.userData = {
        curve: curve,
        progress: (i / 9) + Math.random() * 0.05,
        speed: 0.005 + Math.random() * 0.002 // Slightly slower speed reflects lower hole mobility μp
      };
      flowGroup.add(m);
      flowMarkers.push(m);
    }
  });

  var captionEl = document.getElementById('flow-caption');
  if (captionEl) {
    if (isCarrier) {
      captionEl.textContent = 'CARRIER FLOW: Mobile holes (h+) drift from Source (P+ at VDD) through channel to Drain (P+ at OUT).';
    } else {
      captionEl.textContent = 'CONVENTIONAL CURRENT: Positive charge flow (ISD) pulls output node up towards VDD.';
    }
  }
}

function updateFlowMarkers() {
  if (flowMode === 'off' || currentIn === 1 || !flowMarkers.length) return;

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
