/**
 * geometry.js - PN Junction Diode CAD Viewer
 * 3D Physical model for a discrete planar/mesa PN Junction Diode:
 * - P-type silicon bulk block (Anode side) with Boron acceptor doping finish.
 * - N-type silicon bulk block (Cathode side) with Phosphorus donor doping finish.
 * - Dynamic space-charge depletion zone expanding/contracting with bias VA and doping NA, ND.
 * - Asymmetric depletion extensions xp vs xn with fixed uncompensated space-charge ions (NA- and ND+).
 * - Metallic Anode (P-side) and Cathode (N-side) contact pads with brushed metal textures.
 * - Surface oxide passivation dielectric (SiO2) with etched contact windows.
 * - Volumetric high-field breakdown glow active during Zener/Avalanche breakdown.
 * - Interactive raycasting, mesh registration, layer explosion groups, and clipping plane integration.
 */

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---------------------------------------------------------------------------
// LAYER GROUPS & MESH REGISTRY
// ---------------------------------------------------------------------------
var groups = {
  semiconductor: new THREE.Group(),
  depletion: new THREE.Group(),
  ions: new THREE.Group(),
  contacts: new THREE.Group(),
  passivation: new THREE.Group(),
  field: new THREE.Group()
};

var clickableMeshes = [];
var interactiveLabels = [];

// Base block dimensions
var BLOCK_HALF_L = 12.0;   // Length along X (-12 to +12)
var BLOCK_W = 9.0;        // Width along Z (-4.5 to +4.5)
var BLOCK_H = 3.6;        // Height along Y (-1.8 to +1.8)

// Dynamic mesh references
var pBlockMesh = null;
var nBlockMesh = null;
var depletionMesh = null;
var breakdownGlowMesh = null;
var fixedIonsPGroup = null;
var fixedIonsNGroup = null;
var pEdgeLine = null;
var nEdgeLine = null;
var depletionEdgeLine = null;

// Materials dictionary
var diodeMaterials = {};

// ---------------------------------------------------------------------------
// PROCEDURAL TEXTURES
// ---------------------------------------------------------------------------
var brushedMetalTex = null;
function getBrushedMetalTexture() {
  if (brushedMetalTex) return brushedMetalTex;
  var c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(0, 0, 256, 256);
  for (var i = 0; i < 300; i++) {
    var y = Math.random() * 256;
    var len = 30 + Math.random() * 160;
    var x = Math.random() * 256;
    var alpha = 0.08 + Math.random() * 0.16;
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(255,255,255,' + alpha + ')' : 'rgba(70,70,70,' + alpha + ')';
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  brushedMetalTex = tex;
  return tex;
}

function createIonTexture(sign, bgColor, fgColor) {
  var c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  var ctx = c.getContext('2d');
  // Outer circle
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = fgColor;
  ctx.stroke();

  // Sign text (- or +)
  ctx.fillStyle = fgColor;
  ctx.font = 'bold 74px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(sign, 64, sign === '+' ? 64 : 60);

  var tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

// ---------------------------------------------------------------------------
// 3D FLOATING TEXT LABELS (Billboard Sprites)
// ---------------------------------------------------------------------------
function makeLabelSprite(text, color, subtext) {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var c = document.createElement('canvas');
  c.width = 380; c.height = 110;
  var ctx = c.getContext('2d');

  // Background rounded pill
  ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.97)' : 'rgba(10, 14, 22, 0.96)';
  ctx.strokeStyle = color || '#5fd9c4';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(8, 8, 364, 94, 14);
  ctx.fill();
  ctx.stroke();

  // Title
  ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
  ctx.font = 'bold 32px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 190, 46);

  // Subtitle
  if (subtext) {
    ctx.fillStyle = color || (isLight ? '#0284c7' : '#5fd9c4');
    ctx.font = '600 21px "IBM Plex Mono", monospace';
    ctx.fillText(subtext, 190, 78);
  }

  var tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  var mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false });
  var sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.2, 1.25, 1.0);
  sprite.renderOrder = 998;
  return sprite;
}

