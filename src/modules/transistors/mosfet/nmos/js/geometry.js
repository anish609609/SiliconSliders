/**
 * geometry.js - NMOS CAD Viewer
 * 3D Physical model for a discrete N-channel MOSFET:
 * - P-substrate bulk wafer slab with TCAD-style doping finish
 * - Heavily doped N+ Source and Drain diffusions with Gaussian profiles & lateral straggle
 * - Shallow N-SDE / LDD extensions flanking gate channel
 * - Ultra-thin interfacial SiO2 (preserved in blue) + High-k HfO2 gate dielectric stack
 * - Crisp, clean polysilicon / metal gate electrode runner (non-burnt HKMG material)
 * - P+ Substrate / Body tap diffusion
 * - Tapered Tungsten CVD contact via plugs (matching CMOS inverter palette)
 * - Metal-1 interconnects for Source (S), Drain (D), Gate (G), and Body (B)
 * - Dynamic 3D continuous inversion channel and pinch-off space-charge gap
 * - 3D Floating terminal tags with leader lines attached to layer groups (zero collision)
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
    qz = sin >= 0 ? 1 : -1;
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
var LAYER_ORDER = ['substrate', 'active', 'sde', 'oxide', 'highk', 'poly', 'spacer', 'contact', 'metal'];
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
  actBot: 1.804,
  actTop: 3.004,
  sdeBot: 2.508,
  sdeTop: 3.008,
  oxBot: 3.008,
  oxTop: 3.188,
  hkBot: 3.188,
  hkTop: 3.428,
  polyBot: 3.428,
  polyTop: 4.458,
  ctBot: 3.008,
  ctTop: 5.158,
  m1Bot: 5.158,
  m1Top: 5.338
};

// 1. P-SUBSTRATE BASE SLAB (Matching CMOS Inverter Palette)
var subMesh = box(22, Y.subTop - Y.subBot, 20, '--c-substrate', { roughness: 0.85, metalness: 0.05 });
subMesh.renderOrder = 1;
subMesh.position.set(0, (Y.subTop + Y.subBot) / 2, 0);
reg(subMesh, 'psub', 'substrate');

// 2. ACTIVE REGIONS: SOURCE & DRAIN (N+ heavily doped diffusions)
var actW = 4.2;  // Lateral dimension along X
var actD = 7.0;  // Transistor width along Z
var actH = Y.actTop - Y.actBot;

var srcX = -4.2;
var drnX = 4.2;

var srcMesh = gaussianDopingMesh(actW, actH, actD, '--c-active-n', {
  peakV: 0.15,
  sigmaV: 0.22,
  straggle: 0.16,
  cornerR: 0.5,
  outlineColor: '#7fc3ec',
  opacity: 0.88,
  depthWrite: false,
  renderOrder: 3
});
srcMesh.position.set(srcX, (Y.actTop + Y.actBot) / 2, 0);
reg(srcMesh, 'nmosSrc', 'active');

var drnMesh = gaussianDopingMesh(actW, actH, actD, '--c-active-n', {
  peakV: 0.15,
  sigmaV: 0.22,
  straggle: 0.16,
  cornerR: 0.5,
  outlineColor: '#7fc3ec',
  opacity: 0.88,
  depthWrite: false,
  renderOrder: 3
});
drnMesh.position.set(drnX, (Y.actTop + Y.actBot) / 2, 0);
reg(drnMesh, 'nmosDrn', 'active');

// 3. SOURCE / DRAIN EXTENSIONS (N-SDE / LDD)
var sdeW = 1.1;
var sdeH = Y.sdeTop - Y.sdeBot;
var sdeSrcX = -1.55;
var sdeDrnX = 1.55;

var sdeSrcMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-n', {
  peakV: 0.10,
  sigmaV: 0.28,
  straggle: 0.12,
  cornerR: 0.25,
  opacity: 0.72,
  outlineColor: '#bae6fd',
  depthWrite: false,
  renderOrder: 4
});
sdeSrcMesh.position.set(sdeSrcX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeSrcMesh, 'sdeSrc', 'sde');

var sdeDrnMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-n', {
  peakV: 0.10,
  sigmaV: 0.28,
  straggle: 0.12,
  cornerR: 0.25,
  opacity: 0.72,
  outlineColor: '#bae6fd',
  depthWrite: false,
  renderOrder: 4
});
sdeDrnMesh.position.set(sdeDrnX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeDrnMesh, 'sdeDrn', 'sde');

// ---------------------------------------------------------------------------
// 4. CONTINUOUS 3D INVERSION CHANNEL & PINCH-OFF REGION
// ---------------------------------------------------------------------------
// A dynamic multi-segmented channel mesh whose length, taper, and pinch-off
// profile dynamically respond to continuous (VGS, VDS) operating regions.
var chanGeom = new THREE.BoxGeometry(2.0, 0.18, actD, 32, 1, 2);
var chanMat = new THREE.MeshStandardMaterial({
  color: 0x38bdf8,
  emissive: 0x0284c7,
  emissiveIntensity: 0.45,
  transparent: true,
  opacity: 0.80,
  depthWrite: false,
  roughness: 0.50,
  metalness: 0.15,
  side: THREE.DoubleSide
});
var channelMesh = new THREE.Mesh(chanGeom, chanMat);
channelMesh.position.set(0, 2.918, 0);
channelMesh.renderOrder = 3;
reg(channelMesh, 'channel', 'active');

// Dedicated pinch-off space-charge gap mesh visible during Saturation (VDS >= VGS - VTH)
var pinchGeom = new THREE.BoxGeometry(0.8, 0.16, actD, 12, 1, 2);
var pinchMat = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  emissive: 0xd97706,
  emissiveIntensity: 0.50,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  roughness: 0.50,
  metalness: 0.15,
  side: THREE.DoubleSide
});
var pinchMesh = new THREE.Mesh(pinchGeom, pinchMat);
pinchMesh.position.set(0.6, 2.928, 0);
pinchMesh.renderOrder = 3;
pinchMesh.visible = false;
groups['active'].add(pinchMesh);

// Function to dynamically deform channel thickness and taper based on MOSFET physics
window.updateChannelGeometry = function(vgs, vds, ids, region, deltaL) {
  var vth = 0.40;
  var vov = Math.max(0, vgs - vth);

  if (region === 'CUTOFF' || vov <= 0.001) {
    channelMesh.visible = false;
    pinchMesh.visible = false;
    return;
  }

  channelMesh.visible = true;

  // Base channel length along X is 2.0 (from -1.0 to +1.0)
  var pos = chanGeom.attributes.position;
  var maxH = 0.18;
  var pinchX = (region === 'SATURATION') ? Math.max(-0.2, 1.0 - (deltaL || 0.4)) : 1.0;

  for (var i = 0; i < pos.count; i++) {
    // Original normalized X coordinate [-1, 1]
    var origX = (pos.getX(i) >= 0 ? 1 : -1) * Math.min(1.0, Math.abs(pos.getX(i)));
    // Normalized distance from Source: u = 0 at Source (-1.0), u = 1 at Drain (+1.0)
    var u = (pos.getX(i) + 1.0) / 2.0;

    var thickness = 0;
    if (region === 'LINEAR') {
      // Linear region: continuous channel from Source to Drain
      // Tapers according to local inversion charge Qinv(u) ~ (VGS - VTH - u * VDS)
      var localV = u * vds;
      var localCharge = Math.max(0.08, (vov - localV) / Math.max(0.1, vov));
      thickness = maxH * (0.35 + 0.65 * localCharge);
    } else {
      // Saturation region: channel pinches off at pinchX
      if (pos.getX(i) <= pinchX) {
        var fracToPinch = (pos.getX(i) + 1.0) / (pinchX + 1.0);
        thickness = maxH * Math.pow(Math.max(0.04, 1.0 - fracToPinch * 0.95), 0.7);
      } else {
        // Pinched off: collapsed to microscopic thickness
        thickness = 0.01;
      }
    }

    // Adjust Y coordinate
    var origSignY = pos.getY(i) >= 0 ? 1 : -1;
    pos.setY(i, (origSignY * thickness) / 2);
  }

  pos.needsUpdate = true;
  chanGeom.computeVertexNormals();

  // Update dynamic channel material luminescence with IDS
  var intensityNorm = Math.min(1.0, ids / 0.5);
  chanMat.emissiveIntensity = 0.20 + 0.65 * intensityNorm;

  // Update pinch-off space-charge region in Saturation
  if (region === 'SATURATION') {
    pinchMesh.visible = true;
    var gapW = Math.max(0.15, 1.0 - pinchX);
    pinchMesh.scale.x = gapW / 0.8;
    pinchMesh.position.x = pinchX + gapW / 2;
    pinchMat.emissiveIntensity = 0.30 + 0.40 * Math.min(1.0, (vds - vov) / 0.8);
  } else {
    pinchMesh.visible = false;
  }
};

// 5. SUBSTRATE / BODY TAP (P+)
var tapW = 2.4, tapD = 2.4;
var tapMesh = gaussianDopingMesh(tapW, actH, tapD, '--c-substrate', {
  peakV: 0.18,
  sigmaV: 0.24,
  straggle: 0.20,
  cornerR: 0.3,
  outlineColor: '#aab4c2',
  opacity: 0.80,
  depthWrite: false,
  renderOrder: 3
});
tapMesh.position.set(-6.5, (Y.actTop + Y.actBot) / 2, 6.2);
reg(tapMesh, 'subtap', 'active');

// ---------------------------------------------------------------------------
// 6. GATE DIELECTRIC STACK (SiO2 + High-k HfO2) - PRESERVE BLUE SiO2
// ---------------------------------------------------------------------------
var gateL = 2.0;    // Gate length along X
var gateW = 7.6;    // Dielectric width along Z

// Interfacial Gate Oxide (SiO2) - Clean refined translucent blue finish matching CMOS Inverter
var oxMesh = box(gateL, Y.oxTop - Y.oxBot, gateW, '--c-oxide', {
  transparent: true,
  opacity: 0.82,
  roughness: 0.32,  // subtle specular response matching CMOS Inverter, eliminates white blowout/glare
  metalness: 0.02,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1.0,
  polygonOffsetUnits: -1.0,
  outlineColor: '#7dd3fc',
  outlineOpacity: 0.30
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
// 7. POLYSILICON / METAL GATE RUNNER (Coral-red satin, non-burnt HKMG material)
// ---------------------------------------------------------------------------
var polyRunnerLength = 11.2;
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
// 8. TAPERED TUNGSTEN CONTACT VIA PLUGS (Matching CMOS Inverter Palette)
// ---------------------------------------------------------------------------
var ctRadius = 0.24;
var ctRadiusBot = 0.19;
var ctH = Y.ctTop - Y.ctBot;

// Subtle tapered CVD Tungsten plugs (color 0x4a4d54, metalness 0.95, roughness 0.25)
var srcCt = cylinder(ctRadius, ctRadiusBot, ctH, 20, 0x4a4d54, { metalness: 0.95, roughness: 0.25 });
srcCt.position.set(srcX, (Y.ctTop + Y.ctBot) / 2, 0);
reg(srcCt, 'nmosSrcCt', 'contact');

var drnCt = cylinder(ctRadius, ctRadiusBot, ctH, 20, 0x4a4d54, { metalness: 0.95, roughness: 0.25 });
drnCt.position.set(drnX, (Y.ctTop + Y.ctBot) / 2, 0);
reg(drnCt, 'nmosDrnCt', 'contact');

var gateCtH = Y.ctTop - Y.polyTop;
var gateCt = cylinder(ctRadius, ctRadiusBot, gateCtH, 20, 0x4a4d54, { metalness: 0.95, roughness: 0.25 });
gateCt.position.set(0, (Y.ctTop + Y.polyTop) / 2, 5.2);
reg(gateCt, 'polyCt', 'contact');

var subCt = cylinder(ctRadius, ctRadiusBot, ctH, 20, 0x4a4d54, { metalness: 0.95, roughness: 0.25 });
subCt.position.set(-6.5, (Y.ctTop + Y.ctBot) / 2, 6.2);
reg(subCt, 'subtapCt', 'contact');

// ---------------------------------------------------------------------------
// 9. METAL-1 INTERCONNECT RAILS (Sleek thin flat ribbons, matching CMOS Inverter baseline)
// ---------------------------------------------------------------------------
var m1H = Y.m1Top - Y.m1Bot;
var m1Y = (Y.m1Top + Y.m1Bot) / 2;

// Source Rail (S / GND) - Sleek thin flat ribbon capping the Tungsten via
var srcPad = box(1.2, m1H, 2.4, '--c-active-n', {
  roughness: 0.22,
  metalness: 0.88,
  bevel: 0.02,
  cornerRadius: 0.15,
  outlineColor: '#7dd3fc',
  outlineOpacity: 0.45,
  roughnessMap: getBrushedMetalTexture()
});
srcPad.position.set(srcX, m1Y, 0);
reg(srcPad, 'srcRail', 'metal');

// Drain Rail (D / VDS) - Sleek thin flat ribbon capping the Tungsten via
var drnPad = box(1.2, m1H, 2.4, '--c-out', {
  roughness: 0.22,
  metalness: 0.88,
  bevel: 0.02,
  cornerRadius: 0.15,
  outlineColor: '#86efac',
  outlineOpacity: 0.45,
  roughnessMap: getBrushedMetalTexture()
});
drnPad.position.set(drnX, m1Y, 0);
reg(drnPad, 'drnRail', 'metal');

// Gate Rail (G / VGS) - Sleek thin flat ribbon capping the gate contact via
var gatePad = box(1.2, m1H, 2.0, '--c-in', {
  roughness: 0.22,
  metalness: 0.88,
  bevel: 0.02,
  cornerRadius: 0.15,
  outlineColor: '#fde047',
  outlineOpacity: 0.45,
  roughnessMap: getBrushedMetalTexture()
});
gatePad.position.set(0, m1Y, 5.2);
reg(gatePad, 'gateRail', 'metal');

// Body Tap Rail (B / GND) - Sleek thin flat ribbon capping the substrate tap via
var bodyPad = box(1.2, m1H, 1.8, '--c-gnd', {
  roughness: 0.22,
  metalness: 0.88,
  bevel: 0.02,
  cornerRadius: 0.15,
  outlineColor: '#cbd5e1',
  outlineOpacity: 0.45,
  roughnessMap: getBrushedMetalTexture()
});
bodyPad.position.set(-6.5, m1Y, 6.2);
reg(bodyPad, 'bodyRail', 'metal');

// ---------------------------------------------------------------------------
// 10. 3D FLOATING TERMINAL TAGS WITH LEADER LINES (Zero Overlap & Layer Sync)
// ---------------------------------------------------------------------------
var labelSprites = [];
var labelCalloutGroups = [];

function makeTextSprite(text, colorHex, opts) {
  opts = opts || {};
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var c = document.createElement('canvas');
  c.width = 384;
  c.height = 112;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  // High-contrast semi-transparent pill badge
  ctx.fillStyle = opts.bg || (isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(11, 16, 24, 0.92)');
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3.5;
  var r = 18;
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

  ctx.fillStyle = colorHex;
  ctx.font = 'bold 34px "IBM Plex Mono", monospace';
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
  sprite.scale.set(2.4, 0.72, 1.0);
  sprite.renderOrder = 999;
  sprite.userData.labelText = text;
  sprite.userData.colorHex = colorHex;
  return sprite;
}

function updateLabelSprite(sprite, text, colorHex, isLight) {
  var c = document.createElement('canvas');
  c.width = 384;
  c.height = 112;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(11, 16, 24, 0.92)';
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3.5;
  var r = 18;
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

  ctx.fillStyle = colorHex;
  ctx.font = 'bold 34px "IBM Plex Mono", monospace';
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
  selectable.forEach(function(m) {
    if (m && m.userData && m.userData.colorVar && m.material && m.material.color) {
      var hex = cssVar(m.userData.colorVar);
      if (hex) {
        m.material.color.set(hex);
        if (m.children) {
          m.children.forEach(function(child) {
            if (child.isMesh && child.material && child.material.color) {
              child.material.color.set(hex);
            }
          });
        }
      }
    } else if (m && m.isGroup) {
      m.traverse(function(child) {
        if (child.isMesh && child.userData && child.userData.colorVar && child.material && child.material.color) {
          var hex = cssVar(child.userData.colorVar);
          if (hex) child.material.color.set(hex);
        }
      });
    }
  });
  labelSprites.forEach(function(s) {
    if (s && s.userData && s.userData.labelText && s.userData.colorHex) {
      updateLabelSprite(s, s.userData.labelText, s.userData.colorHex, isLight);
    }
  });
}
window.updateMaterialsTheme = updateMaterialsTheme;

// Builds a callout group containing a vertical leader stem and an elevated pill badge
function createTerminalCallout(text, colorHex, padX, padY, padZ, offset) {
  var group = new THREE.Group();

  // Thin vertical leader line
  var lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(offset.x, offset.y, offset.z)
  ]);
  var lineMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(colorHex),
    transparent: true,
    opacity: 0.60,
    linewidth: 1.5
  });
  var line = new THREE.Line(lineGeo, lineMat);
  group.add(line);

  // Anchor dot on the metal pad
  var dotGeo = new THREE.SphereGeometry(0.08, 8, 8);
  var dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex) });
  var dot = new THREE.Mesh(dotGeo, dotMat);
  group.add(dot);

  // Text sprite badge
  var sprite = makeTextSprite(text, colorHex);
  sprite.position.set(offset.x, offset.y, offset.z);
  group.add(sprite);
  labelSprites.push(sprite);

  group.position.set(padX, padY, padZ);
  labelCalloutGroups.push(group);
  return group;
}

// Attach terminal tags to groups['metal'] so they move synchronously with exploded layers
// Separate spatial quadrants guarantee zero collision or overlap between badges
var srcCallout = createTerminalCallout('SOURCE (S)', '#4a92c9', srcX, Y.m1Top, 0, { x: -1.2, y: 1.6, z: -1.8 });
groups['metal'].add(srcCallout);

var drnCallout = createTerminalCallout('DRAIN (D)', '#57cf8f', drnX, Y.m1Top, 0, { x: 1.2, y: 1.6, z: -1.8 });
groups['metal'].add(drnCallout);

var gateCallout = createTerminalCallout('GATE (G)', '#e6c94a', 0, Y.m1Top, 5.2, { x: 0, y: 1.6, z: 2.2 });
groups['metal'].add(gateCallout);

var bodyCallout = createTerminalCallout('BODY (B)', '#9aa6b6', -6.5, Y.m1Top, 6.2, { x: -1.4, y: 1.6, z: 1.4 });
groups['metal'].add(bodyCallout);

// Gate length callout attached to groups['poly']
var polyLengthCallout = createTerminalCallout('L = 28nm', '#ffffff', 0, Y.polyTop, 0, { x: 0, y: 1.2, z: -4.8 });
groups['poly'].add(polyLengthCallout);

function toggleLabels(visible) {
  labelSprites.forEach(function(s) {
    s.visible = visible;
  });
  labelCalloutGroups.forEach(function(g) {
    g.visible = visible;
  });
}
