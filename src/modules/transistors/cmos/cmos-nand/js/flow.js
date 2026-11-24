/* CatmullRomCurve3 conduction paths for MP1, MP2, and series MN2->MN1, dual parallel pools & Current/Carriers toggle */

var flowMode = 'current'; /* 'current' | 'electron' */
var pmosACurve = null;
var pmosBCurve = null;
var nmosSeriesCurve = null;

var branchMarkersA = [];
var branchMarkersB = [];
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
scene.add(flowGroup);

var FLOW_MARKER_COUNT = 14;
var FLOW_SPEED = 0.085;
var flowPhase = 0;

var guideLineA = null;
var guideLineB = null;

var _upVec = new THREE.Vector3(0, 1, 0);
var _tmpPt = new THREE.Vector3();
var _tmpTan = new THREE.Vector3();

// High contrast palette:
var ELECTRON_COLOR_DARK = 0x38bdf8;
var ELECTRON_COLOR_LIGHT = 0x0052cc; // Deep royal cobalt blue
var HOLE_COLOR_DARK = 0xff4fbf;
var HOLE_COLOR_LIGHT = 0xb91c1c;     // Deep crimson
var CURRENT_COLOR_DARK = 0xffcf4d;
var CURRENT_COLOR_LIGHT = 0xb45309;  // Warm deep bronze / amber

function pOf(id) {
  var m = meshById[id];
  return m ? m.position : new THREE.Vector3();
}

function buildFlowPools() {
  while (flowGroup.children.length > 0) {
    flowGroup.remove(flowGroup.children[0]);
  }
  branchMarkersA = [];
  branchMarkersB = [];

  var carrierGeo = new THREE.SphereGeometry(0.045, 8, 8);
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var initColor = isLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK;

  for (var i = 0; i < FLOW_MARKER_COUNT; i++) {
    var matA = new THREE.MeshBasicMaterial({
      color: initColor,
      depthTest: true,
      depthWrite: false
    });
    var sphereA = new THREE.Mesh(carrierGeo, matA);
    sphereA.visible = false;
    flowGroup.add(sphereA);
    branchMarkersA.push(sphereA);

    var matB = new THREE.MeshBasicMaterial({
      color: initColor,
      depthTest: true,
      depthWrite: false
    });
    var sphereB = new THREE.Mesh(carrierGeo, matB);
    sphereB.visible = false;
    flowGroup.add(sphereB);
    branchMarkersB.push(sphereB);
  }
}

function makeGuideTube(curve, colorHex) {
  var pts = curve.getPoints(48);
  var geo = new THREE.BufferGeometry().setFromPoints(pts);
  var mat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.38
  });
  return new THREE.Line(geo, mat);
}

function rebuildFlowCurves() {
  var vddY = pOf('vddRail').y + 0.02;
  var vddZ = pOf('vddRail').z;

  var outY = pOf('outPin').y + 0.02;
  var outZ = pOf('outPin').z;
  var outEndX = pOf('outPin').x + 2.4;

  var pA_x = pOf('pmosASrcCt').x;
  var pA_z = pOf('pmosASrc').z;
  var pA_y = pOf('pmosASrc').y + 0.08;

  var pSh_x = pOf('pmosSharedDrnCt').x;
  var pSh_z = pOf('pmosSharedDrn').z;
  var pSh_y = pOf('pmosSharedDrn').y + 0.08;

  var pB_x = pOf('pmosBSrcCt').x;
  var pB_z = pOf('pmosBSrc').z;
  var pB_y = pOf('pmosBSrc').y + 0.08;

  var gA_x = pOf('polyA').x;
  var gB_x = pOf('polyB').x;

  /* 1. MP1 Pull-Up Curve: VDD -> vddStubPmosA -> pmosASrcCt -> pmosASrc -> Gate A channel -> pmosSharedDrn -> pmosSharedDrnCt -> outPmosBranch -> outSpine -> outPin */
  pmosACurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(pA_x - 3.0, vddY, vddZ),
    new THREE.Vector3(pA_x, vddY, vddZ),
    new THREE.Vector3(pA_x, vddY, pA_z),
    new THREE.Vector3(pA_x, pA_y, pA_z),
    new THREE.Vector3(gA_x, pA_y - 0.03, pA_z),
    new THREE.Vector3(pSh_x, pSh_y, pSh_z),
    new THREE.Vector3(pSh_x, outY, pSh_z),
    new THREE.Vector3(pSh_x, outY, outZ),
    new THREE.Vector3(pOf('outNmosBranch').x, outY, outZ),
    new THREE.Vector3(outEndX, outY, outZ)
  ], false, 'catmullrom', 0.12);
  pmosACurve.userData = { type: 'pmos' };

  /* 2. MP2 Pull-Up Curve: VDD -> vddStubPmosB -> pmosBSrcCt -> pmosBSrc -> Gate B channel -> pmosSharedDrn -> pmosSharedDrnCt -> outPmosBranch -> outSpine -> outPin */
  pmosBCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(pB_x + 3.0, vddY, vddZ),
    new THREE.Vector3(pB_x, vddY, vddZ),
    new THREE.Vector3(pB_x, vddY, pB_z),
    new THREE.Vector3(pB_x, pB_y, pB_z),
    new THREE.Vector3(gB_x, pB_y - 0.03, pB_z),
    new THREE.Vector3(pSh_x, pSh_y, pSh_z),
    new THREE.Vector3(pSh_x, outY, pSh_z),
    new THREE.Vector3(pSh_x, outY, outZ),
    new THREE.Vector3(pOf('outNmosBranch').x, outY, outZ),
    new THREE.Vector3(outEndX, outY, outZ)
  ], false, 'catmullrom', 0.12);
  pmosBCurve.userData = { type: 'pmos' };

  /* 3. Series NMOS Pull-Down Curve: outPin -> outSpine -> outNmosBranch -> nmosBDrnCt -> nmosBDrn -> Gate B channel -> nmosMidNode -> Gate A channel -> nmosASrc -> nmosASrcCt -> gndStubNmosA -> gndRail */
  var nB_x = pOf('nmosBDrnCt').x;
  var nB_z = pOf('nmosBDrn').z;
  var nB_y = pOf('nmosBDrn').y + 0.08;

  var nMid_x = pOf('nmosMidNode').x;
  var nMid_z = pOf('nmosMidNode').z;
  var nMid_y = pOf('nmosMidNode').y + 0.08;

  var nA_x = pOf('nmosASrcCt').x;
  var nA_z = pOf('nmosASrc').z;
  var nA_y = pOf('nmosASrc').y + 0.08;

  var gndY = pOf('gndRail').y + 0.02;
  var gndZ = pOf('gndRail').z;

  nmosSeriesCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(outEndX, outY, outZ),
    new THREE.Vector3(nB_x, outY, outZ),
    new THREE.Vector3(nB_x, outY, nB_z),
    new THREE.Vector3(nB_x, nB_y, nB_z),
    new THREE.Vector3(gB_x, nB_y - 0.03, nB_z),
    new THREE.Vector3(nMid_x, nMid_y, nMid_z),
    new THREE.Vector3(gA_x, nA_y - 0.03, nA_z),
    new THREE.Vector3(nA_x, nA_y, nA_z),
    new THREE.Vector3(nA_x, gndY, nA_z),
    new THREE.Vector3(nA_x, gndY, gndZ),
    new THREE.Vector3(nA_x - 5.0, gndY, gndZ)
  ], false, 'catmullrom', 0.12);
  nmosSeriesCurve.userData = { type: 'nmos' };

  refreshFlowGuides();
}

