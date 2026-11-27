/**
 * flow.js - CMOS Inverter CAD Viewer
 * High-Contrast Unified InstancedMesh Carrier & Current Flow Streaks:
 * - Zero separate static dots: uses InstancedMesh streamlined tapered capsules/streaks
 *   for both PMOS (holes / VDD->OUT pull-up), NMOS (electrons / GND->OUT pull-down),
 *   and shoot-through (VDD -> PMOS -> OUT -> NMOS -> GND near VM).
 * - Scales parallel channel lane count & streak density live with Wp and Wn.
 * - Dynamically tracks live L / Wp / Wn geometry and Explode (X/Y/Z) layer offsets.
 */

var flowMode = 'current'; // 'current' | 'carrier' | 'off'
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
flowGroup.userData.decorative = true;
flowGroup.userData.isFlowHelper = true;
scene.add(flowGroup);

var MAX_STREAKS_PER_POOL = 220;

var ELEC_COLOR_DARK   = '#F59E0B'; // Electric Amber/Gold for electrons
var ELEC_COLOR_LIGHT  = '#D97706';
var HOLE_COLOR_DARK   = '#38BDF8'; // Electric Sky Cyan for PMOS holes
var HOLE_COLOR_LIGHT  = '#0284C7';
var CURR_COLOR_DARK   = '#F43F5E'; // High-contrast Crimson-Rose for conventional current
var CURR_COLOR_LIGHT  = '#E11D48';

function createFlowStreakGeometry() {
  if (typeof THREE.LatheGeometry === 'function') {
    var profile = [
      new THREE.Vector2(0.001, -0.16),
      new THREE.Vector2(0.012, -0.12),
      new THREE.Vector2(0.025, -0.05),
      new THREE.Vector2(0.038,  0.02),
      new THREE.Vector2(0.040,  0.07),
      new THREE.Vector2(0.028,  0.105),
      new THREE.Vector2(0.001,  0.125)
    ];
    var lathe = new THREE.LatheGeometry(profile, 10);
    lathe.rotateX(Math.PI / 2);
    return lathe;
  }
  return new THREE.SphereGeometry(0.045, 8, 8);
}

var isInitLightFlow = document.documentElement.getAttribute('data-theme') === 'light';
var sharedStreakGeom = createFlowStreakGeometry();

function createStreakInstancedPool(colorHex) {
  var mat = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false
  });
  var mesh;
  if (typeof THREE.InstancedMesh === 'function') {
    mesh = new THREE.InstancedMesh(sharedStreakGeom, mat, MAX_STREAKS_PER_POOL);
  } else {
    mesh = new THREE.Group();
    mesh.isInstancedMesh = true;
    mesh.geometry = sharedStreakGeom;
    mesh.material = mat;
    mesh.count = 0;
    mesh.instanceMatrix = { needsUpdate: false };
    mesh.setMatrixAt = function() {};
  }
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 8;
  mesh.raycast = function() {};
  mesh.userData.decorative = true;
  mesh.userData.isFlowHelper = true;
  flowGroup.add(mesh);
  return { mesh: mesh, mat: mat, records: [] };
}

var pmosPool = createStreakInstancedPool(isInitLightFlow ? CURR_COLOR_LIGHT : CURR_COLOR_DARK);
var nmosPool = createStreakInstancedPool(isInitLightFlow ? CURR_COLOR_LIGHT : CURR_COLOR_DARK);

var _flowDummy = new THREE.Object3D();
var _flowLookTarget = new THREE.Vector3();

function updateFlowTheme(theme) {
  var isLight = theme === 'light';
  var isCurr = flowMode === 'current';
  if (pmosPool.mat && pmosPool.mat.color) {
    pmosPool.mat.color.set(isCurr ? (isLight ? CURR_COLOR_LIGHT : CURR_COLOR_DARK) : (isLight ? HOLE_COLOR_LIGHT : HOLE_COLOR_DARK));
  }
  if (nmosPool.mat && nmosPool.mat.color) {
    nmosPool.mat.color.set(isCurr ? (isLight ? CURR_COLOR_LIGHT : CURR_COLOR_DARK) : (isLight ? ELEC_COLOR_LIGHT : ELEC_COLOR_DARK));
  }
}
window.updateFlowTheme = updateFlowTheme;

