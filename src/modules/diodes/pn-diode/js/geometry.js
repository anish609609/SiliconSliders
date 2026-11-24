/**
 * geometry.js - PN Junction Diode CAD Viewer
 * Authentic 3D Physical CAD model for a Planar Diffused Silicon IC PN Junction Diode:
 * - P-Type Silicon Substrate (Bulk wafer slab matching NMOS styling)
 * - N-Well (Cathode Body Tub) implanted into the P-substrate
 * - P+ Anode Diffusion Tub with Gaussian curved profile forming P+/N junction
 * - N+ Cathode Ohmic Contact Tap with Gaussian curved profile inside N-Well
 * - 3D Conformal Depletion Shell wrapping the P+ Anode tub, dynamically modulated by VA, NA, ND
 * - Fixed Space-Charge Ions (Acceptors NA- and Donors ND+) aligned along conformal boundary
 * - High-Field Breakdown Glow on high-curvature junction sidewalls in Breakdown regime
 * - Shallow Trench Isolation (STI) oxide and Surface Passivation / ILD (SiO2)
 * - Vertical Tungsten (W) contact via plugs through ILD to active diffusions
 * - Metal-1 interconnect pads for Anode (A) and Cathode (K)
 * - 3D Floating billboard terminal tags (ANODE / CATHODE)
 */

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---------------------------------------------------------------------------
// LAYER GROUPS & REGISTRY
// ---------------------------------------------------------------------------
var groups = {
  substrate: new THREE.Group(),
  nwell: new THREE.Group(),
  active: new THREE.Group(),
  depletion: new THREE.Group(),
  ions: new THREE.Group(),
  field: new THREE.Group(),
  passivation: new THREE.Group(),
  contact: new THREE.Group(),
  metal: new THREE.Group(),
  labels: new THREE.Group()
};

// Backwards compatibility aliases
groups.semiconductor = groups.active;
groups.contacts = groups.contact;

var clickableMeshes = [];
var interactiveLabels = [];

// Base Dimensions in 3D Units
var SUB_L = 26.0;   // Substrate length X (-13 to +13)
var SUB_W = 15.0;   // Substrate width Z (-7.5 to +7.5)
var SUB_H = 4.0;    // Substrate thickness Y (-4.0 to 0.0)

var WELL_L = 21.0;  // N-Well length X (-10.5 to +10.5)
var WELL_W = 12.0;  // N-Well width Z (-6.0 to +6.0)
var WELL_H = 3.0;   // N-Well depth into silicon (-3.0 to 0.0)

var P_TUB_W = 6.4;  // P+ Anode tub width X (-8.0 to -1.6, center -4.8)
var P_TUB_L = 9.0;  // P+ Anode tub length Z (-4.5 to +4.5)
var P_TUB_D = 1.6;  // P+ Anode tub depth Y (-1.6 to 0.0)

var N_TAP_W = 5.6;  // N+ Cathode tap width X (+2.0 to +7.6, center +4.8)
var N_TAP_L = 9.0;  // N+ Cathode tap length Z (-4.5 to +4.5)
var N_TAP_D = 1.3;  // N+ Cathode tap depth Y (-1.3 to 0.0)

// Dynamic mesh references
var subMesh = null;
var nwellMesh = null;
var pTubMesh = null;
var nTapMesh = null;
var depletionShellMesh = null;
var breakdownGlowMesh = null;
var fixedIonsPGroup = null;
var fixedIonsNGroup = null;

// Materials dictionary
var diodeMaterials = {};

// ---------------------------------------------------------------------------
// PROCEDURAL TEXTURES (BRUSHED METAL & IONS)
// ---------------------------------------------------------------------------
var brushedMetalTexCache = null;
function getBrushedMetalTexture() {
  if (brushedMetalTexCache) return brushedMetalTexCache;
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
  brushedMetalTexCache = tex;
  return tex;
}

