/**
 * flow.js - PN Junction Diode CAD Viewer
 * Dynamic 3D carrier flow & conventional current simulation:
 * - Ultra-fine quantum particles (electrons: cyan, holes: orange-red, conventional current: gold).
 * - Equilibrium: subtle thermal Brownian jitter, zero net drift.
 * - Forward bias: electrons (N->P) and holes (P->N), speed & density scale with current I.
 * - Reverse bias: majority pullback towards contacts, sparse minority leakage drift.
 * - Reverse breakdown: rapid electron sweep (P->N) and strong reverse current (Cathode->Anode).
 *   - Zener mode (VBR < 5V): narrow-barrier band-to-band tunneling stream.
 *   - Avalanche mode (VBR > 6V): cascading impact ionization carrier pair generation.
 */

var flowMode = 'carrier'; // 'carrier' | 'current' | 'off'
var flowSeg = document.getElementById('flow-seg');
var flowGroup = new THREE.Group();
flowGroup.name = 'flowGroup';
scene.add(flowGroup);

// Geometries and materials
var particleGeom = new THREE.SphereGeometry(0.065, 8, 8);
var electronMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, depthTest: true, depthWrite: false }); // Cyan
var holeMat = new THREE.MeshBasicMaterial({ color: 0xf97316, depthTest: true, depthWrite: false });     // Orange-Red
var currentMat = new THREE.MeshBasicMaterial({ color: 0xffcf4d, depthTest: true, depthWrite: false });  // Golden Yellow
var zenerMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e, depthTest: true, depthWrite: false });    // Pinkish-Red Tunneling
var avalancheMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: true, depthWrite: false });// Violet Ionizing

flowGroup.renderOrder = 999;