function buildPathCurve(points) {
  return new THREE.CatmullRomCurve3(points);
}

function getGroupOffset(key) {
  if (typeof groups !== 'undefined' && groups[key] && groups[key].position) {
    return groups[key].position;
  }
  return { x: 0, y: 0, z: 0 };
}

function makePt(x, y, z, layerBlend) {
  var aOff = getGroupOffset('active');
  var mOff = getGroupOffset('metal');
  return new THREE.Vector3(
    x + aOff.x * (1 - layerBlend) + mOff.x * layerBlend,
    y + aOff.y * (1 - layerBlend) + mOff.y * layerBlend,
    z + aOff.z * (1 - layerBlend) + mOff.z * layerBlend
  );
}

var _lastFlowGeomKey = '';
var _lastFlowMode = flowMode;
var _flowTime = 0;

function rebuildFlowCurves() {
  pmosPool.records = [];
  nmosPool.records = [];

  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  updateFlowTheme(isLight ? 'light' : 'dark');

  var tourActive = Boolean(window.isTourActive || (typeof isTourActive !== 'undefined' && isTourActive));
  var st = (typeof window.calcCmosState === 'function')
    ? window.calcCmosState(typeof currentVin !== 'undefined' ? currentVin : 'off')
    : { vin: 'off', vout: 0.5, idd: 0, maxIdd: 0.05, vm: 0.5, vthN: 0.30, vthP: 0.30, wp: 240, wn: 120, nmosReg: 'CUTOFF', pmosReg: 'CUTOFF' };

  if (tourActive || flowMode === 'off' || st.vin === 'off') {
    flowGroup.visible = false;
    pmosPool.mesh.count = 0;
    nmosPool.mesh.count = 0;
    if (pmosPool.mesh.instanceMatrix) pmosPool.mesh.instanceMatrix.needsUpdate = true;
    if (nmosPool.mesh.instanceMatrix) nmosPool.mesh.instanceMatrix.needsUpdate = true;
    return;
  }

  flowGroup.visible = true;

  var g3d = (typeof window.getCmosGeom3DState === 'function') ? window.getCmosGeom3DState() : {
    halfL: 1.0, srcX: -2.5, drnX: 2.5,
    pmosZC: 4.55, nmosZC: -4.55,
    wp3d: 6.0, wn3d: 4.3,
    railZp: 9.15, railZn: -7.45
  };

  var halfL = g3d.halfL;
  var srcX = g3d.srcX;
  var drnX = g3d.drnX;
  var yMetal = 3.05;
  var ySi = 1.90;
  var isCurr = flowMode === 'current';

  var iddNorm = Math.min(1.0, st.idd / Math.max(0.002, st.maxIdd));
  var isShoot = iddNorm > 0.08;

  // PMOS Pull-Up / Shoot-Through Streaks (active when PMOS channel exists)
  var pActive = st.pmosReg !== 'CUTOFF' && st.pmosReg !== 'SUBTHRESHOLD';
  if (pActive) {
    var lanesP = Math.max(2, Math.min(8, Math.round(1 + (st.wp || 240) / 50)));
    var zSpanP = Math.max(0.4, (g3d.wp3d * 0.5) * 0.78);
    var pSpeed = isShoot ? (0.48 + 0.55 * iddNorm) : 0.24;
    var countPerLaneP = Math.max(3, Math.min(8, Math.round(isShoot ? (5 + 3 * iddNorm) : 4)));

    for (var lp = 0; lp < lanesP; lp++) {
      var fracP = lanesP > 1 ? (lp / (lanesP - 1)) : 0.5;
      var zLaneP = g3d.pmosZC - zSpanP + 2.0 * zSpanP * fracP;

      // Holes & Conventional Current in PMOS both flow from Source (VDD) -> Drain (OUT)
      var ptsP = [
        makePt(srcX - 1.5, yMetal, g3d.railZp, 1.0),
        makePt(srcX,       yMetal, g3d.railZp, 1.0),
        makePt(srcX,       yMetal, zLaneP,     0.95),
        makePt(srcX,       ySi,    zLaneP,     0.0),
        makePt(-halfL * 0.9, ySi,  zLaneP,     0.0),
        makePt(0,          ySi,    zLaneP,     0.0),
        makePt(halfL * 0.9, ySi,   zLaneP,     0.0),
        makePt(drnX,       ySi,    zLaneP,     0.0),
        makePt(drnX,       yMetal, zLaneP,     0.95)
      ];
      if (isShoot) {
        ptsP.push(makePt(drnX, yMetal, 0.0, 1.0));
      } else {
        ptsP.push(makePt(drnX, yMetal, 0.0, 1.0));
        ptsP.push(makePt(drnX + 3.2, yMetal, 0.0, 1.0));
      }

      var curveP = buildPathCurve(ptsP);
      for (var ip = 0; ip < countPerLaneP; ip++) {
        if (pmosPool.records.length >= MAX_STREAKS_PER_POOL) break;
        pmosPool.records.push({
          curve: curveP,
          phase: (ip / countPerLaneP) + ((lp * 0.17) % 1.0),
          speed: pSpeed,
          scaleLen: isShoot ? (1.15 + 0.55 * iddNorm) : 0.95,
          scaleRad: isShoot ? 1.05 : 0.90,
          isPmos: true,
          zLane: zLaneP,
          halfL: halfL
        });
      }
    }
  }

  // NMOS Pull-Down / Shoot-Through Streaks (active when NMOS channel exists)
  var nActive = st.nmosReg !== 'CUTOFF' && st.nmosReg !== 'SUBTHRESHOLD';
  if (nActive) {
    var lanesN = Math.max(2, Math.min(8, Math.round(1 + (st.wn || 120) / 50)));
    var zSpanN = Math.max(0.4, (g3d.wn3d * 0.5) * 0.78);
    var nSpeed = isShoot ? (0.50 + 0.58 * iddNorm) : 0.24;
    var countPerLaneN = Math.max(3, Math.min(8, Math.round(isShoot ? (5 + 3 * iddNorm) : 4)));

    for (var ln = 0; ln < lanesN; ln++) {
      var fracN = lanesN > 1 ? (ln / (lanesN - 1)) : 0.5;
      var zLaneN = g3d.nmosZC - zSpanN + 2.0 * zSpanN * fracN;

      // Current mode: Conventional Current flows OUT (or VDD->OUT) -> NMOS Drain -> NMOS Source -> GND
      // Carrier mode: Electrons flow GND -> NMOS Source -> NMOS Drain -> OUT
      var ptsCurr = [
        makePt(drnX + (isShoot ? 0.0 : 3.2), yMetal, 0.0, 1.0),
        makePt(drnX,       yMetal, 0.0,        1.0),
        makePt(drnX,       yMetal, zLaneN,     0.95),
        makePt(drnX,       ySi,    zLaneN,     0.0),
        makePt(halfL * 0.9, ySi,   zLaneN,     0.0),
        makePt(0,          ySi,    zLaneN,     0.0),
        makePt(-halfL * 0.9, ySi,  zLaneN,     0.0),
        makePt(srcX,       ySi,    zLaneN,     0.0),
        makePt(srcX,       yMetal, zLaneN,     0.95),
        makePt(srcX,       yMetal, g3d.railZn, 1.0),
        makePt(srcX - 1.5, yMetal, g3d.railZn, 1.0)
      ];
      var ptsElec = ptsCurr.slice().reverse();
      var curveN = buildPathCurve(isCurr ? ptsCurr : ptsElec);

      for (var inIdx = 0; inIdx < countPerLaneN; inIdx++) {
        if (nmosPool.records.length >= MAX_STREAKS_PER_POOL) break;
        nmosPool.records.push({
          curve: curveN,
          phase: (inIdx / countPerLaneN) + ((ln * 0.23) % 1.0),
          speed: nSpeed,
          scaleLen: isShoot ? (1.15 + 0.55 * iddNorm) : 0.95,
          scaleRad: isShoot ? 1.05 : 0.90,
          isPmos: false,
          zLane: zLaneN,
          halfL: halfL
        });
      }
    }
  }

  _lastFlowGeomKey = [g3d.halfL.toFixed(3), g3d.wp3d.toFixed(2), g3d.wn3d.toFixed(2), getGroupOffset('metal').y.toFixed(2), getGroupOffset('active').y.toFixed(2), st.vin, flowMode].join('|');
  _lastFlowMode = flowMode;
  stepFlowMarkers(0.0);
}
window.rebuildFlowCurves = rebuildFlowCurves;