function createIonTexture(sign, bgColor, fgColor) {
  var c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  var ctx = c.getContext('2d');
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = fgColor;
  ctx.stroke();

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
// 3D FLOATING BILLBOARD LABELS
// ---------------------------------------------------------------------------
function makeLabelSprite(text, color, subtext) {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var c = document.createElement('canvas');
  c.width = 380; c.height = 110;
  var ctx = c.getContext('2d');

  ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.97)' : 'rgba(10, 14, 22, 0.96)';
  ctx.strokeStyle = color || '#5fd9c4';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(8, 8, 364, 94, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = isLight ? '#0f172a' : '#ffffff';
  ctx.font = 'bold 30px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, 190, 46);

  if (subtext) {
    ctx.fillStyle = color || (isLight ? '#0284c7' : '#5fd9c4');
    ctx.font = '600 20px "IBM Plex Mono", monospace';
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
// GAUSSIAN CURVED TUB GEOMETRY (Matching NMOS/PMOS Active Tub Standards)
// ---------------------------------------------------------------------------
function createGaussianTubGeometry(w, h, d, opts) {
  opts = opts || {};
  var nLayers = opts.nLayers || 18;
  var nPerim = opts.nPerim || 36;
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.20;
  var cornerR = opts.cornerR !== undefined ? opts.cornerR : Math.min(w, d) * 0.22;
  cornerR = Math.min(cornerR, (w / 2) * 0.95, (d / 2) * 0.95);

  var positions = [];
  var uvs = [];
  var indices = [];

  var halfW = w / 2;
  var halfD = d / 2;

  function getRoundedRectPoint(hx, hz, cr, theta) {
    var cos = Math.cos(theta);
    var sin = Math.sin(theta);
    var sx = Math.max(0, hx - cr);
    var sz = Math.max(0, hz - cr);
    var qx = cos >= 0 ? 1 : -1;
    var qz = sin >= 0 ? 1 : -1;
    var cCos = Math.abs(cos);
    var cSin = Math.abs(sin);
    var len = Math.hypot(cCos, cSin) || 1;
    return [
      qx * (sx + cr * (cCos / len)),
      qz * (sz + cr * (cSin / len))
    ];
  }

  for (var i = 0; i <= nLayers; i++) {
    var eta = i / nLayers;
    var rFactor = Math.sqrt(Math.max(0, 1.0 - eta * eta));
    var curHx = halfW * (1.0 - straggle * (1.0 - rFactor));
    var curHz = halfD * (1.0 - straggle * (1.0 - rFactor));
    var curCr = cornerR * (0.35 + 0.65 * rFactor);
    var y = h * 0.5 - h * eta;

    for (var j = 0; j < nPerim; j++) {
      var theta = (j / nPerim) * Math.PI * 2;
      var pt = getRoundedRectPoint(curHx, curHz, curCr, theta);
      positions.push(pt[0], y, pt[1]);
      uvs.push(j / nPerim, eta);
    }
  }

  for (var i = 0; i < nLayers; i++) {
    var ring1 = i * nPerim;
    var ring2 = (i + 1) * nPerim;
    for (var j = 0; j < nPerim; j++) {
      var nextJ = (j + 1) % nPerim;
      var a = ring1 + j;
      var b = ring2 + j;
      var c = ring2 + nextJ;
      var d = ring1 + nextJ;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  // Bottom cap
  var bottomCenterIdx = positions.length / 3;
  positions.push(0, -h * 0.5, 0);
  uvs.push(0.5, 1.0);
  var lastRingStart = nLayers * nPerim;
  for (var j = 0; j < nPerim; j++) {
    var nextJ = (j + 1) % nPerim;
    indices.push(bottomCenterIdx, lastRingStart + nextJ, lastRingStart + j);
  }

  // Top surface cap
  var topCenterIdx = positions.length / 3;
  positions.push(0, h * 0.5, 0);
  uvs.push(0.5, 0.0);
  for (var j = 0; j < nPerim; j++) {
    var nextJ = (j + 1) % nPerim;
    indices.push(topCenterIdx, j, nextJ);
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// BUILD 3D GEOMETRY
// ---------------------------------------------------------------------------
function buildDiodeGeometry() {
  Object.keys(groups).forEach(function (k) {
    scene.add(groups[k]);
  });

  var metalTex = getBrushedMetalTexture();
  var isLight = (currentTheme === 'light');
  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(currentTheme) : (window.getMaterialPalette ? window.getMaterialPalette(currentTheme) : null);

  // Theme-sensitive colors from unified palette
  var subColor = pal ? pal.pSubstrate : (isLight ? 0x93c5fd : 0x1e3a5f);
  var wellColor = pal ? pal.nWell : (isLight ? 0x4ade80 : 0x166534);
  var pColor = pal ? pal.pPlusDiffusion : (isLight ? 0x1d4ed8 : 0x2563eb);
  var nColor = pal ? pal.nPlusDiffusion : (isLight ? 0x15803d : 0x15803d);
  var depletColor = pal ? pal.depletion : (isLight ? 0x475569 : 0x64748b);
  var metalColor = pal ? pal.metal : (isLight ? 0x475569 : 0x94a3b8);
  var oxideColor = pal ? pal.fieldOxide : (isLight ? 0x64748b : 0x475569);
  var viaColor = pal ? pal.via : (isLight ? 0x334155 : 0xcbd5e1);
  var fieldOpacity = pal ? pal.fieldOxideOpacity : (isLight ? 0.35 : 0.45);
  var depletOpacity = pal ? pal.depletionOpacity : 0.26;

  diodeMaterials.substrate = new THREE.MeshStandardMaterial({
    color: subColor,
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  diodeMaterials.nwell = new THREE.MeshStandardMaterial({
    color: wellColor,
    roughness: 0.50,
    metalness: 0.20,
    transparent: true,
    opacity: 0.88
  });

  diodeMaterials.pRegion = new THREE.MeshStandardMaterial({
    color: pColor,
    roughness: 0.40,
    metalness: 0.20
  });

  diodeMaterials.nRegion = new THREE.MeshStandardMaterial({
    color: nColor,
    roughness: 0.40,
    metalness: 0.20
  });

  diodeMaterials.depletion = new THREE.MeshStandardMaterial({
    color: depletColor,
    emissive: 0x1e293b,
    emissiveIntensity: 0.15,
    roughness: 0.40,
    metalness: 0.10,
    transparent: true,
    opacity: depletOpacity,
    depthWrite: false
  });

  diodeMaterials.breakdownGlow = new THREE.MeshBasicMaterial({
    color: 0xf43f5e,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  diodeMaterials.sti = new THREE.MeshStandardMaterial({
    color: oxideColor,
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: fieldOpacity,
    depthWrite: false
  });

  diodeMaterials.passivation = new THREE.MeshStandardMaterial({
    color: oxideColor,
    roughness: 0.25,
    metalness: 0.05,
    transparent: true,
    opacity: fieldOpacity * 0.8,
    depthWrite: false
  });

  diodeMaterials.metal = new THREE.MeshStandardMaterial({
    color: metalColor,
    map: metalTex,
    roughness: 0.35,
    metalness: 0.80
  });

  diodeMaterials.contact = new THREE.MeshStandardMaterial({
    color: viaColor,
    roughness: 0.30,
    metalness: 0.85
  });

  // =========================================================================
  // 1. P-SUBSTRATE (BULK SILICON WAFER SLAB)
  // =========================================================================
  var subGeo = new THREE.BoxGeometry(SUB_L, SUB_H, SUB_W);
  subMesh = new THREE.Mesh(subGeo, diodeMaterials.substrate);
  subMesh.position.set(0, -SUB_H / 2, 0); // Y: -4.0 to 0.0
  subMesh.receiveShadow = true;
  subMesh.userData = { id: 'substrate', layerKey: 'substrate' };
  clickableMeshes.push(subMesh);
  groups.substrate.add(subMesh);

  var subEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(subGeo),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 })
  );
  subEdges.raycast = function () {};
  subMesh.add(subEdges);

  // =========================================================================
  // 2. N-WELL (CATHODE BODY TUB)
  // =========================================================================
  var wellGeo = createGaussianTubGeometry(WELL_L, WELL_H, WELL_W, {
    nLayers: 16,
    nPerim: 32,
    straggle: 0.14,
    cornerR: 1.8
  });
  nwellMesh = new THREE.Mesh(wellGeo, diodeMaterials.nwell);
  nwellMesh.position.set(0, -WELL_H / 2, 0); // Y: -3.0 to 0.0
  nwellMesh.receiveShadow = true;
  nwellMesh.userData = { id: 'nwell', layerKey: 'nwell' };
  clickableMeshes.push(nwellMesh);
  groups.nwell.add(nwellMesh);

  var wellEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(wellGeo),
    new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.35 })
  );
  wellEdges.raycast = function () {};
  nwellMesh.add(wellEdges);

  // =========================================================================
  // 3. ACTIVE DIFFUSIONS (P+ ANODE TUB & N+ CATHODE TAP)
  // =========================================================================
  // 3a. P+ Anode Tub (Implanted on Left, center X = -4.8)
  var pTubGeo = createGaussianTubGeometry(P_TUB_W, P_TUB_D, P_TUB_L, {
    nLayers: 14,
    nPerim: 28,
    straggle: 0.18,
    cornerR: 1.2
  });
  pTubMesh = new THREE.Mesh(pTubGeo, diodeMaterials.pRegion);
  pTubMesh.position.set(-4.8, -P_TUB_D / 2, 0); // Y: -1.6 to 0.0
  pTubMesh.castShadow = true;
  pTubMesh.receiveShadow = true;
  pTubMesh.userData = { id: 'pRegion', layerKey: 'active' };
  clickableMeshes.push(pTubMesh);
  groups.active.add(pTubMesh);

  var pEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(pTubGeo),
    new THREE.LineBasicMaterial({ color: 0xffedd5, transparent: true, opacity: 0.32 })
  );
  pEdges.raycast = function () {};
  pTubMesh.add(pEdges);

  // 3b. N+ Cathode Tap (Implanted on Right, center X = +4.8)
  var nTapGeo = createGaussianTubGeometry(N_TAP_W, N_TAP_D, N_TAP_L, {
    nLayers: 14,
    nPerim: 28,
    straggle: 0.18,
    cornerR: 1.2
  });
  nTapMesh = new THREE.Mesh(nTapGeo, diodeMaterials.nRegion);
  nTapMesh.position.set(4.8, -N_TAP_D / 2, 0); // Y: -1.3 to 0.0
  nTapMesh.castShadow = true;
  nTapMesh.receiveShadow = true;
  nTapMesh.userData = { id: 'nRegion', layerKey: 'active' };
  clickableMeshes.push(nTapMesh);
  groups.active.add(nTapMesh);

  var nEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(nTapGeo),
    new THREE.LineBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.32 })
  );
  nEdges.raycast = function () {};
  nTapMesh.add(nEdges);

  // =========================================================================
  // 4. CONFORMAL 3D DEPLETION SHELL
  // =========================================================================
  // Conformal shell wrapping around the P+ tub inside the N-Well.
  // Dynamic scale will expand its bottom & sidewalls based on W = xp + xn.
  var depGeo = createGaussianTubGeometry(P_TUB_W + 0.3, P_TUB_D + 0.25, P_TUB_L + 0.3, {
    nLayers: 14,
    nPerim: 28,
    straggle: 0.22,
    cornerR: 1.35
  });
  depletionShellMesh = new THREE.Mesh(depGeo, diodeMaterials.depletion);
  depletionShellMesh.position.set(-4.8, -P_TUB_D / 2, 0);
  depletionShellMesh.userData = { id: 'depletionRegion', layerKey: 'depletion' };
  clickableMeshes.push(depletionShellMesh);
  groups.depletion.add(depletionShellMesh);

  var depEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(depGeo),
    new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.35, depthWrite: false })
  );
  depEdges.raycast = function () {};
  depletionShellMesh.add(depEdges);

  // =========================================================================
  // 5. HIGH-FIELD BREAKDOWN GLOW MESH
  // =========================================================================
  // Concentrated along the high-curvature junction sidewalls & bottom perimeter
  var glowGeo = new THREE.BoxGeometry(1.6, P_TUB_D + 0.4, P_TUB_L + 0.4);
  breakdownGlowMesh = new THREE.Mesh(glowGeo, diodeMaterials.breakdownGlow);
  breakdownGlowMesh.position.set(-1.6, -P_TUB_D / 2, 0);
  breakdownGlowMesh.userData = { id: 'breakdownGlow', layerKey: 'field' };
  groups.field.add(breakdownGlowMesh);

  // =========================================================================
  // 6. FIXED SPACE-CHARGE IONS
  // =========================================================================
  fixedIonsPGroup = new THREE.Group();
  fixedIonsPGroup.userData = { id: 'fixedIonsP', layerKey: 'ions' };
  groups.ions.add(fixedIonsPGroup);

  fixedIonsNGroup = new THREE.Group();
  fixedIonsNGroup.userData = { id: 'fixedIonsN', layerKey: 'ions' };
  groups.ions.add(fixedIonsNGroup);

  buildIonMarkers();

  // =========================================================================
  // 7. DIELECTRIC & ISOLATION STACK (STI & ILD PASSIVATION)
  // =========================================================================
  // 7a. Shallow Trench Isolation (STI) between P+ tub and N+ tap: X in [-1.6, 2.0]
  var stiGeo = new THREE.BoxGeometry(3.6, 0.8, P_TUB_L + 1.2);
  var stiMesh = new THREE.Mesh(stiGeo, diodeMaterials.sti);
  stiMesh.position.set(0.2, -0.4, 0); // Y: -0.8 to 0.0
  stiMesh.userData = { id: 'sti', layerKey: 'passivation' };
  clickableMeshes.push(stiMesh);
  groups.passivation.add(stiMesh);

  // Outer Perimeter STI surrounding well edges
  var stiRimGeo1 = new THREE.BoxGeometry(2.5, 0.8, WELL_W);
  var stiRimMesh1 = new THREE.Mesh(stiRimGeo1, diodeMaterials.sti);
  stiRimMesh1.position.set(-9.25, -0.4, 0);
  groups.passivation.add(stiRimMesh1);

  var stiRimGeo2 = new THREE.BoxGeometry(2.5, 0.8, WELL_W);
  var stiRimMesh2 = new THREE.Mesh(stiRimGeo2, diodeMaterials.sti);
  stiRimMesh2.position.set(9.25, -0.4, 0);
  groups.passivation.add(stiRimMesh2);

  // 7b. Interlayer Dielectric (ILD Passivation SiO2)
  // Surface slab from Y = 0.0 to Y = 1.6 with etched contact cuts
  var ildHeight = 1.6;
  var ildCenterGeo = new THREE.BoxGeometry(4.8, ildHeight, P_TUB_L);
  var ildCenterMesh = new THREE.Mesh(ildCenterGeo, diodeMaterials.passivation);
  ildCenterMesh.position.set(0.0, ildHeight / 2, 0); // Center between via windows
  ildCenterMesh.userData = { id: 'passivation', layerKey: 'passivation' };
  clickableMeshes.push(ildCenterMesh);
  groups.passivation.add(ildCenterMesh);

  var ildOuterLeft = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, ildHeight, P_TUB_L),
    diodeMaterials.passivation
  );
  ildOuterLeft.position.set(-9.25, ildHeight / 2, 0);
  groups.passivation.add(ildOuterLeft);

  var ildOuterRight = new THREE.Mesh(
    new THREE.BoxGeometry(3.5, ildHeight, P_TUB_L),
    diodeMaterials.passivation
  );
  ildOuterRight.position.set(9.25, ildHeight / 2, 0);
  groups.passivation.add(ildOuterRight);

  // =========================================================================
  // 8. TUNGSTEN CONTACT VIAS (W VIA PLUGS)
  // =========================================================================
  var viaH = 1.8;
  var viaR = 0.28;
  var viaZOffsets = [-2.4, 0.0, 2.4];

  // Anode Tungsten Vias (X = -4.8, punching down into P+ tub)
  viaZOffsets.forEach(function (vz, idx) {
    var vGeo = new THREE.CylinderGeometry(viaR, viaR * 0.95, viaH, 16);
    var vMesh = new THREE.Mesh(vGeo, diodeMaterials.contact);
    vMesh.position.set(-4.8, viaH / 2, vz);
    vMesh.castShadow = true;
    vMesh.userData = { id: 'tungstenVias', layerKey: 'contact', viaIdx: 'anode_' + idx };
    clickableMeshes.push(vMesh);
    groups.contact.add(vMesh);
  });

  // Cathode Tungsten Vias (X = +4.8, punching down into N+ tap)
  viaZOffsets.forEach(function (vz, idx) {
    var vGeo = new THREE.CylinderGeometry(viaR, viaR * 0.95, viaH, 16);
    var vMesh = new THREE.Mesh(vGeo, diodeMaterials.contact);
    vMesh.position.set(4.8, viaH / 2, vz);
    vMesh.castShadow = true;
    vMesh.userData = { id: 'tungstenVias', layerKey: 'contact', viaIdx: 'cathode_' + idx };
    clickableMeshes.push(vMesh);
    groups.contact.add(vMesh);
  });

  // =========================================================================
  // 9. METAL-1 INTERCONNECTS (ANODE & CATHODE TERMINAL PADS)
  // =========================================================================
  var padW = 4.8;
  var padL = 7.2;
  var padH = 0.45;

  // Anode Metal-1 Pad (Left, X = -4.8, atop vias at Y = viaH + padH/2)
  var anodePadGeo = new THREE.BoxGeometry(padW, padH, padL);
  var anodeMesh = new THREE.Mesh(anodePadGeo, diodeMaterials.metal);
  anodeMesh.position.set(-4.8, viaH + padH / 2, 0);
  anodeMesh.castShadow = true;
  anodeMesh.userData = { id: 'anodeMetal', layerKey: 'metal' };
  clickableMeshes.push(anodeMesh);
  groups.metal.add(anodeMesh);

  var anodeEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(anodePadGeo),
    new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.6 })
  );
  anodeEdges.raycast = function () {};
  anodeMesh.add(anodeEdges);

  // Cathode Metal-1 Pad (Right, X = +4.8, atop vias at Y = viaH + padH/2)
  var cathodePadGeo = new THREE.BoxGeometry(padW, padH, padL);
  var cathodeMesh = new THREE.Mesh(cathodePadGeo, diodeMaterials.metal);
  cathodeMesh.position.set(4.8, viaH + padH / 2, 0);
  cathodeMesh.castShadow = true;
  cathodeMesh.userData = { id: 'cathodeMetal', layerKey: 'metal' };
  clickableMeshes.push(cathodeMesh);
  groups.metal.add(cathodeMesh);

  var cathodeEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cathodePadGeo),
    new THREE.LineBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.6 })
  );
  cathodeEdges.raycast = function () {};
  cathodeMesh.add(cathodeEdges);

  // =========================================================================
  // 10. 3D FLOATING TERMINAL LABELS
  // =========================================================================
  var lblAnode = makeLabelSprite('ANODE (A)', '#ea580c', 'P+ Anode Terminal (VA)');
  lblAnode.position.set(-4.8, viaH + padH + 1.8, 0);
  groups.labels.add(lblAnode);
  interactiveLabels.push(lblAnode);

  var lblCathode = makeLabelSprite('CATHODE (K)', '#1d4ed8', 'N+ Cathode Terminal (GND)');
  lblCathode.position.set(4.8, viaH + padH + 1.8, 0);
  groups.labels.add(lblCathode);
  interactiveLabels.push(lblCathode);

  var lblJunction = makeLabelSprite('P+/N JUNCTION', '#94a3b8', 'Metallurgical Boundary');
  lblJunction.position.set(-1.6, -P_TUB_D - 1.2, 0);
  groups.depletion.add(lblJunction);
  interactiveLabels.push(lblJunction);
}