// ---------------------------------------------------------------------------
// BUILD 3D GEOMETRY
// ---------------------------------------------------------------------------
function buildDiodeGeometry() {
  // Add groups to scene
  Object.keys(groups).forEach(function (k) {
    scene.add(groups[k]);
  });

  var metalTex = getBrushedMetalTexture();

  // Materials initialization
  var isLight = currentTheme === 'light';
  var pColor = isLight ? 0xd97706 : 0xcf8a4a;
  var nColor = isLight ? 0x0284c7 : 0x4a92c9;
  var depletColor = 0x9333ea;
  var metalColor = isLight ? 0x2563eb : 0x4f86c9;
  var oxideColor = isLight ? 0x0284c7 : 0x38bdf8;

  diodeMaterials.pRegion = new THREE.MeshStandardMaterial({
    color: pColor,
    roughness: 0.45,
    metalness: 0.15
  });

  diodeMaterials.nRegion = new THREE.MeshStandardMaterial({
    color: nColor,
    roughness: 0.45,
    metalness: 0.15
  });

  diodeMaterials.depletion = new THREE.MeshStandardMaterial({
    color: depletColor,
    roughness: 0.3,
    metalness: 0.2,
    transparent: true,
    opacity: 0.42,
    depthWrite: false
  });

  diodeMaterials.breakdownGlow = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  diodeMaterials.metal = new THREE.MeshStandardMaterial({
    color: metalColor,
    map: metalTex,
    roughness: 0.35,
    metalness: 0.75
  });

  diodeMaterials.passivation = new THREE.MeshStandardMaterial({
    color: oxideColor,
    roughness: 0.2,
    metalness: 0.1,
    transparent: true,
    opacity: 0.38,
    depthWrite: false
  });

  // 1. P-Type Region Mesh (Negative X half)
  var pGeo = new THREE.BoxGeometry(1.0, BLOCK_H, BLOCK_W);
  pBlockMesh = new THREE.Mesh(pGeo, diodeMaterials.pRegion);
  pBlockMesh.castShadow = true;
  pBlockMesh.receiveShadow = true;
  pBlockMesh.userData = { id: 'pRegion' };
  clickableMeshes.push(pBlockMesh);
  groups.semiconductor.add(pBlockMesh);

  pEdgeLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(pGeo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
  );
  pBlockMesh.add(pEdgeLine);

  // 2. N-Type Region Mesh (Positive X half)
  var nGeo = new THREE.BoxGeometry(1.0, BLOCK_H, BLOCK_W);
  nBlockMesh = new THREE.Mesh(nGeo, diodeMaterials.nRegion);
  nBlockMesh.castShadow = true;
  nBlockMesh.receiveShadow = true;
  nBlockMesh.userData = { id: 'nRegion' };
  clickableMeshes.push(nBlockMesh);
  groups.semiconductor.add(nBlockMesh);

  nEdgeLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(nGeo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 })
  );
  nBlockMesh.add(nEdgeLine);

  // 3. Dynamic Depletion Region Mesh (Spans junction [-xp, +xn])
  var depGeo = new THREE.BoxGeometry(1.0, BLOCK_H + 0.04, BLOCK_W + 0.04);
  depletionMesh = new THREE.Mesh(depGeo, diodeMaterials.depletion);
  depletionMesh.userData = { id: 'depletionRegion' };
  clickableMeshes.push(depletionMesh);
  groups.depletion.add(depletionMesh);

  depletionEdgeLine = new THREE.LineSegments(
    new THREE.EdgesGeometry(depGeo),
    new THREE.LineBasicMaterial({ color: 0xc084fc, transparent: true, opacity: 0.6 })
  );
  depletionMesh.add(depletionEdgeLine);

  // 4. Breakdown Glow Volumetric Mesh
  var glowGeo = new THREE.BoxGeometry(1.0, BLOCK_H + 0.3, BLOCK_W + 0.3);
  breakdownGlowMesh = new THREE.Mesh(glowGeo, diodeMaterials.breakdownGlow);
  breakdownGlowMesh.userData = { id: 'breakdownGlow' };
  groups.field.add(breakdownGlowMesh);

  // 5. Fixed Space-Charge Ions Group (Acceptors NA- and Donors ND+)
  fixedIonsPGroup = new THREE.Group();
  fixedIonsPGroup.userData = { id: 'fixedIonsP' };
  groups.ions.add(fixedIonsPGroup);

  fixedIonsNGroup = new THREE.Group();
  fixedIonsNGroup.userData = { id: 'fixedIonsN' };
  groups.ions.add(fixedIonsNGroup);

  buildIonMarkers();

  // 6. Anode Contact (Metal-1 Pad & Via Studs on P-Side)
  var padW = 3.2;
  var padL = BLOCK_W - 1.2;
  var padH = 0.45;
  var anodePadGeo = new THREE.BoxGeometry(padW, padH, padL);
  var anodeMesh = new THREE.Mesh(anodePadGeo, diodeMaterials.metal);
  anodeMesh.position.set(-BLOCK_HALF_L + padW / 2 + 0.6, BLOCK_H / 2 + padH / 2, 0);
  anodeMesh.castShadow = true;
  anodeMesh.userData = { id: 'anodeMetal' };
  clickableMeshes.push(anodeMesh);
  groups.contacts.add(anodeMesh);

  // Tungsten via plugs for Anode
  for (var vz = -2.8; vz <= 2.8; vz += 1.8) {
    var viaGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.35, 12);
    var viaMesh = new THREE.Mesh(viaGeo, diodeMaterials.metal);
    viaMesh.position.set(-BLOCK_HALF_L + padW / 2 + 0.6, BLOCK_H / 2 + 0.15, vz);
    groups.contacts.add(viaMesh);
  }

  // 7. Cathode Contact (Metal-1 Pad & Via Studs on N-Side)
  var cathodePadGeo = new THREE.BoxGeometry(padW, padH, padL);
  var cathodeMesh = new THREE.Mesh(cathodePadGeo, diodeMaterials.metal);
  cathodeMesh.position.set(BLOCK_HALF_L - padW / 2 - 0.6, BLOCK_H / 2 + padH / 2, 0);
  cathodeMesh.castShadow = true;
  cathodeMesh.userData = { id: 'cathodeMetal' };
  clickableMeshes.push(cathodeMesh);
  groups.contacts.add(cathodeMesh);

  // Tungsten via plugs for Cathode
  for (var vz = -2.8; vz <= 2.8; vz += 1.8) {
    var viaGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.35, 12);
    var viaMesh = new THREE.Mesh(viaGeo, diodeMaterials.metal);
    viaMesh.position.set(BLOCK_HALF_L - padW / 2 - 0.6, BLOCK_H / 2 + 0.15, vz);
    groups.contacts.add(viaMesh);
  }

  // 8. Passivation Dielectric Oxide (SiO2) Capping Layer
  var passL = (BLOCK_HALF_L - padW - 0.9) * 2;
  var passGeo = new THREE.BoxGeometry(passL, 0.35, BLOCK_W);
  var passMesh = new THREE.Mesh(passGeo, diodeMaterials.passivation);
  passMesh.position.set(0, BLOCK_H / 2 + 0.18, 0);
  passMesh.userData = { id: 'passivation' };
  clickableMeshes.push(passMesh);
  groups.passivation.add(passMesh);

  // 9. Floating 3D Billboard Labels
  var lblAnode = makeLabelSprite('ANODE (A)', '#4a92c9', 'P-Side Contact (VA)');
  lblAnode.position.set(-BLOCK_HALF_L + 2.2, BLOCK_H / 2 + 2.4, 0);
  groups.contacts.add(lblAnode);
  interactiveLabels.push(lblAnode);

  var lblCathode = makeLabelSprite('CATHODE (K)', '#57cf8f', 'N-Side Contact (GND)');
  lblCathode.position.set(BLOCK_HALF_L - 2.2, BLOCK_H / 2 + 2.4, 0);
  groups.contacts.add(lblCathode);
  interactiveLabels.push(lblCathode);

  var lblJunction = makeLabelSprite('P-N JUNCTION', '#c084fc', 'Metallurgical Boundary (x=0)');
  lblJunction.position.set(0, -BLOCK_H / 2 - 1.6, 0);
  groups.depletion.add(lblJunction);
  interactiveLabels.push(lblJunction);
}

