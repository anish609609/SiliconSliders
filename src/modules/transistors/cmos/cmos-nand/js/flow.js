/**
 * flow.js - CMOS NAND2 CAD Viewer
 * High-Contrast Unified InstancedMesh Carrier & Current Flow Streaks:
 * - Replaces static dotted markers with streamlined InstancedMesh tapered capsules/streaks
 *   for parallel PMOS pull-up branches (MP1, MP2), series NMOS pull-down stack (MN2 -> MN1),
 *   and simultaneous shoot-through conduction near the transition threshold.
 * - Parallel channel lanes & streak density scale dynamically with Wp and Wn.
 * - Adapts live to L, Wp, Wn geometry deformation and Explode (X/Y/Z) layer offsets.
 */

var flowMode = 'current'; // 'current' | 'electron'
var pmosACurve = null;
var pmosBCurve = null;
var nmosSeriesCurve = null;

var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
flowGroup.userData.decorative = true;
scene.add(flowGroup);

var MAX_STREAKS_PER_BRANCH = 180;

var ELECTRON_COLOR_DARK  = 0xf59e0b; // Amber/gold electron drift in NMOS
var ELECTRON_COLOR_LIGHT = 0xd97706;
var HOLE_COLOR_DARK      = 0x38bdf8; // Electric cyan-blue hole flow in PMOS
var HOLE_COLOR_LIGHT     = 0x0284c7;
var CURRENT_COLOR_DARK   = 0xf43f5e; // High-contrast crimson conventional current
var CURRENT_COLOR_LIGHT  = 0xe11d48;

var flowPhase = 0;
var guideLineA = null;
var guideLineB = null;

function createNandStreakGeometry() {
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

var sharedNandStreakGeom = createNandStreakGeometry();

function createBranchPool(initHex) {
  var mat = new THREE.MeshBasicMaterial({
    color: initHex,
    transparent: true,
    opacity: 0.95,
    depthTest: true,
    depthWrite: false
  });
  var mesh;
  if (typeof THREE.InstancedMesh === 'function') {
    mesh = new THREE.InstancedMesh(sharedNandStreakGeom, mat, MAX_STREAKS_PER_BRANCH);
  } else {
    mesh = new THREE.Group();
    mesh.isInstancedMesh = true;
    mesh.geometry = sharedNandStreakGeom;
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
  flowGroup.add(mesh);
  return { mesh: mesh, mat: mat, records: [] };
}

var isInitNandLight = document.documentElement.getAttribute('data-theme') === 'light';
var poolA = createBranchPool(isInitNandLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK);
var poolB = createBranchPool(isInitNandLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK);

var _nandFlowDummy = new THREE.Object3D();
var _nandFlowTarget = new THREE.Vector3();

function pOf(id) {
  var m = meshById[id];
  return m ? m.position : new THREE.Vector3();
}

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

function getCurveColor(curve) {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var isCarrier = (flowMode === 'electron' || flowMode === 'carrier');
  if (!isCarrier) {
    return isLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK;
  }
  if (curve && curve.userData && curve.userData.type === 'pmos') {
    return isLight ? HOLE_COLOR_LIGHT : HOLE_COLOR_DARK;
  }
  return isLight ? ELECTRON_COLOR_LIGHT : ELECTRON_COLOR_DARK;
}

function makeGuideTube(curve, colorHex) {
  var pts = curve.getPoints(64);
  var geo = new THREE.BufferGeometry().setFromPoints(pts);
  var mat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.30,
    depthWrite: false
  });
  var line = new THREE.Line(geo, mat);
  line.raycast = function() {};
  return line;
}

function clearGuideLines() {
  if (guideLineA) {
    flowGroup.remove(guideLineA);
    guideLineA.geometry.dispose();
    guideLineA.material.dispose();
    guideLineA = null;
  }
  if (guideLineB) {
    flowGroup.remove(guideLineB);
    guideLineB.geometry.dispose();
    guideLineB.material.dispose();
    guideLineB = null;
  }
}

