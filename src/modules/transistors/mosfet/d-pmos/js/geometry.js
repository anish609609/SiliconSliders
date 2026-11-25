/**
 * geometry.js - PMOS CAD Viewer
 * 3D Physical model for a discrete P-channel MOSFET:
 * - P-substrate bulk wafer slab
 * - Deep retrograde Gaussian N-Well tub
 * - Heavily doped P+ Source and Drain diffusions (Wp ≈ 2x Wn) with lateral straggle
 * - Shallow P-SDE / LDD extensions flanking gate channel
 * - Ultra-thin interfacial SiO2 + High-k HfO2 gate dielectric stack
 * - Polysilicon / Metal gate electrode runner
 * - Gate sidewall spacers (Si3N4)
 * - N+ Well tap diffusion (tied to VDD)
 * - Tungsten CVD contact via plugs
 * - Metal-1 interconnects for Source (S/VDD), Drain (D/OUT), Gate (G), and Well (B/VDD)
 * - 3D Floating text annotations & depth testing
 */

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---------------------------------------------------------------------------
// PROCEDURAL BRUSHED METALLIC TEXTURE (Matching CMOS Inverter Palette)
// ---------------------------------------------------------------------------
var brushedMetalTexCache = null;
function getBrushedMetalTexture() {
  if (brushedMetalTexCache) return brushedMetalTexCache;
  var c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(0, 0, 256, 256);
  for (var i = 0; i < 300; i++) {
    var y = Math.random() * 256;
    var len = 30 + Math.random() * 150;
    var x = Math.random() * 256;
    var alpha = 0.08 + Math.random() * 0.15;
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(255,255,255,' + alpha + ')' : 'rgba(80,80,80,' + alpha + ')';
    ctx.lineWidth = 0.7 + Math.random() * 1.0;
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

// ---------------------------------------------------------------------------
// GAUSSIAN DOPING DEPTH & SURFACE TEXTURE GENERATOR
// ---------------------------------------------------------------------------
// In ion implantation and thermal drive-in diffusion, dopant concentration
// follows an exponential Gaussian depth distribution:
//   N(y) = Npeak * exp( -((y - Rp)^2) / (2 * sigma^2) )
// where Rp is the projected range and sigma is the depth straggle.
// Near mask boundaries, lateral straggle (x_lat ~ 0.7-0.8 xj) rounds the junction.
//
// gaussianDepthTexture() paints a UV map:
//   U (horizontal) = angular / perimeter position around the doped region
//   V (vertical)   = normalized depth into silicon (0 = surface, 1 = junction depth)
//   Iso-concentration contour lines mark equal-concentration shells at
//   0.85, 0.60, 0.35, 0.15, and 0.05 of peak concentration.
// ---------------------------------------------------------------------------
var gaussTexCache = {};
function gaussianDepthTexture(colorVarOrHex, peakV, sigmaV, opts) {
  opts = opts || {};
  var rawColor = colorVarOrHex.indexOf('--') === 0 ? cssVar(colorVarOrHex) : colorVarOrHex;
  var key = [rawColor, peakV, sigmaV, opts.isoLines || 5].join('|');
  if (gaussTexCache[key]) return gaussTexCache[key];

  var TW = 512, TH = 256;
  var c = document.createElement('canvas');
  c.width = TW;
  c.height = TH;
  var ctx = c.getContext('2d');
  var img = ctx.createImageData(TW, TH);
  var data = img.data;

  // Parse color to RGB
  var tc = new THREE.Color(rawColor);
  var r0 = Math.round(tc.r * 255);
  var g0 = Math.round(tc.g * 255);
  var b0 = Math.round(tc.b * 255);

  var nIso = opts.isoLines !== undefined ? opts.isoLines : 5;

  for (var py = 0; py < TH; py++) {
    var v = py / (TH - 1); // 0 at surface, 1 at bottom junction
    var dv = (v - peakV) / sigmaV;
    var gDepth = Math.exp(-0.5 * dv * dv);

    for (var px = 0; px < TW; px++) {
      var u = px / (TW - 1);
      // Slight periodic ripple across perimeter to give subtle crystal texture
      var uMod = 0.94 + 0.06 * Math.cos(u * Math.PI * 4);
      var conc = Math.min(1.0, gDepth * uMod);

      var idx = (py * TW + px) * 4;
      // Core is luminous; fades into base silicon at junction
      data[idx]     = Math.min(255, Math.round(r0 * (0.65 + 0.45 * conc) + 40 * conc));
      data[idx + 1] = Math.min(255, Math.round(g0 * (0.65 + 0.45 * conc) + 40 * conc));
      data[idx + 2] = Math.min(255, Math.round(b0 * (0.65 + 0.45 * conc) + 40 * conc));
      data[idx + 3] = Math.round(180 + 75 * conc);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Draw crisp iso-concentration contour lines along depth
  var isoRatios = [0.85, 0.60, 0.35, 0.15, 0.05].slice(0, nIso);
  isoRatios.forEach(function(ratio, i) {
    var dv = Math.sqrt(-2.0 * Math.log(ratio)) * sigmaV;
    var alpha = 0.70 - i * 0.10;
    ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
    ctx.lineWidth = 1.4;

    var vUp = peakV - dv;
    if (vUp >= 0 && vUp <= 1) {
      var yUp = vUp * (TH - 1);
      ctx.beginPath();
      ctx.moveTo(0, yUp);
      ctx.lineTo(TW, yUp);
      ctx.stroke();
    }
    var vDn = peakV + dv;
    if (vDn >= 0 && vDn <= 1) {
      var yDn = vDn * (TH - 1);
      ctx.beginPath();
      ctx.moveTo(0, yDn);
      ctx.lineTo(TW, yDn);
      ctx.stroke();
    }
  });

  // Top wafer interface line (dashed)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(TW, 2);
  ctx.stroke();
  ctx.setLineDash([]);

  var tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  gaussTexCache[key] = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// 3D GAUSSIAN CURVED TUB GEOMETRY
// ---------------------------------------------------------------------------
// Real diffused wells and ion-implanted regions are NOT sharp rectangular boxes:
// 1. Due to lateral straggle and isotropic thermal diffusion, dopants expand
//    under the mask edges, creating rounded quarter-cylinder/quarter-sphere shoulders.
// 2. The metallurgical junction curves smoothly upward at the edges and bottom,
//    forming a curved "tub" (for wells) or "trough" (for source/drain).
// 3. This constructs a 3D BufferGeometry with smoothly rounded corners, curved sidewalls,
//    a flat wafer-surface top cap, and a curved junction bottom.
// ---------------------------------------------------------------------------
function createGaussianTubGeometry(w, h, d, opts) {
  opts = opts || {};
  var nLayers = opts.nLayers || 20;
  var nPerim = opts.nPerim || 48;
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.18;
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

  // Stacked rings from eta = 0 (top surface, y = +h/2) to eta = 1 (bottom apex, y = -h/2)
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

  // Wall indices between rings
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

  // Bottom cap: smoothly rounded bottom apex at y = -h/2
  var bottomCenterIdx = positions.length / 3;
  positions.push(0, -h * 0.5, 0);
  uvs.push(0.5, 1.0);
  var lastRingStart = nLayers * nPerim;
  for (var j = 0; j < nPerim; j++) {
    var nextJ = (j + 1) % nPerim;
    indices.push(bottomCenterIdx, lastRingStart + nextJ, lastRingStart + j);
  }

  // Top surface cap at y = +h/2 (wafer surface)
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
// GAUSSIAN DOPING MESH BUILDER
// ---------------------------------------------------------------------------
// Creates a first-class THREE.Mesh with:
// - Realistic 3D curved Gaussian tub geometry
// - Gaussian concentration depth gradient texture
// - 3D iso-concentration contour wire loops
// - Inner high-concentration volumetric core
// - Full MeshStandardMaterial with translucent depth-layer finish
// ---------------------------------------------------------------------------
function gaussianDopingMesh(w, h, d, colorVar, opts) {
  opts = opts || {};
  var peakV = opts.peakV !== undefined ? opts.peakV : 0.25;
  var sigmaV = opts.sigmaV !== undefined ? opts.sigmaV : 0.25;

  var geo = createGaussianTubGeometry(w, h, d, opts);
  var tex = gaussianDepthTexture(colorVar, peakV, sigmaV, opts);

  var rawColor = colorVar.indexOf('--') === 0 ? cssVar(colorVar) : colorVar;
  var baseColor = new THREE.Color(rawColor);
  var mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: tex,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.50,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.15,
    transparent: true,
    opacity: opts.opacity !== undefined ? opts.opacity : 0.88,
    side: THREE.DoubleSide,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : false,
    polygonOffset: true,
    polygonOffsetFactor: -1.0,
    polygonOffsetUnits: -1.0,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  var mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.baseEmissive = 0x000000;
  mesh.userData.baseEmissiveIntensity = 0;
  mesh.userData.isGaussianDoping = true;
  mesh.userData.colorVar = colorVar;
  mesh.userData.peakV = peakV;
  mesh.userData.sigmaV = sigmaV;
  mesh.userData.opts = opts;
  mesh.userData.outlineColor = opts.outlineColor;
  mesh.renderOrder = opts.renderOrder !== undefined ? opts.renderOrder : 3;

  // Add 3D Iso-concentration Contour Wire Loops at depths eta = 0.25, 0.50, 0.75
  var contourEtas = [0.25, 0.50, 0.75];
  var nPerim = opts.nPerim || 48;
  var cornerR = opts.cornerR !== undefined ? opts.cornerR : Math.min(w, d) * 0.22;
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.18;
  cornerR = Math.min(cornerR, (w / 2) * 0.95, (d / 2) * 0.95);
  var halfW = w / 2;
  var halfD = d / 2;

  function getRoundedRectPt(hx, hz, cr, theta) {
    var cos = Math.cos(theta);
    var sin = Math.sin(theta);
    var sx = Math.max(0, hx - cr);
    var sz = Math.max(0, hz - cr);
    var qx = cos >= 0 ? 1 : -1;
    var qz = sin >= 0 ? 1 : -1;
    var cCos = Math.abs(cos);
    var cSin = Math.abs(sin);
    var len = Math.hypot(cCos, cSin) || 1;
    return new THREE.Vector3(
      qx * (sx + cr * (cCos / len)),
      0,
      qz * (sz + cr * (cSin / len))
    );
  }

  contourEtas.forEach(function(eta, idx) {
    var rFactor = Math.sqrt(Math.max(0, 1.0 - eta * eta));
    var curHx = halfW * (1.0 - straggle * (1.0 - rFactor));
    var curHz = halfD * (1.0 - straggle * (1.0 - rFactor));
    var curCr = cornerR * (0.35 + 0.65 * rFactor);
    var y = h * 0.5 - h * eta;

    var pts = [];
    for (var j = 0; j < nPerim; j++) {
      var theta = (j / nPerim) * Math.PI * 2;
      var p = getRoundedRectPt(curHx, curHz, curCr, theta);
      p.y = y;
      pts.push(p);
    }
    var lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    var lineMat = new THREE.LineBasicMaterial({
      color: opts.outlineColor ? new THREE.Color(opts.outlineColor) : baseColor.clone().offsetHSL(0, 0.1, 0.2),
      transparent: true,
      opacity: 0.70 - idx * 0.15,
      depthWrite: false
    });
    var loop = new THREE.LineLoop(lineGeo, lineMat);
    loop.raycast = function() {}; // Keep clicks focused on parent mesh
    mesh.add(loop);
  });

  // Top surface perimeter boundary line
  var topPts = [];
  for (var j = 0; j < nPerim; j++) {
    var theta = (j / nPerim) * Math.PI * 2;
    var p = getRoundedRectPt(halfW, halfD, cornerR, theta);
    p.y = h * 0.5 + 0.005;
    topPts.push(p);
  }
  var topGeo = new THREE.BufferGeometry().setFromPoints(topPts);
  var topMat = new THREE.LineBasicMaterial({
    color: opts.outlineColor ? new THREE.Color(opts.outlineColor) : baseColor,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  var topLoop = new THREE.LineLoop(topGeo, topMat);
  topLoop.raycast = function() {};
  mesh.add(topLoop);

  // High-concentration internal core for volumetric glow
  var coreH = h * 0.60;
  var coreW = w * 0.70;
  var coreD = d * 0.70;
  var coreGeo = createGaussianTubGeometry(coreW, coreH, coreD, {
    nLayers: 12,
    nPerim: 32,
    straggle: straggle * 1.2,
    cornerR: cornerR * 0.7
  });
  var coreMat = new THREE.MeshBasicMaterial({
    color: baseColor,
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  var coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.y = (h * 0.5) - (coreH * 0.5) - (h * (peakV * 0.5));
  coreMesh.raycast = function() {};
  mesh.add(coreMesh);

  return mesh;
}

// ---------------------------------------------------------------------------
// LAYER GROUPS & ORDER
// ---------------------------------------------------------------------------
var LAYER_ORDER = ['substrate', 'well', 'active', 'dchannel', 'sde', 'oxide', 'highk', 'poly', 'spacer', 'contact', 'metal'];
var EXPLODE_GAP = 3.2;

var groups = {};
LAYER_ORDER.forEach(function(k) {
  groups[k] = new THREE.Group();
  groups[k].name = k;
  scene.add(groups[k]);
});

var selectable = [];

function reg(mesh, id, layerKey) {
  mesh.userData.id = id;
  mesh.userData.layer = layerKey;
  if (mesh.isGroup) {
    mesh.traverse(function(child) {
      child.userData.id = id;
      child.userData.layer = layerKey;
    });
  }
  selectable.push(mesh);
  groups[layerKey].add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------
// FILLETED TRACE & BEVELED PDK INTERCONNECT GEOMETRIES
// ---------------------------------------------------------------------------
// Extrudes planar Metal / Gate runner geometries with rounded corner fillets
// and 45-degree micro-bevels matching the CMOS Inverter CAD baseline.
function createFilletedTraceGeometry(w, h, d, cornerRadius, bevel) {
  cornerRadius = Math.min(cornerRadius !== undefined ? cornerRadius : 0.15, Math.min(w, d) * 0.48);
  bevel = Math.min(bevel !== undefined ? bevel : 0.02, Math.min(w, h, d) * 0.25);
  var hw = w / 2;
  var hd = d / 2;
  var cr = cornerRadius;

  var shape = new THREE.Shape();
  shape.moveTo(-hw + cr, -hd);
  shape.lineTo(hw - cr, -hd);
  shape.quadraticCurveTo(hw, -hd, hw, -hd + cr);
  shape.lineTo(hw, hd - cr);
  shape.quadraticCurveTo(hw, hd, hw - cr, hd);
  shape.lineTo(-hw + cr, hd);
  shape.quadraticCurveTo(-hw, hd, -hw, hd - cr);
  shape.lineTo(-hw, -hd + cr);
  shape.quadraticCurveTo(-hw, -hd, -hw + cr, -hd);

  var extrudeSettings = {
    steps: 1,
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 2
  };
  var geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}
var createBeveledBoxGeometry = createFilletedTraceGeometry;

function box(w, h, d, colorVar, opts) {
  opts = opts || {};
  var col = colorVar.indexOf('--') === 0 ? cssVar(colorVar) : colorVar;
  var mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(col),
    roughness: opts.roughness !== undefined ? opts.roughness : 0.65,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.15,
    roughnessMap: opts.roughnessMap || ((opts.metalness !== undefined && opts.metalness >= 0.85) ? getBrushedMetalTexture() : null),
    transparent: opts.transparent || false,
    opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
    polygonOffset: opts.polygonOffset || false,
    polygonOffsetFactor: opts.polygonOffsetFactor !== undefined ? opts.polygonOffsetFactor : 0,
    polygonOffsetUnits: opts.polygonOffsetUnits !== undefined ? opts.polygonOffsetUnits : 0,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  var geo = (opts.bevel && typeof createFilletedTraceGeometry === 'function')
    ? createFilletedTraceGeometry(w, h, d, opts.cornerRadius || 0.08, opts.bevel)
    : new THREE.BoxGeometry(w, h, d);
  var m = new THREE.Mesh(geo, mat);
  m.castShadow = !opts.noShadow;
  m.receiveShadow = true;
  m.userData.colorVar = colorVar;
  m.userData.baseEmissive = 0x000000;
  m.userData.baseEmissiveIntensity = 0;
  if (opts.outlineColor) {
    var edges = new THREE.EdgesGeometry(geo, 24);
    var lineMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(opts.outlineColor),
      transparent: true,
      opacity: opts.outlineOpacity !== undefined ? opts.outlineOpacity : 0.40,
      depthWrite: false
    });
    var line = new THREE.LineSegments(edges, lineMat);
    line.raycast = function() {};
    m.add(line);
  }
  return m;
}

function cylinder(rt, rb, h, seg, colorHexOrVar, opts) {
  opts = opts || {};
  var col = (typeof colorHexOrVar === 'string' && colorHexOrVar.indexOf('--') === 0) ? cssVar(colorHexOrVar) : colorHexOrVar;
  var mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(col),
    roughness: opts.roughness !== undefined ? opts.roughness : 0.25,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.95,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.colorVar = colorHexOrVar;
  m.userData.baseEmissive = 0x000000;
  m.userData.baseEmissiveIntensity = 0;
  return m;
}

// ---------------------------------------------------------------------------
// GEOMETRY ELEVATION COORDINATES (Y Stack - Progressive Micro-Offsets to Eliminate Z-Fighting)
// ---------------------------------------------------------------------------
var Y = {
  subBot: 0.0,
  subTop: 3.0,
  wellBot: 0.603,
  wellTop: 3.003,
  actBot: 1.806,
  actTop: 3.006,
  sdeBot: 2.509,
  sdeTop: 3.009,
  oxBot: 3.009,
  oxTop: 3.189,
  hkBot: 3.189,
  hkTop: 3.429,
  polyBot: 3.429,
  polyTop: 4.459,
  ctBot: 3.009,
  ctTop: 5.159,
  m1Bot: 5.159,
  m1Top: 5.339
};

// 1. P-SUBSTRATE BASE SLAB (Bottom seated at y=0, grid lines at y=-0.02 never clip)
var subMesh = box(24, Y.subTop - Y.subBot, 22, '--c-substrate', { roughness: 0.85, metalness: 0.05 });
subMesh.renderOrder = 1;
subMesh.position.set(0, (Y.subTop + Y.subBot) / 2, 0);
reg(subMesh, 'psub', 'substrate');

// 2. N-WELL RETROGRADE TUB (Houses PMOS)
var wellW = 18.0;
var wellD = 16.0;
var wellH = Y.wellTop - Y.wellBot;
var wellMesh = gaussianDopingMesh(wellW, wellH, wellD, '--c-well', {
  peakV: 0.35,      // Retrograde implant peak sits ~35% down into the well
  sigmaV: 0.28,     // Broad Gaussian with high thermal straggle
  straggle: 0.08,   // Controlled lateral straggle ensuring active is fully enclosed at all depths
  cornerR: 0.50,    // Smooth rounded corner radius
  opacity: 0.85,
  outlineColor: '#5fd9c4',
  depthWrite: false,
  renderOrder: 2
});
wellMesh.position.set(0, (Y.wellTop + Y.wellBot) / 2, 0);
reg(wellMesh, 'nwell', 'well');

// 3. PMOS ACTIVE DIFFUSION (P+) - Wp ≈ 2x Wn rule (Wp = 9.2 units along Z)
var actW = 4.2;  // Lateral width along X
var actD = 9.2;  // Gate width dimension along Z (Wp ≈ 2x Wn)
var actH = Y.actTop - Y.actBot;

var srcX = -4.2;
var drnX = 4.2;

var srcMesh = gaussianDopingMesh(actW, actH, actD, '--c-active-p', {
  peakV: 0.15,      // Peak close to surface (~20 nm projected range)
  sigmaV: 0.22,     // Tight sigma for abrupt shallow junction
  straggle: 0.16,   // Lateral straggle under gate edge
  cornerR: 0.5,
  outlineColor: '#f0b877',
  opacity: 0.88,
  depthWrite: false,
  renderOrder: 3
});
srcMesh.position.set(srcX, (Y.actTop + Y.actBot) / 2, 0);
reg(srcMesh, 'pmosSrc', 'active');

var drnMesh = gaussianDopingMesh(actW, actH, actD, '--c-active-p', {
  peakV: 0.15,
  sigmaV: 0.22,
  straggle: 0.16,
  cornerR: 0.5,
  outlineColor: '#f0b877',
  opacity: 0.88,
  depthWrite: false,
  renderOrder: 3
});
drnMesh.position.set(drnX, (Y.actTop + Y.actBot) / 2, 0);
reg(drnMesh, 'pmosDrn', 'active');

// 4. SOURCE / DRAIN EXTENSIONS (P-SDE / LDD)
var sdeW = 1.1;
var sdeH = Y.sdeTop - Y.sdeBot;
var sdeSrcX = -1.55;
var sdeDrnX = 1.55;

var sdeSrcMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-p', {
  peakV: 0.10,
  sigmaV: 0.28,
  straggle: 0.12,
  cornerR: 0.25,
  opacity: 0.72,
  outlineColor: '#fcd34d',
  depthWrite: false,
  renderOrder: 4
});
sdeSrcMesh.position.set(sdeSrcX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeSrcMesh, 'sdeSrc', 'sde');

var sdeDrnMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-p', {
  peakV: 0.10,
  sigmaV: 0.28,
  straggle: 0.12,
  cornerR: 0.25,
  opacity: 0.72,
  outlineColor: '#fcd34d',
  depthWrite: false,
  renderOrder: 4
});
sdeDrnMesh.position.set(sdeDrnX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeDrnMesh, 'sdeDrn', 'sde');

// ---------------------------------------------------------------------------
// 5. PERMANENTLY IMPLANTED 3D P-CHANNEL SLAB, DYNAMIC CHANNEL & DEPLETION
// ---------------------------------------------------------------------------
// 5a. Permanent physical implanted channel slab (static) bridging inner faces
// of Source LDD and Drain LDD with 1.5% overlap per side and 70% LDD depth.
var isInitLightDPMOS = (typeof currentTheme !== 'undefined' ? currentTheme : document.documentElement.getAttribute('data-theme')) === 'light';
var palInitDPMOS = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isInitLightDPMOS ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isInitLightDPMOS ? 'light' : 'dark') : null);

var gateL = 2.0;    // Gate length along X (inner LDD-to-LDD span: -1.0 to +1.0)
var slabOverlap = 0.03; // 1.5% of gateL per side into Source/Drain LDDs
var slabW = gateL + slabOverlap * 2;
var slabH = sdeH * 0.70; // 70% of LDD junction depth -> stepped S/D -> LDD -> Channel profile
var slabTop = Y.oxBot - 0.001; // Flush beneath SiO2 with micro-offset
var slabBot = slabTop - slabH;
var slabCenterY = (slabTop + slabBot) / 2;

var implantedSlabColor = palInitDPMOS ? palInitDPMOS.holeChannel : (isInitLightDPMOS ? 0x60A5FA : 0x38BDF8);
var implantedSlabGeo = new THREE.BoxGeometry(slabW, slabH, actD);
var implantedSlabMat = new THREE.MeshStandardMaterial({
  color: implantedSlabColor,
  emissive: implantedSlabColor,
  emissiveIntensity: isInitLightDPMOS ? 0.04 : 0.12,
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  roughness: 0.45,
  metalness: 0.10,
  side: THREE.DoubleSide
});
var implantedSlabMesh = new THREE.Mesh(implantedSlabGeo, implantedSlabMat);
implantedSlabMesh.position.set(0, slabCenterY, 0);
implantedSlabMesh.renderOrder = 4;
implantedSlabMesh.userData.isChannelShell = true;
implantedSlabMesh.userData.baseEmissive = implantedSlabMat.emissive.getHex();
implantedSlabMesh.userData.baseEmissiveIntensity = implantedSlabMat.emissiveIntensity;
var implantedSlabEdgeGeo = new THREE.EdgesGeometry(implantedSlabGeo, 24);
var implantedSlabEdgeMat = new THREE.LineBasicMaterial({
  color: implantedSlabColor,
  transparent: true,
  opacity: 0.32,
  depthWrite: false
});
var implantedSlabEdgeLine = new THREE.LineSegments(implantedSlabEdgeGeo, implantedSlabEdgeMat);
implantedSlabEdgeLine.raycast = function() {};
implantedSlabMesh.add(implantedSlabEdgeLine);
reg(implantedSlabMesh, 'channel', 'dchannel');

// 5b. Inset dynamic conducting channel & charcoal depletion region inside the slab
var chanEps = 0.012;
var innerH = slabH - chanEps * 2;
var innerD = actD - chanEps * 2;
var innerCenterY = slabCenterY;

var chanGeom = new THREE.BoxGeometry(2.0, innerH, innerD, 32, 1, 2);
var chanMat = new THREE.MeshStandardMaterial({
  color: palInitDPMOS ? palInitDPMOS.holeChannel : (isInitLightDPMOS ? 0x60A5FA : 0x38BDF8),
  emissive: palInitDPMOS ? palInitDPMOS.holeChannel : (isInitLightDPMOS ? 0x60A5FA : 0x38BDF8),
  emissiveIntensity: isInitLightDPMOS ? 0.15 : 0.40,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  roughness: 0.50,
  metalness: 0.15,
  side: THREE.DoubleSide
});
var channelMesh = new THREE.Mesh(chanGeom, chanMat);
channelMesh.position.set(0, innerCenterY, 0);
channelMesh.renderOrder = 3;
channelMesh.userData.baseEmissive = chanMat.emissive.getHex();
channelMesh.userData.baseEmissiveIntensity = chanMat.emissiveIntensity;
reg(channelMesh, 'channel', 'dchannel');

// Existing charcoal depletion-region material reused across pinch-off, depletion-mode, and cutoff
// Base width of pinchGeom is 1.0 along X so scale.x corresponds directly to physical deltaL (or 2.0 in cutoff)
var pinchGeom = new THREE.BoxGeometry(1.0, innerH, innerD, 12, 1, 2);
var pinchMat = new THREE.MeshStandardMaterial({
  color: palInitDPMOS ? palInitDPMOS.depletion : 0x64748b,
  emissive: 0x1e293b,
  emissiveIntensity: 0.15,
  transparent: true,
  opacity: palInitDPMOS ? palInitDPMOS.depletionOpacity : 0.26,
  depthWrite: false,
  roughness: 0.50,
  metalness: 0.10,
  side: THREE.DoubleSide
});
var pinchMesh = new THREE.Mesh(pinchGeom, pinchMat);
pinchMesh.position.set(0.6, innerCenterY, 0);
pinchMesh.renderOrder = 3;
pinchMesh.visible = false;
pinchMesh.userData.baseEmissive = pinchMat.emissive.getHex();
pinchMesh.userData.baseEmissiveIntensity = pinchMat.emissiveIntensity;
reg(pinchMesh, 'depletion', 'dchannel');

// Subtle edge highlight for the full-height depletion region
var pinchEdgeGeo = new THREE.EdgesGeometry(pinchGeom);
var pinchEdgeMat = new THREE.LineBasicMaterial({
  color: palInitDPMOS ? palInitDPMOS.depletion : 0x64748b,
  transparent: true,
  opacity: 0.40
});
var pinchEdgeLine = new THREE.LineSegments(pinchEdgeGeo, pinchEdgeMat);
pinchEdgeLine.raycast = function() {};
pinchMesh.add(pinchEdgeLine);

// Complementary charcoal depletion wedges filling the depleted zones above/below the thinned/tapered channel
var deplUpperGeom = new THREE.BoxGeometry(2.0, 1.0, innerD, 32, 1, 2);
var deplUpperMesh = new THREE.Mesh(deplUpperGeom, pinchMat);
deplUpperMesh.position.set(0, innerCenterY, 0);
deplUpperMesh.renderOrder = 3;
deplUpperMesh.visible = false;
deplUpperMesh.userData.baseEmissive = pinchMat.emissive.getHex();
deplUpperMesh.userData.baseEmissiveIntensity = pinchMat.emissiveIntensity;
reg(deplUpperMesh, 'depletion', 'dchannel');

var deplLowerGeom = new THREE.BoxGeometry(2.0, 1.0, innerD, 32, 1, 2);
var deplLowerMesh = new THREE.Mesh(deplLowerGeom, pinchMat);
deplLowerMesh.position.set(0, innerCenterY, 0);
deplLowerMesh.renderOrder = 3;
deplLowerMesh.visible = false;
deplLowerMesh.userData.baseEmissive = pinchMat.emissive.getHex();
deplLowerMesh.userData.baseEmissiveIntensity = pinchMat.emissiveIntensity;
reg(deplLowerMesh, 'depletion', 'dchannel');

function getCachedBoxAxes(geom) {
  var pos = geom.attributes.position;
  if (!geom.userData.initialX || !geom.userData.initialSignY) {
    var initX = new Float32Array(pos.count);
    var initSignY = new Int8Array(pos.count);
    for (var k = 0; k < pos.count; k++) {
      initX[k] = pos.getX(k);
      initSignY[k] = pos.getY(k) >= 0 ? 1 : -1;
    }
    geom.userData.initialX = initX;
    geom.userData.initialSignY = initSignY;
  }
  return { pos: pos, initX: geom.userData.initialX, initSignY: geom.userData.initialSignY };
}

function syncChannelBaseEmissive() {
  var chanHex = chanMat.emissive ? chanMat.emissive.getHex() : 0;
  channelMesh.userData.baseEmissive = chanHex;
  channelMesh.userData.baseEmissiveIntensity = chanMat.emissiveIntensity;
  var deplHex = pinchMat.emissive ? pinchMat.emissive.getHex() : 0;
  [pinchMesh, deplUpperMesh, deplLowerMesh].forEach(function(m) {
    m.userData.baseEmissive = deplHex;
    m.userData.baseEmissiveIntensity = pinchMat.emissiveIntensity;
  });
}

// Function to dynamically deform channel thickness, taper, and charcoal depletion based on D-PMOS physics
window.updateChannelGeometry = function(vgs, vsd, isd, region, deltaL) {
  var vth = 0.80; // VTH,p = +0.80V
  var vov = Math.max(0, vth - vgs); // Overdrive VOV = VTH,p - VGS

  if (region === 'CUTOFF' || vov <= 0.001) {
    channelMesh.visible = false;
    deplUpperMesh.visible = false;
    deplLowerMesh.visible = false;
    pinchMesh.visible = true;
    pinchMesh.scale.x = 2.0;
    pinchMesh.position.x = 0.0;
    pinchMesh.position.y = innerCenterY;
    pinchMat.emissiveIntensity = 0.18;
    syncChannelBaseEmissive();
    return;
  }

  channelMesh.visible = true;

  // Baseline implanted P-channel thickness is 0.19 at VGS = 0V (fits inside innerH = 0.326 even at max -VGS)
  // In Depletion Mode (0 < VGS < VTH,p), positive gate depletes holes, thinning the channel
  // In Enhancement Mode (VGS < 0), negative gate accumulates extra holes, thickening the channel
  var baseH = 0.19;
  var gateFactor = (vgs >= 0) ? Math.max(0.08, vov / 0.80) : (1.0 + Math.min(0.85, (-vgs / 1.0) * 0.60));
  var maxH = Math.min(innerH, baseH * gateFactor);

  var vsdDiff = Math.max(0, vsd - vov);
  var isSat = (vsd >= vov) && (region === 'SATURATION');

  // Exact continuous physics model:
  // In Linear: deltaL = 0. Channel tapers smoothly toward drain edge: thickness(s) = maxH * (1 - s * (vsd/vov)).
  // In Saturation: deltaL grows monotonically from 0 as k * sqrt(vsd - vov), clamped to 0.40 * L.
  // Channel shrinks to Leff = L - deltaL, ending at pinchX = 1.0 - deltaL where thickness = 0.
  // Depletion gap mesh is anchored strictly to the drain edge (x = 1.0) and expands strictly toward source.
  var dL = isSat ? 2.0 * Math.min(0.40, 0.22 * Math.sqrt(vsdDiff)) : 0.0;
  var ratio = (vov > 0.0001) ? Math.min(1.0, Math.max(0, vsd / vov)) : 1.0;

  var chanData = getCachedBoxAxes(chanGeom);
  for (var i = 0; i < chanData.pos.count; i++) {
    var origX = chanData.initX[i];
    var s = (origX + 1.0) / 2.0; // Normalized position [0, 1] from Source (-1.0) to Drain (+1.0)
    var mappedX, thickness;

    if (!isSat) {
      mappedX = origX;
      thickness = maxH * Math.max(0.002, 1.0 - s * ratio);
    } else {
      mappedX = -1.0 + s * (2.0 - dL);
      thickness = maxH * Math.max(0.002, 1.0 - s);
    }

    chanData.pos.setX(i, mappedX);
    chanData.pos.setY(i, (chanData.initSignY[i] * thickness) / 2);
  }
  chanData.pos.needsUpdate = true;
  chanGeom.computeVertexNormals();

  // Complementary charcoal depletion wedges above/below thinned or tapered channel
  var gateDepl = (vgs > 0) ? Math.min(1.0, Math.max(0, (baseH - maxH) / baseH)) : 0.0;
  var hasWedgeDepl = (gateDepl > 0.001) || (isSat ? true : ratio > 0.001);
  if (hasWedgeDepl) {
    deplUpperMesh.visible = true;
    deplLowerMesh.visible = true;
    var endX = isSat ? Math.max(-1.0, 1.0 - dL - 0.001) : 1.0;
    var upperData = getCachedBoxAxes(deplUpperGeom);
    var lowerData = getCachedBoxAxes(deplLowerGeom);

    for (var j = 0; j < upperData.pos.count; j++) {
      var uOrigX = upperData.initX[j];
      var us = (uOrigX + 1.0) / 2.0;
      var uMappedX = -1.0 + us * (endX - (-1.0));
      var taperFrac = isSat ? us : (us * ratio);
      var cThick = maxH * Math.max(0.002, 1.0 - taperFrac);
      var deplWeight = 1.0 - (1.0 - gateDepl) * (1.0 - taperFrac);
      var availH = Math.max(0, innerH - cThick);
      var halfChan = cThick / 2;
      var halfDepl = (availH * deplWeight) / 2;
      var yBot = halfChan + (halfDepl > 0.002 ? 0.001 : 0);
      var yTop = Math.min(innerH / 2, halfChan + halfDepl);
      if (yTop < yBot) yTop = yBot;

      upperData.pos.setX(j, uMappedX);
      upperData.pos.setY(j, upperData.initSignY[j] > 0 ? yTop : yBot);

      lowerData.pos.setX(j, uMappedX);
      lowerData.pos.setY(j, lowerData.initSignY[j] > 0 ? -yBot : -yTop);
    }
    upperData.pos.needsUpdate = true;
    deplUpperGeom.computeVertexNormals();
    lowerData.pos.needsUpdate = true;
    deplLowerGeom.computeVertexNormals();
  } else {
    deplUpperMesh.visible = false;
    deplLowerMesh.visible = false;
  }

  var intensityNorm = Math.min(1.0, isd / 0.5);
  chanMat.emissiveIntensity = 0.20 + 0.65 * intensityNorm;

  // Full-height space-charge depletion gap mesh in Saturation when dL > 0, anchored strictly to drain edge (+1.0)
  if (isSat && dL > 0.0005) {
    pinchMesh.visible = true;
    pinchMesh.scale.x = dL;
    pinchMesh.position.x = 1.0 - dL / 2;
    pinchMesh.position.y = innerCenterY;
    pinchMat.emissiveIntensity = 0.30 + 0.40 * Math.min(1.0, vsdDiff / 0.8);
  } else {
    pinchMesh.visible = false;
    pinchMat.emissiveIntensity = 0.15 + 0.15 * gateDepl;
  }
  syncChannelBaseEmissive();
};

// 6. N-WELL TAP (N+ OHMIC CONTACT TO VDD)
var tapW = 2.4, tapD = 2.4;
var tapMesh = gaussianDopingMesh(tapW, actH, tapD, '--c-well', {
  peakV: 0.18,
  sigmaV: 0.24,
  straggle: 0.20,
  cornerR: 0.3,
  outlineColor: '#8fe6c8',
  opacity: 0.85,
  depthWrite: false,
  renderOrder: 3
});
tapMesh.position.set(-6.5, (Y.actTop + Y.actBot) / 2, 6.2);
reg(tapMesh, 'welltap', 'active');

// ---------------------------------------------------------------------------
// 7. GATE DIELECTRIC STACK (SiO2 + High-k HfO2) - PRESERVE BLUE SiO2
// ---------------------------------------------------------------------------
var gateW = 9.8;

// Interfacial Gate Oxide (SiO2) - Frosted white/silver glass finish
var oxMesh = box(gateL, Y.oxTop - Y.oxBot, gateW, '--c-oxide', {
  transparent: true,
  opacity: 0.75,
  roughness: 0.25,
  metalness: 0.05,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1.0,
  polygonOffsetUnits: -1.0,
  outlineColor: '#cbd5e1',
  outlineOpacity: 0.35
});
oxMesh.position.set(0, (Y.oxTop + Y.oxBot) / 2, 0);
reg(oxMesh, 'oxide', 'oxide');

// High-k Dielectric (HfO2) - Refined dielectric finish matching CMOS Inverter
var hkMesh = box(gateL, Y.hkTop - Y.hkBot, gateW, '--c-highk', {
  transparent: true,
  opacity: 0.78,
  roughness: 0.28,  // soft dielectric satin highlight, avoids neon/glossy glare
  metalness: 0.06,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1.0,
  polygonOffsetUnits: -1.0,
  outlineColor: '#c084fc',
  outlineOpacity: 0.30
});
hkMesh.position.set(0, (Y.hkTop + Y.hkBot) / 2, 0);
reg(hkMesh, 'highk', 'highk');

// ---------------------------------------------------------------------------
// 8. POLYSILICON / METAL GATE RUNNER (Coral-red satin, non-burnt HKMG material)
// ---------------------------------------------------------------------------
var polyRunnerLength = 13.4;
var polyMesh = box(gateL, Y.polyTop - Y.polyBot, polyRunnerLength, '--c-poly', {
  roughness: 0.45,
  metalness: 0.20,
  bevel: 0.02,
  cornerRadius: 0.08,
  outlineColor: '#f87171',
  outlineOpacity: 0.40
});
polyMesh.position.set(0, (Y.polyTop + Y.polyBot) / 2, 1.2);
reg(polyMesh, 'poly', 'poly');

// Sleek, refined crystalline Si3N4 sidewall spacers (soft translucent dielectric)
var spacerW = 0.20;
var spacerMat = new THREE.MeshStandardMaterial({
  color: 0x7dd3fc,   // cohesive Si3N4 dielectric tone
  roughness: 0.45,   // soft satin finish, not harsh glass
  metalness: 0.04,
  transparent: true,
  opacity: 0.62,     // refined translucency
  depthWrite: false,
  side: THREE.DoubleSide
});
var spacerGeo = new THREE.BoxGeometry(spacerW, Y.polyTop - Y.oxBot, actD);
var spacerEdges = new THREE.EdgesGeometry(spacerGeo, 24);
var spacerEdgeMat = new THREE.LineBasicMaterial({
  color: 0xbae6fd,
  transparent: true,
  opacity: 0.35,
  depthWrite: false
});

var spacerGroup = new THREE.Group();
var leftSpacer = new THREE.Mesh(spacerGeo, spacerMat);
leftSpacer.position.set(-gateL / 2 - spacerW / 2, (Y.polyTop + Y.oxBot) / 2, 0);
leftSpacer.userData.id = 'spacer';
leftSpacer.userData.layer = 'spacer';
var leftLine = new THREE.LineSegments(spacerEdges, spacerEdgeMat);
leftLine.raycast = function() {};
leftSpacer.add(leftLine);
spacerGroup.add(leftSpacer);

var rightSpacer = new THREE.Mesh(spacerGeo, spacerMat);
rightSpacer.position.set(gateL / 2 + spacerW / 2, (Y.polyTop + Y.oxBot) / 2, 0);
rightSpacer.userData.id = 'spacer';
rightSpacer.userData.layer = 'spacer';
var rightLine = new THREE.LineSegments(spacerEdges, spacerEdgeMat);
rightLine.raycast = function() {};
rightSpacer.add(rightLine);
spacerGroup.add(rightSpacer);

reg(spacerGroup, 'spacer', 'spacer');

// ---------------------------------------------------------------------------
// 9. TUNGSTEN CONTACT VIA PLUGS (Pure CVD Tungsten)
// ---------------------------------------------------------------------------
var ctRadius = 0.30;
var ctRadiusBot = 0.24;
var ctH = Y.ctTop - Y.ctBot;

// Source Contact
var srcCt = cylinder(ctRadius, ctRadiusBot, ctH, 20, 0x4a4d54, { roughness: 0.25, metalness: 0.95 });
srcCt.position.set(srcX, (Y.ctTop + Y.ctBot) / 2, 0);
reg(srcCt, 'pmosSrcCt', 'contact');

// Drain Contact
var drnCt = cylinder(ctRadius, ctRadiusBot, ctH, 20, 0x4a4d54, { roughness: 0.25, metalness: 0.95 });
drnCt.position.set(drnX, (Y.ctTop + Y.ctBot) / 2, 0);
reg(drnCt, 'pmosDrnCt', 'contact');

// Gate Contact
var gateCtH = Y.ctTop - Y.polyTop;
var gateCt = cylinder(ctRadius, ctRadiusBot, gateCtH, 20, 0x4a4d54, { roughness: 0.25, metalness: 0.95 });
gateCt.position.set(0, (Y.ctTop + Y.polyTop) / 2, 6.2);
reg(gateCt, 'polyCt', 'contact');

// N-Well Tap Contact
var wellCt = cylinder(ctRadius, ctRadiusBot, ctH, 20, 0x4a4d54, { roughness: 0.25, metalness: 0.95 });
wellCt.position.set(-6.5, (Y.ctTop + Y.ctBot) / 2, 6.2);
reg(wellCt, 'welltapCt', 'contact');

// ---------------------------------------------------------------------------
// 10. METAL-1 INTERCONNECT RAILS (Sleek thin flat ribbons, matching CMOS Inverter baseline)
// ---------------------------------------------------------------------------
var m1H = Y.m1Top - Y.m1Bot;
var m1Y = (Y.m1Top + Y.m1Bot) / 2;

// Source Rail (S / VDD) - Sleek thin flat ribbon capping the PMOS source via
var srcPad = box(1.2, m1H, 2.4, '--c-active-p', {
  roughness: 0.22,
  metalness: 0.88,
  bevel: 0.02,
  cornerRadius: 0.15,
  outlineColor: '#fca5a5',
  outlineOpacity: 0.45,
  roughnessMap: getBrushedMetalTexture()
});
srcPad.position.set(srcX, m1Y, 0);
reg(srcPad, 'srcRail', 'metal');

// Drain Rail (D / OUT) - Sleek thin flat ribbon capping the PMOS drain via
var drnPad = box(1.2, m1H, 2.4, '--c-out', {
  roughness: 0.22,
  metalness: 0.88,
  bevel: 0.02,
  cornerRadius: 0.15,
  outlineColor: '#fde047',
  outlineOpacity: 0.45,
  roughnessMap: getBrushedMetalTexture()
});
drnPad.position.set(drnX, m1Y, 0);
reg(drnPad, 'drnRail', 'metal');

// Gate Rail (G / VG) - Sleek thin flat ribbon capping the gate contact via
var gatePad = box(1.2, m1H, 2.0, '--c-in', {
  roughness: 0.22,
  metalness: 0.88,
  bevel: 0.02,
  cornerRadius: 0.15,
  outlineColor: '#fde047',
  outlineOpacity: 0.45,
  roughnessMap: getBrushedMetalTexture()
});
gatePad.position.set(0, m1Y, 6.2);
reg(gatePad, 'gateRail', 'metal');

// N-Well Tap Rail (B / VDD) - Sleek thin flat ribbon capping the well tap via
var wellPad = box(1.2, m1H, 1.8, '--c-vdd', {
  roughness: 0.22,
  metalness: 0.88,
  bevel: 0.02,
  cornerRadius: 0.15,
  outlineColor: '#fca5a5',
  outlineOpacity: 0.45,
  roughnessMap: getBrushedMetalTexture()
});
wellPad.position.set(-6.5, m1Y, 6.2);
reg(wellPad, 'wellRail', 'metal');

// ---------------------------------------------------------------------------
// 3D TERMINAL CALLOUTS (WITH LEADER LINES & ANCHOR DOTS)
// ---------------------------------------------------------------------------
var labelSprites = [];
var labelCalloutGroups = [];

function makeTextSprite(text, colorHex, opts) {
  opts = opts || {};
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var isWhite = (colorHex === '#ffffff' || colorHex === '#fff');
  var textColor = isWhite ? (isLight ? '#0f172a' : '#f8fafc') : colorHex;
  var strokeColor = isWhite ? (isLight ? '#94a3b8' : '#475569') : colorHex;
  var bgColor = opts.bg || (isLight ? 'rgba(255, 255, 255, 0.97)' : 'rgba(10, 14, 22, 0.96)');

  var c = document.createElement('canvas');
  c.width = 384;
  c.height = 128;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 4;
  var r = 16;
  ctx.beginPath();
  ctx.moveTo(r, 6);
  ctx.lineTo(c.width - r, 6);
  ctx.quadraticCurveTo(c.width - 6, 6, c.width - 6, r);
  ctx.lineTo(c.width - 6, c.height - r);
  ctx.quadraticCurveTo(c.width - 6, c.height - 6, c.width - r, c.height - 6);
  ctx.lineTo(r, c.height - 6);
  ctx.quadraticCurveTo(6, c.height - 6, 6, c.height - r);
  ctx.lineTo(6, r);
  ctx.quadraticCurveTo(6, 6, r, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);

  var tex = new THREE.CanvasTexture(c);
  var mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: true,
    depthWrite: false,
    transparent: true
  });
  var sprite = new THREE.Sprite(mat);
  sprite.scale.set(3.2, 1.1, 1.0);
  sprite.renderOrder = 999;
  sprite.userData.labelText = text;
  sprite.userData.colorHex = colorHex;
  return sprite;
}

function updateLabelSprite(sprite, text, colorHex, isLight) {
  var isWhite = (colorHex === '#ffffff' || colorHex === '#fff');
  var textColor = isWhite ? (isLight ? '#0f172a' : '#f8fafc') : colorHex;
  var strokeColor = isWhite ? (isLight ? '#94a3b8' : '#475569') : colorHex;
  var bgColor = isLight ? 'rgba(255, 255, 255, 0.97)' : 'rgba(10, 14, 22, 0.96)';

  var c = document.createElement('canvas');
  c.width = 384;
  c.height = 128;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 4;
  var r = 16;
  ctx.beginPath();
  ctx.moveTo(r, 6);
  ctx.lineTo(c.width - r, 6);
  ctx.quadraticCurveTo(c.width - 6, 6, c.width - 6, r);
  ctx.lineTo(c.width - 6, c.height - r);
  ctx.quadraticCurveTo(c.width - 6, c.height - 6, c.width - r, c.height - 6);
  ctx.lineTo(r, c.height - 6);
  ctx.quadraticCurveTo(6, c.height - 6, 6, c.height - r);
  ctx.lineTo(6, r);
  ctx.quadraticCurveTo(6, 6, r, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);

  if (sprite.material && sprite.material.map) {
    sprite.material.map.dispose();
  }
  var tex = new THREE.CanvasTexture(c);
  sprite.material.map = tex;
  sprite.material.needsUpdate = true;
}

function updateMaterialsTheme() {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);

  selectable.forEach(function(m) {
    if (m && m.userData && m.userData.colorVar && m.material && m.material.color) {
      var hex = cssVar(m.userData.colorVar);
      if (m.userData.colorVar === '--c-substrate' && pal && pal.pSubstrate) {
        hex = pal.pSubstrate;
      } else if (m.userData.colorVar === '--c-active-p' && pal && pal.pPlusDiffusion) {
        hex = pal.pPlusDiffusion;
      } else if (m.userData.colorVar === '--c-sde-p' && pal && pal.pSDE) {
        hex = pal.pSDE;
      } else if (m.userData.colorVar === '--c-active-n' && pal && pal.nPlusDiffusion) {
        hex = pal.nPlusDiffusion;
      } else if (m.userData.colorVar === '--c-sde-n' && pal && pal.nSDE) {
        hex = pal.nSDE;
      }
      if (hex) {
        m.material.color.set(hex);
        if (m.userData.colorVar === '--c-substrate') {
          m.material.roughness = 0.85;
          if (m.material.emissive) m.material.emissive.set(0x000000);
          m.material.emissiveIntensity = 0;
        }
        if (m.userData.isGaussianDoping && m.userData.peakV !== undefined) {
          m.material.map = gaussianDepthTexture(m.userData.colorVar, m.userData.peakV, m.userData.sigmaV, m.userData.opts);
          m.material.needsUpdate = true;
        }
        if (m.children) {
          m.children.forEach(function(child) {
            if (child.isMesh && child.material && child.material.color) {
              child.material.color.set(hex);
              if (m.userData.colorVar === '--c-substrate') {
                child.material.roughness = 0.85;
                if (child.material.emissive) child.material.emissive.set(0x000000);
                child.material.emissiveIntensity = 0;
              }
            } else if (child.isLineLoop && child.material && child.material.color) {
              child.material.color.set(hex);
            }
          });
        }
      }
    } else if (m && m.isGroup) {
      m.traverse(function(child) {
        if (child.isMesh && child.userData && child.userData.colorVar && child.material && child.material.color) {
          var hex = cssVar(child.userData.colorVar);
          if (child.userData.colorVar === '--c-substrate' && pal && pal.pSubstrate) {
            hex = pal.pSubstrate;
          } else if (child.userData.colorVar === '--c-active-p' && pal && pal.pPlusDiffusion) {
            hex = pal.pPlusDiffusion;
          } else if (child.userData.colorVar === '--c-sde-p' && pal && pal.pSDE) {
            hex = pal.pSDE;
          } else if (child.userData.colorVar === '--c-active-n' && pal && pal.nPlusDiffusion) {
            hex = pal.nPlusDiffusion;
          } else if (child.userData.colorVar === '--c-sde-n' && pal && pal.nSDE) {
            hex = pal.nSDE;
          }
          if (hex) {
            child.material.color.set(hex);
            if (child.userData.colorVar === '--c-substrate') {
              child.material.roughness = 0.85;
              if (child.material.emissive) child.material.emissive.set(0x000000);
              child.material.emissiveIntensity = 0;
            }
          }
        } else if (child.isLineLoop && child.material && child.material.color && child.parent && child.parent.userData && child.parent.userData.colorVar) {
          var parentHex = cssVar(child.parent.userData.colorVar);
          if (parentHex) child.material.color.set(parentHex);
        }
      });
    }
  });

  if (typeof subMesh !== 'undefined' && subMesh && subMesh.material) {
    if (pal && pal.pSubstrate) subMesh.material.color.set(pal.pSubstrate);
    subMesh.material.roughness = 0.85;
    subMesh.material.metalness = 0.05;
    if (subMesh.material.emissive) subMesh.material.emissive.set(0x000000);
    subMesh.material.emissiveIntensity = 0;
  }

  if (typeof wellMesh !== 'undefined' && wellMesh && wellMesh.material) {
    if (pal && pal.nWell) wellMesh.material.color.set(pal.nWell);
    wellMesh.material.roughness = isLight ? 0.75 : 0.60;
    if (wellMesh.material.emissive) wellMesh.material.emissive.set(0x000000);
    wellMesh.material.emissiveIntensity = 0;
  }

  if (typeof oxMesh !== 'undefined' && oxMesh && oxMesh.material) {
    if (pal) {
      oxMesh.material.color.set(pal.gateOxide);
      oxMesh.material.opacity = pal.gateOxideOpacity || (isLight ? 0.28 : 0.35);
    }
  }

  if (typeof pinchMat !== 'undefined' && pinchMat) {
    if (pal) {
      pinchMat.color.set(pal.depletion);
      pinchMat.opacity = pal.depletionOpacity || 0.26;
      if (typeof pinchEdgeMat !== 'undefined' && pinchEdgeMat) {
        pinchEdgeMat.color.set(pal.depletion);
      }
    }
  }

  if (typeof implantedSlabMat !== 'undefined' && implantedSlabMat) {
    if (pal) {
      implantedSlabMat.color.set(pal.holeChannel);
      if (implantedSlabMat.emissive) {
        implantedSlabMat.emissive.set(pal.holeChannel);
        implantedSlabMat.emissiveIntensity = isLight ? 0.04 : 0.12;
      }
      if (typeof implantedSlabEdgeMat !== 'undefined' && implantedSlabEdgeMat) {
        implantedSlabEdgeMat.color.set(pal.holeChannel);
      }
      if (typeof implantedSlabMesh !== 'undefined' && implantedSlabMesh) {
        implantedSlabMesh.userData.baseEmissive = implantedSlabMat.emissive.getHex();
        implantedSlabMesh.userData.baseEmissiveIntensity = implantedSlabMat.emissiveIntensity;
      }
    }
  }

  if (typeof chanMat !== 'undefined' && chanMat && chanMat.emissive) {
    if (pal) {
      chanMat.color.set(pal.holeChannel);
      chanMat.emissive.set(pal.holeChannel);
      chanMat.emissiveIntensity = isLight ? 0.15 : 0.40;
      if (typeof syncChannelBaseEmissive === 'function') syncChannelBaseEmissive();
    }
  }

  labelSprites.forEach(function(s) {
    if (s && s.userData && s.userData.labelText && s.userData.colorHex) {
      updateLabelSprite(s, s.userData.labelText, s.userData.colorHex, isLight);
    }
  });

  labelCalloutGroups.forEach(function(g) {
    if (g && g.userData && (g.userData.baseColorHex === '#ffffff' || g.userData.baseColorHex === '#fff')) {
      var c = isLight ? 0x64748b : 0xffffff;
      if (g.userData.line && g.userData.line.material) g.userData.line.material.color.set(c);
      if (g.userData.dot && g.userData.dot.material) g.userData.dot.material.color.set(c);
    }
  });

  if (typeof updateLayersListTheme === 'function') {
    updateLayersListTheme(pal);
  }

  if (typeof renderer !== 'undefined' && renderer && typeof scene !== 'undefined' && scene && typeof activeCamera !== 'undefined' && activeCamera) {
    renderer.render(scene, activeCamera);
  }
}
window.updateMaterialsTheme = updateMaterialsTheme;

