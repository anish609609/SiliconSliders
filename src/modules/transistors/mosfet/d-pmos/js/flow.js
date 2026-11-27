/**
 * flow.js - Depletion-Mode PMOS CAD Viewer
 * Single Unified High-Contrast Instanced Hole & Conventional Current Flow:
 * - One continuous InstancedMesh pool inside the implanted P-channel (no separate static dot layer).
 * - CUTOFF (VGS >= VTH,p): Channel holes vanish completely (count = 0).
 * - Zero Bias (VSD = 0 V): Compact hole beads stay inside the built-in P-channel with gentle 3D thermal jitter & zero drift.
 * - Active Drift (VSD > 0 V): Same population flows Source (+VDD) -> Drain (OUT) along CatmullRomCurve3 lanes,
 *   elongating and accelerating across the high-field drain pinch-off gap (deltaL) in saturation.
 * - Parented directly to groups['dchannel'] so Explode (X/Y/Z) & Section Scrub stay 100% locked.
 */

var flowMode = 'carrier'; // 'carrier' | 'current' | 'off'
var flowSeg = document.getElementById('flow-seg');
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
flowGroup.userData.decorative = true;
flowGroup.userData.isFlowHelper = true;
if (typeof groups !== 'undefined' && groups['dchannel']) {
  groups['dchannel'].add(flowGroup);
} else if (typeof groups !== 'undefined' && groups['active']) {
  groups['active'].add(flowGroup);
} else {
  scene.add(flowGroup);
}

var MAX_STREAKS = 360;
var streakRecords = [];

// High-contrast palette: Crimson-Rose for Holes (h+), Warm Amber/Gold for Conventional Current (ISD)
var isInitialLight = (document.documentElement.getAttribute('data-theme') === 'light');
var palInitFlow = (typeof getMaterialPalette === 'function')
  ? getMaterialPalette(isInitialLight ? 'light' : 'dark')
  : (window.getMaterialPalette ? window.getMaterialPalette(isInitialLight ? 'light' : 'dark') : null);

var HOLE_COLOR_DARK = palInitFlow ? palInitFlow.holeFlow : '#F43F5E';
var HOLE_COLOR_LIGHT = '#BE123C';
var CURRENT_COLOR_DARK = '#FFCF4D';
var CURRENT_COLOR_LIGHT = '#D97706';

function createFlowStreakGeometry() {
  if (typeof THREE.LatheGeometry === 'function') {
    var profile = [
      new THREE.Vector2(0.001, -0.15),
      new THREE.Vector2(0.010, -0.11),
      new THREE.Vector2(0.022, -0.05),
      new THREE.Vector2(0.034,  0.02),
      new THREE.Vector2(0.036,  0.06),
      new THREE.Vector2(0.026,  0.095),
      new THREE.Vector2(0.001,  0.11)
    ];
    var lathe = new THREE.LatheGeometry(profile, 10);
    lathe.rotateX(Math.PI / 2);
    return lathe;
  }
  return new THREE.SphereGeometry(0.042, 8, 8);
}

var flowStreakGeom = createFlowStreakGeometry();
var flowStreakMat = new THREE.MeshBasicMaterial({
  color: palInitFlow ? palInitFlow.holeFlow : (isInitialLight ? HOLE_COLOR_LIGHT : HOLE_COLOR_DARK),
  transparent: true,
  opacity: 0.96,
  depthTest: true,
  depthWrite: false
});

var flowStreakMesh;
if (typeof THREE.InstancedMesh === 'function') {
  flowStreakMesh = new THREE.InstancedMesh(flowStreakGeom, flowStreakMat, MAX_STREAKS);
} else {
  flowStreakMesh = new THREE.Group();
  flowStreakMesh.isInstancedMesh = true;
  flowStreakMesh.geometry = flowStreakGeom;
  flowStreakMesh.material = flowStreakMat;
  flowStreakMesh.count = 0;
  flowStreakMesh.instanceMatrix = { needsUpdate: false };
  flowStreakMesh.setMatrixAt = function() {};
}
flowStreakMesh.count = 0;
flowStreakMesh.frustumCulled = false;
flowStreakMesh.renderOrder = 8;
flowStreakMesh.raycast = function() {};
flowStreakMesh.userData.decorative = true;
flowStreakMesh.userData.isFlowHelper = true;
flowGroup.add(flowStreakMesh);

var _flowDummy = new THREE.Object3D();
var _flowLookTarget = new THREE.Vector3();
var _flowTime = 0;