function getBranchCenterCurve(kind, zOffset, g3d) {
  var metalY = pOf('vddRail').y;
  var vddZ = pOf('vddRail').z;
  var gndZ = pOf('gndRail').z;
  var outSpineZ = pOf('outSpine').z;
  var outEndX = pOf('outPin').x + 2.5;
  var actMidY = pOf('pmosSharedDrn').y;
  var hL = g3d ? g3d.halfL : 1.0;

  var pA_x = pOf('pmosASrcCt').x;
  var pA_z = pOf('pmosASrcCt').z + zOffset;
  var pSh_x = pOf('pmosSharedDrnCt').x;
  var pSh_z = pOf('pmosSharedDrnCt').z + zOffset;
  var pB_x = pOf('pmosBSrcCt').x;
  var pB_z = pOf('pmosBSrcCt').z + zOffset;
  var gA_x = pOf('polyA').x;
  var gB_x = pOf('polyB').x;

  var nA_x = pOf('nmosASrcCt').x;
  var nA_z = pOf('nmosASrcCt').z + zOffset;
  var nB_x = pOf('nmosBDrnCt').x;
  var nB_z = pOf('nmosBDrnCt').z + zOffset;
  var nMid_x = pOf('nmosMidNode').x;
  var nMid_z = pOf('nmosMidNode').z + zOffset;

  if (kind === 'pmosA') {
    var c1 = createOrthogonalPath([
      new THREE.Vector3(pA_x - 3.0, metalY, vddZ),
      new THREE.Vector3(pA_x, metalY, vddZ),
      new THREE.Vector3(pA_x, metalY, pOf('pmosASrcCt').z),
      new THREE.Vector3(pA_x, actMidY, pA_z),
      new THREE.Vector3(gA_x - hL, actMidY, pA_z),
      new THREE.Vector3(gA_x + hL, actMidY, pA_z),
      new THREE.Vector3(pSh_x, actMidY, pSh_z),
      new THREE.Vector3(pSh_x, metalY, pOf('pmosSharedDrnCt').z),
      new THREE.Vector3(pSh_x, metalY, outSpineZ),
      new THREE.Vector3(pOf('outNmosBranch').x, metalY, outSpineZ),
      new THREE.Vector3(outEndX, metalY, outSpineZ)
    ]);
    c1.userData = { type: 'pmos' };
    return c1;
  }

  if (kind === 'pmosB') {
    var c2 = createOrthogonalPath([
      new THREE.Vector3(pB_x + 3.0, metalY, vddZ),
      new THREE.Vector3(pB_x, metalY, vddZ),
      new THREE.Vector3(pB_x, metalY, pOf('pmosBSrcCt').z),
      new THREE.Vector3(pB_x, actMidY, pB_z),
      new THREE.Vector3(gB_x + hL, actMidY, pB_z),
      new THREE.Vector3(gB_x - hL, actMidY, pB_z),
      new THREE.Vector3(pSh_x, actMidY, pSh_z),
      new THREE.Vector3(pSh_x, metalY, pOf('pmosSharedDrnCt').z),
      new THREE.Vector3(pSh_x, metalY, outSpineZ),
      new THREE.Vector3(pOf('outNmosBranch').x, metalY, outSpineZ),
      new THREE.Vector3(outEndX, metalY, outSpineZ)
    ]);
    c2.userData = { type: 'pmos' };
    return c2;
  }

  // Series NMOS path
  var cN = createOrthogonalPath([
    new THREE.Vector3(outEndX, metalY, outSpineZ),
    new THREE.Vector3(pOf('outNmosBranch').x, metalY, outSpineZ),
    new THREE.Vector3(nB_x, metalY, pOf('nmosBDrnCt').z),
    new THREE.Vector3(nB_x, actMidY, nB_z),
    new THREE.Vector3(gB_x + hL, actMidY, nB_z),
    new THREE.Vector3(gB_x - hL, actMidY, nB_z),
    new THREE.Vector3(nMid_x, actMidY, nMid_z),
    new THREE.Vector3(gA_x + hL, actMidY, nA_z),
    new THREE.Vector3(gA_x - hL, actMidY, nA_z),
    new THREE.Vector3(nA_x, actMidY, nA_z),
    new THREE.Vector3(nA_x, metalY, pOf('nmosASrcCt').z),
    new THREE.Vector3(nA_x, metalY, gndZ),
    new THREE.Vector3(nA_x - 3.0, metalY, gndZ)
  ]);
  cN.userData = { type: 'nmos' };
  return cN;
}

