/**
 * flow.js - PN Junction Diode CAD Viewer
 * Dynamic 3D carrier flow & conventional current simulation for Planar Silicon IC Diode:
 * - Ultra-fine quantum particles (electrons: cyan, holes: orange-red, conventional current: gold).
 * - Planar U-shaped conduction path:
 *   Anode Metal-1 (VA) -> Tungsten Via -> P+ Anode Tub -> Conformal Depletion Shell -> N-Well -> N+ Cathode Tap -> Tungsten Via -> Cathode Metal-1 (GND).
 * - Equilibrium (VA = 0V): subtle Brownian thermal jitter inside P+ tub and N-Well; zero net current.
 * - Forward bias (VA > 0V): majority injection; electrons (Cathode -> Anode) and holes (Anode -> Cathode); speed & count scale with current I.
 * - Reverse bias: majority pullback towards terminals; sparse minority thermal leakage drift across junction.
 * - Reverse breakdown (VA <= -VBR): rapid reverse drift across junction sidewalls (Zener tunneling / Avalanche multiplication).
 */

var flowMode = 'carrier'; // 'carrier' | 'current' | 'off'
var flowSeg = document.getElementById('flow-seg');
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
scene.add(flowGroup);

// Particle geometries and materials
var particleGeom = new THREE.SphereGeometry(0.09, 8, 8);
var isInitialLight = document.documentElement.getAttribute('data-theme') === 'light';

var palInitial = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isInitialLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isInitialLight ? 'light' : 'dark') : null);

var CARRIER_ELECTRON_DARK = palInitial ? palInitial.electronFlow : '#F59E0B';
var CARRIER_ELECTRON_LIGHT = '#D97706';
var CARRIER_HOLE_DARK = palInitial ? palInitial.holeFlow : '#F43F5E';
var CARRIER_HOLE_LIGHT = '#BE123C';
var CURRENT_COLOR_DARK = '#FDE047';     // Radiant gold
var CURRENT_COLOR_LIGHT = '#D97706';    // Warm amber
var ZENER_COLOR_DARK = '#F43F5E';
var ZENER_COLOR_LIGHT = '#BE123C';
var AVALANCHE_COLOR_DARK = '#A855F7';
var AVALANCHE_COLOR_LIGHT = '#7E22CE';

var electronMat = new THREE.MeshBasicMaterial({ color: isInitialLight ? CARRIER_ELECTRON_LIGHT : CARRIER_ELECTRON_DARK, depthTest: true, depthWrite: false });
var holeMat = new THREE.MeshBasicMaterial({ color: isInitialLight ? CARRIER_HOLE_LIGHT : CARRIER_HOLE_DARK, depthTest: true, depthWrite: false });
var currentMat = new THREE.MeshBasicMaterial({ color: isInitialLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK, depthTest: true, depthWrite: false });
var zenerMat = new THREE.MeshBasicMaterial({ color: isInitialLight ? ZENER_COLOR_LIGHT : ZENER_COLOR_DARK, depthTest: true, depthWrite: false });
var avalancheMat = new THREE.MeshBasicMaterial({ color: isInitialLight ? AVALANCHE_COLOR_LIGHT : AVALANCHE_COLOR_DARK, depthTest: true, depthWrite: false });

function updateFlowTheme(theme) {
  var isLight = theme === 'light';
  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(theme) : (window.getMaterialPalette ? window.getMaterialPalette(theme) : null);
  var eCol = pal ? pal.electronFlow : (isLight ? CARRIER_ELECTRON_LIGHT : CARRIER_ELECTRON_DARK);
  var hCol = pal ? pal.holeFlow : (isLight ? CARRIER_HOLE_LIGHT : CARRIER_HOLE_DARK);

  if (electronMat) electronMat.color.set(eCol);
  if (holeMat) holeMat.color.set(hCol);
  if (currentMat) currentMat.color.set(isLight ? CURRENT_COLOR_LIGHT : CURRENT_COLOR_DARK);
  if (zenerMat) zenerMat.color.set(isLight ? ZENER_COLOR_LIGHT : ZENER_COLOR_DARK);
  if (avalancheMat) avalancheMat.color.set(isLight ? AVALANCHE_COLOR_LIGHT : AVALANCHE_COLOR_DARK);
}
window.updateFlowTheme = updateFlowTheme;

flowGroup.renderOrder = 999;

var activeParticles = [];

function initFlowControls() {
  if (flowSeg) {
    flowSeg.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        flowSeg.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        flowMode = btn.dataset.flow || 'carrier';
        rebuildFlowSimulation();
      });
    });
  }
}