function refreshConnections() {
  rebuildFlowCurves();
}
window.refreshConnections = refreshConnections;

function updatePoolInstances(pool, t) {
  var mesh = pool.mesh;
  var recs = pool.records;
  var count = Math.min(recs.length, MAX_STREAKS_PER_POOL);
  mesh.count = count;
  if (count === 0) {
    if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
    return;
  }

  for (var i = 0; i < count; i++) {
    var rec = recs[i];
    var s = ((rec.phase + t * rec.speed) % 1.0 + 1.0) % 1.0;
    s = Math.max(0.002, Math.min(0.998, s));
    var pt = rec.curve.getPointAt(s);

    _flowDummy.position.copy(pt);
    if (typeof rec.curve.getTangentAt === 'function') {
      var tan = rec.curve.getTangentAt(s);
      _flowLookTarget.copy(pt).add(tan);
    } else {
      var p1 = rec.curve.getPointAt(Math.max(0.001, s - 0.015));
      var p2 = rec.curve.getPointAt(Math.min(0.999, s + 0.015));
      _flowLookTarget.set(pt.x + (p2.x - p1.x), pt.y + (p2.y - p1.y), pt.z + (p2.z - p1.z));
    }
    _flowDummy.lookAt(_flowLookTarget);
    _flowDummy.scale.set(rec.scaleRad, rec.scaleRad, rec.scaleLen);
    if (typeof _flowDummy.updateMatrix === 'function') {
      _flowDummy.updateMatrix();
    }
    mesh.setMatrixAt(i, _flowDummy.matrix);
  }
  if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
}