function createTerminalCallout(text, colorHex, padX, padY, padZ, offset) {
  var group = new THREE.Group();
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var isWhite = (colorHex === '#ffffff' || colorHex === '#fff');
  var leaderColorHex = isWhite ? (isLight ? '#64748b' : '#ffffff') : colorHex;

  // Thin vertical leader line
  var lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(offset.x, offset.y, offset.z)
  ]);
  var lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(leaderColorHex),
    transparent: true,
    opacity: 0.60,
    linewidth: 1.5
  });
  var line = new THREE.Line(lineGeo, lineMat);
  group.add(line);

  // Anchor dot on the metal pad
  var dotGeo = new THREE.SphereGeometry(0.08, 8, 8);
  var dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(leaderColorHex) });
  var dot = new THREE.Mesh(dotGeo, dotMat);
  group.add(dot);

  // Text sprite badge
  var sprite = makeTextSprite(text, colorHex);
  sprite.position.set(offset.x, offset.y, offset.z);
  group.add(sprite);
  labelSprites.push(sprite);

  group.position.set(padX, padY, padZ);
  group.userData.isTerminalTag = true;
  group.userData.line = line;
  group.userData.dot = dot;
  group.userData.baseColorHex = colorHex;
  group.name = 'callout_' + text.replace(/[^a-zA-Z0-9]/g, '_');
  labelCalloutGroups.push(group);
  return group;
}