// ---------------------------------------------------------------------------
// BUILD SPACE CHARGE ION MARKERS (CONFORMAL ORDERLY CRYSTAL LATTICE)
// ---------------------------------------------------------------------------
var ionPTexture = null;
var ionNTexture = null;

var ION_COLS_X = 3;
var ION_ROWS_Y = 3;
var ION_PLANES_Z = 4;
var TOTAL_IONS_PER_SIDE = ION_COLS_X * ION_ROWS_Y * ION_PLANES_Z; // 36

function buildIonMarkers() {
  if (!ionPTexture) ionPTexture = createIonTexture('−', '#ea580c', '#ffffff');
  if (!ionNTexture) ionNTexture = createIonTexture('+', '#1d4ed8', '#ffffff');

  // Pre-create 36 sprites per side arranged in an orderly crystallographic lattice
  for (var i = 0; i < TOTAL_IONS_PER_SIDE; i++) {
    var pMat = new THREE.SpriteMaterial({
      map: ionPTexture,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.75
    });
    var pSprite = new THREE.Sprite(pMat);
    pSprite.scale.set(0.44, 0.44, 1.0);
    pSprite.userData = { id: 'fixedIonsP', idx: i };
    fixedIonsPGroup.add(pSprite);

    var nMat = new THREE.SpriteMaterial({
      map: ionNTexture,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.75
    });
    var nSprite = new THREE.Sprite(nMat);
    nSprite.scale.set(0.44, 0.44, 1.0);
    nSprite.userData = { id: 'fixedIonsN', idx: i };
    fixedIonsNGroup.add(nSprite);
  }
}