function stepFlowMarkers(dt) {
  var tourActive = Boolean(window.isTourActive || (typeof isTourActive !== 'undefined' && isTourActive));
  if (tourActive || flowMode === 'off' || window.currentIn === 'off') {
    pmosPool.mesh.count = 0;
    nmosPool.mesh.count = 0;
    return;
  }

  // Re-anchor bridge curves if Explode layers moved
  var aOff = getGroupOffset('active');
  var mOff = getGroupOffset('metal');
  if (pmosPool.records.length === 0 && nmosPool.records.length === 0) {
    rebuildFlowCurves();
  } else if (Math.abs((aOff.y - mOff.y) - (_lastExplodeDiffY || 0)) > 0.05) {
    _lastExplodeDiffY = aOff.y - mOff.y;
    rebuildFlowCurves();
  }

  _flowTime += (typeof dt === 'number' ? Math.min(0.05, dt) : 0);
  updatePoolInstances(pmosPool, _flowTime);
  updatePoolInstances(nmosPool, _flowTime);
}
var _lastExplodeDiffY = 0;
window.stepFlowMarkers = stepFlowMarkers;

function initFlowControls() {
  var flowSeg = document.getElementById('flow-seg');
  if (flowSeg) {
    flowSeg.querySelectorAll('button').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var mode = btn.dataset.flow;
        if (!mode) return;
        flowMode = mode;
        flowSeg.querySelectorAll('button').forEach(function(b) {
          b.classList.toggle('active', b.dataset.flow === mode);
        });
        rebuildFlowCurves();
        if (typeof window.applyLogicState === 'function') window.applyLogicState();
      });
    });
  }
}
initFlowControls();
