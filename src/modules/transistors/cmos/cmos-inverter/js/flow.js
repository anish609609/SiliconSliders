/**
 * flow.js - CMOS Inverter CAD Viewer
 * Dynamic 3D carrier flow & conventional current simulation:
 * - Ultra-fine quantum carrier particles (radius 0.045) streaming through PMOS and NMOS channels.
 * - Accurate physical carrier transport:
 *     * PMOS: Mobile holes (h+) drift from Source (+VDD) through channel to Drain (OUT).
 *     * NMOS: Mobile electrons (e-) drift from Source (GND) through channel to Drain (OUT).
 *     * Transition (Region B-D): Simultaneous conduction forming peak shoot-through current at VM.
 * - Dynamic path updates when layers are exploded.
 * - High-contrast palette in both Dark and Light modes.
 */

// =====================================================================
// CARRIER & CURRENT FLOW SIMULATION
// =====================================================================
if (typeof window.currentIn === 'undefined') window.currentIn = 'off';
var flowMode = 'current'; // 'current' | 'electron'
var flowSeg = document.getElementById('flow-seg');
var flowCaption = document.getElementById('flow-caption');
var markerGroup = new THREE.Group();
markerGroup.name = 'flowGroup';
scene.add(markerGroup);

var PMOS_PATH_IDS = ['vddRail','vddStubPmos','pmosSrcCt','pmosSrc','pmosDrn','pmosDrnCt','outSpine'];
var NMOS_PATH_IDS = ['outSpine','nmosDrnCt','nmosDrn','nmosSrc','nmosSrcCt','gndStubNmos','gndRail'];
var SHOOT_THROUGH_PATH_IDS = [
  'vddRail','vddStubPmos','pmosSrcCt','pmosSrc','pmosDrn','pmosDrnCt',
  'outSpine',
  'nmosDrnCt','nmosDrn','nmosSrc','nmosSrcCt','gndStubNmos','gndRail'
];

var METAL_FLOW_Y = (Y.metalTop + Y.metalBot) / 2;

// Fine spherical particle geometry (quantum charge carrier spheres)
var carrierGeom = new THREE.SphereGeometry(0.045, 8, 8);

// Colors: High contrast in both dark and light modes
var ELECTRON_COLOR_DARK = 0x38bdf8;
var ELECTRON_COLOR_LIGHT = 0x0052cc; // Deep royal cobalt blue
var HOLE_COLOR_DARK = 0xff4fbf;
var HOLE_COLOR_LIGHT = 0xb91c1c;     // Deep crimson
var CURRENT_COLOR_DARK = 0xffcf4d;
var CURRENT_COLOR_LIGHT = 0xb45309;  // Warm deep bronze / amber

var isInitLight = document.documentElement.getAttribute('data-theme') === 'light';

var electronMat = new THREE.MeshBasicMaterial({
  color: isInitLight ? ELECTRON_COLOR_LIGHT : ELECTRON_COLOR_DARK,
  depthTest: true,
  depthWrite: false
});
var holeMat = new THREE.MeshBasicMaterial({
  color: isInitLight ? HOLE_COLOR_LIGHT : HOLE_COLOR_DARK,
  depthTest: true,
  depthWrite: false
});
var currentMat = new THREE.MeshBasicMaterial({
  color: isInitLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK,
  depthTest: true,
  depthWrite: false
});

markerGroup.renderOrder = 999;

function updateFlowTheme(theme) {
  var isLight = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light';
  if (electronMat) electronMat.color.setHex(isLight ? ELECTRON_COLOR_LIGHT : ELECTRON_COLOR_DARK);
  if (holeMat) holeMat.color.setHex(isLight ? HOLE_COLOR_LIGHT : HOLE_COLOR_DARK);
  if (currentMat) currentMat.color.setHex(isLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK);
  if (typeof refreshConnections === 'function') refreshConnections();
}
window.updateFlowTheme = updateFlowTheme;

// Helper to build strictly orthogonal piecewise linear paths inside physical conductors
function createOrthogonalPath(points) {
  var path = new THREE.CurvePath();
  for (var i = 0; i < points.length - 1; i++) {
    var p0 = points[i];
    var p1 = points[i + 1];
    if (p0.distanceTo(p1) > 0.001) {
      path.add(new THREE.LineCurve3(p0, p1));
    }
  }
  return path;
}

// Multi-track curve collections
var pmosTracks = [];
var nmosTracks = [];
var shootTracks = [];

