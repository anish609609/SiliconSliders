/**
 * flow.js - NMOS CAD Viewer
 * High-Contrast Instanced Carrier & Conventional Current Flow Streaks:
 * - InstancedMesh of streamlined tapered capsules/streaks oriented along flow tangent.
 * - High-contrast Electric Amber (#F59E0B) for ELECTRONS (Source -> Drain) and Crimson (#E11D48) for CURRENT (Drain -> Source).
 * - Physics-driven channel funneling along tapered inversion thickness & pinch-off acceleration across ΔL.
 * - Parallel lane count scales with Channel Width W; density & drift speed scale with IDS.
 * - Parented directly to groups['active'] so Explode (X/Y/Z) & Section Scrub stay 100% locked.
 */

var flowMode = 'carrier'; // 'carrier' | 'current' | 'off'
var flowSeg = document.getElementById('flow-seg');
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
flowGroup.userData.decorative = true;
flowGroup.userData.isFlowHelper = true;
if (typeof groups !== 'undefined' && groups['active']) {
  groups['active'].add(flowGroup);
} else {
  scene.add(flowGroup);
}

var MAX_STREAKS = 360;
var streakRecords = [];

// High-contrast palette against light/dark backgrounds and green/blue silicon
var CARRIER_COLOR_DARK = '#F59E0B';  // Electric Amber/Gold
var CARRIER_COLOR_LIGHT = '#D97706'; // Rich Amber on light background
var CURRENT_COLOR_DARK = '#F43F5E';  // Bright Crimson-Rose
var CURRENT_COLOR_LIGHT = '#E11D48'; // Deep Crimson

var isInitialLight = document.documentElement.getAttribute('data-theme') === 'light';

// Streamlined tapered capsule / streak geometry oriented along +Z (nose at +Z, tail at -Z)
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
  color: isInitialLight ? CARRIER_COLOR_LIGHT : CARRIER_COLOR_DARK,
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

function getActiveFlowColor(theme) {
  var isLight = theme === 'light';
  if (flowMode === 'current') {
    return isLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK;
  }
  return isLight ? CARRIER_COLOR_LIGHT : CARRIER_COLOR_DARK;
}

function updateFlowTheme(theme) {
  if (flowStreakMat && flowStreakMat.color) {
    flowStreakMat.color.set(getActiveFlowColor(theme));
  }
}
window.updateFlowTheme = updateFlowTheme;

function createFlowCurve(points) {
  return new THREE.CatmullRomCurve3(points);
}