// ---------------------------------------------------------------------------
// BUILD SPACE CHARGE ION MARKERS (NA- on P-Side, ND+ on N-Side)
// ---------------------------------------------------------------------------
var ionPTexture = null;
var ionNTexture = null;

function buildIonMarkers() {
  if (!ionPTexture) ionPTexture = createIonTexture('-', '#e11d48', '#ffffff');
  if (!ionNTexture) ionNTexture = createIonTexture('+', '#0284c7', '#ffffff');

  // Pre-create 18 sprites on each side arranged in a 3x3 depth/lateral matrix
  for (var i = 0; i < 24; i++) {
    var pMat = new THREE.SpriteMaterial({ map: ionPTexture, depthTest: true, depthWrite: false });
    var pSprite = new THREE.Sprite(pMat);
    pSprite.scale.set(0.65, 0.65, 1.0);
    pSprite.userData = { id: 'fixedIonsP', idx: i };
    fixedIonsPGroup.add(pSprite);

    var nMat = new THREE.SpriteMaterial({ map: ionNTexture, depthTest: true, depthWrite: false });
    var nSprite = new THREE.Sprite(nMat);
    nSprite.scale.set(0.65, 0.65, 1.0);
    nSprite.userData = { id: 'fixedIonsN', idx: i };
    fixedIonsNGroup.add(nSprite);
  }
}