// ---------------------------------------------------------------------------
// UPDATE 3D GEOMETRY FROM ACTIVE PHYSICS STATE
// ---------------------------------------------------------------------------
function updateDiode3DGeometry(state) {
  if (!pTubMesh || !nwellMesh || !depletionShellMesh) return;

  var wUm = state.wUm || 0.35;
  var xpUm = state.xpUm || (wUm * 0.1);
  var xnUm = state.xnUm || (wUm * 0.9);

  // Physical to visual scale factor
  var scaleFactor = 7.0;
  var xpVis = Math.max(0.10, Math.min(3.2, xpUm * scaleFactor));
  var xnVis = Math.max(0.12, Math.min(4.8, xnUm * scaleFactor));
  var totalWVis = xpVis + xnVis;

  // 1. Conformal Depletion Shell Scaling
  // Shell wraps around P+ tub: center at -4.8, depth at -P_TUB_D / 2.
  // Sidewall extends outward by xnVis toward Cathode tap (+X),
  // and bottom extends deeper by xnVis.
  var scaleX = 1.0 + (xnVis / P_TUB_W) * 1.8;
  var scaleY = 1.0 + (xnVis / P_TUB_D) * 1.4;
  var scaleZ = 1.0 + (xnVis / P_TUB_L) * 1.2;

  depletionShellMesh.scale.set(scaleX, scaleY, scaleZ);
  // Shift center slightly toward right (+X) and downward (-Y) as xn expands outward
  depletionShellMesh.position.set(-4.8 + xnVis * 0.35, -P_TUB_D / 2 - xnVis * 0.25, 0);

  // 2. Position Fixed Space-Charge Ions in an Orderly Lattice
  // 3 columns in X, 3 rows in Y, 4 planes in Z
  var pSprites = fixedIonsPGroup.children;
  var nSprites = fixedIonsNGroup.children;

  var zCoords = [-3.0, -1.0, 1.0, 3.0];
  var yCoords = [-0.35, -0.80, -1.25];

  for (var i = 0; i < pSprites.length; i++) {
    var sp = pSprites[i];
    var colX = i % ION_COLS_X;                     // 0, 1, 2
    var rowY = Math.floor(i / ION_COLS_X) % ION_ROWS_Y; // 0, 1, 2
    var planeZ = Math.floor(i / (ION_COLS_X * ION_ROWS_Y)); // 0, 1, 2, 3

    // P-side negative ions (Acceptors NA-): extend left from metallurgical junction (X = -1.6)
    var fracP = (colX + 0.5) / ION_COLS_X;
    var xPosP = -1.6 - fracP * xpVis;
    var yPosP = yCoords[rowY];
    var zPosP = zCoords[planeZ];

    sp.position.set(xPosP, yPosP, zPosP);
    // Smooth fade in / out based on depletion penetration
    var pVisRatio = xpVis / (0.15 + (colX / ION_COLS_X) * 0.8);
    var pAlpha = Math.max(0.0, Math.min(0.85, pVisRatio * 0.8));
    sp.material.opacity = pAlpha;
    sp.visible = pAlpha > 0.05;
  }

  for (var j = 0; j < nSprites.length; j++) {
    var sn = nSprites[j];
    var colXn = j % ION_COLS_X;
    var rowYn = Math.floor(j / ION_COLS_X) % ION_ROWS_Y;
    var planeZn = Math.floor(j / (ION_COLS_X * ION_ROWS_Y));

    // N-side positive ions (Donors ND+): extend right from metallurgical junction (X = -1.6)
    var fracN = (colXn + 0.5) / ION_COLS_X;
    var xPosN = -1.6 + fracN * xnVis;
    var yPosN = yCoords[rowYn];
    var zPosN = zCoords[planeZn];

    sn.position.set(xPosN, yPosN, zPosN);
    var nVisRatio = xnVis / (0.15 + (colXn / ION_COLS_X) * 1.2);
    var nAlpha = Math.max(0.0, Math.min(0.85, nVisRatio * 0.8));
    sn.material.opacity = nAlpha;
    sn.visible = nAlpha > 0.05;
  }

  // 3. High-Field Breakdown Glow
  if (breakdownGlowMesh) {
    var isBreakdown = (state.regime === 'ZENER' || state.regime === 'AVALANCHE' || state.regime === 'MIXED');
    if (isBreakdown) {
      breakdownGlowMesh.visible = true;
      breakdownGlowMesh.scale.set(1.0 + xnVis * 0.4, 1.0 + xnVis * 0.25, 1.0);
      breakdownGlowMesh.position.set(-1.6 + xnVis * 0.2, -P_TUB_D / 2 - xnVis * 0.1, 0);

      var glowColor = (state.regime === 'ZENER') ? 0xf43f5e : 0x8b5cf6;
      diodeMaterials.breakdownGlow.color.setHex(glowColor);
      diodeMaterials.breakdownGlow.opacity = 0.45 + 0.25 * Math.sin(Date.now() * 0.009);
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
  var isLight = (currentTheme === 'light');
  if (!diodeMaterials.substrate) return;

  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(currentTheme) : (window.getMaterialPalette ? window.getMaterialPalette(currentTheme) : null);
  if (!pal) {
    pal = {
      pSubstrate: isLight ? '#93C5FD' : '#1E3A5F',
      nWell: isLight ? '#4ADE80' : '#166534',
      pPlusDiffusion: isLight ? '#1D4ED8' : '#2563EB',
      nPlusDiffusion: isLight ? '#15803D' : '#15803D',
      depletion: isLight ? '#475569' : '#64748B',
      depletionOpacity: 0.26,
      fieldOxide: isLight ? '#64748B' : '#475569',
      fieldOxideOpacity: isLight ? 0.35 : 0.45,
      metal: isLight ? '#475569' : '#94A3B8',
      via: isLight ? '#334155' : '#CBD5E1'
    };
  }

  diodeMaterials.substrate.color.set(pal.pSubstrate);
  diodeMaterials.substrate.roughness = 0.85;
  diodeMaterials.substrate.metalness = 0.05;
  if (diodeMaterials.substrate.emissive) diodeMaterials.substrate.emissive.set(0x000000);
  diodeMaterials.substrate.emissiveIntensity = 0;
  if (diodeMaterials.nwell) {
    diodeMaterials.nwell.color.set(pal.nWell);
    diodeMaterials.nwell.roughness = isLight ? 0.75 : 0.50;
    diodeMaterials.nwell.metalness = isLight ? 0.05 : 0.20;
    if (diodeMaterials.nwell.emissive) diodeMaterials.nwell.emissive.set(0x000000);
    diodeMaterials.nwell.emissiveIntensity = 0;
  }
  if (diodeMaterials.pRegion) diodeMaterials.pRegion.color.set(pal.pPlusDiffusion);
  if (diodeMaterials.nRegion) diodeMaterials.nRegion.color.set(pal.nPlusDiffusion);
  if (diodeMaterials.metal) diodeMaterials.metal.color.set(pal.metal);
  if (diodeMaterials.contact) diodeMaterials.contact.color.set(pal.via);
  if (diodeMaterials.passivation) {
    diodeMaterials.passivation.color.set(pal.fieldOxide);
    diodeMaterials.passivation.opacity = (pal.fieldOxideOpacity || 0.45) * 0.8;
  }
  if (diodeMaterials.sti) {
    diodeMaterials.sti.color.set(pal.fieldOxide);
    diodeMaterials.sti.opacity = pal.fieldOxideOpacity || 0.45;
  }
  if (diodeMaterials.depletion) {
    diodeMaterials.depletion.color.set(pal.depletion);
    diodeMaterials.depletion.opacity = pal.depletionOpacity || 0.26;
  }

  if (typeof updateLayersListTheme === 'function') {
    updateLayersListTheme(pal);
  }

  if (typeof renderer !== 'undefined' && renderer && typeof scene !== 'undefined' && scene && typeof activeCamera !== 'undefined' && activeCamera) {
    renderer.render(scene, activeCamera);
  }
}