/**
 * Computes 3D position along planar conduction trajectory
 * t in [0, 1] maps from Anode Metal-1 -> Cathode Metal-1
 */
function getPlanarPoint(t, zOffset, xJitter) {
  t = Math.max(0.0, Math.min(1.0, t));
  var x, y, z;
  z = zOffset || 0.0;
  var xj = xJitter || 0.0;

  if (t < 0.18) {
    // 1. Descending Anode Tungsten Via: from Y = 2.0 to 0.0 at X = -4.8
    var s = t / 0.18;
    x = -4.8 + xj * 0.4;
    y = 2.0 - s * 2.0;
  } else if (t < 0.40) {
    // 2. Curving through P+ Anode Tub towards metallurgical junction (X = -1.6)
    var s2 = (t - 0.18) / 0.22;
    x = -4.8 + s2 * 3.2 + xj * 0.6;
    y = -s2 * 1.0 - 0.2 * Math.sin(s2 * Math.PI);
  } else if (t < 0.62) {
    // 3. Crossing Conformal Depletion Shell & N-Well towards N+ Tap
    var s3 = (t - 0.40) / 0.22;
    x = -1.6 + s3 * 3.6 + xj * 0.5;
    y = -1.0 - 0.3 * Math.cos(s3 * Math.PI);
  } else if (t < 0.82) {
    // 4. Entering N+ Cathode Tap and curving up toward via base
    var s4 = (t - 0.62) / 0.20;
    x = 2.0 + s4 * 2.8 + xj * 0.4;
    y = -1.0 + s4 * 1.0;
  } else {
    // 5. Ascending Cathode Tungsten Via: from Y = 0.0 to 2.0 at X = +4.8
    var s5 = (t - 0.82) / 0.18;
    x = 4.8 + xj * 0.4;
    y = s5 * 2.0;
  }

  return { x: x, y: y, z: z };
}

/**
 * Rebuild flow particle pool based on current regime & physics state
 */