function getActiveCurves() {
  if (typeof isTourRunning !== 'undefined' && isTourRunning) return [];
  if (typeof currentA === 'undefined' || typeof currentB === 'undefined') return [];
  if (currentA === 'off' || currentB === 'off') return [];

  var curves = [];
  if (currentA === 0 && currentB === 0) {
    if (pmosACurve) curves.push(pmosACurve);
    if (pmosBCurve) curves.push(pmosBCurve);
  } else if (currentA === 0 && currentB === 1) {
    if (pmosACurve) curves.push(pmosACurve);
  } else if (currentA === 1 && currentB === 0) {
    if (pmosBCurve) curves.push(pmosBCurve);
  } else if (currentA === 1 && currentB === 1) {
    if (nmosSeriesCurve) curves.push(nmosSeriesCurve);
  }
  return curves;
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

function refreshFlowGuides() {
  clearGuideLines();
  var active = getActiveCurves();
  if (active.length >= 1) {
    guideLineA = makeGuideTube(active[0], getCurveColor(active[0]));
    flowGroup.add(guideLineA);
  }
  if (active.length >= 2) {
    guideLineB = makeGuideTube(active[1], getCurveColor(active[1]));
    flowGroup.add(guideLineB);
  }
}

function hideAllFlowMarkers() {
  for (var i = 0; i < branchMarkersA.length; i++) {
    branchMarkersA[i].visible = false;
    branchMarkersB[i].visible = false;
  }
}

function positionPoolOnCurve(pool, curve) {
  var isCarrier = (flowMode === 'electron' || flowMode === 'carrier');
  var isPmos = curve && curve.userData && curve.userData.type === 'pmos';
  var colorHex = getCurveColor(curve);

  for (var i = 0; i < pool.length; i++) {
    var sphere = pool[i];
    var u = (flowPhase + i / pool.length) % 1.0;

    // Conduction direction:
    // In PMOS: Holes (and current) flow VDD -> OUT (forward along curve, u)
    // In NMOS: Conventional current flows OUT -> GND (forward along curve, u)
    //          Electrons drift from GND -> OUT (reverse along curve, 1.0 - u)
    var t;
    if (isPmos) {
      t = u;
    } else {
      t = isCarrier ? (1.0 - u) : u;
    }
    t = Math.max(0.001, Math.min(0.999, t));

    curve.getPointAt(t, _tmpPt);
    sphere.position.copy(_tmpPt);
    sphere.material.color.setHex(colorHex);
    sphere.visible = true;
  }
}

function updateFlowMarkers(dt) {
  var active = getActiveCurves();
  if (!active.length) {
    hideAllFlowMarkers();
    return;
  }

  flowPhase = (flowPhase + dt * FLOW_SPEED) % 1.0;

  positionPoolOnCurve(branchMarkersA, active[0]);
  if (active.length >= 2) {
    positionPoolOnCurve(branchMarkersB, active[1]);
  } else {
    for (var i = 0; i < branchMarkersB.length; i++) {
      branchMarkersB[i].visible = false;
    }
  }
}

function setFlowMode(mode) {
  flowMode = (mode === 'electron' || mode === 'carrier') ? 'electron' : 'current';
  var btns = document.querySelectorAll('#flow-mode-group button[data-flow], #flow-mode-group .seg-btn[data-flow]');
  for (var i = 0; i < btns.length; i++) {
    var attr = btns[i].getAttribute('data-flow');
    var isMatch = (flowMode === 'electron') ? (attr === 'electron' || attr === 'carrier') : (attr === 'current');
    btns[i].classList.toggle('active', isMatch);
  }
  refreshFlowGuides();
}

function initFlowControls() {
  buildFlowPools();
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
  if (typeof refreshFlowGuides === 'function') refreshFlowGuides();
};
if (typeof window.updateFlowTheme === 'function') window.updateFlowTheme();