// ---------------------------------------------------------------------------
// UPDATE 3D GEOMETRY FROM ACTIVE PHYSICS STATE
// ---------------------------------------------------------------------------
function updateDiode3DGeometry(state) {
  if (!pBlockMesh || !nBlockMesh || !depletionMesh) return;

  // Physical depletion widths xp and xn mapped to 3D visual units
  // Map typical depletion width (0.05 to 2.5 um) to 3D space [0.2 to 8.0 units]
  var wUm = state.wUm || 0.35;
  var xpUm = state.xpUm || (wUm * 0.1);
  var xnUm = state.xnUm || (wUm * 0.9);

  // Scaling factor mapping micrometers to 3D units
  // Reference: standard standard equilibrium (w ~ 0.35 um) -> 3D total width ~ 3.6 units
  var scaleFactor = 10.0;
  var xpVis = Math.max(0.18, Math.min(8.5, xpUm * scaleFactor));
  var xnVis = Math.max(0.18, Math.min(8.5, xnUm * scaleFactor));
  var totalWVis = xpVis + xnVis;

  // 1. Depletion Zone Mesh
  // Positioned from -xpVis to +xnVis, center is (-xpVis + xnVis)/2
  var depCenterX = (-xpVis + xnVis) / 2.0;
  depletionMesh.scale.set(totalWVis, 1, 1);
  depletionMesh.position.set(depCenterX, 0, 0);

  // 2. P-Region Mesh (spans from -BLOCK_HALF_L to -xpVis)
  var pLength = Math.max(0.2, BLOCK_HALF_L - xpVis);
  pBlockMesh.scale.set(pLength, 1, 1);
  pBlockMesh.position.set(-BLOCK_HALF_L + pLength / 2.0, 0, 0);

  // 3. N-Region Mesh (spans from +xnVis to +BLOCK_HALF_L)
  var nLength = Math.max(0.2, BLOCK_HALF_L - xnVis);
  nBlockMesh.scale.set(nLength, 1, 1);
  nBlockMesh.position.set(BLOCK_HALF_L - nLength / 2.0, 0, 0);

  // 4. Update Fixed Ions Positions
  // Spread NA- ions uniformly inside [-xpVis, -0.05]
  var pSprites = fixedIonsPGroup.children;
  var nSprites = fixedIonsNGroup.children;

  var yPositions = [-1.0, 0.0, 1.0];
  var zPositions = [-3.0, -1.8, -0.6, 0.6, 1.8, 3.0];

  for (var i = 0; i < pSprites.length; i++) {
    var s = pSprites[i];
    var yIdx = i % yPositions.length;
    var zIdx = Math.floor(i / yPositions.length) % zPositions.length;
    var fracX = 0.15 + 0.70 * ((i % 4) / 3.0); // distributed along -xp
    var xPos = -xpVis * fracX;
    s.position.set(xPos, yPositions[yIdx], zPositions[zIdx]);
    // Fade out if depletion is extremely thin
    s.visible = xpVis > 0.25;
  }

  // Spread ND+ ions uniformly inside [+0.05, +xnVis]
  for (var j = 0; j < nSprites.length; j++) {
    var sn = nSprites[j];
    var yIdxN = j % yPositions.length;
    var zIdxN = Math.floor(j / yPositions.length) % zPositions.length;
    var fracXN = 0.15 + 0.70 * ((j % 4) / 3.0);
    var xPosN = xnVis * fracXN;
    sn.position.set(xPosN, yPositions[yIdxN], zPositions[zIdxN]);
    sn.visible = xnVis > 0.25;
  }

  // 5. High-Field Breakdown Glow
  if (breakdownGlowMesh) {
    var isBreakdown = (state.regime === 'ZENER' || state.regime === 'AVALANCHE' || state.regime === 'MIXED');
    if (isBreakdown) {
      breakdownGlowMesh.visible = true;
      breakdownGlowMesh.scale.set(totalWVis + 0.4, 1.0, 1.0);
      breakdownGlowMesh.position.set(depCenterX, 0, 0);
      var glowColor = state.regime === 'ZENER' ? 0xf43f5e : 0x8b5cf6;
      diodeMaterials.breakdownGlow.color.setHex(glowColor);
      diodeMaterials.breakdownGlow.opacity = 0.45 + 0.25 * Math.sin(Date.now() * 0.008);
    } else {
      breakdownGlowMesh.visible = false;
      diodeMaterials.breakdownGlow.opacity = 0.0;
    }
  }
}

// ---------------------------------------------------------------------------
// ADAPTIVE MATERIALS THEME (LIGHT / DARK)
// ---------------------------------------------------------------------------
function updateMaterialsTheme() {
  var isLight = currentTheme === 'light';
  if (!diodeMaterials.pRegion) return;

  diodeMaterials.pRegion.color.setHex(isLight ? 0xd97706 : 0xcf8a4a);
  diodeMaterials.nRegion.color.setHex(isLight ? 0x0284c7 : 0x4a92c9);
  diodeMaterials.metal.color.setHex(isLight ? 0x2563eb : 0x4f86c9);
  diodeMaterials.passivation.color.setHex(isLight ? 0x0284c7 : 0x38bdf8);

  if (pEdgeLine && pEdgeLine.material) {
    pEdgeLine.material.color.setHex(isLight ? 0x94a3b8 : 0xffffff);
    pEdgeLine.material.opacity = isLight ? 0.35 : 0.22;
  }
  if (nEdgeLine && nEdgeLine.material) {
    nEdgeLine.material.color.setHex(isLight ? 0x94a3b8 : 0xffffff);
    nEdgeLine.material.opacity = isLight ? 0.35 : 0.22;
  }
}