// Particle arrays
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

  // Determine track positions along Z (-3.2 to +3.2) and Y (-1.0 to +1.0)
  var zTracks = [-3.0, -1.5, 0.0, 1.5, 3.0];
  var yTracks = [-0.8, 0.0, 0.8];

  // =========================================================================
  // CASE 1: EQUILIBRIUM (VA = 0)
  // =========================================================================
  if (regime === 'EQUILIBRIUM' || Math.abs(va) < 0.02) {
    if (caption) {
      caption.textContent = isCarrier
        ? 'THERMAL EQUILIBRIUM (VA = 0V): Zero net current. Majority carriers exhibit subtle thermal jitter.'
        : 'CONVENTIONAL CURRENT (I = 0): Zero net electric current across equilibrium junction.';
    }

    if (isCarrier) {
      // Create stationary majority holes in P-region (left, X: -10 to -2)
      for (var i = 0; i < 28; i++) {
        var hole = new THREE.Mesh(particleGeom, holeMat);
        var basePos = new THREE.Vector3(
          -10.0 + Math.random() * 7.5,
          -1.2 + Math.random() * 2.4,
          -3.5 + Math.random() * 7.0
        );
        hole.position.copy(basePos);
        flowGroup.add(hole);
        activeParticles.push({ mesh: hole, type: 'hole-jitter', home: basePos.clone() });
      }

      // Create stationary majority electrons in N-region (right, X: +2 to +10)
      for (var j = 0; j < 28; j++) {
        var elec = new THREE.Mesh(particleGeom, electronMat);
        var basePosN = new THREE.Vector3(
          2.5 + Math.random() * 7.5,
          -1.2 + Math.random() * 2.4,
          -3.5 + Math.random() * 7.0
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
    var speed = 0.04 + 0.18 * Math.min(1.0, absI / 25.0);
    var numParticles = Math.round(18 + 36 * Math.min(1.0, absI / 25.0));

    if (caption) {
      caption.textContent = isCarrier
        ? 'FORWARD BIAS (VA = +' + va.toFixed(2) + 'V, I = ' + absI.toFixed(2) + 'mA): Electrons (cyan) injected from N->P; Holes (orange) injected from P->N.'
        : 'CONVENTIONAL CURRENT: Anode (+) -> Cathode (-) forward current flowing with I = ' + absI.toFixed(2) + ' mA.';
    }

    if (isCarrier) {
      // 1. Electrons flowing from N (Right, +10) -> Across narrowed junction -> P (Left, -10)
      for (var i = 0; i < numParticles; i++) {
        var elec = new THREE.Mesh(particleGeom, electronMat);
        var z = zTracks[i % zTracks.length] + (Math.random() - 0.5) * 0.4;
        var y = yTracks[Math.floor(i / zTracks.length) % yTracks.length];
        var startX = 10.0 - (i / numParticles) * 20.0;
        elec.position.set(startX, y, z);
        flowGroup.add(elec);
        activeParticles.push({
          mesh: elec,
          type: 'electron-fwd',
          speed: speed,
          minX: -10.5,
          maxX: 10.5,
          y: y,
          z: z
        });
      }

      // 2. Holes flowing from P (Left, -10) -> Across junction -> N (Right, +10)
      for (var j = 0; j < numParticles; j++) {
        var hole = new THREE.Mesh(particleGeom, holeMat);
        var z = zTracks[(j + 2) % zTracks.length] + (Math.random() - 0.5) * 0.4;
        var y = yTracks[Math.floor(j / zTracks.length) % yTracks.length];
        var startX = -10.0 + (j / numParticles) * 20.0;
        hole.position.set(startX, y, z);
        flowGroup.add(hole);
        activeParticles.push({
          mesh: hole,
          type: 'hole-fwd',
          speed: speed,
          minX: -10.5,
          maxX: 10.5,
          y: y,
          z: z
        });
      }
    } else {
      // Conventional Current mode: flowing Anode (Left, -10) -> Cathode (Right, +10)
      for (var k = 0; k < numParticles * 1.5; k++) {
        var cur = new THREE.Mesh(particleGeom, currentMat);
        var z = zTracks[k % zTracks.length];
        var y = yTracks[Math.floor(k / zTracks.length) % yTracks.length];
        var startX = -10.5 + (k / (numParticles * 1.5)) * 21.0;
        cur.position.set(startX, y, z);
        flowGroup.add(cur);
        activeParticles.push({
          mesh: cur,
          type: 'current-fwd',
          speed: speed * 1.1,
          minX: -10.5,
          maxX: 10.5,
          y: y,
          z: z
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
        ? 'REVERSE BIAS (VA = ' + va.toFixed(2) + 'V): Majority carriers pulled back; only sparse thermally generated minority carrier drift (Is leakage).'
        : 'REVERSE BIAS: Minimal reverse saturation leakage current (I ≈ -Is ≈ pA/nA range).';
    }

    if (isCarrier) {
      // Majority carriers pulled back away from junction
      // Holes pulled towards Anode terminal (Left, X: -11 to -6)
      for (var i = 0; i < 16; i++) {
        var hole = new THREE.Mesh(particleGeom, holeMat);
        var basePos = new THREE.Vector3(-10.8 + Math.random() * 4.5, -1.0 + Math.random() * 2.0, -3.5 + Math.random() * 7.0);
        hole.position.copy(basePos);
        flowGroup.add(hole);
        activeParticles.push({ mesh: hole, type: 'hole-jitter', home: basePos.clone() });
      }

      // Electrons pulled towards Cathode terminal (Right, X: +6 to +11)
      for (var j = 0; j < 16; j++) {
        var elec = new THREE.Mesh(particleGeom, electronMat);
        var basePosN = new THREE.Vector3(6.5 + Math.random() * 4.5, -1.0 + Math.random() * 2.0, -3.5 + Math.random() * 7.0);
        elec.position.copy(basePosN);
        flowGroup.add(elec);
        activeParticles.push({ mesh: elec, type: 'electron-jitter', home: basePosN.clone() });
      }

      // Sparse minority electron leakage drifting across depletion: P -> N
      for (var k = 0; k < 5; k++) {
        var leakElec = new THREE.Mesh(particleGeom, electronMat);
        leakElec.scale.set(0.7, 0.7, 0.7);
        var startX = -6.0 + k * 2.5;
        leakElec.position.set(startX, (k % 2 === 0 ? 0.3 : -0.3), (k - 2) * 1.5);
        flowGroup.add(leakElec);
        activeParticles.push({
          mesh: leakElec,
          type: 'minority-drift',
          speed: 0.03,
          minX: -6.0,
          maxX: 6.0,
          y: (k % 2 === 0 ? 0.3 : -0.3),
          z: (k - 2) * 1.5
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
  var brSpeed = 0.12 + 0.22 * Math.min(1.0, absIBr / 30.0);

  if (caption) {
    caption.textContent = isZener
      ? 'ZENER BREAKDOWN (VBR < 5V): Direct quantum band-to-band electron tunneling across the ultra-narrow depletion zone! Strong reverse current.'
      : 'AVALANCHE BREAKDOWN (VBR > 6V): Cascading impact ionization! Energetic carriers strike lattice generating secondary electron-hole pairs.';
  }

  if (isCarrier) {
    if (isZener) {
      // Zener: Direct band-to-band tunneling electron stream P -> N
      for (var i = 0; i < 40; i++) {
        var zElec = new THREE.Mesh(particleGeom, zenerMat);
        var z = zTracks[i % zTracks.length] + (Math.random() - 0.5) * 0.3;
        var y = yTracks[Math.floor(i / zTracks.length) % yTracks.length];
        var startX = -2.5 + (i / 40.0) * 5.0;
        zElec.position.set(startX, y, z);
        flowGroup.add(zElec);
        activeParticles.push({
          mesh: zElec,
          type: 'zener-tunnel',
          speed: brSpeed * 1.4,
          minX: -2.5,
          maxX: 2.5,
          y: y,
          z: z
        });
      }
    } else {
      // Avalanche: Impact ionization multiplication particles
      for (var j = 0; j < 50; j++) {
        var isHole = (j % 3 === 0);
        var avPart = new THREE.Mesh(particleGeom, isHole ? avalancheMat : electronMat);
        var z = zTracks[j % zTracks.length] + (Math.random() - 0.5) * 0.5;
        var y = yTracks[Math.floor(j / zTracks.length) % yTracks.length];
        var startX = -6.0 + (j / 50.0) * 12.0;
        avPart.position.set(startX, y, z);
        flowGroup.add(avPart);
        activeParticles.push({
          mesh: avPart,
          type: isHole ? 'avalanche-hole' : 'avalanche-elec',
          speed: brSpeed,
          minX: -6.5,
          maxX: 6.5,
          y: y,
          z: z
        });
      }
    }
  } else {
    // Current Mode during breakdown: strong reverse current Cathode (+X) -> Anode (-X)
    for (var k = 0; k < 45; k++) {
      var cur = new THREE.Mesh(particleGeom, currentMat);
      var z = zTracks[k % zTracks.length];
      var y = yTracks[Math.floor(k / zTracks.length) % yTracks.length];
      var startX = 10.5 - (k / 45.0) * 21.0;
      cur.position.set(startX, y, z);
      flowGroup.add(cur);
      activeParticles.push({
        mesh: cur,
        type: 'current-rev',
        speed: brSpeed * 1.2,
        minX: -10.5,
        maxX: 10.5,
        y: y,
        z: z
      });
    }
  }
}

/**
 * Per-frame animation tick
 */
function updateFlowParticles(delta) {
  var t = Date.now() * 0.003;

  for (var i = 0; i < activeParticles.length; i++) {
    var p = activeParticles[i];
    var mesh = p.mesh;

    switch (p.type) {
      case 'hole-jitter':
      case 'electron-jitter':
        // Brownian thermal jitter
        mesh.position.x = p.home.x + 0.12 * Math.sin(t + i * 1.5);
        mesh.position.y = p.home.y + 0.12 * Math.cos(t * 1.2 + i * 2.0);
        mesh.position.z = p.home.z + 0.12 * Math.sin(t * 0.8 + i);
        break;

      case 'electron-fwd':
        // Drift from +X (Cathode) to -X (Anode)
        mesh.position.x -= p.speed;
        if (mesh.position.x < p.minX) mesh.position.x = p.maxX;
        break;

      case 'hole-fwd':
        // Drift from -X (Anode) to +X (Cathode)
        mesh.position.x += p.speed;
        if (mesh.position.x > p.maxX) mesh.position.x = p.minX;
        break;

      case 'current-fwd':
        // Conventional current from -X (Anode) to +X (Cathode)
        mesh.position.x += p.speed;
        if (mesh.position.x > p.maxX) mesh.position.x = p.minX;
        break;

      case 'minority-drift':
        mesh.position.x += p.speed;
        if (mesh.position.x > p.maxX) mesh.position.x = p.minX;
        break;

      case 'zener-tunnel':
        // High speed electron tunneling across narrow barrier P (-X) -> N (+X)
        mesh.position.x += p.speed;
        if (mesh.position.x > p.maxX) mesh.position.x = p.minX;
        break;

      case 'avalanche-elec':
        // Impact electrons sweeping across high field P (-X) -> N (+X)
        mesh.position.x += p.speed;
        if (mesh.position.x > p.maxX) mesh.position.x = p.minX;
        break;

      case 'avalanche-hole':
        // Impact holes sweeping towards Anode N (+X) -> P (-X)
        mesh.position.x -= p.speed;
        if (mesh.position.x < p.minX) mesh.position.x = p.maxX;
        break;

      case 'current-rev':
        // Reverse current flowing Cathode (+X) -> Anode (-X)
        mesh.position.x -= p.speed;
        if (mesh.position.x < p.minX) mesh.position.x = p.maxX;
        break;
    }
  }
}
