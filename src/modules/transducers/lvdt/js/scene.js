/**
 * scene.js - Three.js r128 3D Cutaway & Enclosed LVDT CAD Viewport
 *
 * Procedurally constructs:
 *  - Switchable Cutaway / Enclosed stainless-steel + mu-metal outer housing
 *  - Cutaway insulating PEEK/phenolic bobbin with winding bays
 *  - Cutaway copper Primary (P) and Secondary (S1, S2) wound coils
 *  - Sliding ferromagnetic Ni-Fe Permalloy core & non-magnetic push-rod
 *  - Animated dipole magnetic flux lines & pulse beads (P->S1, P->S2)
 *  - Collision-free 100% Exploded View, per-layer visibility, SiliconLayerHighlight
 *    raycasting (6px drag threshold), 5-step guided tour, and dark/light theme lighting.
 */
(function (root) {
  'use strict';

  var CUT_START = 1.12 * Math.PI;
  var CUT_END = 2.48 * Math.PI;
  var CUT_ARC = CUT_END - CUT_START;
  var DRAG_THRESHOLD_PX = 6;
  var MM_TO_SCENE = 0.32;

  var PARTS_INFO = {
    housing: {
      id: 'housing',
      name: 'Outer Housing',
      material: '316L Stainless Steel + Mu-Metal Liner',
      tag: 'SHIELDING & IP68 SEAL',
      desc: 'Hermetically welded stainless-steel cylindrical shell lined with high-permeability mu-metal to shield internal windings from stray EMI and external magnetic fields.'
    },
    bobbin: {
      id: 'bobbin',
      name: 'Insulating Bobbin / Former',
      material: 'Glass-Filled PEEK / Phenolic Resin',
      tag: 'NON-MAGNETIC SUPPORT',
      desc: 'Non-magnetic, thermally stable hollow former providing concentric bore alignment, dielectric isolation, and partitioned bays for the three coil windings.'
    },
    primary: {
      id: 'primary',
      name: 'Primary Coil (P)',
      material: 'Enameled Copper Wire (AWG 34)',
      tag: 'AC EXCITATION WINDING',
      desc: 'Center copper winding driven by sinusoidal excitation Vp (1–10 Vrms, 50 Hz–10 kHz), establishing a symmetric alternating magnetic flux across the core.'
    },
    secondary1: {
      id: 'secondary1',
      name: 'Secondary Coil 1 (S₁ · Left)',
      material: 'Matched Bifilar Copper Winding',
      tag: 'SERIES-OPPOSITION PICKUP',
      desc: 'Left precision-wound secondary. Moving the core left (x < 0) increases mutual inductance M1, producing an in-phase (0°) differential output.'
    },
    secondary2: {
      id: 'secondary2',
      name: 'Secondary Coil 2 (S₂ · Right)',
      material: 'Matched Bifilar Copper Winding',
      tag: 'SERIES-OPPOSITION PICKUP',
      desc: 'Right secondary wired in series opposition to S₁ (Vout = VS1 − VS2). Moving the core right (x > 0) increases M2, inverting output phase by 180°.'
    },
    core: {
      id: 'core',
      name: 'Ferromagnetic Core',
      material: '78% Ni-Fe Permalloy (High-μ)',
      tag: 'MOVABLE FLUX ARMATURE',
      desc: 'High-permeability, low-coercivity ferromagnetic armature sliding frictionlessly inside the bore to steer magnetic flux coupling between P, S₁, and S₂.'
    },
    pushrod: {
      id: 'pushrod',
      name: 'Non-Magnetic Push-Rod',
      material: '304 Stainless Steel / Titanium Alloy',
      tag: 'MECHANICAL LINKAGE',
      desc: 'Zero-permeability extension rod transmitting external target displacement x to the Ni-Fe core without distorting the internal magnetic flux path.'
    }
  };

  var TOUR_STEPS = [
    {
      id: 'overview',
      title: '1. Cutaway LVDT Architecture',
      subtitle: 'Coaxial differential transformer: mu-metal housing, PEEK bobbin, P/S₁/S₂ copper coils, and sliding Ni-Fe armature.',
      camPos: [6.8, 5.2, 10.6],
      target: [0.3, 0.0, 0.0],
      xMm: 0.0,
      explode: 0.12,
      highlightLayer: null
    },
    {
      id: 'primary',
      title: '2. Primary Excitation (P)',
      subtitle: 'AC voltage Vp drives the central Primary Coil (P), creating a symmetric alternating dipole magnetic field.',
      camPos: [2.2, 3.6, 6.4],
      target: [0.0, 0.0, 0.0],
      xMm: 0.0,
      explode: 0.0,
      highlightLayer: 'primary'
    },
    {
      id: 'null',
      title: '3. Magnetic Null Balance (x = 0 mm)',
      subtitle: 'Centered core couples equal flux into S₁ and S₂. Series-opposition wiring cancels voltages: VS1 − VS2 = 0 V.',
      camPos: [0.0, 4.0, 7.6],
      target: [0.0, 0.0, 0.0],
      xMm: 0.0,
      explode: 0.0,
      highlightLayer: 'core'
    },
    {
      id: 'left-shift',
      title: '4. Left Displacement & Flux Shift (x = −4.5 mm)',
      subtitle: 'Core shifts left toward S₁: flux density concentrates in S₁ (VS1 > VS2), yielding an in-phase (0°) output.',
      camPos: [-3.2, 3.8, 7.4],
      target: [-1.4, 0.0, 0.0],
      xMm: -4.5,
      explode: 0.0,
      highlightLayer: 'secondary1'
    },
    {
      id: 'phase-flip',
      title: '5. 180° Phase Reversal (x = +4.5 mm)',
      subtitle: 'Crossing null to x > 0 shifts flux into S₂ (VS2 > VS1), flipping differential polarity and AC phase by 180°.',
      camPos: [4.2, 3.8, 7.4],
      target: [1.4, 0.0, 0.0],
      xMm: 4.5,
      explode: 0.0,
      highlightLayer: 'secondary2'
    }
  ];

  // Runtime scene handles
  var hostEl = null;
  var scene = null;
  var camera = null;
  var renderer = null;
  var controls = null;
  var assemblyRoot = null;
  var gridHelper = null;
  var shadowPlane = null;
  var ambientLight = null;
  var keyLight = null;
  var fillLight = null;
  var rimLight = null;

  var initialCamPos = new THREE.Vector3(6.8, 5.2, 10.6);
  var initialTarget = new THREE.Vector3(0.3, 0.0, 0.0);

  // Layer groups & housing sub-modes
  var layerGroups = {};
  var housingCutawayGroup = null;
  var housingEnclosedGroup = null;
  var viewModeGroups = [];
  var housingViewMode = 'cutaway';
  var layerVisibility = {
    housing: true,
    bobbin: true,
    primary: true,
    secondary1: true,
    secondary2: true,
    core: true,
    pushrod: true
  };

  var moverGroup = null;
  var fluxGroup = null;
  var fluxLeftEntries = [];
  var fluxRightEntries = [];
  var materials = {};
  var explodeFrac = 0.0;
  var fluxVisible = true;
  var activeHighlightId = null;
  var dimSaved = [];

  var camTween = null;
  var currentSimState = null;
  var simPhase = 0;

  var pointerDown = false;
  var pointerDownPos = { x: 0, y: 0 };
  var isDragging = false;
  var raycaster = new THREE.Raycaster();
  var pointerNdc = new THREE.Vector2();
  var callbacks = {
    onSelectLayer: null,
    onHoverLayer: null
  };

  function createCutawayTubeGeo(innerR, outerR, length, startAngle, endAngle, curveSegments) {
    var shape = new THREE.Shape();
    var segs = curveSegments || 48;
    shape.absarc(0, 0, outerR, startAngle, endAngle, false);
    shape.lineTo(Math.cos(endAngle) * innerR, Math.sin(endAngle) * innerR);
    shape.absarc(0, 0, innerR, endAngle, startAngle, true);
    shape.closePath();

    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.014,
      bevelSegments: 2,
      curveSegments: segs
    });
    geo.translate(0, 0, -length / 2);
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }

  function registerLayerMesh(mesh, layerId) {
    mesh.userData = mesh.userData || {};
    mesh.userData.layerId = layerId;
    return mesh;
  }

  function buildMaterials() {
    materials.housing = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.78,
      roughness: 0.26,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    materials.housingEnclosed = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.82,
      roughness: 0.25
    });
    materials.housingCap = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.82,
      roughness: 0.28
    });
    materials.bobbin = new THREE.MeshStandardMaterial({
      color: 0xc89d66,
      metalness: 0.08,
      roughness: 0.56
    });
    materials.primaryCopper = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xb45309,
      emissiveIntensity: 0.16,
      metalness: 0.8,
      roughness: 0.25
    });
    materials.sec1Copper = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.14,
      metalness: 0.8,
      roughness: 0.25
    });
    materials.sec2Copper = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.14,
      metalness: 0.8,
      roughness: 0.25
    });
    materials.core = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      emissive: 0x334155,
      emissiveIntensity: 0.08,
      metalness: 0.88,
      roughness: 0.20
    });
    materials.pushrod = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.74,
      roughness: 0.32
    });
    materials.pushrodAccent = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.78,
      roughness: 0.28
    });
  }

  function buildCoilBay(group, layerId, centerX, bayWidth, innerR, outerR, turns, mat, isEnclosed) {
    var arcStart = isEnclosed ? 0 : CUT_START;
    var arcEnd = isEnclosed ? (Math.PI * 2) : CUT_END;
    var arcSpan = isEnclosed ? (Math.PI * 2) : CUT_ARC;
    var segs = isEnclosed ? 48 : 40;

    var drumGeo = createCutawayTubeGeo(innerR, innerR + 0.06, bayWidth - 0.14, arcStart, arcEnd, segs);
    var drum = new THREE.Mesh(drumGeo, mat);
    drum.position.x = centerX;
    drum.castShadow = true;
    drum.receiveShadow = true;
    registerLayerMesh(drum, layerId);
    group.add(drum);

    var wireRadius = 0.068;
    var ringRadius = (innerR + outerR) * 0.5;
    var pitch = (bayWidth - 0.24) / Math.max(1, turns - 1);
    var startX = centerX - (bayWidth - 0.24) * 0.5;

    for (var row = 0; row < 2; row++) {
      var rRow = ringRadius + (row === 0 ? -0.065 : 0.075);
      for (var i = 0; i < turns; i++) {
        var torusGeo = new THREE.TorusGeometry(rRow, wireRadius, 10, 48, arcSpan);
        torusGeo.rotateZ(arcStart);
        torusGeo.rotateY(Math.PI / 2);
        var wire = new THREE.Mesh(torusGeo, mat);
        wire.position.x = startX + i * pitch;
        wire.castShadow = true;
        registerLayerMesh(wire, layerId);
        group.add(wire);
      }
    }

    var pinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.85, 12);
    var pin = new THREE.Mesh(pinGeo, mat);
    pin.position.set(centerX, outerR + 0.38, -0.35);
    registerLayerMesh(pin, layerId);
    group.add(pin);
  }

  function buildBobbinMeshes(group, isEnclosed) {
    var arcStart = isEnclosed ? 0 : CUT_START;
    var arcEnd = isEnclosed ? (Math.PI * 2) : CUT_END;
    var bobbinTubeGeo = createCutawayTubeGeo(0.76, 0.90, 8.9, arcStart, arcEnd, 48);
    var bobbinTube = new THREE.Mesh(bobbinTubeGeo, materials.bobbin);
    bobbinTube.castShadow = true;
    bobbinTube.receiveShadow = true;
    registerLayerMesh(bobbinTube, 'bobbin');
    group.add(bobbinTube);

    [-4.25, -1.45, 1.45, 4.25].forEach(function (fx) {
      var flangeGeo = createCutawayTubeGeo(0.76, 1.56, 0.16, arcStart, arcEnd, 48);
      var flange = new THREE.Mesh(flangeGeo, materials.bobbin);
      flange.position.x = fx;
      flange.castShadow = true;
      registerLayerMesh(flange, 'bobbin');
      group.add(flange);
    });
  }

  function addCutawayEnclosedPair(parentGrp, buildFn) {
    var cutSub = new THREE.Group();
    var encSub = new THREE.Group();
    buildFn(cutSub, false);
    buildFn(encSub, true);
    cutSub.visible = housingViewMode === 'cutaway';
    encSub.visible = housingViewMode === 'enclosed';
    parentGrp.add(cutSub);
    parentGrp.add(encSub);
    viewModeGroups.push({ cut: cutSub, enclosed: encSub });
  }

  function createFluxLoop(xStart, xEnd, radiusY, radiusZ, sideSign, colorHex) {
    var xMid = (xStart + xEnd) * 0.5;
    var pts = [
      new THREE.Vector3(xStart, 0.0, 0.0),
      new THREE.Vector3(xStart + (xEnd - xStart) * 0.15, radiusY * 0.65, radiusZ * 0.55),
      new THREE.Vector3(xMid, radiusY, radiusZ),
      new THREE.Vector3(xEnd - (xEnd - xStart) * 0.15, radiusY * 0.65, radiusZ * 0.55),
      new THREE.Vector3(xEnd, 0.0, 0.0),
      new THREE.Vector3(xMid, -radiusY * 0.22, -radiusZ * 0.18),
      new THREE.Vector3(xStart, 0.0, 0.0)
    ];
    var curve = new THREE.CatmullRomCurve3(pts, true);
    var tubeGeo = new THREE.TubeGeometry(curve, 52, 0.028, 8, true);
    var tubeMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    var tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.renderOrder = 8;
    tubeMesh.userData = { decorative: true, isFlowHelper: true };

    var beads = [];
    for (var b = 0; b < 3; b++) {
      var beadGeo = new THREE.SphereGeometry(0.065, 10, 10);
      var beadMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      var bead = new THREE.Mesh(beadGeo, beadMat);
      bead.renderOrder = 9;
      bead.userData = { decorative: true, isFlowHelper: true };
      beads.push({ mesh: bead, offset: b / 3.0 });
    }

    return {
      curve: curve,
      tube: tubeMesh,
      tubeMat: tubeMat,
      beads: beads,
      sideSign: sideSign
    };
  }

  function buildAssembly() {
    assemblyRoot = new THREE.Group();
    assemblyRoot.name = 'lvdtAssembly';
    viewModeGroups = [];
    fluxLeftEntries = [];
    fluxRightEntries = [];
    scene.add(assemblyRoot);

    // 1. Housing Group (contains Cutaway & Enclosed sub-groups)
    var housingGrp = new THREE.Group();
    housingGrp.userData.basePos = new THREE.Vector3(0, 0, 0);
    // Cleanly lifted upward & backward on 100% explode with zero overlap
    housingGrp.userData.explodeOffset = new THREE.Vector3(0, 4.6, -2.2);

    // 1A. Cutaway Housing Sub-Group
    housingCutawayGroup = new THREE.Group();
    var outerShellGeo = createCutawayTubeGeo(1.78, 1.98, 9.8, CUT_START, CUT_END, 56);
    var outerShell = new THREE.Mesh(outerShellGeo, materials.housing);
    outerShell.renderOrder = 3;
    registerLayerMesh(outerShell, 'housing');
    housingCutawayGroup.add(outerShell);

    [-4.92, 4.92].forEach(function (xPos) {
      var capGeo = createCutawayTubeGeo(0.55, 2.08, 0.24, CUT_START, CUT_END, 52);
      var cap = new THREE.Mesh(capGeo, materials.housingCap);
      cap.position.x = xPos;
      cap.castShadow = true;
      registerLayerMesh(cap, 'housing');
      housingCutawayGroup.add(cap);
    });

    var turretCut = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.65, 20), materials.housingCap);
    turretCut.position.set(0, 2.18, -0.65);
    registerLayerMesh(turretCut, 'housing');
    housingCutawayGroup.add(turretCut);
    housingGrp.add(housingCutawayGroup);

    // 1B. Enclosed 360-deg Housing Sub-Group
    housingEnclosedGroup = new THREE.Group();
    housingEnclosedGroup.visible = false;

    var fullBodyGeo = new THREE.CylinderGeometry(1.98, 1.98, 9.8, 56);
    fullBodyGeo.rotateZ(Math.PI / 2);
    var fullBody = new THREE.Mesh(fullBodyGeo, materials.housingEnclosed);
    fullBody.castShadow = true;
    fullBody.receiveShadow = true;
    registerLayerMesh(fullBody, 'housing');
    housingEnclosedGroup.add(fullBody);

    // Full end-cap flanges + left sealed end plate + right guide bushing
    [-4.92, 4.92].forEach(function (xPos) {
      var flangeGeo = new THREE.CylinderGeometry(2.09, 2.09, 0.26, 56);
      flangeGeo.rotateZ(Math.PI / 2);
      var flange = new THREE.Mesh(flangeGeo, materials.housingCap);
      flange.position.x = xPos;
      flange.castShadow = true;
      registerLayerMesh(flange, 'housing');
      housingEnclosedGroup.add(flange);
    });

    var leftSealGeo = new THREE.CylinderGeometry(1.85, 1.85, 0.14, 48);
    leftSealGeo.rotateZ(Math.PI / 2);
    var leftSeal = new THREE.Mesh(leftSealGeo, materials.housingCap);
    leftSeal.position.x = -5.02;
    registerLayerMesh(leftSeal, 'housing');
    housingEnclosedGroup.add(leftSeal);

    var rightBushingGeo = createCutawayTubeGeo(0.24, 1.85, 0.18, 0, Math.PI * 2, 48);
    var rightBushing = new THREE.Mesh(rightBushingGeo, materials.housingCap);
    rightBushing.position.x = 5.02;
    registerLayerMesh(rightBushing, 'housing');
    housingEnclosedGroup.add(rightBushing);

    var turretFull = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.65, 20), materials.housingCap);
    turretFull.position.set(0, 2.18, -0.65);
    registerLayerMesh(turretFull, 'housing');
    housingEnclosedGroup.add(turretFull);

    housingGrp.add(housingEnclosedGroup);
    viewModeGroups.push({ cut: housingCutawayGroup, enclosed: housingEnclosedGroup });
    housingCutawayGroup.visible = housingViewMode === 'cutaway';
    housingEnclosedGroup.visible = housingViewMode === 'enclosed';
    layerGroups.housing = housingGrp;
    assemblyRoot.add(housingGrp);

    // 2. Bobbin / Former Group (drops cleanly downward & back)
    var bobbinGrp = new THREE.Group();
    bobbinGrp.userData.basePos = new THREE.Vector3(0, 0, 0);
    bobbinGrp.userData.explodeOffset = new THREE.Vector3(0, -3.6, -2.0);
    addCutawayEnclosedPair(bobbinGrp, function (sub, isEnc) {
      buildBobbinMeshes(sub, isEnc);
    });
    layerGroups.bobbin = bobbinGrp;
    assemblyRoot.add(bobbinGrp);

    // 3. Primary Coil (P) — lifts up & forward
    var primaryGrp = new THREE.Group();
    primaryGrp.userData.basePos = new THREE.Vector3(0, 0, 0);
    primaryGrp.userData.explodeOffset = new THREE.Vector3(0, 1.9, 1.6);
    addCutawayEnclosedPair(primaryGrp, function (sub, isEnc) {
      buildCoilBay(sub, 'primary', 0.0, 2.55, 0.93, 1.42, 11, materials.primaryCopper, isEnc);
    });
    layerGroups.primary = primaryGrp;
    assemblyRoot.add(primaryGrp);

    // 4. Secondary Coil 1 (S1, left) — spreads axially left & forward
    var sec1Grp = new THREE.Group();
    sec1Grp.userData.basePos = new THREE.Vector3(0, 0, 0);
    sec1Grp.userData.explodeOffset = new THREE.Vector3(-3.2, 1.6, 1.6);
    addCutawayEnclosedPair(sec1Grp, function (sub, isEnc) {
      buildCoilBay(sub, 'secondary1', -2.85, 2.45, 0.93, 1.42, 10, materials.sec1Copper, isEnc);
    });
    layerGroups.secondary1 = sec1Grp;
    assemblyRoot.add(sec1Grp);

    // 5. Secondary Coil 2 (S2, right) — spreads axially right & forward
    var sec2Grp = new THREE.Group();
    sec2Grp.userData.basePos = new THREE.Vector3(0, 0, 0);
    sec2Grp.userData.explodeOffset = new THREE.Vector3(3.2, 1.6, 1.6);
    addCutawayEnclosedPair(sec2Grp, function (sub, isEnc) {
      buildCoilBay(sub, 'secondary2', 2.85, 2.45, 0.93, 1.42, 10, materials.sec2Copper, isEnc);
    });
    layerGroups.secondary2 = sec2Grp;
    assemblyRoot.add(sec2Grp);

    // 6 & 7. Sliding Core + Push-Rod mover assembly (independent explode offsets)
    moverGroup = new THREE.Group();
    assemblyRoot.add(moverGroup);

    var coreGrp = new THREE.Group();
    coreGrp.userData.basePos = new THREE.Vector3(0, 0, 0);
    coreGrp.userData.explodeOffset = new THREE.Vector3(-1.6, -0.6, 3.6);
    var coreBodyGeo = new THREE.CylinderGeometry(0.50, 0.50, 3.60, 32);
    coreBodyGeo.rotateZ(Math.PI / 2);
    var coreBody = new THREE.Mesh(coreBodyGeo, materials.core);
    coreBody.castShadow = true;
    coreBody.receiveShadow = true;
    registerLayerMesh(coreBody, 'core');
    coreGrp.add(coreBody);

    [-1.82, 1.82].forEach(function (cx) {
      var collarGeo = new THREE.CylinderGeometry(cx < 0 ? 0.40 : 0.50, cx < 0 ? 0.50 : 0.40, 0.14, 32);
      collarGeo.rotateZ(Math.PI / 2);
      var collar = new THREE.Mesh(collarGeo, materials.core);
      collar.position.x = cx;
      registerLayerMesh(collar, 'core');
      coreGrp.add(collar);
    });

    layerGroups.core = coreGrp;
    moverGroup.add(coreGrp);

    var rodGrp = new THREE.Group();
    rodGrp.userData.basePos = new THREE.Vector3(0, 0, 0);
    rodGrp.userData.explodeOffset = new THREE.Vector3(4.2, -0.6, 3.6);
    var rodGeo = new THREE.CylinderGeometry(0.15, 0.15, 5.4, 24);
    rodGeo.rotateZ(Math.PI / 2);
    var rod = new THREE.Mesh(rodGeo, materials.pushrod);
    rod.position.x = 4.55;
    rod.castShadow = true;
    registerLayerMesh(rod, 'pushrod');
    rodGrp.add(rod);

    var nutGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.34, 6);
    nutGeo.rotateZ(Math.PI / 2);
    var nut = new THREE.Mesh(nutGeo, materials.pushrodAccent);
    nut.position.x = 2.02;
    registerLayerMesh(nut, 'pushrod');
    rodGrp.add(nut);

    var tipGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.45, 24);
    tipGeo.rotateZ(Math.PI / 2);
    var tip = new THREE.Mesh(tipGeo, materials.pushrodAccent);
    tip.position.x = 7.35;
    registerLayerMesh(tip, 'pushrod');
    rodGrp.add(tip);

    layerGroups.pushrod = rodGrp;
    moverGroup.add(rodGrp);

    // 8. Magnetic Flux Lines Group (P -> S1 and P -> S2)
    fluxGroup = new THREE.Group();
    fluxGroup.name = 'fluxGroup';
    assemblyRoot.add(fluxGroup);

    var loopSpecs = [
      { y: 1.55, z: 0.72 },
      { y: 1.38, z: -0.95 },
      { y: -1.42, z: 0.45 }
    ];

    loopSpecs.forEach(function (sp) {
      var leftLoop = createFluxLoop(-0.35, -3.55, sp.y, sp.z, -1, 0x38bdf8);
      fluxGroup.add(leftLoop.tube);
      leftLoop.beads.forEach(function (b) { fluxGroup.add(b.mesh); });
      fluxLeftEntries.push(leftLoop);

      var rightLoop = createFluxLoop(0.35, 3.55, sp.y, sp.z, 1, 0x10b981);
      fluxGroup.add(rightLoop.tube);
      rightLoop.beads.forEach(function (b) { fluxGroup.add(b.mesh); });
      fluxRightEntries.push(rightLoop);
    });
  }

  function applySceneTheme(theme) {
    if (!scene) return;
    var isLight = theme === 'light';
    if (isLight) {
      scene.background = new THREE.Color(0xf1f5f9);
      scene.fog = new THREE.Fog(0xf1f5f9, 32, 90);
      if (ambientLight) ambientLight.intensity = 1.95;
      if (keyLight) keyLight.intensity = 1.35;
      if (gridHelper && gridHelper.material) {
        gridHelper.material.color.setHex(0x94a3b8);
        gridHelper.material.opacity = 0.20;
      }
      if (shadowPlane && shadowPlane.material) shadowPlane.material.opacity = 0.08;
    } else {
      scene.background = new THREE.Color(0x080b11);
      scene.fog = new THREE.Fog(0x080b11, 32, 90);
      if (ambientLight) ambientLight.intensity = 1.45;
      if (keyLight) keyLight.intensity = 1.65;
      if (gridHelper && gridHelper.material) {
        gridHelper.material.color.setHex(0x334155);
        gridHelper.material.opacity = 0.14;
      }
      if (shadowPlane && shadowPlane.material) shadowPlane.material.opacity = 0.22;
    }
  }

  function updateMaterialsTheme() {
    if (root.ViewerTheme) {
      applySceneTheme(root.ViewerTheme.getTheme());
    }
  }

  function setExplode(frac) {
    explodeFrac = Math.max(0, Math.min(1, Number(frac) || 0));
    Object.keys(layerGroups).forEach(function (key) {
      var grp = layerGroups[key];
      if (!grp || !grp.userData.basePos || !grp.userData.explodeOffset) return;
      grp.position.copy(grp.userData.basePos).addScaledVector(grp.userData.explodeOffset, explodeFrac);
    });
    if (moverGroup) {
      var xScene = currentSimState ? currentSimState.xMm * MM_TO_SCENE : 0;
      moverGroup.position.set(xScene, 0, 0);
    }
  }

  function setHousingView(mode) {
    housingViewMode = mode === 'enclosed' ? 'enclosed' : 'cutaway';
    var isEnc = housingViewMode === 'enclosed';
    for (var i = 0; i < viewModeGroups.length; i++) {
      var pair = viewModeGroups[i];
      if (pair.cut) pair.cut.visible = !isEnc;
      if (pair.enclosed) pair.enclosed.visible = isEnc;
    }
    if (activeHighlightId) {
      highlightLayer(activeHighlightId);
    }
  }

  function setLayerVisible(layerId, visible) {
    if (!layerGroups[layerId]) return;
    var vis = Boolean(visible);
    layerVisibility[layerId] = vis;
    layerGroups[layerId].visible = vis;
  }

  function getLayerVisible(layerId) {
    return layerVisibility[layerId] !== false;
  }

  function setFluxVisible(visible) {
    fluxVisible = Boolean(visible);
    if (fluxGroup) fluxGroup.visible = fluxVisible;
  }

  function restoreDimmed() {
    for (var i = 0; i < dimSaved.length; i++) {
      var entry = dimSaved[i];
      if (entry.mesh && entry.mesh.material) {
        entry.mesh.material.opacity = entry.opacity;
      }
    }
    dimSaved = [];
  }

  function highlightLayer(layerId) {
    if (!assemblyRoot) return;
    restoreDimmed();
    activeHighlightId = layerId || null;

    if (typeof root.SiliconLayerHighlight !== 'undefined') {
      if (!layerId) {
        root.SiliconLayerHighlight.clearHighlight(assemblyRoot);
      } else {
        root.SiliconLayerHighlight.selectLayer(assemblyRoot, layerId);
      }
    }

    if (layerId) {
      assemblyRoot.traverse(function (obj) {
        if (!obj || !obj.isMesh || !obj.material) return;
        if (obj.userData && (obj.userData._isHighlightPart || obj.userData.decorative || obj.userData.isFlowHelper)) return;
        if (obj.userData.layerId && obj.userData.layerId !== layerId) {
          dimSaved.push({ mesh: obj, opacity: obj.material.opacity });
          if (obj.material.transparent) {
            obj.material.opacity = Math.min(obj.material.opacity, 0.18);
          }
        }
      });
    }
  }

  function clearHighlight() {
    highlightLayer(null);
  }

  function tweenCamera(camPos, targetPos, durationMs) {
    if (!camera || !controls) return;
    camTween = {
      startTime: performance.now(),
      duration: durationMs || 650,
      fromPos: camera.position.clone(),
      toPos: new THREE.Vector3(camPos[0], camPos[1], camPos[2]),
      fromTarget: controls.target.clone(),
      toTarget: new THREE.Vector3(targetPos[0], targetPos[1], targetPos[2])
    };
  }

  function resetCamera() {
    tweenCamera(
      [initialCamPos.x, initialCamPos.y, initialCamPos.z],
      [initialTarget.x, initialTarget.y, initialTarget.z],
      550
    );
  }

  function applyTourStep(stepIndex) {
    var step = TOUR_STEPS[stepIndex];
    if (!step) return null;
    tweenCamera(step.camPos, step.target, 700);
    setExplode(step.explode || 0);
    highlightLayer(step.highlightLayer || null);
    return step;
  }

  function updateState(simState) {
    currentSimState = simState;
    if (!moverGroup) return;
    moverGroup.position.x = simState.xMm * MM_TO_SCENE;
  }

  function applySideFluxVisuals(entries, fluxStrength, vpNorm, freqNorm) {
    // Symmetric at null (fluxStrength = 0.5); strongly amplified toward coupled coil & dimmed opposite
    var nonLin = Math.pow(Math.max(0.0, Math.min(1.0, fluxStrength)), 1.38);
    var sideOpacity = (0.045 + 0.94 * nonLin) * (0.45 + 0.55 * vpNorm);
    var reachScale = (0.72 + 0.42 * fluxStrength) * (0.94 + 0.12 * vpNorm);
    var thickScale = (0.58 + 0.88 * fluxStrength) * (0.88 + 0.22 * vpNorm);
    var speed = 0.20 + 0.65 * fluxStrength * freqNorm;

    entries.forEach(function (entry, idx) {
      var loopWeight = idx === 0 ? 1.0 : (0.92 - 0.06 * idx);
      var tubeAlpha = Math.min(0.92, Math.max(0.04, sideOpacity * loopWeight));
      entry.tubeMat.opacity = tubeAlpha;
      entry.tube.scale.set(reachScale, thickScale, thickScale);

      entry.beads.forEach(function (b) {
        var t = (simPhase * speed + b.offset + idx * 0.17) % 1.0;
        var pt = entry.curve.getPointAt(t);
        b.mesh.position.set(pt.x * reachScale, pt.y * thickScale, pt.z * thickScale);
        b.mesh.material.opacity = Math.min(0.98, Math.max(0.05, tubeAlpha * 1.38));
        b.mesh.scale.setScalar((0.42 + 0.96 * fluxStrength) * (0.85 + 0.25 * vpNorm));
      });
    });
  }

  function updateFluxVisuals(dtSec) {
    if (!currentSimState) return;
    var freqNorm = 0.65 + 1.8 * Math.min(1, currentSimState.freqHz / 6000.0);
    var vpNorm = 0.35 + 0.65 * (currentSimState.vpVrms / 10.0);
    simPhase += dtSec * (2.6 * freqNorm);

    var acOsc = Math.sin(simPhase * 1.4);
    if (!activeHighlightId) {
      materials.primaryCopper.emissiveIntensity = 0.14 + 0.16 * vpNorm * (0.5 + 0.5 * Math.abs(acOsc));
      materials.sec1Copper.emissiveIntensity = 0.10 + 0.34 * currentSimState.fluxLeft * vpNorm;
      materials.sec2Copper.emissiveIntensity = 0.10 + 0.34 * currentSimState.fluxRight * vpNorm;
    }

    if (!fluxGroup || !fluxVisible) return;

    applySideFluxVisuals(fluxLeftEntries, currentSimState.fluxLeft, vpNorm, freqNorm);
    applySideFluxVisuals(fluxRightEntries, currentSimState.fluxRight, vpNorm, freqNorm);
  }

  function tick(dtSec) {
    if (!renderer || !scene || !camera) return;

    if (camTween) {
      var elapsed = performance.now() - camTween.startTime;
      var t = Math.min(1, elapsed / camTween.duration);
      var ease = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(camTween.fromPos, camTween.toPos, ease);
      controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, ease);
      if (t >= 1) camTween = null;
    }

    updateFluxVisuals(dtSec);
    if (controls) controls.update();
    renderer.render(scene, camera);
  }

  function resize() {
    if (!hostEl || !renderer || !camera) return;
    var w = hostEl.clientWidth || window.innerWidth;
    var h = hostEl.clientHeight || window.innerHeight;
    if (w <= 0 || h <= 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function pickLayerAtClientXY(clientX, clientY) {
    if (!renderer || !camera || !assemblyRoot) return null;
    var rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);

    if (typeof root.SiliconLayerHighlight !== 'undefined') {
      var hit = root.SiliconLayerHighlight.raycastLayer(raycaster, assemblyRoot);
      return hit ? hit.layerId : null;
    }
    return null;
  }

  function bindPointerEvents() {
    var dom = renderer.domElement;
    dom.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      pointerDown = true;
      isDragging = false;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      camTween = null;
    });

    window.addEventListener('pointermove', function (e) {
      if (pointerDown) {
        var dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
        if (dist > DRAG_THRESHOLD_PX) isDragging = true;
      } else if (e.target === dom && callbacks.onHoverLayer) {
        var hovered = pickLayerAtClientXY(e.clientX, e.clientY);
        dom.style.cursor = hovered ? 'pointer' : 'grab';
        callbacks.onHoverLayer(hovered);
      }
    });

    window.addEventListener('pointerup', function () {
      pointerDown = false;
    });

    dom.addEventListener('click', function (e) {
      if (isDragging) {
        isDragging = false;
        return;
      }
      var layerId = pickLayerAtClientXY(e.clientX, e.clientY);
      if (callbacks.onSelectLayer) {
        callbacks.onSelectLayer(layerId);
      } else {
        highlightLayer(layerId);
      }
    });
  }

  function init(containerEl, opts) {
    hostEl = containerEl;
    if (!hostEl || typeof THREE === 'undefined') return;
    if (opts) {
      callbacks.onSelectLayer = opts.onSelectLayer || null;
      callbacks.onHoverLayer = opts.onHoverLayer || null;
    }

    scene = new THREE.Scene();
    var w = hostEl.clientWidth || 960;
    var h = hostEl.clientHeight || 640;

    camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 240);
    camera.position.copy(initialCamPos);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    hostEl.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.copy(initialTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4.2;
    controls.maxDistance = 42;
    controls.update();

    ambientLight = new THREE.AmbientLight(0x475569, 1.5);
    scene.add(ambientLight);

    keyLight = new THREE.DirectionalLight(0xffffff, 1.65);
    keyLight.position.set(10, 16, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -14;
    keyLight.shadow.camera.right = 14;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);

    fillLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    fillLight.position.set(-12, 8, -8);
    scene.add(fillLight);

    rimLight = new THREE.DirectionalLight(0xf59e0b, 0.45);
    rimLight.position.set(2, 6, -14);
    scene.add(rimLight);

    gridHelper = new THREE.GridHelper(40, 40, 0x475569, 0x334155);
    gridHelper.position.y = -4.2;
    gridHelper.renderOrder = -10;
    if (gridHelper.material) {
      gridHelper.material.transparent = true;
      gridHelper.material.opacity = 0.14;
      gridHelper.material.depthWrite = false;
    }
    scene.add(gridHelper);

    shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.ShadowMaterial({ opacity: 0.18 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -4.18;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    buildMaterials();
    buildAssembly();
    bindPointerEvents();

    var theme = root.ViewerTheme ? root.ViewerTheme.getTheme() : 'dark';
    applySceneTheme(theme);

    window.addEventListener('resize', resize);
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () { resize(); });
      ro.observe(hostEl);
    }
  }

  root.applySceneTheme = applySceneTheme;
  root.updateMaterialsTheme = updateMaterialsTheme;

  root.LVDTScene = {
    PARTS_INFO: PARTS_INFO,
    TOUR_STEPS: TOUR_STEPS,
    init: init,
    updateState: updateState,
    setExplode: setExplode,
    setHousingView: setHousingView,
    setLayerVisible: setLayerVisible,
    getLayerVisible: getLayerVisible,
    setFluxVisible: setFluxVisible,
    highlightLayer: highlightLayer,
    clearHighlight: clearHighlight,
    applyTourStep: applyTourStep,
    resetCamera: resetCamera,
    resize: resize,
    tick: tick,
    applySceneTheme: applySceneTheme
  };
})(typeof window !== 'undefined' ? window : globalThis);