function getLocalChannelThickness(x, halfL, maxH, isSat, dL, ratio) {
  if (typeof getChannelThicknessAtX === 'function') {
    return getChannelThicknessAtX(x, true, maxH, isSat, dL, ratio);
  }
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

var _flowTime = 0;

function rebuildFlowCurves(optIds, optRegion, optDeltaL) {
  streakRecords = [];

  var state = (typeof window.getMosfetPhysicsState === 'function') ? window.getMosfetPhysicsState() : {
    ids: (typeof optIds === 'number' ? optIds : 0.10),
    region: optRegion || 'SATURATION',
    deltaL: optDeltaL || 0.3,
    vgs: 1.0,
    vth: 0.40,
    vov: 0.60,
    vds: 0.8,
    vdsSat: 0.12,
    W: 120
  };

  var ids = (typeof optIds === 'number') ? optIds : state.ids;
  var region = optRegion || state.region;
  var deltaL = (typeof optDeltaL === 'number') ? optDeltaL : state.deltaL;
  var vov = (typeof state.vov === 'number') ? state.vov : Math.max(0, (state.vgs || 0) - (state.vth || 0.40));
  var vds = (typeof state.vds === 'number') ? state.vds : 0;
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
        caption.textContent = 'CUTOFF REGION (VGS < VTH): Zero inversion layer; conduction carriers quenched.';
      }
      caption.classList.add('visible');
    }
    return;
  }

  flowGroup.visible = true;
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  updateFlowTheme(isLight ? 'light' : 'dark');

  var isCarrier = flowMode === 'carrier';
  var gState = (typeof window.getDeviceGeomState === 'function') ? window.getDeviceGeomState() : null;
  var halfL = gState ? gState.halfL : 1.0;
  var actD = gState ? gState.actD : 7.0;
  var absSrcX = gState ? Math.abs(gState.srcX) : 4.2;
  var W_nm = state.W || (gState ? gState.W_nm : 120);
  var maxH = 0.16;
  var chanTop = (typeof yChanTop === 'number') ? yChanTop : 3.006;

  // Scale parallel lanes with Channel Width W (3 lanes at 40nm -> 11 lanes at 400nm)
  var laneCount = Math.max(3, Math.min(11, Math.round(2 + (W_nm / 40.0))));
  var zSpan = Math.max(0.4, (actD * 0.5) * 0.84);

  // Zero-Bias Inversion (VGS >= VTH, VDS = 0 V): same channel population with thermal jitter in place
  if (vds <= 0.001 || ids <= 0.0001) {
    var vovNorm = Math.min(1.0, Math.max(0.08, vov / 1.2));
    var zeroPerLane = Math.max(4, Math.min(Math.floor(MAX_STREAKS / laneCount), Math.round(4 + 12 * vovNorm)));
    var activeDepth = maxH * Math.min(1.0, 0.35 + 0.65 * vovNorm);
    var xSpan = Math.max(0.08, halfL * 0.94);

    for (var zlIdx = 0; zlIdx < laneCount; zlIdx++) {
      var zLaneFrac = laneCount > 1 ? (zlIdx / (laneCount - 1)) : 0.5;
      var zBase = -zSpan + 2.0 * zSpan * zLaneFrac;

      for (var zpIdx = 0; zpIdx < zeroPerLane; zpIdx++) {
        if (streakRecords.length >= MAX_STREAKS) break;
        var hashA = ((zlIdx * 19 + zpIdx * 37) % 101) / 101.0;
        var hashB = ((zlIdx * 43 + zpIdx * 13) % 97) / 97.0;
        var xFrac = ((zpIdx + 0.5 + (hashA - 0.5) * 0.45) / zeroPerLane);
        var bx = -xSpan + 2.0 * xSpan * Math.max(0.02, Math.min(0.98, xFrac));
        var cTZero = Math.min(activeDepth, getLocalChannelThickness(bx, halfL, maxH, false, 0, 0));
        var minY = chanTop - Math.max(0.020, cTZero);
        var maxY = chanTop - 0.012;
        var by = maxY - hashB * Math.max(0.006, maxY - minY);
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

    var zeroCaption = document.getElementById('flow-caption');
    if (zeroCaption) {
      if (isCarrier) {
        zeroCaption.textContent = 'INVERSION (VDS = 0 V): Channel formed (density ∝ VOV); carriers undergo thermal motion with zero net drift.';
      } else {
        zeroCaption.textContent = 'INVERSION (VDS = 0 V): Continuous channel formed; zero net drift current (IDS = 0 mA).';
      }
      zeroCaption.classList.add('visible');
    }
    return;
  }

  var isSat = (region === 'SATURATION');
  var currentNorm = Math.min(1.0, Math.max(0.06, ids / 0.35));
  var baseSpeed = 0.0038 + 0.0135 * currentNorm;

  var srcEnd = -(absSrcX + 0.25);
  var drnEnd = absSrcX + 0.25;
  var sdeMid = halfL + 0.72;
  var pinchX = isSat ? Math.max(-halfL * 0.2, halfL - deltaL) : halfL;
  var ratio = (state.vdsSat > 0.0001) ? Math.min(1.0, Math.max(0, state.vds / state.vdsSat)) : 1.0;

  var particlesPerLane = Math.max(4, Math.min(Math.floor(MAX_STREAKS / laneCount), Math.round(5 + 11 * currentNorm)));

  for (var lIdx = 0; lIdx < laneCount; lIdx++) {
    var laneFrac = laneCount > 1 ? (lIdx / (laneCount - 1)) : 0.5;
    var zOff = -zSpan + 2.0 * zSpan * laneFrac;
    // Slight deterministic depth variation across lanes so particles fill channel depth near Source
    var depthFrac = 0.20 + 0.60 * ((lIdx % 3) / 2);

    var xSrc = -halfL;
    var xMid = -halfL + 0.55 * (pinchX + halfL);
    var cTSrc = getLocalChannelThickness(xSrc, halfL, maxH, isSat, deltaL, ratio);
    var cTMid = getLocalChannelThickness(xMid, halfL, maxH, isSat, deltaL, ratio);

    var yChanSrc = chanTop - Math.max(0.020, depthFrac * cTSrc);
    var yChanMid = chanTop - Math.max(0.018, depthFrac * cTMid);
    var yChanEnd = chanTop - 0.018; // funneled right beneath Si/SiO2 at pinch-off / drain edge

    var pts = [
      new THREE.Vector3(srcEnd, 2.58, zOff),
      new THREE.Vector3(-sdeMid, 2.86, zOff),
      new THREE.Vector3(xSrc, yChanSrc, zOff),
      new THREE.Vector3(xMid, yChanMid, zOff),
      new THREE.Vector3(pinchX, yChanEnd, zOff)
    ];

    if (isSat && (halfL - pinchX) > 0.04) {
      pts.push(new THREE.Vector3(0.5 * (pinchX + halfL), 2.94, zOff));
    }
    pts.push(new THREE.Vector3(sdeMid, 2.84, zOff));
    pts.push(new THREE.Vector3(drnEnd, 2.58, zOff));

    if (!isCarrier) {
      pts.reverse();
    }

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

  var captionEl = document.getElementById('flow-caption');
  if (captionEl) {
    if (isCarrier) {
      if (isSat) {
        captionEl.textContent = 'SATURATION (PINCH-OFF): Electrons funnel into pinched channel and accelerate across ΔL into Drain.';
      } else {
        captionEl.textContent = 'LINEAR / TRIODE: Continuous inversion channel. Electron drift velocity v = µ·E ∝ VDS.';
      }
    } else {
      captionEl.textContent = 'CONVENTIONAL CURRENT: Positive charge flow (ID = ' + ids.toFixed(3) + ' mA) from Drain to Source.';
    }
    captionEl.classList.add('visible');
  }
}

function stepFlowMarkers(dt) {
  updateFlowMarkers(dt);
}

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
      var jy = Math.min(rec.maxY, Math.max(rec.minY, rec.baseY + 0.007 * Math.cos(_flowTime * 3.9 + rec.phase * 1.37)));
      var jz = Math.min(rec.zSpan, Math.max(-rec.zSpan, rec.baseZ + 0.024 * Math.sin(_flowTime * 2.6 + rec.phase * 0.83)));
      _flowDummy.position.set(jx, jy, jz);
      _flowDummy.rotation.set(0, 0, 0);
      _flowDummy.scale.set(0.85, 0.85, 0.30);
      if (typeof _flowDummy.updateMatrix === 'function') _flowDummy.updateMatrix();
      flowStreakMesh.setMatrixAt(i, _flowDummy.matrix);
      continue;
    }

    var ptNow = rec.curve.getPointAt(rec.progress);

    // Accelerate & elongate sharply across the high-field pinch-off gap (pinchX .. halfL + 0.6)
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