function getActiveFlowColor(theme) {
  var isLight = theme === 'light';
  var pal = (typeof getMaterialPalette === 'function')
    ? getMaterialPalette(isLight ? 'light' : 'dark')
    : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
  if (flowMode === 'current') {
    return isLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK;
  }
  return pal ? pal.holeFlow : (isLight ? HOLE_COLOR_LIGHT : HOLE_COLOR_DARK);
}

function updateFlowTheme(theme) {
  var t = theme || (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  if (flowStreakMat && flowStreakMat.color) {
    flowStreakMat.color.set(getActiveFlowColor(t));
  }
}
window.updateFlowTheme = updateFlowTheme;
window.syncFlowTheme = updateFlowTheme;

function createFlowCurve(points) {
  return new THREE.CatmullRomCurve3(points);
}

function getLocalChannelThickness(x, halfL, maxH, isSat, dL, ratio) {
  var fullL = halfL * 2.0;
  var pinchX = halfL - dL;
  if (isSat) {
    if (x >= pinchX) return 0;
    var sSat = Math.max(0, Math.min(1, (x + halfL) / Math.max(0.001, fullL - dL)));
    return maxH * Math.max(0, 1.0 - sSat);
  }
  var sLin = Math.max(0, Math.min(1, (x + halfL) / Math.max(0.001, fullL)));
  return maxH * Math.max(0, 1.0 - sLin * ratio);
}

function rebuildFlowCurves(optIsd, optRegion, optDeltaL) {
  streakRecords = [];

  var state = (typeof window.getMosfetPhysicsState === 'function') ? window.getMosfetPhysicsState() : {
    isd: (typeof optIsd === 'number' ? optIsd : 0.45),
    region: optRegion || 'SATURATION',
    deltaL: optDeltaL || 0.3,
    vgs: 0.0,
    vth: 0.80,
    vov: 0.80,
    vsd: 0.80,
    vsdSat: 0.12,
    tox: 2.0,
    W: 120
  };

  var isd = (typeof optIsd === 'number') ? optIsd : (state.isd !== undefined ? state.isd : state.ids);
  var region = optRegion || state.region;
  var deltaL = (typeof optDeltaL === 'number') ? optDeltaL : state.deltaL;
  var vgs = (typeof state.vgs === 'number') ? state.vgs : 0.0;
  var vthAbs = Math.max(0.25, Math.abs(state.vth || 0.80));
  var vov = (typeof state.vov === 'number') ? state.vov : Math.max(0, (state.vth || 0.80) - vgs);
  var vsd = (typeof state.vsd === 'number') ? state.vsd : 0;
  var tourActive = Boolean(window.isTourActive || (typeof isTourActive !== 'undefined' && isTourActive));

  if (tourActive || flowMode === 'off' || region === 'CUTOFF' || vov <= 0.001) {
    flowGroup.visible = false;
    flowStreakMesh.count = 0;
    if (flowStreakMesh.instanceMatrix) flowStreakMesh.instanceMatrix.needsUpdate = true;

    var caption = document.getElementById('flow-caption');
    if (caption) {
      if (tourActive) {
        caption.textContent = 'FABRICATION TOUR ACTIVE: Device held in Cutoff (Carriers suppressed).';
      } else if (flowMode === 'off') {
        caption.textContent = 'CARRIER FLOW: OFF (Simulation Paused)';
      } else {
        caption.textContent = 'CUTOFF: Positive VGS >= VTH,p depletes all mobile holes from the implanted P-channel.';
      }
      caption.classList.add('visible');
    }
    return;
  }

  flowGroup.visible = true;
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  updateFlowTheme(isLight ? 'light' : 'dark');

  var gState = (typeof window.getDeviceGeomState === 'function') ? window.getDeviceGeomState() : null;
  var halfL = gState ? gState.halfL : 1.0;
  var actD = gState ? gState.actD : 9.2;
  var absSrcX = gState ? Math.abs(gState.srcX) : 4.2;
  var W_nm = state.W || (gState ? gState.W_nm : 120);
  var centerY = (typeof innerCenterY === 'number') ? innerCenterY : 2.833;
  var maxInnerH = (typeof innerH === 'number') ? innerH : 0.326;
  var baseH = 0.19;
  var gateFactor = (vgs >= 0) ? Math.max(0.08, vov / vthAbs) : (1.0 + Math.min(0.85, (-vgs / 1.0) * 0.60));
  var toxFactor = Math.min(1.18, Math.pow(2.0 / Math.max(1.2, state.tox || 2.0), 0.16));
  var maxH = Math.min(maxInnerH, baseH * gateFactor * toxFactor);

  // Scale parallel lanes with Channel Width W (3 lanes at 40nm -> 11 lanes at 400nm)
  var laneCount = Math.max(3, Math.min(11, Math.round(2 + (W_nm / 40.0))));
  var zSpan = Math.max(0.4, (actD * 0.5) * 0.84);

  // Zero-Bias Conducting State (VSD = 0V): compact thermal-jittering hole beads inside the implanted channel
  if (vsd <= 0.001 || isd <= 0.0001) {
    var vovNorm = Math.min(1.0, Math.max(0.10, vov / 1.4));
    var zeroPerLane = Math.max(4, Math.min(Math.floor(MAX_STREAKS / laneCount), Math.round(4 + 12 * vovNorm)));
    var xSpan = Math.max(0.08, halfL * 0.94);

    for (var zlIdx = 0; zlIdx < laneCount; zlIdx++) {
      var zLaneFrac = laneCount > 1 ? (zlIdx / (laneCount - 1)) : 0.5;
      var zBase = -zSpan + 2.0 * zSpan * zLaneFrac;

      for (var zpIdx = 0; zpIdx < zeroPerLane; zpIdx++) {
        if (streakRecords.length >= MAX_STREAKS) break;
        var hashA = ((zlIdx * 19 + zpIdx * 37) % 101) / 101.0;
        var hashB = ((zlIdx * 43 + zpIdx * 13) % 97) / 97.0;
        var xFrac = (zpIdx + 0.5 + (hashA - 0.5) * 0.45) / zeroPerLane;
        var bx = -xSpan + 2.0 * xSpan * Math.max(0.02, Math.min(0.98, xFrac));
        var cTZero = Math.max(0.024, getLocalChannelThickness(bx, halfL, maxH, false, 0, 0));
        var minY = centerY - cTZero * 0.38;
        var maxY = centerY + cTZero * 0.38;
        var by = minY + hashB * Math.max(0.006, maxY - minY);
        var bz = zBase + (hashA - 0.5) * Math.min(0.24, zSpan / Math.max(1, laneCount));

        streakRecords.push({
          isZeroBias: true,
          baseX: bx,
          baseY: by,
          baseZ: bz,
          minY: minY,
          maxY: maxY,
          halfL: halfL,
          zSpan: zSpan,
          phase: zlIdx * 1.73 + zpIdx * 2.41
        });
      }
    }

    flowStreakMesh.count = streakRecords.length;
    updateFlowMarkers(0.016);
    return;
  }

  var isSat = (region === 'SATURATION');
  var currentNorm = Math.min(1.0, Math.max(0.06, isd / 0.5));
  var baseSpeed = 0.0036 + 0.0132 * currentNorm;

  var srcEnd = -(absSrcX + 0.25);
  var drnEnd = absSrcX + 0.25;
  var sdeMid = halfL + 0.72;
  var pinchX = isSat ? Math.max(-halfL * 0.2, halfL - deltaL) : halfL;
  var ratio = (state.vsdSat > 0.0001) ? Math.min(1.0, Math.max(0, vsd / state.vsdSat)) : 1.0;
  var particlesPerLane = Math.max(4, Math.min(Math.floor(MAX_STREAKS / laneCount), Math.round(5 + 11 * currentNorm)));

  for (var lIdx = 0; lIdx < laneCount; lIdx++) {
    var laneFrac = laneCount > 1 ? (lIdx / (laneCount - 1)) : 0.5;
    var zOff = -zSpan + 2.0 * zSpan * laneFrac;
    var ySign = (lIdx % 2 === 0 ? 1 : -1) * (0.20 + 0.50 * ((lIdx % 3) / 2));

    var xSrc = -halfL;
    var xMid = -halfL + 0.55 * (pinchX + halfL);
    var cTSrc = getLocalChannelThickness(xSrc, halfL, maxH, isSat, deltaL, ratio);
    var cTMid = getLocalChannelThickness(xMid, halfL, maxH, isSat, deltaL, ratio);

    var yChanSrc = centerY + ySign * (cTSrc * 0.36);
    var yChanMid = centerY + ySign * (cTMid * 0.36);
    var yChanEnd = centerY;

    // In D-PMOS, both mobile holes (h+) and conventional current (ISD) travel Source (+VDD) -> Drain (OUT)
    var pts = [
      new THREE.Vector3(srcEnd, 2.58, zOff),
      new THREE.Vector3(-sdeMid, centerY, zOff),
      new THREE.Vector3(xSrc, yChanSrc, zOff),
      new THREE.Vector3(xMid, yChanMid, zOff),
      new THREE.Vector3(pinchX, yChanEnd, zOff)
    ];

    if (isSat && (halfL - pinchX) > 0.04) {
      pts.push(new THREE.Vector3(0.5 * (pinchX + halfL), centerY, zOff));
    }
    pts.push(new THREE.Vector3(sdeMid, centerY, zOff));
    pts.push(new THREE.Vector3(drnEnd, 2.58, zOff));

    var curve = createFlowCurve(pts);
    for (var pIdx = 0; pIdx < particlesPerLane; pIdx++) {
      if (streakRecords.length >= MAX_STREAKS) break;
      var jitterSeed = ((lIdx * 17 + pIdx * 31) % 100) / 100.0;
      streakRecords.push({
        isZeroBias: false,
        curve: curve,
        progress: (pIdx / particlesPerLane + jitterSeed * 0.05) % 1.0,
        speed: baseSpeed * (0.90 + 0.20 * jitterSeed),
        isSat: isSat,
        pinchX: pinchX,
        halfL: halfL,
        currentNorm: currentNorm
      });
    }
  }

  flowStreakMesh.count = streakRecords.length;
  updateFlowMarkers(0.016);
}
window.rebuildFlowCurves = rebuildFlowCurves;

function stepFlowMarkers(dt) {
  updateFlowMarkers(dt);
}
window.stepFlowMarkers = stepFlowMarkers;
window.updateCarrierFlow = stepFlowMarkers;

function updateFlowMarkers(dt) {
  var tourActive = Boolean(window.isTourActive || (typeof isTourActive !== 'undefined' && isTourActive));
  if (tourActive) {
    if (flowGroup) flowGroup.visible = false;
    flowStreakMesh.count = 0;
    return;
  }
  if (flowMode === 'off' || !streakRecords.length || !flowGroup.visible) return;

  var clampedDt = (typeof dt === 'number' && dt > 0) ? Math.min(0.1, dt) : 0.016;
  _flowTime += clampedDt;
  var stepScale = (typeof dt === 'number' && dt > 0) ? Math.min(2.5, dt * 60.0) : 1.0;

  for (var i = 0; i < streakRecords.length; i++) {
    var rec = streakRecords[i];

    if (rec.isZeroBias) {
      var jx = Math.min(rec.halfL * 0.96, Math.max(-rec.halfL * 0.96, rec.baseX + 0.030 * Math.sin(_flowTime * 3.1 + rec.phase)));
      var jy = Math.min(rec.maxY, Math.max(rec.minY, rec.baseY + 0.008 * Math.cos(_flowTime * 3.9 + rec.phase * 1.37)));
      var jz = Math.min(rec.zSpan, Math.max(-rec.zSpan, rec.baseZ + 0.024 * Math.sin(_flowTime * 2.6 + rec.phase * 0.83)));
      _flowDummy.position.set(jx, jy, jz);
      _flowDummy.rotation.set(0, 0, 0);
      _flowDummy.scale.set(0.85, 0.85, 0.30);
      if (typeof _flowDummy.updateMatrix === 'function') _flowDummy.updateMatrix();
      flowStreakMesh.setMatrixAt(i, _flowDummy.matrix);
      continue;
    }

    var ptNow = rec.curve.getPointAt(rec.progress);
    var inGap = rec.isSat && ptNow && (ptNow.x >= rec.pinchX - 0.08) && (ptNow.x <= rec.halfL + 0.65);
    var accelFactor = inGap ? 1.0 : 0.0;
    var speedMult = inGap ? 2.85 : 1.0;

    rec.progress += rec.speed * speedMult * stepScale;
    if (rec.progress >= 1.0) rec.progress -= 1.0;

    var pt = rec.curve.getPointAt(rec.progress);
    var nextU = rec.progress + 0.018;
    if (nextU >= 1.0) nextU -= 1.0;
    var nextPt = rec.curve.getPointAt(nextU);

    if (pt) {
      _flowDummy.position.copy(pt);
      if (nextPt) {
        _flowLookTarget.copy(nextPt);
        _flowDummy.lookAt(_flowLookTarget);
      }
      var baseLen = 0.85 + 0.45 * rec.currentNorm;
      var lenScale = baseLen + 1.45 * accelFactor;
      _flowDummy.scale.set(0.90, 0.90, lenScale);
      if (typeof _flowDummy.updateMatrix === 'function') _flowDummy.updateMatrix();
      flowStreakMesh.setMatrixAt(i, _flowDummy.matrix);
    }
  }

  if (flowStreakMesh.instanceMatrix) {
    flowStreakMesh.instanceMatrix.needsUpdate = true;
  }
}

window.resetFlow = function() {
  flowMode = 'carrier';
  if (flowSeg) {
    flowSeg.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('active', b.dataset.flow === 'carrier');
    });
  }
  updateFlowTheme();
  rebuildFlowCurves();
};

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

if (typeof window.updateFlowTheme === 'function') window.updateFlowTheme();