function rebuildFlowCurves() {
  pmosTracks = [];
  nmosTracks = [];
  shootTracks = [];

  var actOffset = groups['active'] ? groups['active'].position : new THREE.Vector3();
  var metalOffset = groups['metal'] ? groups['metal'].position : new THREE.Vector3();

  var actMidY = (Y.actBot + Y.actTop) / 2; // Mid-plane of active silicon slab (1.75)
  var zOffsets = [-1.4, -0.7, 0.0, 0.7, 1.4];

  // 1. PMOS Tracks (VDD Rail -> VDD Stub -> pmosSrcCt Via -> Source Diffusion -> Channel -> Drain Diffusion -> pmosDrnCt Via -> OUT Spine -> OUT Pin)
  zOffsets.forEach(function(dz) {
    var pts = [
      new THREE.Vector3(SRC_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, RAIL_Z + metalOffset.z),
      new THREE.Vector3(SRC_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, PMOS_ZC + metalOffset.z),
      new THREE.Vector3(SRC_X + actOffset.x,   actMidY + actOffset.y,         PMOS_ZC + actOffset.z),
      new THREE.Vector3(SRC_X + 0.6 + actOffset.x, actMidY + actOffset.y,     PMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(CH.min + actOffset.x,  actMidY + actOffset.y,         PMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(CH.max + actOffset.x,  actMidY + actOffset.y,         PMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(DRN_X - 0.6 + actOffset.x, actMidY + actOffset.y,     PMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(DRN_X + actOffset.x,   actMidY + actOffset.y,         PMOS_ZC + actOffset.z),
      new THREE.Vector3(DRN_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, PMOS_ZC + metalOffset.z),
      new THREE.Vector3(DRN_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, 0 + metalOffset.z),
      new THREE.Vector3(DRN_X + 2.5 + metalOffset.x, METAL_FLOW_Y + metalOffset.y, 0 + metalOffset.z)
    ];
    pmosTracks.push(createOrthogonalPath(pts));
  });

  // 2. NMOS Tracks (GND Rail -> GND Stub -> nmosSrcCt Via -> Source Diffusion -> Channel -> Drain Diffusion -> nmosDrnCt Via -> OUT Spine -> OUT Pin)
  zOffsets.forEach(function(dz) {
    var pts = [
      new THREE.Vector3(SRC_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, -RAIL_Z + metalOffset.z),
      new THREE.Vector3(SRC_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, NMOS_ZC + metalOffset.z),
      new THREE.Vector3(SRC_X + actOffset.x,   actMidY + actOffset.y,         NMOS_ZC + actOffset.z),
      new THREE.Vector3(SRC_X + 0.6 + actOffset.x, actMidY + actOffset.y,     NMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(CH.min + actOffset.x,  actMidY + actOffset.y,         NMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(CH.max + actOffset.x,  actMidY + actOffset.y,         NMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(DRN_X - 0.6 + actOffset.x, actMidY + actOffset.y,     NMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(DRN_X + actOffset.x,   actMidY + actOffset.y,         NMOS_ZC + actOffset.z),
      new THREE.Vector3(DRN_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, NMOS_ZC + metalOffset.z),
      new THREE.Vector3(DRN_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, 0 + metalOffset.z),
      new THREE.Vector3(DRN_X + 2.5 + metalOffset.x, METAL_FLOW_Y + metalOffset.y, 0 + metalOffset.z)
    ];
    nmosTracks.push(createOrthogonalPath(pts));
  });

  // 3. Shoot-Through Tracks (VDD Rail -> PMOS Stub -> pmosSrcCt Via -> PMOS Channel -> pmosDrnCt Via -> OUT Spine -> nmosDrnCt Via -> NMOS Channel -> nmosSrcCt Via -> GND Stub -> GND Rail)
  zOffsets.forEach(function(dz) {
    var pts = [
      new THREE.Vector3(SRC_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, RAIL_Z + metalOffset.z),
      new THREE.Vector3(SRC_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, PMOS_ZC + metalOffset.z),
      new THREE.Vector3(SRC_X + actOffset.x,   actMidY + actOffset.y,         PMOS_ZC + actOffset.z),
      new THREE.Vector3(SRC_X + 0.6 + actOffset.x, actMidY + actOffset.y,     PMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(CH.min + actOffset.x,  actMidY + actOffset.y,         PMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(CH.max + actOffset.x,  actMidY + actOffset.y,         PMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(DRN_X - 0.6 + actOffset.x, actMidY + actOffset.y,     PMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(DRN_X + actOffset.x,   actMidY + actOffset.y,         PMOS_ZC + actOffset.z),
      new THREE.Vector3(DRN_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, PMOS_ZC + metalOffset.z),
      new THREE.Vector3(DRN_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, 0 + metalOffset.z),
      new THREE.Vector3(DRN_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, NMOS_ZC + metalOffset.z),
      new THREE.Vector3(DRN_X + actOffset.x,   actMidY + actOffset.y,         NMOS_ZC + actOffset.z),
      new THREE.Vector3(DRN_X - 0.6 + actOffset.x, actMidY + actOffset.y,     NMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(CH.max + actOffset.x,  actMidY + actOffset.y,         NMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(CH.min + actOffset.x,  actMidY + actOffset.y,         NMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(SRC_X + 0.6 + actOffset.x, actMidY + actOffset.y,     NMOS_ZC + dz + actOffset.z),
      new THREE.Vector3(SRC_X + actOffset.x,   actMidY + actOffset.y,         NMOS_ZC + actOffset.z),
      new THREE.Vector3(SRC_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, NMOS_ZC + metalOffset.z),
      new THREE.Vector3(SRC_X + metalOffset.x, METAL_FLOW_Y + metalOffset.y, -RAIL_Z + metalOffset.z)
    ];
    shootTracks.push(createOrthogonalPath(pts));
  });
}
rebuildFlowCurves();

var flowParticles = [];
var PARTICLES_PER_TRACK = 6;

function initFlowParticles() {
  while (markerGroup.children.length > 0) {
    markerGroup.remove(markerGroup.children[0]);
  }
  flowParticles = [];

  // Create a pool of particles capable of displaying PMOS, NMOS, and Shoot-through
  var totalTracks = Math.max(pmosTracks.length, nmosTracks.length, shootTracks.length);
  for (var ti = 0; ti < totalTracks; ti++) {
    for (var pi = 0; pi < PARTICLES_PER_TRACK; pi++) {
      var m = new THREE.Mesh(carrierGeom, currentMat);
      m.visible = false;
      m.userData = {
        trackIdx: ti,
        progress: (pi / PARTICLES_PER_TRACK) + Math.random() * 0.03,
        speed: 0.006 + Math.random() * 0.002
      };
      markerGroup.add(m);
      flowParticles.push(m);
    }
  }
}
initFlowParticles();

function activePathIds() {
  var cur = (typeof currentIn !== 'undefined') ? currentIn : (typeof window.currentIn !== 'undefined' ? window.currentIn : 'off');
  if (cur === 'off') return SHOOT_THROUGH_PATH_IDS;
  if (typeof cur === 'number') {
    if (cur < 0.40) return PMOS_PATH_IDS;
    if (cur > 0.60) return NMOS_PATH_IDS;
    return SHOOT_THROUGH_PATH_IDS;
  }
  return cur === 0 ? PMOS_PATH_IDS : NMOS_PATH_IDS;
}

function updateFlowCaption() {
  if (!flowCaption) return;
  flowCaption.classList.add('visible');
  var cur = (typeof currentIn !== 'undefined') ? currentIn : (typeof window.currentIn !== 'undefined' ? window.currentIn : 'off');
  var isCarrier = (flowMode === 'electron' || flowMode === 'carrier');
  var modeLabel = isCarrier ? 'CARRIER DRIFT' : 'CONVENTIONAL CURRENT';
  var desc = '';

  if (cur === 'off') {
    flowCaption.textContent = 'CIRCUIT STATE: OFF / HIGH-Z (STATIONARY · FLOW INACTIVE)';
    return;
  }

  if (typeof cur === 'number' && cur >= 0.40 && cur <= 0.60) {
    modeLabel += ' [PEAK SHOOT-THROUGH]';
    desc = isCarrier
      ? 'PMOS: Holes (VDD \u2192 OUT) · NMOS: Electrons (GND \u2192 OUT) · Simultaneous Conduction'
      : 'VDD \u2192 PMOS \u2192 OUT \u2192 NMOS \u2192 GND (Both Saturated \u00b7 Peak IDD)';
  } else if (cur === 0 || (typeof cur === 'number' && cur < 0.40)) {
    desc = isCarrier
      ? 'PMOS: Mobile Holes (h+) drift from Source (+VDD) \u2192 Inversion Channel \u2192 Drain (OUT)'
      : 'Positive Current ID flows from VDD Rail \u2192 PMOS \u2192 OUT (Pulling Output HIGH)';
  } else {
    desc = isCarrier
      ? 'NMOS: Mobile Electrons (e-) drift from Source (GND) \u2192 Inversion Channel \u2192 Drain (OUT)'
      : 'Positive Current ID flows from OUT \u2192 NMOS \u2192 GND (Pulling Output LOW)';
  }

  flowCaption.textContent = modeLabel + ': ' + desc;
}

function refreshConnections() {
  selectable.forEach(function(m) { m.userData.pulsing = false; });

  var cur = (typeof currentIn !== 'undefined') ? currentIn : (typeof window.currentIn !== 'undefined' ? window.currentIn : 'off');
  if (cur === 'off') {
    flowParticles.forEach(function(p) { p.visible = false; });
    updateFlowCaption();
    selectable.forEach(function(m) {
      if (m && m.material && m.material.emissive && selectedMeshes.indexOf(m) === -1) {
        m.material.emissive.setHex(m.userData.baseEmissive || 0);
        m.material.emissiveIntensity = m.userData.baseEmissiveIntensity || 0;
      }
    });
    return;
  }

  activePathIds().forEach(function(id) {
    var m = findMesh(id);
    if (m) m.userData.pulsing = true;
  });

  updateFlowCaption();
}

if (flowSeg) {
  flowSeg.addEventListener('click', function(e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    flowSeg.querySelectorAll('button').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    flowMode = (btn.dataset.flow === 'electron' || btn.dataset.flow === 'carrier') ? 'electron' : 'current';
    refreshConnections();
  });
}

function stepFlowMarkers(dt) {
  var cur = (typeof currentIn !== 'undefined') ? currentIn : (typeof window.currentIn !== 'undefined' ? window.currentIn : 'off');
  if (cur === 'off') return;

  var isCarrier = (flowMode === 'electron' || flowMode === 'carrier');
  var isShootThrough = (typeof cur === 'number' && cur >= 0.40 && cur <= 0.60);
  var isPmosOn = (cur === 0 || (typeof cur === 'number' && cur < 0.60));
  var isNmosOn = (cur === 1 || (typeof cur === 'number' && cur > 0.40));

  var speedFactor = 0.08;

  for (var i = 0; i < flowParticles.length; i++) {
    var p = flowParticles[i];
    var ti = p.userData.trackIdx;

    if (isShootThrough) {
      // Both PMOS and NMOS conduct
      var track = shootTracks[ti % shootTracks.length];
      if (!track) continue;

      p.userData.progress += dt * speedFactor * 0.9;
      if (p.userData.progress > 1.0) p.userData.progress -= 1.0;

      var prog = p.userData.progress;
      var pt = track.getPointAt(Math.max(0.001, Math.min(0.999, prog)));
      if (pt) p.position.copy(pt);

      if (isCarrier) {
        // Upper half (VDD to OUT) is holes; lower half (OUT to GND) is electrons
        p.material = (prog < 0.5) ? holeMat : electronMat;
      } else {
        p.material = currentMat;
      }
      p.visible = true;

    } else if (isPmosOn && !isNmosOn) {
      // Region A: PMOS conduction only
      var track = pmosTracks[ti % pmosTracks.length];
      if (!track) continue;

      p.userData.progress += dt * speedFactor;
      if (p.userData.progress > 1.0) p.userData.progress -= 1.0;

      // In PMOS, both holes and current flow Source (VDD) -> Drain (OUT)
      var prog = p.userData.progress;
      var pt = track.getPointAt(Math.max(0.001, Math.min(0.999, prog)));
      if (pt) p.position.copy(pt);

      p.material = isCarrier ? holeMat : currentMat;
      p.visible = true;

    } else if (isNmosOn && !isPmosOn) {
      // Region E: NMOS conduction only
      var track = nmosTracks[ti % nmosTracks.length];
      if (!track) continue;

      p.userData.progress += dt * speedFactor;
      if (p.userData.progress > 1.0) p.userData.progress -= 1.0;

      var prog = p.userData.progress;
      // In NMOS: electrons flow Source (GND) -> Drain (OUT) [forward along track]
      // Conventional current flows Drain (OUT) -> Source (GND) [reverse along track]
      var sampleProg = isCarrier ? prog : (1.0 - prog);
      var pt = track.getPointAt(Math.max(0.001, Math.min(0.999, sampleProg)));
      if (pt) p.position.copy(pt);

      p.material = isCarrier ? electronMat : currentMat;
      p.visible = true;

    } else {
      p.visible = false;
    }
  }
}