function rebuildFlowSimulation() {
  while (flowGroup.children.length > 0) {
    flowGroup.remove(flowGroup.children[0]);
  }
  activeParticles = [];

  var state = (typeof window.getDiodeState === 'function') ? window.getDiodeState() : {
    va: 0.0,
    currentMa: 0.0,
    regime: 'EQUILIBRIUM',
    vbr: 12.0
  };

  var va = state.va;
  var currentMa = state.currentMa;
  var regime = state.regime;
  var isCarrier = (flowMode === 'carrier');

  var caption = document.getElementById('flow-caption');

  if (flowMode === 'off') {
    flowGroup.visible = false;
    if (caption) caption.textContent = 'CARRIER FLOW: OFF (Simulation Paused)';
    return;
  }
  flowGroup.visible = true;

  var zTracks = [-2.4, -1.2, 0.0, 1.2, 2.4];

  // =========================================================================
  // CASE 1: EQUILIBRIUM (VA = 0)
  // =========================================================================
  if (regime === 'EQUILIBRIUM' || Math.abs(va) < 0.02) {
    if (caption) {
      caption.textContent = isCarrier
        ? 'THERMAL EQUILIBRIUM (VA = 0V): Zero net current. Majority carriers exhibit subtle thermal jitter in planar regions.'
        : 'CONVENTIONAL CURRENT (I = 0): Zero net electric current across equilibrium junction.';
    }

    if (isCarrier) {
      // Stationary majority holes in P+ tub (X: -7.5 to -2.0, Y: -1.4 to 0.0)
      for (var i = 0; i < 28; i++) {
        var hole = new THREE.Mesh(particleGeom, holeMat);
        var basePos = new THREE.Vector3(
          -7.2 + Math.random() * 5.0,
          -1.4 + Math.random() * 1.2,
          -3.2 + Math.random() * 6.4
        );
        hole.position.copy(basePos);
        flowGroup.add(hole);
        activeParticles.push({ mesh: hole, type: 'hole-jitter', home: basePos.clone() });
      }

      // Stationary majority electrons in N-Well & N+ tap (X: 1.5 to 8.5, Y: -2.0 to 0.0)
      for (var j = 0; j < 28; j++) {
        var elec = new THREE.Mesh(particleGeom, electronMat);
        var basePosN = new THREE.Vector3(
          2.0 + Math.random() * 6.0,
          -1.6 + Math.random() * 1.4,
          -3.2 + Math.random() * 6.4
        );
        elec.position.copy(basePosN);
        flowGroup.add(elec);
        activeParticles.push({ mesh: elec, type: 'electron-jitter', home: basePosN.clone() });
      }
    }
    return;
  }

  // =========================================================================
  // CASE 2: FORWARD BIAS (VA > 0)
  // =========================================================================
  if (regime === 'FORWARD' || va > 0.0) {
    var absI = Math.abs(currentMa);
    var speed = 0.0035 + 0.014 * Math.min(1.0, absI / 25.0);
    var numParticles = Math.round(18 + 36 * Math.min(1.0, absI / 25.0));

    if (caption) {
      caption.textContent = isCarrier
        ? 'FORWARD BIAS (VA = +' + va.toFixed(2) + 'V, I = ' + absI.toFixed(2) + 'mA): Holes (crimson) flow Anode->Cathode; Electrons (saffron) flow Cathode->Anode along planar path.'
        : 'CONVENTIONAL CURRENT: Anode (+) -> Cathode (-) planar current flowing with I = ' + absI.toFixed(2) + ' mA.';
    }

    if (isCarrier) {
      // 1. Holes flowing Anode -> Cathode (t: 0 -> 1)
      for (var i = 0; i < numParticles; i++) {
        var hole = new THREE.Mesh(particleGeom, holeMat);
        var tStartH = (i / numParticles);
        var zH = zTracks[i % zTracks.length] + (Math.random() - 0.5) * 0.4;
        var ptH = getPlanarPoint(tStartH, zH, 0);
        hole.position.set(ptH.x, ptH.y, ptH.z);
        flowGroup.add(hole);
        activeParticles.push({
          mesh: hole,
          type: 'planar-forward',
          t: tStartH,
          speed: speed,
          z: zH,
          xj: (Math.random() - 0.5) * 0.5
        });
      }

      // 2. Electrons flowing Cathode -> Anode (t: 1 -> 0)
      for (var j = 0; j < numParticles; j++) {
        var elec = new THREE.Mesh(particleGeom, electronMat);
        var tStartE = (j / numParticles);
        var zE = zTracks[(j + 2) % zTracks.length] + (Math.random() - 0.5) * 0.4;
        var ptE = getPlanarPoint(tStartE, zE, 0);
        elec.position.set(ptE.x, ptE.y, ptE.z);
        flowGroup.add(elec);
        activeParticles.push({
          mesh: elec,
          type: 'planar-reverse',
          t: tStartE,
          speed: speed,
          z: zE,
          xj: (Math.random() - 0.5) * 0.5
        });
      }
    } else {
      // Conventional current mode: flowing Anode -> Cathode
      for (var k = 0; k < numParticles * 1.5; k++) {
        var cur = new THREE.Mesh(particleGeom, currentMat);
        var tStartC = (k / (numParticles * 1.5));
        var zC = zTracks[k % zTracks.length] + (Math.random() - 0.5) * 0.3;
        var ptC = getPlanarPoint(tStartC, zC, 0);
        cur.position.set(ptC.x, ptC.y, ptC.z);
        flowGroup.add(cur);
        activeParticles.push({
          mesh: cur,
          type: 'planar-forward',
          t: tStartC,
          speed: speed * 1.15,
          z: zC,
          xj: (Math.random() - 0.5) * 0.4
        });
      }
    }
    return;
  }

  // =========================================================================
  // CASE 3: REVERSE BIAS (-VBR < VA < 0)
  // =========================================================================
  if (regime === 'REVERSE') {
    if (caption) {
      caption.textContent = isCarrier
        ? 'REVERSE BIAS (VA = ' + va.toFixed(2) + 'V): Majority carriers pulled back; sparse thermally generated minority carrier drift (Is leakage).'
        : 'REVERSE BIAS: Minimal reverse saturation leakage current (I ≈ -Is ≈ pA/nA range).';
    }

    if (isCarrier) {
      // Majority holes pulled back towards left edge of P+ tub
      for (var i = 0; i < 16; i++) {
        var hole = new THREE.Mesh(particleGeom, holeMat);
        var basePos = new THREE.Vector3(-7.5 + Math.random() * 2.5, -1.2 + Math.random() * 1.0, -3.2 + Math.random() * 6.4);
        hole.position.copy(basePos);
        flowGroup.add(hole);
        activeParticles.push({ mesh: hole, type: 'hole-jitter', home: basePos.clone() });
      }

      // Majority electrons pulled back towards Cathode tap
      for (var j = 0; j < 16; j++) {
        var elec = new THREE.Mesh(particleGeom, electronMat);
        var basePosN = new THREE.Vector3(5.0 + Math.random() * 2.5, -1.2 + Math.random() * 1.0, -3.2 + Math.random() * 6.4);
        elec.position.copy(basePosN);
        flowGroup.add(elec);
        activeParticles.push({ mesh: elec, type: 'electron-jitter', home: basePosN.clone() });
      }

      // Sparse minority electron leakage drifting across depletion: P -> N
      for (var k = 0; k < 6; k++) {
        var leakElec = new THREE.Mesh(particleGeom, electronMat);
        leakElec.scale.set(0.7, 0.7, 0.7);
        var startT = 0.35 + k * 0.05;
        var zL = (k - 2.5) * 1.2;
        var ptL = getPlanarPoint(startT, zL, 0);
        leakElec.position.set(ptL.x, ptL.y, ptL.z);
        flowGroup.add(leakElec);
        activeParticles.push({
          mesh: leakElec,
          type: 'planar-forward',
          t: startT,
          speed: 0.0018,
          z: zL,
          xj: 0,
          minT: 0.35,
          maxT: 0.65
        });
      }
    }
    return;
  }

  // =========================================================================
  // CASE 4: REVERSE BREAKDOWN (VA <= -VBR)
  // =========================================================================
  var isZener = (regime === 'ZENER');
  var absIBr = Math.abs(currentMa);
  var brSpeed = 0.008 + 0.022 * Math.min(1.0, absIBr / 30.0);

  if (caption) {
    caption.textContent = isZener
      ? 'ZENER BREAKDOWN (VBR < 5V): Direct quantum band-to-band electron tunneling across the ultra-narrow junction sidewall! Massive reverse current.'
      : 'AVALANCHE BREAKDOWN (VBR > 6V): Cascading impact ionization multiplication! Energetic carriers strike lattice generating secondary electron-hole pairs.';
  }

  var brCount = 38;
  if (isCarrier) {
    var bMat = isZener ? zenerMat : avalancheMat;
    for (var m = 0; m < brCount; m++) {
      var brP = new THREE.Mesh(particleGeom, bMat);
      var tStart = 0.30 + (m / brCount) * 0.35;
      var zB = zTracks[m % zTracks.length] + (Math.random() - 0.5) * 0.4;
      var ptB = getPlanarPoint(tStart, zB, (Math.random() - 0.5) * 0.3);
      brP.position.set(ptB.x, ptB.y, ptB.z);
      flowGroup.add(brP);
      activeParticles.push({
        mesh: brP,
        type: 'planar-forward',
        t: tStart,
        speed: brSpeed,
        z: zB,
        xj: (Math.random() - 0.5) * 0.4,
        minT: 0.28,
        maxT: 0.68
      });
    }
  } else {
    // Reverse conventional current flows Cathode -> Anode (t: 1 -> 0)
    for (var n = 0; n < brCount * 1.5; n++) {
      var curBr = new THREE.Mesh(particleGeom, currentMat);
      var tStartC = (n / (brCount * 1.5));
      var zCB = zTracks[n % zTracks.length];
      var ptCB = getPlanarPoint(tStartC, zCB, 0);
      curBr.position.set(ptCB.x, ptCB.y, ptCB.z);
      flowGroup.add(curBr);
      activeParticles.push({
        mesh: curBr,
        type: 'planar-reverse',
        t: tStartC,
        speed: brSpeed * 1.2,
        z: zCB,
        xj: (Math.random() - 0.5) * 0.3
      });
    }
  }
}