function getActiveBranchSpecs() {
  var st = (typeof computeNand2State === 'function')
    ? computeNand2State(typeof currentA !== 'undefined' ? currentA : 'off', typeof currentB !== 'undefined' ? currentB : 'off')
    : { frozen: true, regions: {} };
  if ((typeof isTourRunning !== 'undefined' && isTourRunning) || window.isTourActive === true) return [];
  if (!st || st.frozen || st.a === 'off' || st.b === 'off') return [];

  var regs = st.regions || {};
  var mp1On = regs.mp1 && regs.mp1 !== 'CUTOFF' && regs.mp1 !== 'SUBTHRESHOLD';
  var mp2On = regs.mp2 && regs.mp2 !== 'CUTOFF' && regs.mp2 !== 'SUBTHRESHOLD';
  var mn1On = regs.mn1 && regs.mn1 !== 'CUTOFF' && regs.mn1 !== 'SUBTHRESHOLD';
  var mn2On = regs.mn2 && regs.mn2 !== 'CUTOFF' && regs.mn2 !== 'SUBTHRESHOLD';
  var seriesOn = mn1On && mn2On;

  var list = [];
  if (mp1On && !seriesOn) {
    list.push({ kind: 'pmosA', type: 'pmos', speed: 0.085 });
    if (mp2On) list.push({ kind: 'pmosB', type: 'pmos', speed: 0.085 });
  } else if (mp2On && !seriesOn) {
    list.push({ kind: 'pmosB', type: 'pmos', speed: 0.085 });
  } else if (seriesOn && !mp1On && !mp2On) {
    list.push({ kind: 'nmos', type: 'nmos', speed: 0.085 });
  } else if (seriesOn && (mp1On || mp2On)) {
    // Active transition shoot-through: pull-up + series pull-down simultaneously!
    var iddBoost = 1.0 + Math.min(1.5, (st.idd || 0) * 15);
    if (mp1On && mp2On) {
      list.push({ kind: 'pmosA', type: 'pmos', speed: 0.085 * iddBoost });
      list.push({ kind: 'nmos', type: 'nmos', speed: 0.085 * iddBoost });
    } else if (mp1On) {
      list.push({ kind: 'pmosA', type: 'pmos', speed: 0.085 * iddBoost });
      list.push({ kind: 'nmos', type: 'nmos', speed: 0.085 * iddBoost });
    } else if (mp2On) {
      list.push({ kind: 'pmosB', type: 'pmos', speed: 0.085 * iddBoost });
      list.push({ kind: 'nmos', type: 'nmos', speed: 0.085 * iddBoost });
    }
  }
  return list;
}

function populatePoolFromSpec(pool, spec, g3d) {
  pool.records = [];
  if (!spec) {
    pool.mesh.count = 0;
    if (pool.mesh.instanceMatrix) pool.mesh.instanceMatrix.needsUpdate = true;
    return;
  }

  var isPmos = spec.type === 'pmos';
  var wNm = g3d ? (isPmos ? g3d.Wp_nm : g3d.Wn_nm) : 240;
  var w3d = g3d ? (isPmos ? g3d.wp3d : g3d.wn3d) : 6.0;
  var lanes = Math.max(2, Math.min(7, Math.round(1 + wNm / 55)));
  var zSpan = Math.max(0.35, w3d * 0.5 * 0.72);
  var countPerLane = Math.max(4, Math.min(10, Math.round(5 + (wNm / 120))));

  pool.mat.color.setHex(getCurveColor({ userData: { type: spec.type } }));

  for (var ln = 0; ln < lanes; ln++) {
    var frac = lanes > 1 ? (ln / (lanes - 1)) : 0.5;
    var zOff = -zSpan + 2.0 * zSpan * frac;
    var curve = getBranchCenterCurve(spec.kind, zOff, g3d);
    for (var i = 0; i < countPerLane; i++) {
      if (pool.records.length >= MAX_STREAKS_PER_BRANCH) break;
      pool.records.push({
        curve: curve,
        phase: (i / countPerLane) + ((ln * 0.19) % 1.0),
        isPmos: isPmos,
        speedScale: spec.speed / 0.085
      });
    }
  }
}

function refreshFlowGuides() {
  clearGuideLines();
  var specs = getActiveBranchSpecs();
  if (specs.length >= 1) {
    var c1 = (specs[0].kind === 'pmosA') ? pmosACurve : (specs[0].kind === 'pmosB' ? pmosBCurve : nmosSeriesCurve);
    if (c1) {
      guideLineA = makeGuideTube(c1, getCurveColor(c1));
      flowGroup.add(guideLineA);
    }
  }
  if (specs.length >= 2) {
    var c2 = (specs[1].kind === 'pmosA') ? pmosACurve : (specs[1].kind === 'pmosB' ? pmosBCurve : nmosSeriesCurve);
    if (c2) {
      guideLineB = makeGuideTube(c2, getCurveColor(c2));
      flowGroup.add(guideLineB);
    }
  }
}