// Spatially distributed terminal callouts attached to groups['metal']
var srcCallout = createTerminalCallout('SOURCE (S / VDD)', '#ea580c', srcX, Y.m1Top, 0, { x: -1.2, y: 1.6, z: -2.0 });
groups['metal'].add(srcCallout);

var drnCallout = createTerminalCallout('DRAIN (D / OUT)', '#e6a23c', drnX, Y.m1Top, 0, { x: 1.2, y: 1.6, z: -2.0 });
groups['metal'].add(drnCallout);

var gateCallout = createTerminalCallout('GATE (G / VG)', '#e6c94a', 0, Y.m1Top, 6.2, { x: 0, y: 1.6, z: 2.2 });
groups['metal'].add(gateCallout);

var wellCallout = createTerminalCallout('N-WELL (B / VDD)', '#3f8f6f', -6.5, Y.m1Top, 6.2, { x: -1.4, y: 1.6, z: 1.4 });
groups['metal'].add(wellCallout);

// PMOS width & gate length callout attached to groups['poly']
var polyLengthCallout = createTerminalCallout('Wp ≈ 2Wn · L=28nm', '#ffffff', 0, Y.polyTop, 0, { x: 0, y: 1.2, z: -5.2 });
groups['poly'].add(polyLengthCallout);

function toggleLabels(visible) {
  labelSprites.forEach(function(s) {
    if (s) s.visible = visible;
  });
  labelCalloutGroups.forEach(function(g) {
    if (g) g.visible = visible;
  });
}
window.toggleLabels = toggleLabels;

var initLabelChk = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
if (initLabelChk) {
  toggleLabels(initLabelChk.checked);
}