/**
 * Per-frame animation tick updating particle positions
 */
function updateFlowParticles(delta) {
  if (!activeParticles.length) return;
  var dt = Math.min(0.05, delta || 0.016);
  var time = Date.now() * 0.004;

  for (var i = 0; i < activeParticles.length; i++) {
    var p = activeParticles[i];

    if (p.type === 'planar-forward') {
      p.t += p.speed * (dt * 60.0);
      var maxT = p.maxT || 1.0;
      var minT = p.minT || 0.0;
      if (p.t > maxT) p.t = minT;
      var pt = getPlanarPoint(p.t, p.z, p.xj);
      p.mesh.position.set(pt.x, pt.y, pt.z);
    } else if (p.type === 'planar-reverse') {
      p.t -= p.speed * (dt * 60.0);
      var maxTR = p.maxT || 1.0;
      var minTR = p.minT || 0.0;
      if (p.t < minTR) p.t = maxTR;
      var ptR = getPlanarPoint(p.t, p.z, p.xj);
      p.mesh.position.set(ptR.x, ptR.y, ptR.z);
    } else if (p.type === 'hole-jitter' || p.type === 'electron-jitter') {
      var seed = i * 1.7;
      p.mesh.position.x = p.home.x + 0.12 * Math.sin(time + seed);
      p.mesh.position.y = p.home.y + 0.08 * Math.cos(time * 1.3 + seed);
      p.mesh.position.z = p.home.z + 0.12 * Math.sin(time * 0.8 + seed);
    }
  }
}