function rebuildFlowCurves() {
  var g3d = (typeof window.getNandGeom3DState === 'function') ? window.getNandGeom3DState() : null;
  pmosACurve = getBranchCenterCurve('pmosA', 0, g3d);
  pmosBCurve = getBranchCenterCurve('pmosB', 0, g3d);
  nmosSeriesCurve = getBranchCenterCurve('nmos', 0, g3d);

  var specs = getActiveBranchSpecs();
  populatePoolFromSpec(poolA, specs[0] || null, g3d);
  populatePoolFromSpec(poolB, specs[1] || null, g3d);
  refreshFlowGuides();
  if (specs.length) {
    flowGroup.visible = true;
    renderPoolAtPhase(poolA, flowPhase);
    renderPoolAtPhase(poolB, flowPhase);
  } else {
    hideAllFlowMarkers();
  }
}
window.rebuildFlowCurves = rebuildFlowCurves;

function hideAllFlowMarkers() {
  poolA.mesh.count = 0;
  poolB.mesh.count = 0;
  if (poolA.mesh.instanceMatrix) poolA.mesh.instanceMatrix.needsUpdate = true;
  if (poolB.mesh.instanceMatrix) poolB.mesh.instanceMatrix.needsUpdate = true;
  flowGroup.visible = false;
}
window.hideAllFlowMarkers = hideAllFlowMarkers;

function renderPoolAtPhase(pool, phase) {
  var mesh = pool.mesh;
  var recs = pool.records;
  var count = Math.min(recs.length, MAX_STREAKS_PER_BRANCH);
  mesh.count = count;
  if (count === 0) {
    if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
    return;
  }

  var isCarrier = (flowMode === 'electron' || flowMode === 'carrier');
  for (var i = 0; i < count; i++) {
    var rec = recs[i];
    var u = ((phase * rec.speedScale + rec.phase) % 1.0 + 1.0) % 1.0;
    var reverse = (!rec.isPmos) && isCarrier;
    var s = reverse ? (1.0 - u) : u;
    s = Math.max(0.002, Math.min(0.998, s));

    var pt = rec.curve.getPointAt(s);
    var tan;
    if (typeof rec.curve.getTangentAt === 'function') {
      tan = rec.curve.getTangentAt(s);
      if (reverse) tan.multiplyScalar(-1);
    } else {
      var p1 = rec.curve.getPointAt(Math.max(0.001, s - 0.015));
      var p2 = rec.curve.getPointAt(Math.min(0.999, s + 0.015));
      var dir = reverse ? -1 : 1;
      tan = new THREE.Vector3((p2.x - p1.x) * dir, (p2.y - p1.y) * dir, (p2.z - p1.z) * dir);
    }

    _nandFlowDummy.position.copy(pt);
    _nandFlowTarget.copy(pt).add(tan);
    _nandFlowDummy.lookAt(_nandFlowTarget);
    _nandFlowDummy.scale.set(0.95, 0.95, 1.15);
    if (typeof _nandFlowDummy.updateMatrix === 'function') {
      _nandFlowDummy.updateMatrix();
    }
    mesh.setMatrixAt(i, _nandFlowDummy.matrix);
  }
  if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true;
}

function updateFlowMarkers(dt) {
  var specs = getActiveBranchSpecs();
  if (!specs.length) {
    hideAllFlowMarkers();
    return;
  }
  flowGroup.visible = true;
  flowPhase = (flowPhase + dt * 0.095) % 100.0;
  renderPoolAtPhase(poolA, flowPhase);
  renderPoolAtPhase(poolB, flowPhase);
}
window.updateFlowMarkers = updateFlowMarkers;

function setFlowMode(mode) {
  flowMode = (mode === 'electron' || mode === 'carrier') ? 'electron' : 'current';
  var btns = document.querySelectorAll('#flow-mode-group button[data-flow], #flow-mode-group .seg-btn[data-flow]');
  for (var i = 0; i < btns.length; i++) {
    var attr = btns[i].getAttribute('data-flow');
    var isMatch = (flowMode === 'electron') ? (attr === 'electron' || attr === 'carrier') : (attr === 'current');
    btns[i].classList.toggle('active', isMatch);
  }
  rebuildFlowCurves();
}
window.setFlowMode = setFlowMode;

function initFlowControls() {
  rebuildFlowCurves();

  var grp = document.getElementById('flow-mode-group');
  if (grp) {
    grp.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-flow], .seg-btn[data-flow]');
      if (!btn) return;
      setFlowMode(btn.getAttribute('data-flow'));
    });
  }
}

initFlowControls();

window.updateFlowTheme = function(theme) {
  rebuildFlowCurves();
};
if (typeof window.updateFlowTheme === 'function') window.updateFlowTheme();
