/* Procedural 3D NAND2 physical layout geometry, Gaussian doping profiles, iso-contours, PDK Metal-1 & themeable labels */

var Y = {
  subBot: 0.0,    subTop: 2.0,
  wellBot: 1.10,  wellTop: 2.05,    // sits in UPPER part of substrate, +0.05 proud
  actBot: 1.55,   actTop: 1.95,     // recessed below well/substrate top surface
  silBot: 1.952,  silTop: 1.992,    // self-aligned NiSi silicide contact pads atop exposed silicon
  oxideBot: 1.95, oxideTop: 1.985,  // interfacial SiO2 (thickness 0.035)
  highkBot: 1.985,highkTop: 2.02,   // High-K HfO2 (thickness 0.035)
  polyBot: 2.02,  polyTop: 2.32,    // polysilicon height 0.30
  metalBot: 2.95, metalTop: 3.10    // flat ribbon: 0.15 (1λ) thick
};

var LAYER_ORDER = ['substrate', 'well', 'depletion', 'active', 'sde', 'oxide', 'highk', 'poly', 'spacer', 'silicide', 'contact', 'metal'];
var EXPLODE_GAP = 3.2;

var allMeshes = [];
var meshById = {};
var meshesById = {};
var labelSprites = [];
var labelsList = labelSprites;
var gaussTexCache = {};
var brushedMetalTexCache = null;

var activeClipPlanes = typeof THREE !== 'undefined' ? [
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), 999),
  new THREE.Plane(new THREE.Vector3(0, -1, 0), 999),
  new THREE.Plane(new THREE.Vector3(0, 0, -1), 999)
] : [];

/* ============================================================
   PROCEDURAL GRADIENT & BRUSHED METAL TEXTURES
   ============================================================ */

function resolveNandCanonProp(colorVarOrHex, isLightTheme) {
  var isL = isLightTheme !== undefined ? isLightTheme : (document.documentElement.getAttribute('data-theme') === 'light');
  var fn = (typeof getMaterialProperties === 'function') ? getMaterialProperties : window.getMaterialProperties;
  var props = fn ? fn(isL ? 'light' : 'dark') : null;
  if (props && colorVarOrHex) {
    if (colorVarOrHex === '--c-substrate') return props.substrate;
    if (colorVarOrHex === '--c-well') return props.nWell;
    if (colorVarOrHex === '--c-pwell') return props.pWell;
    if (colorVarOrHex === '--c-active-p') return props.pPlusImplant;
    if (colorVarOrHex === '--c-active-n') return props.nPlusImplant;
    if (colorVarOrHex === '--c-sde-p') return props.pSDE;
    if (colorVarOrHex === '--c-sde-n') return props.nSDE;
  }
  return null;
}

function gaussianDepthTexture(colorVarOrHex, peakV, sigmaV, opts) {
  opts = opts || {};
  var canonProp = resolveNandCanonProp(colorVarOrHex);
  var rawColor = canonProp ? canonProp.color : (colorVarOrHex.indexOf('--') === 0 ? cssVar(colorVarOrHex) : colorVarOrHex);
  var key = [rawColor, peakV, sigmaV, opts.isoLines || 5].join('|');
  if (gaussTexCache[key]) return gaussTexCache[key];

  var TW = 512, TH = 256;
  var c = document.createElement('canvas'); c.width = TW; c.height = TH;
  var ctx = c.getContext('2d');
  var img = ctx.createImageData(TW, TH), data = img.data;

  var tc = new THREE.Color(rawColor);
  var r0 = Math.round(tc.r * 255), g0 = Math.round(tc.g * 255), b0 = Math.round(tc.b * 255);
  var nIso = opts.isoLines !== undefined ? opts.isoLines : 5;

  for (var py = 0; py < TH; py++) {
    var v = py / (TH - 1); // 0 = wafer surface, 1 = junction bottom
    var dv = (v - peakV) / sigmaV;
    var gDepth = Math.exp(-0.5 * dv * dv);

    for (var px = 0; px < TW; px++) {
      var u = px / (TW - 1);
      var uMod = 0.94 + 0.06 * Math.cos(u * Math.PI * 4);
      var conc = Math.min(1.0, gDepth * uMod);

      var idx = (py * TW + px) * 4;
      data[idx]     = Math.min(255, Math.round(r0 * (0.65 + 0.45 * conc) + 40 * conc));
      data[idx + 1] = Math.min(255, Math.round(g0 * (0.65 + 0.45 * conc) + 40 * conc));
      data[idx + 2] = Math.min(255, Math.round(b0 * (0.65 + 0.45 * conc) + 40 * conc));
      data[idx + 3] = Math.round(180 + 75 * conc);
    }
  }
  ctx.putImageData(img, 0, 0);

  var isoRatios = [0.85, 0.60, 0.35, 0.15, 0.05].slice(0, nIso);
  isoRatios.forEach(function (ratio, i) {
    var dv = Math.sqrt(-2.0 * Math.log(ratio)) * sigmaV;
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.70 - i * 0.10).toFixed(2) + ')';
    ctx.lineWidth = 1.4;
    var vUp = peakV - dv;
    if (vUp >= 0 && vUp <= 1) {
      ctx.beginPath(); ctx.moveTo(0, vUp * (TH - 1)); ctx.lineTo(TW, vUp * (TH - 1)); ctx.stroke();
    }
    var vDn = peakV + dv;
    if (vDn >= 0 && vDn <= 1) {
      ctx.beginPath(); ctx.moveTo(0, vDn * (TH - 1)); ctx.lineTo(TW, vDn * (TH - 1)); ctx.stroke();
    }
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(TW, 2); ctx.stroke();
  ctx.setLineDash([]);

  var tex = new THREE.CanvasTexture(c);
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  gaussTexCache[key] = tex;
  return tex;
}

function getBrushedMetalTexture() {
  if (brushedMetalTexCache) return brushedMetalTexCache;
  var c = document.createElement('canvas'); c.width = 256; c.height = 256;
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
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
  }
  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  brushedMetalTexCache = tex;
  return tex;
}

/* ============================================================
   EXACT GEOMETRY BUILDER FUNCTIONS
   ============================================================ */

function getRoundedRectPoint(hx, hz, cr, theta) {
  var cos = Math.cos(theta), sin = Math.sin(theta);
  var sx = Math.max(0, hx - cr), sz = Math.max(0, hz - cr);
  var qx = cos >= 0 ? 1 : -1, qz = sin >= 0 ? 1 : -1;
  var cCos = Math.abs(cos), cSin = Math.abs(sin);
  var len = Math.hypot(cCos, cSin) || 1;
  return [qx * (sx + cr * (cCos / len)), qz * (sz + cr * (cSin / len))];
}

// 3D GAUSSIAN CURVED TUB GEOMETRY (Wells, S/D, SDE/LDD, Taps)
function createGaussianTubGeometry(w, h, d, opts) {
  opts = opts || {};
  var nLayers = opts.nLayers || 20;
  var nPerim = opts.nPerim || 48;
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.18;
  var cornerR = opts.cornerR !== undefined ? opts.cornerR : Math.min(w, d) * 0.22;

  var positions = [], uvs = [], indices = [];
  var halfW = w / 2, halfD = d / 2;

  for (var i = 0; i <= nLayers; i++) {
    var eta = i / nLayers; // 0 at wafer surface, 1 at bottom apex
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

  for (var i2 = 0; i2 < nLayers; i2++) {
    var ring1 = i2 * nPerim, ring2 = (i2 + 1) * nPerim;
    for (var j2 = 0; j2 < nPerim; j2++) {
      var nextJ = (j2 + 1) % nPerim;
      var a = ring1 + j2, b = ring2 + j2, c = ring2 + nextJ, dIdx = ring1 + nextJ;
      indices.push(a, b, dIdx, b, c, dIdx);
    }
  }

  var bottomCenterIdx = positions.length / 3;
  positions.push(0, -h * 0.5, 0);
  uvs.push(0.5, 1.0);
  var lastRingStart = nLayers * nPerim;
  for (var jb = 0; jb < nPerim; jb++) {
    indices.push(bottomCenterIdx, lastRingStart + ((jb + 1) % nPerim), lastRingStart + jb);
  }

  var topCenterIdx = positions.length / 3;
  positions.push(0, h * 0.5, 0);
  uvs.push(0.5, 0.0);
  for (var jt = 0; jt < nPerim; jt++) {
    indices.push(topCenterIdx, jt, (jt + 1) % nPerim);
  }

  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// FILLETED METAL-1 TRACE GEOMETRY
function createFilletedTraceGeometry(w, h, d, cornerRadius, bevel) {
  cornerRadius = Math.min(cornerRadius !== undefined ? cornerRadius : 0.15, Math.min(w, d) * 0.48);
  bevel = Math.min(bevel !== undefined ? bevel : 0.02, Math.min(w, h, d) * 0.25);
  var hw = w / 2, hd = d / 2, cr = cornerRadius;

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

  var geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 2
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

// OCTAGONAL 5λ×5λ VIA LANDING PAD (1λ 45° chamfer)
function createOctagonalViaPadGeometry(size, h, chamfer, bevel) {
  size = size || 0.75;
  chamfer = chamfer || 0.15;
  bevel = bevel !== undefined ? bevel : 0.02;
  var hs = size / 2, c = Math.min(chamfer, hs * 0.6);

  var shape = new THREE.Shape();
  shape.moveTo(-hs + c, -hs); shape.lineTo(hs - c, -hs);
  shape.lineTo(hs, -hs + c);  shape.lineTo(hs, hs - c);
  shape.lineTo(hs - c, hs);   shape.lineTo(-hs + c, hs);
  shape.lineTo(-hs, hs - c);  shape.lineTo(-hs, -hs + c);
  shape.closePath();

  var geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: Math.max(0.001, h - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 2
  });
  geo.rotateX(Math.PI / 2);
  geo.center();
  return geo;
}

// 45-DEGREE CHAMFERED T-JUNCTION BRACKET
function createChamferedTJunctionGeometry(branchDir, railW, branchW, chamfer, height, bevel) {
  railW = railW || 0.45; branchW = branchW || 0.45;
  chamfer = chamfer || 0.15; height = height || 0.15;
  bevel = bevel !== undefined ? bevel : 0.02;

  var hwRail = railW / 2, hwBranch = branchW / 2, c = chamfer;
  var armRail = hwBranch + c + 0.20, armBranch = hwRail + c + 0.20;

  var shape = new THREE.Shape();
  shape.moveTo(-hwRail, armRail);
  shape.lineTo(hwRail, armRail);
  shape.lineTo(hwRail, hwBranch + c);
  shape.lineTo(hwRail + c, hwBranch);
  shape.lineTo(armBranch, hwBranch);
  shape.lineTo(armBranch, -hwBranch);
  shape.lineTo(hwRail + c, -hwBranch);
  shape.lineTo(hwRail, -hwBranch - c);
  shape.lineTo(hwRail, -armRail);
  shape.lineTo(-hwRail, -armRail);
  shape.closePath();

  var geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 2
  });
  geo.rotateX(Math.PI / 2);
  geo.computeBoundingBox();
  var bb = geo.boundingBox;
  geo.translate(0, -(bb.min.y + bb.max.y) / 2, 0);

  if (branchDir === '-z')      geo.rotateY(Math.PI / 2);
  else if (branchDir === '+z') geo.rotateY(-Math.PI / 2);
  else if (branchDir === '-x') geo.rotateY(Math.PI);
  return geo;
}

/* ============================================================
   GAUSSIAN TUB + CONTOUR LOOPS + CORE MESH BUILDER
   ============================================================ */

function createTubContourLoop(w, h, d, eta, yOverride, straggle, cornerR, colorObj, opacity) {
  var nPerim = 48;
  var halfW = w / 2, halfD = d / 2;
  var rFactor = Math.sqrt(Math.max(0, 1.0 - eta * eta));
  var curHx = halfW * (1.0 - straggle * (1.0 - rFactor));
  var curHz = halfD * (1.0 - straggle * (1.0 - rFactor));
  var curCr = cornerR * (0.35 + 0.65 * rFactor);
  var y = yOverride !== undefined ? yOverride : (h * 0.5 - h * eta);

  var pts = [];
  for (var j = 0; j < nPerim; j++) {
    var theta = (j / nPerim) * Math.PI * 2;
    var pt = getRoundedRectPoint(curHx, curHz, curCr, theta);
    pts.push(new THREE.Vector3(pt[0], y, pt[1]));
  }

  var geo = new THREE.BufferGeometry().setFromPoints(pts);
  var mat = new THREE.LineBasicMaterial({
    color: colorObj,
    transparent: true,
    opacity: opacity,
    depthWrite: false,
    clippingPlanes: activeClipPlanes
  });
  var loop = new THREE.LineLoop(geo, mat);
  loop.raycast = function () {};
  return loop;
}

function gaussianDopingMesh(w, h, d, colorVar, opts) {
  opts = opts || {};
  var peakV = opts.peakV !== undefined ? opts.peakV : 0.15;
  var sigmaV = opts.sigmaV !== undefined ? opts.sigmaV : 0.22;
  var isoLines = opts.isoLines !== undefined ? opts.isoLines : 5;
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.16;
  var cornerR = opts.cornerR !== undefined ? opts.cornerR : Math.min(w, d) * 0.22;
  var canonProp = resolveNandCanonProp(colorVar);

  var rawHex = canonProp ? canonProp.color : cssVar(colorVar);
  var baseColor = new THREE.Color(rawHex);
  var outlineHex = opts.outlineColor || (canonProp && canonProp.outlineColor) || null;
  var tex = gaussianDepthTexture(colorVar, peakV, sigmaV, { isoLines: isoLines });

  var outerGeo = createGaussianTubGeometry(w, h, d, {
    nLayers: 20,
    nPerim: 48,
    straggle: straggle,
    cornerR: cornerR
  });

  var outerMat = new THREE.MeshStandardMaterial({
    color: baseColor.clone(),
    map: tex,
    roughness: opts.roughness !== undefined ? opts.roughness : (canonProp && canonProp.roughness !== undefined ? canonProp.roughness : 0.50),
    metalness: opts.metalness !== undefined ? opts.metalness : (canonProp && canonProp.metalness !== undefined ? canonProp.metalness : 0.15),
    emissive: 0x000000,
    emissiveIntensity: 0,
    transparent: true,
    opacity: opts.opacity !== undefined ? opts.opacity : (canonProp && canonProp.opacity !== undefined ? canonProp.opacity : 0.88),
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    clippingPlanes: activeClipPlanes
  });

  var mesh = new THREE.Mesh(outerGeo, outerMat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.renderOrder = opts.renderOrder !== undefined ? opts.renderOrder : 3;

  mesh.userData.colorVar = colorVar;
  mesh.userData.gaussParams = { peakV: peakV, sigmaV: sigmaV, isoLines: isoLines };

  /* 3 depth iso-concentration LineLoop rings at eta = [0.25, 0.50, 0.75] */
  var contourEtas = [0.25, 0.50, 0.75];
  var depthColor = outlineHex
    ? new THREE.Color(outlineHex)
    : baseColor.clone().offsetHSL(0, 0.1, 0.2);

  for (var idx = 0; idx < contourEtas.length; idx++) {
    var depthLoop = createTubContourLoop(
      w, h, d,
      contourEtas[idx],
      undefined,
      straggle,
      cornerR,
      depthColor.clone(),
      0.70 - idx * 0.15
    );
    depthLoop.userData.isAutoOutline = !opts.outlineColor;
    depthLoop.userData.hasFixedOutline = Boolean(opts.outlineColor);
    depthLoop.userData.isDepthRing = true;
    mesh.add(depthLoop);
  }

  /* 1 top wafer-surface perimeter LineLoop at y = h * 0.5 + 0.005 */
  var topColor = outlineHex
    ? new THREE.Color(outlineHex)
    : baseColor.clone();
  var topLoop = createTubContourLoop(
    w, h, d,
    0,
    h * 0.5 + 0.005,
    straggle,
    cornerR,
    topColor,
    0.85
  );
  topLoop.userData.isAutoOutline = !opts.outlineColor;
  topLoop.userData.hasFixedOutline = Boolean(opts.outlineColor);
  topLoop.userData.isDepthRing = false;
  mesh.add(topLoop);

  /* Inner volumetric high-concentration coreMesh */
  var coreGeo = createGaussianTubGeometry(0.70 * w, 0.60 * h, 0.70 * d, {
    nLayers: 12,
    nPerim: 32,
    straggle: straggle * 1.2,
    cornerR: cornerR * 0.7
  });
  var coreMat = new THREE.MeshBasicMaterial({
    color: baseColor.clone(),
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
    side: THREE.DoubleSide,
    clippingPlanes: activeClipPlanes
  });
  var coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.raycast = function () {};
  mesh.add(coreMesh);
  mesh.userData.coreMesh = coreMesh;

  return mesh;
}

function makeMetalMaterial(colorVar) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(cssVar(colorVar)),
    metalness: 0.90,
    roughness: 0.20,
    roughnessMap: getBrushedMetalTexture(),
    envMap: typeof studioEnvMap !== 'undefined' ? studioEnvMap : null,
    envMapIntensity: 1.25,
    emissive: 0x000000,
    emissiveIntensity: 0,
    opacity: 1.0,
    transparent: false,
    side: THREE.FrontSide,
    depthWrite: true,
    clippingPlanes: activeClipPlanes
  });
}

function registerMesh(mesh, id, layer, opts) {
  opts = opts || {};
  mesh.userData.id = id;
  if (!opts.decorative) mesh.userData.layerId = id;
  mesh.userData.layer = layer;
  if (mesh.isGroup && !opts.decorative) {
    mesh.traverse(function (child) {
      if (child.isLine || child.isLineSegments || child.isPoints) return;
      child.userData.id = id;
      child.userData.layerId = id;
      child.userData.layer = layer;
    });
  }
  mesh.userData.explodeLayer = opts.explodeLayer || layer;
  mesh.userData.explodeIdx = LAYER_ORDER.indexOf(mesh.userData.explodeLayer);
  if (mesh.userData.explodeIdx < 0) mesh.userData.explodeIdx = 0;
  mesh.userData.restPos = mesh.position.clone();
  mesh.userData.decorative = Boolean(opts.decorative);
  mesh.userData.pulsing = false;
  mesh.userData.baseColor = mesh.material && mesh.material.color ? mesh.material.color.getHex() : 0xffffff;
  mesh.userData.baseEmissive = mesh.material && mesh.material.emissive ? mesh.material.emissive.getHex() : 0x000000;
  mesh.userData.baseEmissiveIntensity = mesh.material && mesh.material.emissiveIntensity ? mesh.material.emissiveIntensity : 0;

  if (opts.decorative) {
    mesh.raycast = function () {};
  }

  cellGroup.add(mesh);
  allMeshes.push(mesh);

  if (!meshesById[id]) meshesById[id] = [];
  meshesById[id].push(mesh);
  if (!meshById[id]) meshById[id] = mesh;
  return mesh;
}

function contactAt(id, x, z, topOfLower) {
  var h = Y.metalBot - topOfLower;
  var midY = (topOfLower + Y.metalBot) / 2;
  var geo = new THREE.CylinderGeometry(0.21, 0.17, h, 16, 1, false);
  var mat = new THREE.MeshStandardMaterial({
    color: 0x4a4d54,
    metalness: 0.95,
    roughness: 0.25,
    envMap: typeof studioEnvMap !== 'undefined' ? studioEnvMap : null,
    envMapIntensity: 1.1,
    emissive: 0x000000,
    emissiveIntensity: 0,
    opacity: 1.0,
    transparent: false,
    side: THREE.FrontSide,
    depthWrite: true,
    clippingPlanes: activeClipPlanes
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, midY, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return registerMesh(mesh, id, 'contact');
}

/* ============================================================
   3D LABEL SPRITES & DYNAMIC THEME SYNCHRONIZATION
   ============================================================ */

function renderLabelCanvasTexture(text, colorHex) {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var pad = 10, fontSize = 30;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = 'bold ' + fontSize + 'px "IBM Plex Mono", monospace';
  var metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width) + pad * 2;
  canvas.height = fontSize + pad * 2;
  ctx.font = 'bold ' + fontSize + 'px "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,14,22,0.96)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = colorHex; ctx.lineWidth = 2.5;
  ctx.strokeRect(1.25, 1.25, canvas.width - 2.5, canvas.height - 2.5);
  ctx.fillStyle = colorHex;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, canvas.height / 2 + 1);

  var tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return { tex: tex, width: canvas.width, height: canvas.height };
}

function makeLabel(text, colorHex) {
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var pad = 10, fontSize = 30;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = 'bold ' + fontSize + 'px "IBM Plex Mono", monospace';
  var metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width) + pad * 2;
  canvas.height = fontSize + pad * 2;
  ctx.font = 'bold ' + fontSize + 'px "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,14,22,0.96)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = colorHex; ctx.lineWidth = 2.5;
  ctx.strokeRect(1.25, 1.25, canvas.width - 2.5, canvas.height - 2.5);
  ctx.fillStyle = colorHex;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, canvas.height / 2 + 1);

  var tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  var mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true });
  var sprite = new THREE.Sprite(mat);
  var scale = 0.0112;
  sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
  sprite.renderOrder = 999;
  sprite.raycast = function () {};
  sprite.userData.isLabel = true;
  sprite.userData.labelText = text;
  sprite.userData.colorHex = colorHex;
  labelSprites.push(sprite);
  return sprite;
}

function addLabel(text, x, y, z, layerKey, colorHex, opts) {
  opts = opts || {};
  var sprite = makeLabel(text, colorHex);
  sprite.position.set(x, y, z);
  sprite.userData.layer = layerKey;
  sprite.userData.explodeLayer = opts.explodeLayer || layerKey;
  sprite.userData.explodeIdx = LAYER_ORDER.indexOf(sprite.userData.explodeLayer);
  if (sprite.userData.explodeIdx < 0) sprite.userData.explodeIdx = 0;
  sprite.userData.restPos = sprite.position.clone();
  cellGroup.add(sprite);

  if (opts.anchor && opts.anchor.length === 3) {
    var dx = opts.anchor[0] - x;
    var dy = opts.anchor[1] - y;
    var dz = opts.anchor[2] - z;
    if (Math.hypot(dx, dy, dz) > 0.05) {
      var lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(dx, dy, dz)
      ]);
      var lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.60,
        depthTest: false,
        depthWrite: false
      });
      var leader = new THREE.Line(lineGeo, lineMat);
      leader.position.set(x, y, z);
      leader.renderOrder = 998;
      leader.raycast = function () {};
      leader.userData.isLabel = true;
      leader.userData.isLabelLeader = true;
      leader.userData.layer = layerKey;
      leader.userData.explodeLayer = sprite.userData.explodeLayer;
      leader.userData.explodeIdx = sprite.userData.explodeIdx;
      leader.userData.restPos = sprite.userData.restPos.clone();
      cellGroup.add(leader);
      sprite.userData.leaderLine = leader;
    }
  }
  return sprite;
}

function refreshAllLabelSprites() {
  for (var i = 0; i < labelSprites.length; i++) {
    var sprite = labelSprites[i];
    if (!sprite || !sprite.userData || !sprite.userData.isLabel) continue;
    var built = renderLabelCanvasTexture(sprite.userData.labelText, sprite.userData.colorHex);
    if (sprite.material.map) sprite.material.map.dispose();
    sprite.material.map = built.tex;
    sprite.material.needsUpdate = true;
    sprite.scale.set(built.width * 0.0112, built.height * 0.0112, 1);
  }
}

function updateMaterialsTheme() {
  if (typeof THREE === 'undefined') return;
  var isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLightTheme ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLightTheme ? 'light' : 'dark') : null);
  var propsFn = (typeof getMaterialProperties === 'function') ? getMaterialProperties : window.getMaterialProperties;
  var props = propsFn ? propsFn(isLightTheme ? 'light' : 'dark') : null;

  for (var i = 0; i < allMeshes.length; i++) {
    var m = allMeshes[i];
    if (m && m.userData && (m.userData.id === 'chMP1' || m.userData.id === 'chMP2' || m.userData.id === 'chMN1' || m.userData.id === 'chMN2')) continue;
    var colorVar = m.userData.colorVar;
    if (!colorVar || !m.material) continue;

    var canonProp = resolveNandCanonProp(colorVar, isLightTheme);
    var nextColorStr = canonProp ? canonProp.color : cssVar(colorVar);
    if (!canonProp && pal) {
      if (colorVar === '--c-substrate' && pal.pSubstrate) nextColorStr = pal.pSubstrate;
      else if (colorVar === '--c-well' && pal.nWell) nextColorStr = pal.nWell;
      else if (colorVar === '--c-pwell' && pal.pWell) nextColorStr = pal.pWell;
      else if (colorVar === '--c-active-p' && pal.pPlusDiffusion) nextColorStr = pal.pPlusDiffusion;
      else if (colorVar === '--c-active-n' && pal.nPlusDiffusion) nextColorStr = pal.nPlusDiffusion;
      else if (colorVar === '--c-sde-p' && pal.pSDE) nextColorStr = pal.pSDE;
      else if (colorVar === '--c-sde-n' && pal.nSDE) nextColorStr = pal.nSDE;
    }

    var nextColor = new THREE.Color(nextColorStr);
    if (m.material.color) {
      m.material.color.copy(nextColor);
    }
    if (canonProp) {
      if (canonProp.roughness !== undefined) m.material.roughness = canonProp.roughness;
      if (canonProp.metalness !== undefined) m.material.metalness = canonProp.metalness;
    }
    if (colorVar === '--c-substrate') {
      m.material.roughness = 0.85;
      m.material.metalness = 0.05;
      if (m.material.emissive) m.material.emissive.set(0x000000);
      m.material.emissiveIntensity = 0;
    } else if (colorVar === '--c-well' || colorVar === '--c-pwell') {
      m.material.roughness = isLightTheme ? 0.75 : 0.60;
      if (m.material.emissive) m.material.emissive.set(0x000000);
      m.material.emissiveIntensity = 0;
    }
    m.userData.baseColor = nextColor.getHex();

    if (m.userData.gaussParams) {
      var gp = m.userData.gaussParams;
      m.material.map = gaussianDepthTexture(colorVar, gp.peakV, gp.sigmaV, {
        isoLines: gp.isoLines
      });
      m.material.needsUpdate = true;
    }

    if (m.userData.coreMesh && m.userData.coreMesh.material && m.userData.coreMesh.material.color) {
      m.userData.coreMesh.material.color.copy(nextColor);
    }

    if (m.children && m.children.length) {
      var canonOut = (canonProp && canonProp.outlineColor) ? new THREE.Color(canonProp.outlineColor) : null;
      for (var c = 0; c < m.children.length; c++) {
        var child = m.children[c];
        if (child.isLineLoop && child.userData && child.userData.isAutoOutline && !child.userData.hasFixedOutline && child.material && child.material.color) {
          if (canonOut) {
            child.material.color.copy(canonOut);
          } else if (child.userData.isDepthRing) {
            child.material.color.copy(nextColor.clone().offsetHSL(0, 0.1, 0.2));
          } else {
            child.material.color.copy(nextColor);
          }
        }
      }
    }
  }

  if (typeof silMatNand !== 'undefined' && silMatNand && silMatNand.color) {
    silMatNand.color.setHex(isLightTheme ? 0x647082 : 0x6e7887);
  }
  var dp = (props && props.depletion) ? props.depletion : {
    colorHex: isLightTheme ? 0x64748b : 0x94a3b8,
    emissiveHex: isLightTheme ? 0x334155 : 0x475569,
    emissiveIntensity: 0.14,
    opacity: 0.38,
    roughness: 0.55,
    metalness: 0.08,
    edgeOpacity: 0.55
  };
  if (typeof window.nandDeplMat !== 'undefined' && window.nandDeplMat) {
    window.nandDeplMat.color.setHex(dp.colorHex);
    window.nandDeplMat.emissive.setHex(dp.emissiveHex);
    window.nandDeplMat.emissiveIntensity = dp.emissiveIntensity;
    window.nandDeplMat.opacity = dp.opacity;
    window.nandDeplMat.roughness = dp.roughness;
    window.nandDeplMat.metalness = dp.metalness;
  }
  if (typeof window.nandDeplEdgeMat !== 'undefined' && window.nandDeplEdgeMat) {
    window.nandDeplEdgeMat.color.setHex(dp.colorHex);
    window.nandDeplEdgeMat.opacity = dp.edgeOpacity;
  }
  for (var di = 0; di < allMeshes.length; di++) {
    var dm = allMeshes[di];
    if (dm && dm.userData && dm.userData.layerId === 'depletion' && dm.material) {
      dm.material.color.setHex(dp.colorHex);
      if (dm.material.emissive) dm.material.emissive.setHex(dp.emissiveHex);
      dm.material.emissiveIntensity = dp.emissiveIntensity;
      dm.material.opacity = dp.opacity;
      dm.userData.baseEmissive = dp.emissiveHex;
      dm.userData.baseEmissiveIntensity = dp.emissiveIntensity;
    }
  }

  refreshAllLabelSprites();

  if (typeof selectedMeshes !== 'undefined' && selectedMeshes.length && typeof setMeshHighlight === 'function') {
    for (var s = 0; s < selectedMeshes.length; s++) {
      setMeshHighlight(selectedMeshes[s], true);
    }
  }

  var isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLightTheme ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLightTheme ? 'light' : 'dark') : null);

  if (typeof updateLayersListTheme === 'function') {
    updateLayersListTheme(pal);
  }

  if (typeof window.updateNandChannelThemes === 'function') {
    window.updateNandChannelThemes(isLightTheme ? 'light' : 'dark');
  }

  if (typeof window.updateBulkCarriersTheme === 'function') {
    window.updateBulkCarriersTheme(isLightTheme ? 'light' : 'dark');
  }

  if (typeof renderer !== 'undefined' && renderer && typeof scene !== 'undefined' && scene && typeof activeCamera !== 'undefined' && activeCamera) {
    renderer.render(scene, activeCamera);
  }
}

try {
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
    document.fonts.ready.then(function () {
      refreshAllLabelSprites();
    }).catch(function () {});
  }
} catch (err) {
  console.error('Font ready listener failed:', err);
}

/* ============================================================
   BUILD FULL CMOS 2-INPUT NAND (NAND2) CELL
   ============================================================ */

function buildNand2Cell() {
  var PMOS_ZC = 4.85;
  var NMOS_ZC = -4.85;
  var ACTIVE_W = 6.0;
  var TAP_X = -9.0;
  var LEFT_X = -5.5;
  var GATE_A_X = -3.0;
  var MID_X = 0.0;
  var GATE_B_X = 3.0;
  var RIGHT_X = 5.5;
  var RAIL_Z = 9.45;
  var METAL_W = 0.45;
  var metalH = Y.metalTop - Y.metalBot;
  var metalMidY = (Y.metalBot + Y.metalTop) / 2;

  /* 1. P-Substrate (Sharp BoxGeometry, NO outline edges) */
  var canonSub = resolveNandCanonProp('--c-substrate');
  var subGeo = new THREE.BoxGeometry(24, Y.subTop - Y.subBot, 25, 1, 1, 1);
  var subMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(canonSub ? canonSub.color : cssVar('--c-substrate')),
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0x000000,
    emissiveIntensity: 0,
    opacity: 1.0,
    transparent: false,
    side: THREE.FrontSide,
    depthWrite: true,
    clippingPlanes: activeClipPlanes
  });
  var psub = new THREE.Mesh(subGeo, subMat);
  psub.position.set(-0.5, (Y.subBot + Y.subTop) / 2, 0);
  psub.receiveShadow = true;
  psub.castShadow = true;
  psub.renderOrder = 1;
  psub.userData.colorVar = '--c-substrate';
  registerMesh(psub, 'psub', 'substrate');

  /* 2. Twin Wells (Gaussian Doping Tubs with 4 soft LineLoop contours + coreMesh) */
  var wellW = 18.70;
  var wellH = Y.wellTop - Y.wellBot;
  var wellMidY = (Y.wellBot + Y.wellTop) / 2;
  var wellD = 7.80;
  var wellX = -1.15;

  var nwell = gaussianDopingMesh(wellW, wellH, wellD, '--c-well', {
    peakV: 0.35,
    sigmaV: 0.28,
    straggle: 0.08,
    cornerR: 0.35,
    renderOrder: 2
  });
  nwell.position.set(wellX, wellMidY, PMOS_ZC);
  registerMesh(nwell, 'nwell', 'well');

  var pwell = gaussianDopingMesh(wellW, wellH, wellD, '--c-pwell', {
    peakV: 0.35,
    sigmaV: 0.28,
    straggle: 0.08,
    cornerR: 0.35,
    renderOrder: 2
  });
  pwell.position.set(wellX, wellMidY, NMOS_ZC);
  registerMesh(pwell, 'pwell', 'well');

  /* 3. Body Taps & Active Diffusions (Gaussian Doping Tubs) */
  var actH = Y.actTop - Y.actBot;
  var actMidY = (Y.actBot + Y.actTop) / 2;

  var welltapAct = gaussianDopingMesh(1.3, actH, 1.3, '--c-well', {
    peakV: 0.18,
    sigmaV: 0.24,
    straggle: 0.20,
    cornerR: 0.3,
    opacity: 0.88,
    outlineColor: '#8fe6c8',
    renderOrder: 3
  });
  welltapAct.position.set(TAP_X, actMidY, PMOS_ZC);
  registerMesh(welltapAct, 'welltapAct', 'active');

  var subtapAct = gaussianDopingMesh(1.3, actH, 1.3, '--c-substrate', {
    peakV: 0.18,
    sigmaV: 0.24,
    straggle: 0.20,
    cornerR: 0.3,
    opacity: 0.88,
    outlineColor: '#aab4c2',
    renderOrder: 3
  });
  subtapAct.position.set(TAP_X, actMidY, NMOS_ZC);
  registerMesh(subtapAct, 'subtapAct', 'active');

  /* P+ Active Diffusions: MP1 Source, Shared P+ Drain, MP2 Source */
  var pActOpts = {
    peakV: 0.15,
    sigmaV: 0.22,
    straggle: 0.16,
    cornerR: 0.5,
    renderOrder: 3
  };

  var pmosASrc = gaussianDopingMesh(3.0, actH, ACTIVE_W, '--c-active-p', pActOpts);
  pmosASrc.position.set(LEFT_X, actMidY, PMOS_ZC);
  registerMesh(pmosASrc, 'pmosASrc', 'active');

  var pmosSharedDrn = gaussianDopingMesh(4.0, actH, ACTIVE_W, '--c-active-p', pActOpts);
  pmosSharedDrn.position.set(MID_X, actMidY, PMOS_ZC);
  registerMesh(pmosSharedDrn, 'pmosSharedDrn', 'active');

  var pmosBSrc = gaussianDopingMesh(3.0, actH, ACTIVE_W, '--c-active-p', pActOpts);
  pmosBSrc.position.set(RIGHT_X, actMidY, PMOS_ZC);
  registerMesh(pmosBSrc, 'pmosBSrc', 'active');

  /* N+ Active Diffusions: MN1 Source, Series N+ Bridge, MN2 Drain */
  var nActOpts = {
    peakV: 0.15,
    sigmaV: 0.22,
    straggle: 0.16,
    cornerR: 0.5,
    renderOrder: 3
  };

  var nmosASrc = gaussianDopingMesh(3.0, actH, ACTIVE_W, '--c-active-n', nActOpts);
  nmosASrc.position.set(LEFT_X, actMidY, NMOS_ZC);
  registerMesh(nmosASrc, 'nmosASrc', 'active');

  var nmosMidNode = gaussianDopingMesh(4.0, actH, ACTIVE_W, '--c-active-n', nActOpts);
  nmosMidNode.position.set(MID_X, actMidY, NMOS_ZC);
  registerMesh(nmosMidNode, 'nmosMidNode', 'active');

  var nmosBDrn = gaussianDopingMesh(3.0, actH, ACTIVE_W, '--c-active-n', nActOpts);
  nmosBDrn.position.set(RIGHT_X, actMidY, NMOS_ZC);
  registerMesh(nmosBDrn, 'nmosBDrn', 'active');

  /* 4. P-SDE & N-SDE / LDD Extensions (flush at Y.actTop, explodeLayer = 'active') */
  var sdeW = 0.55;
  var sdeH = actH * 0.65;
  var sdeMidY = Y.actTop - sdeH / 2;

  var pSdeOpts = {
    peakV: 0.10,
    sigmaV: 0.28,
    straggle: 0.12,
    cornerR: 0.25,
    renderOrder: 4
  };
  var nSdeOpts = {
    peakV: 0.10,
    sigmaV: 0.28,
    straggle: 0.12,
    cornerR: 0.25,
    renderOrder: 4
  };

  var sdeSpecs = [
    { id: 'pmosASrcSde', isPmos: true,  gate: 'A', side: -1, x: -3.925, z: PMOS_ZC, colorVar: '--c-sde-p', opts: pSdeOpts },
    { id: 'pmosADrnSde', isPmos: true,  gate: 'A', side:  1, x: -2.075, z: PMOS_ZC, colorVar: '--c-sde-p', opts: pSdeOpts },
    { id: 'pmosBDrnSde', isPmos: true,  gate: 'B', side: -1, x: 2.075,  z: PMOS_ZC, colorVar: '--c-sde-p', opts: pSdeOpts },
    { id: 'pmosBSrcSde', isPmos: true,  gate: 'B', side:  1, x: 3.925,  z: PMOS_ZC, colorVar: '--c-sde-p', opts: pSdeOpts },
    { id: 'nmosASrcSde', isPmos: false, gate: 'A', side: -1, x: -3.925, z: NMOS_ZC, colorVar: '--c-sde-n', opts: nSdeOpts },
    { id: 'nmosADrnSde', isPmos: false, gate: 'A', side:  1, x: -2.075, z: NMOS_ZC, colorVar: '--c-sde-n', opts: nSdeOpts },
    { id: 'nmosBSrcSde', isPmos: false, gate: 'B', side: -1, x: 2.075,  z: NMOS_ZC, colorVar: '--c-sde-n', opts: nSdeOpts },
    { id: 'nmosBDrnSde', isPmos: false, gate: 'B', side:  1, x: 3.925,  z: NMOS_ZC, colorVar: '--c-sde-n', opts: nSdeOpts }
  ];

  var sdeRefs = [];
  for (var si = 0; si < sdeSpecs.length; si++) {
    var sp = sdeSpecs[si];
    var sdeMesh = gaussianDopingMesh(sdeW, sdeH, ACTIVE_W - 0.1, sp.colorVar, sp.opts);
    sdeMesh.position.set(sp.x, sdeMidY, sp.z);
    registerMesh(sdeMesh, sp.id, 'sde', { explodeLayer: 'active' });
    sdeRefs.push({ mesh: sdeMesh, spec: sp });
  }

  /* Dynamic Sculpted Wrap-Around Space-Charge Depletion Regions (6 S/D+bridge shells + 4 curved sub-gate cradles) */
  var isInitLightDepl = document.documentElement.getAttribute('data-theme') === 'light';
  var propsInitDepl = (typeof getMaterialProperties === 'function') ? getMaterialProperties(isInitLightDepl ? 'light' : 'dark') : (window.getMaterialProperties ? window.getMaterialProperties(isInitLightDepl ? 'light' : 'dark') : null);
  var dpInit = (propsInitDepl && propsInitDepl.depletion) ? propsInitDepl.depletion : {
    colorHex: isInitLightDepl ? 0x64748b : 0x94a3b8,
    emissiveHex: isInitLightDepl ? 0x334155 : 0x475569,
    emissiveIntensity: 0.14,
    opacity: 0.38,
    roughness: 0.55,
    metalness: 0.08,
    edgeOpacity: 0.55
  };

  var nandDeplMat = new THREE.MeshStandardMaterial({
    color: dpInit.colorHex,
    emissive: dpInit.emissiveHex,
    emissiveIntensity: dpInit.emissiveIntensity,
    transparent: true,
    opacity: dpInit.opacity,
    depthWrite: false,
    roughness: dpInit.roughness,
    metalness: dpInit.metalness,
    polygonOffset: true,
    polygonOffsetFactor: -0.5,
    polygonOffsetUnits: -0.5,
    side: THREE.DoubleSide,
    clippingPlanes: activeClipPlanes
  });
  window.nandDeplMat = nandDeplMat;

  var nandDeplEdgeMat = new THREE.LineBasicMaterial({
    color: dpInit.colorHex,
    transparent: true,
    opacity: dpInit.edgeOpacity,
    depthWrite: false,
    clippingPlanes: activeClipPlanes
  });
  window.nandDeplEdgeMat = nandDeplEdgeMat;

  var NAND_DEPL_ETA = [0.0, 0.15, 0.30, 0.45, 0.51, 0.58, 0.65, 0.72, 0.79, 0.86, 0.92, 0.97, 1.0];

  function nandDeplSmoothstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  function buildNandWellShellPerimeter(cx, hx, hz, cr) {
    var pts = [];
    var sx = Math.max(0, hx - cr);
    var sz = Math.max(0, hz - cr);
    var spineHalfZ = Math.max(0, hz - hx);

    function addPt(lx, lz) {
      var zSpine = Math.max(-spineHalfZ, Math.min(spineHalfZ, lz));
      var dx = lx;
      var dz = lz - zSpine;
      var len = Math.hypot(dx, dz) || 1;
      pts.push({
        cx: cx,
        lx: lx,
        lz: lz,
        zSpine: zSpine,
        nxh: dx / len,
        nzh: dz / len
      });
    }

    var nX = 28, nZ = 20, nC = 6, i, t, ang;
    for (i = 0; i < nX; i++) { t = i / nX; addPt(-sx + t * (2 * sx), hz); }
    for (i = 0; i < nC; i++) { ang = (Math.PI / 2) * (1 - i / nC); addPt(sx + cr * Math.cos(ang), sz + cr * Math.sin(ang)); }
    for (i = 0; i < nZ; i++) { t = i / nZ; addPt(hx, sz - t * (2 * sz)); }
    for (i = 0; i < nC; i++) { ang = -(Math.PI / 2) * (i / nC); addPt(sx + cr * Math.cos(ang), -sz + cr * Math.sin(ang)); }
    for (i = 0; i < nX; i++) { t = i / nX; addPt(sx - t * (2 * sx), -hz); }
    for (i = 0; i < nC; i++) { ang = -Math.PI / 2 - (Math.PI / 2) * (i / nC); addPt(-sx + cr * Math.cos(ang), -sz + cr * Math.sin(ang)); }
    for (i = 0; i < nZ; i++) { t = i / nZ; addPt(-hx, -sz + t * (2 * sz)); }
    for (i = 0; i < nC; i++) { ang = Math.PI - (Math.PI / 2) * (i / nC); addPt(-sx + cr * Math.cos(ang), sz + cr * Math.sin(ang)); }
    return pts;
  }

  function createNandWellShellGeometry(perim) {
    var nP = perim.length;
    var nR = NAND_DEPL_ETA.length;
    var outerCount = nR * nP;
    var totalVerts = outerCount * 2 + nP * 2;
    var positions = new Float32Array(totalVerts * 3);
    var indices = [];

    var i, j, nextJ, r0, r1, a, b, c, d;
    for (i = 0; i < nR - 1; i++) {
      r0 = i * nP;
      r1 = (i + 1) * nP;
      for (j = 0; j < nP; j++) {
        nextJ = (j + 1) % nP;
        a = r0 + j; b = r1 + j; c = r1 + nextJ; d = r0 + nextJ;
        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
    for (i = 0; i < nR - 1; i++) {
      r0 = outerCount + i * nP;
      r1 = outerCount + (i + 1) * nP;
      for (j = 0; j < nP; j++) {
        nextJ = (j + 1) % nP;
        a = r0 + j; b = r1 + j; c = r1 + nextJ; d = r0 + nextJ;
        indices.push(a, d, b);
        indices.push(b, d, c);
      }
    }
    var topInnerStart = outerCount * 2;
    var topOuterStart = topInnerStart + nP;
    for (j = 0; j < nP; j++) {
      nextJ = (j + 1) % nP;
      var v0 = topInnerStart + j, v1 = topInnerStart + nextJ;
      var v2 = topOuterStart + nextJ, v3 = topOuterStart + j;
      indices.push(v0, v3, v1);
      indices.push(v1, v3, v2);
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    return geo;
  }

  function makeNandShellMesh(cx, zc, perim, kind, isPmos) {
    var geo = createNandWellShellGeometry(perim);
    var m = new THREE.Mesh(geo, nandDeplMat.clone());
    m.position.set(cx, Y.actTop, zc);
    m.renderOrder = 2;
    m.userData.baseEmissive = nandDeplMat.emissive.getHex();
    m.userData.baseEmissiveIntensity = nandDeplMat.emissiveIntensity;
    m.userData.isSculptedDepletion = true;

    var edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(perim.length * 3), 3));
    var edgeLoop = new THREE.LineLoop(edgeGeo, nandDeplEdgeMat);
    edgeLoop.raycast = function () {};
    m.add(edgeLoop);

    registerMesh(m, 'depletion', 'depletion');
    return { mesh: m, geo: geo, edgeGeo: edgeGeo, perim: perim, kind: kind, isPmos: Boolean(isPmos) };
  }

  function evalNandChanThickness(worldX, ch) {
    var hL = nandGeom3D.halfL;
    var fullL = Math.max(0.002, hL * 2.0);
    if (!ch || !ch.hasChannel || Math.abs(worldX - ch.gateX) > (hL + 0.001)) return 0;
    var localX = worldX - ch.gateX;
    var s = (ch.drainDir === 1) ? ((localX + hL) / fullL) : ((hL - localX) / fullL);
    if (ch.isSat) {
      var pinchFrac = Math.max(0.001, (fullL - ch.dL) / fullL);
      if (s >= pinchFrac) return 0;
      var sSat = Math.max(0, Math.min(1, s / pinchFrac));
      return ch.maxH * Math.max(0, 1.0 - sSat);
    }
    return ch.maxH * Math.max(0, 1.0 - s * ch.ratio);
  }

  function updateNandWellShell(entry, wDep, revBulb, chA, chB) {
    var geo = entry.geo;
    var edgeGeo = entry.edgeGeo;
    var perim = entry.perim;
    var kind = entry.kind; // 'left' | 'mid' | 'right'
    var hL = nandGeom3D.halfL;
    var outerLeftGate = nandGeom3D.gateAX - hL;
    var outerRightGate = nandGeom3D.gateBX + hL;
    var rowHalfD = (entry.isPmos ? nandGeom3D.wp3d : nandGeom3D.wn3d) * 0.5;
    var posAttr = geo.attributes.position;
    var pos = posAttr.array;
    var edgeAttr = edgeGeo.attributes.position;
    var edgeArr = edgeAttr.array;

    var nP = perim.length;
    var nR = NAND_DEPL_ETA.length;
    var outerCount = nR * nP;
    var topInnerStart = outerCount * 2;
    var topOuterStart = topInnerStart + nP;
    var minLocalY = (Y.wellBot + 0.03) - Y.actTop; // -0.82

    for (var i = 0; i < nR; i++) {
      var eta = NAND_DEPL_ETA[i];
      var tDepth, tHoriz, outHWeight, outVWeight;

      if (eta <= 0.45) {
        var p1 = eta / 0.45;
        tDepth = 0.85 * p1;
        tHoriz = 1.0;
        outHWeight = 1.0;
        outVWeight = 0.0;
      } else if (eta <= 0.65) {
        var p2 = (eta - 0.45) / 0.20;
        var ang = p2 * (Math.PI / 2);
        tDepth = 0.85 + 0.15 * Math.sin(ang);
        tHoriz = 0.85 + 0.15 * Math.cos(ang);
        outHWeight = Math.cos(ang);
        outVWeight = Math.sin(ang);
      } else {
        var p3 = (eta - 0.65) / 0.35;
        tDepth = 1.0;
        tHoriz = 0.85 * (1.0 - p3);
        outHWeight = 0.0;
        outVWeight = 1.0;
      }

      for (var j = 0; j < nP; j++) {
        var pt = perim[j];
        var inX = pt.lx * tHoriz;
        var inZ = pt.zSpine + (pt.lz - pt.zSpine) * tHoriz;
        var worldX = pt.cx + inX;

        var tWell;
        if (kind === 'left') {
          tWell = nandDeplSmoothstep(outerLeftGate + 0.18, outerLeftGate - 0.08, worldX);
        } else if (kind === 'right') {
          tWell = nandDeplSmoothstep(outerRightGate - 0.18, outerRightGate + 0.08, worldX);
        } else {
          tWell = 1.0 - nandDeplSmoothstep(1.85, 2.12, Math.abs(worldX));
        }
        var depth = sdeH + (actH - sdeH) * tWell;
        var inY = 0.002 - depth * tDepth;

        var localW = wDep;
        if (revBulb > 0.001) {
          if (kind === 'right') {
            var rBulb = 0.72 + 0.28 * nandDeplSmoothstep(outerRightGate - 0.20, outerRightGate + 1.50, worldX);
            localW = wDep + revBulb * rBulb;
          } else if (kind === 'mid') {
            var mBulb = 0.75 + 0.25 * (1.0 - nandDeplSmoothstep(1.40, 2.35, Math.abs(worldX)));
            localW = wDep + revBulb * mBulb;
          }
        }

        var outX = inX + pt.nxh * localW * outHWeight;
        var outZ = inZ + pt.nzh * localW * outHWeight;
        var outY = Math.max(minLocalY, inY - localW * outVWeight);

        if (Math.abs(inZ) <= (rowHalfD + 0.02)) {
          var cTIn = Math.max(evalNandChanThickness(worldX, chA), evalNandChanThickness(worldX, chB));
          if (cTIn > 0.002) inY = Math.min(inY, -0.05 - cTIn * 0.5 - 0.004);
          var worldOutX = pt.cx + outX;
          var cTOut = Math.max(evalNandChanThickness(worldOutX, chA), evalNandChanThickness(worldOutX, chB));
          if (cTOut > 0.002) outY = Math.min(outY, -0.05 - cTOut * 0.5 - 0.004);
        }

        var oIdx = (i * nP + j) * 3;
        pos[oIdx] = outX; pos[oIdx + 1] = outY; pos[oIdx + 2] = outZ;

        var iIdx = (outerCount + i * nP + j) * 3;
        pos[iIdx] = inX; pos[iIdx + 1] = inY; pos[iIdx + 2] = inZ;

        if (i === 0) {
          var tiIdx = (topInnerStart + j) * 3;
          pos[tiIdx] = inX; pos[tiIdx + 1] = inY; pos[tiIdx + 2] = inZ;

          var toIdx = (topOuterStart + j) * 3;
          pos[toIdx] = outX; pos[toIdx + 1] = outY; pos[toIdx + 2] = outZ;

          var eIdx = j * 3;
          edgeArr[eIdx] = outX; edgeArr[eIdx + 1] = outY + 0.0008; edgeArr[eIdx + 2] = outZ;
        }
      }
    }

    posAttr.needsUpdate = true;
    geo.computeVertexNormals();
    edgeAttr.needsUpdate = true;
  }

  var nandGeom3D = {
    Wp_nm: 240, Wn_nm: 240, L_nm: 28,
    halfL: 1.0, wp3d: ACTIVE_W, wn3d: ACTIVE_W,
    pmosZC: PMOS_ZC, nmosZC: NMOS_ZC,
    gateAX: GATE_A_X, gateBX: GATE_B_X,
    leftX: LEFT_X, midX: MID_X, rightX: RIGHT_X, tapX: TAP_X,
    railZp: RAIL_Z, railZn: -RAIL_Z,
    subHalfW: 12.0, subHalfD: 12.5
  };
  window.getNandGeom3DState = function() { return nandGeom3D; };

  // Left [-7.0, -3.65] -> cx=-5.325, hx=1.675 ; Mid [-2.35, +2.35] -> cx=0, hx=2.35 ; Right [+3.65, +7.0] -> cx=+5.325, hx=1.675
  var nandLeftPerim  = buildNandWellShellPerimeter(-5.325, 1.675, ACTIVE_W * 0.5, 0.35);
  var nandMidPerim   = buildNandWellShellPerimeter( 0.000, 2.350, ACTIVE_W * 0.5, 0.35);
  var nandRightPerim = buildNandWellShellPerimeter( 5.325, 1.675, ACTIVE_W * 0.5, 0.35);

  var mp1SrcDeplEntry  = makeNandShellMesh(-5.325, PMOS_ZC, nandLeftPerim,  'left', true);
  var pmosDrnDeplEntry = makeNandShellMesh( 0.000, PMOS_ZC, nandMidPerim,   'mid', true);
  var mp2SrcDeplEntry  = makeNandShellMesh( 5.325, PMOS_ZC, nandRightPerim, 'right', true);
  var mn1SrcDeplEntry  = makeNandShellMesh(-5.325, NMOS_ZC, nandLeftPerim,  'left', false);
  var nmosMidDeplEntry = makeNandShellMesh( 0.000, NMOS_ZC, nandMidPerim,   'mid', false);
  var mn2DrnDeplEntry  = makeNandShellMesh( 5.325, NMOS_ZC, nandRightPerim, 'right', false);

  var mp1SrcDepl  = mp1SrcDeplEntry.mesh;
  var pmosDrnDepl = pmosDrnDeplEntry.mesh;
  var mp2SrcDepl  = mp2SrcDeplEntry.mesh;
  var mn1SrcDepl  = mn1SrcDeplEntry.mesh;
  var nmosMidDepl = nmosMidDeplEntry.mesh;
  var mn2DrnDepl  = mn2DrnDeplEntry.mesh;

  function makeNandGateDeplMesh(gateX, zc) {
    var gGeo = new THREE.BoxGeometry(1.0, 1.0, ACTIVE_W - 0.14, 24, 1, 2);
    var pos = gGeo.attributes.position;
    var initX = new Float32Array(pos.count);
    var initSignY = new Int8Array(pos.count);
    for (var k = 0; k < pos.count; k++) {
      initX[k] = pos.getX(k);
      initSignY[k] = pos.getY(k) >= 0 ? 1 : -1;
    }
    gGeo.userData.initialX = initX;
    gGeo.userData.initialSignY = initSignY;

    var m = new THREE.Mesh(gGeo, nandDeplMat.clone());
    m.position.set(gateX, Y.actTop, zc);
    m.renderOrder = 2;
    m.visible = false;
    m.userData.baseEmissive = nandDeplMat.emissive.getHex();
    m.userData.baseEmissiveIntensity = nandDeplMat.emissiveIntensity;
    m.userData.isSculptedDepletion = true;
    return registerMesh(m, 'depletion', 'depletion');
  }

  var mp1GateDepl = makeNandGateDeplMesh(GATE_A_X, PMOS_ZC);
  var mp2GateDepl = makeNandGateDeplMesh(GATE_B_X, PMOS_ZC);
  var mn1GateDepl = makeNandGateDeplMesh(GATE_A_X, NMOS_ZC);
  var mn2GateDepl = makeNandGateDeplMesh(GATE_B_X, NMOS_ZC);

  function updateNandGateCradle(mesh, gateX, gateDrive, vRev, drainDir, wLeftEdge, wRightEdge, chSpec) {
    if (!mesh) return;
    if (gateDrive <= 0.001) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    var hL = nandGeom3D.halfL;
    var subFrac = Math.min(1.0, Math.max(0, gateDrive / 0.40));
    var xLeftLocal = -hL * 0.65 + wLeftEdge * 0.85;
    var xRightLocal = Math.max(xLeftLocal + 0.12, hL * 0.65 - wRightEdge * 0.85);
    var gGeo = mesh.geometry;
    var pos = gGeo.attributes.position;
    var initX = gGeo.userData.initialX;
    var initSignY = gGeo.userData.initialSignY;

    for (var g = 0; g < pos.count; g++) {
      var gs = initX[g] + 0.5;
      var gx = xLeftLocal + gs * (xRightLocal - xLeftLocal);
      var worldX = gateX + gx;
      var cT = evalNandChanThickness(worldX, chSpec);
      var topY = (cT > 0.002) ? (-0.05 - cT * 0.5 - 0.004) : -0.004;
      var drainFrac = (drainDir === 1) ? gs : (1.0 - gs);
      var drainBias = nandDeplSmoothstep(0.15, 1.0, drainFrac);
      var pocketDepth = 0.24 * subFrac + 0.16 * vRev * drainBias;
      var botY = Math.max(-0.78, Math.min(topY - 0.01, -0.004 - pocketDepth));
      pos.setX(g, gx);
      pos.setY(g, initSignY[g] > 0 ? topY : botY);
    }
    pos.needsUpdate = true;
    gGeo.computeVertexNormals();
  }

  var _lastNandSt = { a: 'off', b: 'off', frozen: true, vout: 0.50, vthN: 0.30, vthP: 0.30, regions: {} };

  window.updateNandDepletion = function(st) {
    _lastNandSt = st || _lastNandSt;
    var hL = nandGeom3D.halfL;
    var fullL = hL * 2.0;
    var gAX = nandGeom3D.gateAX;
    var gBX = nandGeom3D.gateBX;
    var frozen = !st || st.frozen || st.a === 'off' || st.b === 'off';
    var va = frozen ? 0.50 : Number(st.a);
    var vb = frozen ? 0.50 : Number(st.b);
    var vout = frozen ? 0.50 : Number(st.vout);
    var vthN = (st && typeof st.vthN === 'number') ? st.vthN : 0.30;
    var vthP = (st && typeof st.vthP === 'number') ? st.vthP : 0.30;
    var regs = (st && st.regions) ? st.regions : {};
    var vx = (typeof regs.vx === 'number') ? regs.vx : (frozen ? 0.0 : (va <= vthN ? 0 : 0.5 * vout));
    var maxH = 0.12;

    var makeChSpec = function(gateX, vov, vd, regName, drainDir) {
      var hasChan = !frozen && vov > 0.001 && regName !== 'CUTOFF' && regName !== 'SUBTHRESHOLD';
      var isSat = hasChan && (regName === 'SATURATION') && (vd >= vov);
      return {
        gateX: gateX,
        hasChannel: hasChan,
        maxH: maxH,
        isSat: isSat,
        dL: isSat ? fullL * Math.min(0.40, 0.22 * Math.sqrt(Math.max(0, vd - vov))) : 0.0,
        ratio: (vov > 0.0001) ? Math.min(1.0, Math.max(0, vd / vov)) : 1.0,
        drainDir: drainDir
      };
    };

    var chMP1 = makeChSpec(gAX, Math.max(0, (1.00 - va) - vthP), Math.max(0, 1.00 - vout), regs.mp1, 1);
    var chMP2 = makeChSpec(gBX, Math.max(0, (1.00 - vb) - vthP), Math.max(0, 1.00 - vout), regs.mp2, -1);
    var chMN1 = makeChSpec(gAX, Math.max(0, va - vthN), Math.max(0, vx), regs.mn1, 1);
    var chMN2 = makeChSpec(gBX, Math.max(0, (vb - vx) - vthN), Math.max(0, vout - vx), regs.mn2, 1);

    var wBase = 0.14;
    var pmosDrnBulb = frozen ? 0.0 : 0.16 * Math.sqrt(Math.max(0, 1.00 - vout));
    var nmosMidBulb = frozen ? 0.0 : 0.14 * Math.sqrt(Math.max(0, vx));
    var nmosDrnBulb = frozen ? 0.0 : 0.18 * Math.sqrt(Math.max(0, vout - vx));

    updateNandWellShell(mp1SrcDeplEntry,  wBase, 0.0,         chMP1, null);
    updateNandWellShell(pmosDrnDeplEntry, wBase, pmosDrnBulb, chMP1, chMP2);
    updateNandWellShell(mp2SrcDeplEntry,  wBase, 0.0,         chMP2, null);

    updateNandWellShell(mn1SrcDeplEntry,  wBase, 0.0,         chMN1, null);
    updateNandWellShell(nmosMidDeplEntry, wBase, nmosMidBulb, chMN1, chMN2);
    updateNandWellShell(mn2DrnDeplEntry,  wBase, nmosDrnBulb, chMN2, null);

    updateNandGateCradle(mp1GateDepl, gAX, frozen ? 0 : Math.max(0, 1.00 - va), Math.sqrt(Math.max(0, 1.00 - vout)), 1, wBase, wBase + pmosDrnBulb * 0.75, chMP1);
    updateNandGateCradle(mp2GateDepl, gBX, frozen ? 0 : Math.max(0, 1.00 - vb), Math.sqrt(Math.max(0, 1.00 - vout)), -1, wBase + pmosDrnBulb * 0.75, wBase, chMP2);
    updateNandGateCradle(mn1GateDepl, gAX, frozen ? 0 : Math.max(0, va), Math.sqrt(Math.max(0, vx)), 1, wBase, wBase + nmosMidBulb * 0.75, chMN1);
    updateNandGateCradle(mn2GateDepl, gBX, frozen ? 0 : Math.max(0, vb - vx), Math.sqrt(Math.max(0, vout - vx)), 1, wBase + nmosMidBulb * 0.75, wBase + nmosDrnBulb * 0.75, chMN2);
  };

  // Initial equilibrium sculpted shells
  window.updateNandDepletion({ a: 'off', b: 'off', frozen: true, vout: 0.50, regions: {} });

  /* Gate Channel Inversion Layers under Gate A & Gate B */
  var isInitLight = document.documentElement.getAttribute('data-theme') === 'light';
  var palInitNAND = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isInitLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isInitLight ? 'light' : 'dark') : null);

  var pmosChanMat = new THREE.MeshStandardMaterial({
    color: palInitNAND ? palInitNAND.holeChannel : (isInitLight ? 0x60A5FA : 0x38BDF8),
    roughness: 0.40,
    metalness: 0.15,
    emissive: palInitNAND ? palInitNAND.holeChannel : (isInitLight ? 0x60A5FA : 0x38BDF8),
    emissiveIntensity: isInitLight ? 0.15 : 0.40,
    opacity: 0.85,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    clippingPlanes: activeClipPlanes
  });

  var nmosChanMat = new THREE.MeshStandardMaterial({
    color: palInitNAND ? palInitNAND.electronChannel : (isInitLight ? 0x4ADE80 : 0x34D399),
    roughness: 0.40,
    metalness: 0.15,
    emissive: palInitNAND ? palInitNAND.electronChannel : (isInitLight ? 0x4ADE80 : 0x34D399),
    emissiveIntensity: isInitLight ? 0.15 : 0.40,
    opacity: 0.85,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    clippingPlanes: activeClipPlanes
  });

  var chSpecs = [
    { id: 'chMP1', x: GATE_A_X, z: PMOS_ZC, mat: pmosChanMat, colorVar: '--c-sde-p' },
    { id: 'chMP2', x: GATE_B_X, z: PMOS_ZC, mat: pmosChanMat, colorVar: '--c-sde-p' },
    { id: 'chMN1', x: GATE_A_X, z: NMOS_ZC, mat: nmosChanMat, colorVar: '--c-sde-n' },
    { id: 'chMN2', x: GATE_B_X, z: NMOS_ZC, mat: nmosChanMat, colorVar: '--c-sde-n' }
  ];

  var nandChannelMeshes = {};
  var nandPinchMeshes = {};

  var pinchMat = new THREE.MeshStandardMaterial({
    color: isInitLight ? 0xb45309 : 0xf59e0b,
    roughness: 0.40,
    metalness: 0.15,
    emissive: 0xd97706,
    emissiveIntensity: 0.55,
    opacity: 0.85,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    clippingPlanes: activeClipPlanes
  });

  for (var chi = 0; chi < chSpecs.length; chi++) {
    var ch = chSpecs[chi];
    var chGeo = new THREE.BoxGeometry(2.0, 0.12, ACTIVE_W - 0.14, 24, 1, 2);
    var chMesh = new THREE.Mesh(chGeo, ch.mat.clone());
    chMesh.position.set(ch.x, Y.actTop - 0.05, ch.z);
    chMesh.renderOrder = 4;
    chMesh.userData.colorVar = ch.colorVar;
    registerMesh(chMesh, ch.id, 'active', { decorative: false });
    nandChannelMeshes[ch.id] = chMesh;

    var pGeo = new THREE.BoxGeometry(1.0, 0.12, ACTIVE_W - 0.14, 12, 1, 2);
    var pMesh = new THREE.Mesh(pGeo, pinchMat.clone());
    pMesh.position.set(ch.x, Y.actTop - 0.05, ch.z);
    pMesh.renderOrder = 4;
    pMesh.visible = false;
    registerMesh(pMesh, 'pinch_' + ch.id, 'active', { decorative: false });
    nandPinchMeshes[ch.id] = pMesh;
  }

  function updateNandChannelPhysics(chMesh, pinchMesh, gateX, vov, vd, isSat, drainDir, zcRow, wScaleZ) {
    if (!chMesh || !pinchMesh) return;
    if (vov <= 0.001) {
      chMesh.visible = false;
      pinchMesh.visible = false;
      return;
    }

    var hL = nandGeom3D.halfL;
    var fullL = hL * 2.0;

    chMesh.visible = true;
    chMesh.scale.set(1, 1, wScaleZ);
    chMesh.position.x = gateX;
    chMesh.position.z = zcRow;
    if (chMesh.userData && chMesh.userData.restPos) {
      chMesh.userData.restPos.x = gateX;
      chMesh.userData.restPos.z = zcRow;
    }

    var pos = chMesh.geometry.attributes.position;
    if (!chMesh.geometry.userData.initialX) {
      var initX = new Float32Array(pos.count);
      for (var k = 0; k < pos.count; k++) initX[k] = pos.getX(k);
      chMesh.geometry.userData.initialX = initX;
    }
    var initXArr = chMesh.geometry.userData.initialX;

    var maxH = 0.12;
    var vDiff = Math.max(0, vd - vov);
    var dL = isSat ? fullL * Math.min(0.40, 0.22 * Math.sqrt(vDiff)) : 0.0;
    var ratio = (vov > 0.0001) ? Math.min(1.0, Math.max(0, vd / vov)) : 1.0;

    for (var i = 0; i < pos.count; i++) {
      var origX = initXArr[i];
      var s = (drainDir === 1) ? ((origX + 1.0) / 2.0) : ((1.0 - origX) / 2.0);
      var mappedX, thickness;

      if (!isSat) {
        mappedX = origX * hL;
        thickness = maxH * Math.max(0.002, 1.0 - s * ratio);
      } else {
        mappedX = (drainDir === 1) ? (-hL + s * (fullL - dL)) : (hL - s * (fullL - dL));
        thickness = maxH * Math.max(0.002, 1.0 - s);
      }

      pos.setX(i, mappedX);
      var signY = pos.getY(i) >= 0 ? 1 : -1;
      pos.setY(i, (signY * thickness) / 2);
    }
    pos.needsUpdate = true;
    chMesh.geometry.computeVertexNormals();

    if (isSat && dL > 0.0005) {
      pinchMesh.visible = true;
      pinchMesh.scale.set(dL, 1, wScaleZ);
      var pxPos = gateX + (drainDir === 1 ? (hL - dL / 2) : -(hL - dL / 2));
      pinchMesh.position.x = pxPos;
      pinchMesh.position.z = zcRow;
      if (pinchMesh.userData && pinchMesh.userData.restPos) {
        pinchMesh.userData.restPos.x = pxPos;
        pinchMesh.userData.restPos.z = zcRow;
      }
    } else {
      pinchMesh.visible = false;
    }
  }

  // Dynamic channel updater called on logic state transitions
  window.updateNandChannels = function(st) {
    if (typeof window.updateNandDepletion === 'function') {
      window.updateNandDepletion(st);
    }
    if (!st || st.frozen || st.a === 'off' || st.b === 'off') {
      ['chMP1', 'chMP2', 'chMN1', 'chMN2'].forEach(function(id) {
        if (nandChannelMeshes[id]) nandChannelMeshes[id].visible = false;
        if (nandPinchMeshes[id]) nandPinchMeshes[id].visible = false;
      });
      return;
    }

    var regs = st.regions || {};
    var va = Number(st.a);
    var vb = Number(st.b);
    var vout = Number(st.vout);
    var vthN = (typeof st.vthN === 'number') ? st.vthN : 0.30;
    var vthP = (typeof st.vthP === 'number') ? st.vthP : 0.30;
    var vx = (typeof regs.vx === 'number') ? regs.vx : (va <= vthN ? 0 : 0.5 * vout);
    var gAX = nandGeom3D.gateAX, gBX = nandGeom3D.gateBX;
    var zcP = nandGeom3D.pmosZC, zcN = nandGeom3D.nmosZC;
    var wpScale = nandGeom3D.wp3d / ACTIVE_W;
    var wnScale = nandGeom3D.wn3d / ACTIVE_W;

    var vovP1 = Math.max(0, (1.00 - va) - vthP);
    var vsdP1 = 1.00 - vout;
    var isSatP1 = (regs.mp1 === 'SATURATION') && (vsdP1 >= vovP1);
    updateNandChannelPhysics(nandChannelMeshes['chMP1'], nandPinchMeshes['chMP1'], gAX, vovP1, vsdP1, isSatP1, 1, zcP, wpScale);

    var vovP2 = Math.max(0, (1.00 - vb) - vthP);
    var vsdP2 = 1.00 - vout;
    var isSatP2 = (regs.mp2 === 'SATURATION') && (vsdP2 >= vovP2);
    updateNandChannelPhysics(nandChannelMeshes['chMP2'], nandPinchMeshes['chMP2'], gBX, vovP2, vsdP2, isSatP2, -1, zcP, wpScale);

    var vovN1 = Math.max(0, va - vthN);
    var isSatN1 = (regs.mn1 === 'SATURATION') && (vx >= vovN1);
    updateNandChannelPhysics(nandChannelMeshes['chMN1'], nandPinchMeshes['chMN1'], gAX, vovN1, vx, isSatN1, 1, zcN, wnScale);

    var vovN2 = Math.max(0, (vb - vx) - vthN);
    var vdsN2 = Math.max(0, vout - vx);
    var isSatN2 = (regs.mn2 === 'SATURATION') && (vdsN2 >= vovN2);
    updateNandChannelPhysics(nandChannelMeshes['chMN2'], nandPinchMeshes['chMN2'], gBX, vovN2, vdsN2, isSatN2, 1, zcN, wnScale);
  };

  window.updateNandChannelThemes = function(theme) {
    var isLight = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light';
    var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
    ['chMP1', 'chMP2'].forEach(function(id) {
      var m = nandChannelMeshes[id];
      if (m && m.material) {
        var cP = pal ? pal.holeChannel : (isLight ? 0x60A5FA : 0x38BDF8);
        m.material.color.set(cP);
        m.material.emissive.set(cP);
        m.material.emissiveIntensity = isLight ? 0.15 : 0.40;
      }
    });
    ['chMN1', 'chMN2'].forEach(function(id) {
      var m = nandChannelMeshes[id];
      if (m && m.material) {
        var cN = pal ? pal.electronChannel : (isLight ? 0x4ADE80 : 0x34D399);
        m.material.color.set(cN);
        m.material.emissive.set(cN);
        m.material.emissiveIntensity = isLight ? 0.15 : 0.40;
      }
    });
  };

  /* 5. Gate Oxide (SiO2) & High-K (HfO2) (Sharp BoxGeometry, no outline) */
  var oxH = Y.oxideTop - Y.oxideBot;
  var oxMidY = (Y.oxideBot + Y.oxideTop) / 2;
  var hkH = Y.highkTop - Y.highkBot;
  var hkMidY = (Y.highkBot + Y.highkTop) / 2;

  var gateSiteSpecs = [
    { oxId: 'pmosAOxide', hkId: 'pmosAHighk', gate: 'A', isPmos: true,  x: GATE_A_X, z: PMOS_ZC },
    { oxId: 'pmosBOxide', hkId: 'pmosBHighk', gate: 'B', isPmos: true,  x: GATE_B_X, z: PMOS_ZC },
    { oxId: 'nmosAOxide', hkId: 'nmosAHighk', gate: 'A', isPmos: false, x: GATE_A_X, z: NMOS_ZC },
    { oxId: 'nmosBOxide', hkId: 'nmosBHighk', gate: 'B', isPmos: false, x: GATE_B_X, z: NMOS_ZC }
  ];

  var gateSiteRefs = [];
  for (var gi = 0; gi < gateSiteSpecs.length; gi++) {
    var gs = gateSiteSpecs[gi];
    var oxMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, oxH, ACTIVE_W),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(cssVar('--c-oxide')),
        roughness: 0.15,
        metalness: 0.00,
        emissive: 0x000000,
        emissiveIntensity: 0,
        opacity: 0.85,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: true,
        clippingPlanes: activeClipPlanes
      })
    );
    oxMesh.position.set(gs.x, oxMidY, gs.z);
    oxMesh.castShadow = true;
    oxMesh.receiveShadow = true;
    oxMesh.userData.colorVar = '--c-oxide';
    registerMesh(oxMesh, gs.oxId, 'oxide');

    var hkMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, hkH, ACTIVE_W),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(cssVar('--c-highk')),
        roughness: 0.12,
        metalness: 0.10,
        emissive: 0x000000,
        emissiveIntensity: 0,
        opacity: 0.78,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: true,
        clippingPlanes: activeClipPlanes
      })
    );
    hkMesh.position.set(gs.x, hkMidY, gs.z);
    hkMesh.castShadow = true;
    hkMesh.receiveShadow = true;
    hkMesh.userData.colorVar = '--c-highk';
    registerMesh(hkMesh, gs.hkId, 'highk');

    gateSiteRefs.push({ oxMesh: oxMesh, hkMesh: hkMesh, spec: gs });
  }

  /* 6. Dual Continuous Vertical Polysilicon Gates (A & B) (Sharp BoxGeometry, no outline) */
  var polyH = Y.polyTop - Y.polyBot;
  var polyMidY = (Y.polyBot + Y.polyTop) / 2;
  var polyD = 15.70; /* Z in [-7.85, +7.85] */

  var polySpecs = [
    { id: 'polyA', x: GATE_A_X },
    { id: 'polyB', x: GATE_B_X }
  ];
  var polyRefs = {};
  for (var pi = 0; pi < polySpecs.length; pi++) {
    var ps = polySpecs[pi];
    var polyGeo = new THREE.BoxGeometry(2.0, polyH, polyD);
    var polyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cssVar('--c-poly')),
      roughness: 0.45,
      metalness: 0.20,
      emissive: 0x000000,
      emissiveIntensity: 0,
      opacity: 1.0,
      transparent: false,
      side: THREE.FrontSide,
      depthWrite: true,
      clippingPlanes: activeClipPlanes
    });
    var polyMesh = new THREE.Mesh(polyGeo, polyMat);
    polyMesh.position.set(ps.x, polyMidY, 0);
    polyMesh.castShadow = true;
    polyMesh.receiveShadow = true;
    polyMesh.userData.colorVar = '--c-poly';
    registerMesh(polyMesh, ps.id, 'poly');
    polyRefs[ps.id] = polyMesh;
  }

  /* 6b. Gate Sidewall Spacers (Si3N4) - 8 spacers flush to scaled gate faces (±(halfL + w/2 + 0.002)) */
  var nandSpacerGap = 0.002;
  var nandSpacerW = 0.20;
  var nandSpacerBot = Y.oxideBot + 0.002;
  var nandSpacerH = Y.polyTop - nandSpacerBot;
  var nandSpacerMidY = (Y.polyTop + nandSpacerBot) / 2;
  var nandSpacerGeo = new THREE.BoxGeometry(nandSpacerW, nandSpacerH, ACTIVE_W);
  var nandSpacerEdges = new THREE.EdgesGeometry(nandSpacerGeo, 24);
  var nandSpacerMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    roughness: 0.45,
    metalness: 0.04,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -0.5,
    polygonOffsetUnits: -0.5,
    side: THREE.DoubleSide,
    clippingPlanes: activeClipPlanes
  });
  var nandSpacerEdgeMat = new THREE.LineBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  var spacerOffset = 1.0 + nandSpacerGap + nandSpacerW / 2; // 1.102 from gate center
  var spacerConfigs = [
    { gate: 'A', side: -1, x: GATE_A_X - spacerOffset },
    { gate: 'A', side:  1, x: GATE_A_X + spacerOffset },
    { gate: 'B', side: -1, x: GATE_B_X - spacerOffset },
    { gate: 'B', side:  1, x: GATE_B_X + spacerOffset }
  ];
  var spacerRefs = [];
  [PMOS_ZC, NMOS_ZC].forEach(function(zcRow, rIdx) {
    spacerConfigs.forEach(function(cfg) {
      var sp = new THREE.Mesh(nandSpacerGeo, nandSpacerMat);
      sp.position.set(cfg.x, nandSpacerMidY, zcRow);
      sp.renderOrder = 6;
      var el = new THREE.LineSegments(nandSpacerEdges, nandSpacerEdgeMat);
      el.raycast = function() {};
      sp.add(el);
      registerMesh(sp, 'spacer', 'spacer');
      spacerRefs.push({ mesh: sp, isPmos: rIdx === 0, gate: cfg.gate, side: cfg.side });
    });
  });

  /* 6c. Self-Aligned Silicide (Salicide / NiSi) Contact Pads */
  var silHNand = Y.silTop - Y.silBot;
  var silMidYNand = (Y.silTop + Y.silBot) / 2;

  function createNandSalicideGeo(w, h, d, outerDir) {
    var hw = w / 2, hd = d / 2;
    var rIn = outerDir === 0 ? 0.01 : 0.01;
    var rOut = outerDir === 0 ? 0.01 : Math.min(0.35, hw * 0.45, hd * 0.45);
    var rLeft = outerDir < 0 ? rOut : rIn;
    var rRight = outerDir > 0 ? rOut : rIn;
    var bevel = 0.006;
    var shape = new THREE.Shape();
    shape.moveTo(-hw + rLeft, -hd);
    shape.lineTo(hw - rRight, -hd);
    shape.quadraticCurveTo(hw, -hd, hw, -hd + rRight);
    shape.lineTo(hw, hd - rRight);
    shape.quadraticCurveTo(hw, hd, hw - rRight, hd);
    shape.lineTo(-hw + rLeft, hd);
    shape.quadraticCurveTo(-hw, hd, -hw, hd - rLeft);
    shape.lineTo(-hw, -hd + rLeft);
    shape.quadraticCurveTo(-hw, -hd, -hw + rLeft, -hd);
    var geo = new THREE.ExtrudeGeometry(shape, {
      steps: 1, depth: Math.max(0.002, h - bevel * 2),
      bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: 0, bevelSegments: 1
    });
    geo.rotateX(Math.PI / 2);
    geo.center();
    return geo;
  }

  window.silMatNand = new THREE.MeshStandardMaterial({
    color: isInitLight ? 0x647082 : 0x6e7887,
    roughness: 0.28,
    metalness: 0.80,
    roughnessMap: getBrushedMetalTexture(),
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -1.5,
    emissive: 0x000000,
    emissiveIntensity: 0,
    clippingPlanes: activeClipPlanes
  });
  var silMatNand = window.silMatNand;

  function addNandSilicide(geo, xPos, zPos) {
    var m = new THREE.Mesh(geo, silMatNand);
    m.position.set(xPos, silMidYNand, zPos);
    m.castShadow = true;
    m.receiveShadow = true;
    m.renderOrder = 5;
    var el = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo, 24),
      new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.45, depthWrite: false })
    );
    el.raycast = function() {};
    m.add(el);
    return registerMesh(m, 'silicide', 'silicide');
  }

  var outerSilW = 6.96 - 4.206; // 2.754
  var outerSilCX = (6.96 + 4.206) / 2; // 5.583
  var midSilW = 1.792 * 2; // 3.584 (strictly between mid spacers ±1.798)

  var silRefs = {};
  [PMOS_ZC, NMOS_ZC].forEach(function(zcRow, rIdx) {
    var kRow = rIdx === 0 ? 'pmos' : 'nmos';
    silRefs[kRow + 'Left']  = addNandSilicide(createNandSalicideGeo(outerSilW, silHNand, ACTIVE_W, -1), -outerSilCX, zcRow);
    silRefs[kRow + 'Mid']   = addNandSilicide(createNandSalicideGeo(midSilW, silHNand, ACTIVE_W, 0), MID_X, zcRow);
    silRefs[kRow + 'Right'] = addNandSilicide(createNandSalicideGeo(outerSilW, silHNand, ACTIVE_W, 1), outerSilCX, zcRow);
    silRefs[kRow + 'Tap']   = addNandSilicide(createFilletedTraceGeometry(1.12, silHNand, 1.12, 0.20, 0.006), TAP_X, zcRow);
  });

  /* 7. 9 Tapered Tungsten Contacts (land flush atop NiSi pads) */
  var ctRefs = {
    welltap:       contactAt('welltapCt', TAP_X, PMOS_ZC, Y.silTop),
    pmosASrc:      contactAt('pmosASrcCt', LEFT_X, PMOS_ZC, Y.silTop),
    pmosSharedDrn: contactAt('pmosSharedDrnCt', MID_X, PMOS_ZC, Y.silTop),
    pmosBSrc:      contactAt('pmosBSrcCt', RIGHT_X, PMOS_ZC, Y.silTop),
    subtap:        contactAt('subtapCt', TAP_X, NMOS_ZC, Y.silTop),
    nmosASrc:      contactAt('nmosASrcCt', LEFT_X, NMOS_ZC, Y.silTop),
    nmosBDrn:      contactAt('nmosBDrnCt', RIGHT_X, NMOS_ZC, Y.silTop),
    polyA:         contactAt('polyACt', GATE_A_X, 0.8, Y.polyTop),
    polyB:         contactAt('polyBCt', GATE_B_X, -0.8, Y.polyTop)
  };

  /* 8. Planar Zero-Crossing Metal-1 Interconnects */
  function addMetalTrace(id, x, z, w, d, colorVar) {
    var geo = createFilletedTraceGeometry(w, metalH, d, 0.15, 0.02);
    var m = new THREE.Mesh(geo, makeMetalMaterial(colorVar));
    m.position.set(x, metalMidY, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.colorVar = colorVar;
    m.userData.baseW = w;
    m.userData.baseD = d;
    return registerMesh(m, id, 'metal');
  }

  function addViaPad(id, x, z, colorVar) {
    var geo = createOctagonalViaPadGeometry(0.75, metalH + 0.002, 0.15, 0.02);
    var mat = makeMetalMaterial(colorVar);
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, metalMidY, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.colorVar = colorVar;
    return registerMesh(m, id, 'metal');
  }

  function addTJunction(id, branchDir, x, z, colorVar) {
    var geo = createChamferedTJunctionGeometry(branchDir, METAL_W, METAL_W, 0.15, metalH + 0.002, 0.02);
    var mat = makeMetalMaterial(colorVar);
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = -1;
    mat.polygonOffsetUnits = -1;
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, metalMidY, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.colorVar = colorVar;
    return registerMesh(m, id, 'metal');
  }

  var metalRefs = {
    /* VDD Rail & 3 Stubs */
    vddRail:      addMetalTrace('vddRail', -0.5, RAIL_Z, 22.0, METAL_W, '--c-vdd'),
    vddStubTap:   addMetalTrace('vddStubTap', TAP_X, (PMOS_ZC + RAIL_Z) / 2, METAL_W, RAIL_Z - PMOS_ZC, '--c-vdd'),
    vddStubPmosA: addMetalTrace('vddStubPmosA', LEFT_X, (PMOS_ZC + RAIL_Z) / 2, METAL_W, RAIL_Z - PMOS_ZC, '--c-vdd'),
    vddStubPmosB: addMetalTrace('vddStubPmosB', RIGHT_X, (PMOS_ZC + RAIL_Z) / 2, METAL_W, RAIL_Z - PMOS_ZC, '--c-vdd'),
    jVddTap:      addTJunction('vddRail', '-z', TAP_X, RAIL_Z, '--c-vdd'),
    jVddPmosA:    addTJunction('vddRail', '-z', LEFT_X, RAIL_Z, '--c-vdd'),
    jVddPmosB:    addTJunction('vddRail', '-z', RIGHT_X, RAIL_Z, '--c-vdd'),
    padVddTap:    addViaPad('vddStubTap', TAP_X, PMOS_ZC, '--c-vdd'),
    padVddPmosA:  addViaPad('vddStubPmosA', LEFT_X, PMOS_ZC, '--c-vdd'),
    padVddPmosB:  addViaPad('vddStubPmosB', RIGHT_X, PMOS_ZC, '--c-vdd'),

    /* GND Rail & 2 Stubs */
    gndRail:      addMetalTrace('gndRail', -0.5, -RAIL_Z, 22.0, METAL_W, '--c-gnd'),
    gndStubTap:   addMetalTrace('gndStubTap', TAP_X, (NMOS_ZC - RAIL_Z) / 2, METAL_W, RAIL_Z + NMOS_ZC, '--c-gnd'),
    gndStubNmosA: addMetalTrace('gndStubNmosA', LEFT_X, (NMOS_ZC - RAIL_Z) / 2, METAL_W, RAIL_Z + NMOS_ZC, '--c-gnd'),
    jGndTap:      addTJunction('gndRail', '+z', TAP_X, -RAIL_Z, '--c-gnd'),
    jGndNmosA:    addTJunction('gndRail', '+z', LEFT_X, -RAIL_Z, '--c-gnd'),
    padGndTap:    addViaPad('gndStubTap', TAP_X, NMOS_ZC, '--c-gnd'),
    padGndNmosA:  addViaPad('gndStubNmosA', LEFT_X, NMOS_ZC, '--c-gnd'),

    /* Input A & Input B */
    inAPin:       addMetalTrace('inAPin', -7.25, 0.8, 8.5, METAL_W, '--c-in'),
    padInA:       addViaPad('inAPin', GATE_A_X, 0.8, '--c-in'),
    inBPin:       addMetalTrace('inBPin', -4.25, -0.8, 14.5, METAL_W, '--c-in'),
    padInB:       addViaPad('inBPin', GATE_B_X, -0.8, '--c-in'),

    /* Output Net (OUT) */
    outPmosBranch: addMetalTrace('outPmosBranch', MID_X, 2.7125, METAL_W, 4.275, '--c-out'),
    padOutPmos:    addViaPad('outPmosBranch', MID_X, PMOS_ZC, '--c-out'),
    outSpine:      addMetalTrace('outSpine', 2.6375, 0.8, 5.725, METAL_W, '--c-out'),
    outNmosBranch: addMetalTrace('outNmosBranch', RIGHT_X, -2.025, METAL_W, 5.65, '--c-out'),
    padOutNmos:    addViaPad('outNmosBranch', RIGHT_X, NMOS_ZC, '--c-out'),
    jOutNmos:      addTJunction('outNmosBranch', '-z', RIGHT_X, 0.8, '--c-out'),
    outPin:        addMetalTrace('outPin', 8.0, 0.8, 5.0, METAL_W, '--c-out')
  };

  /* 9. 3D Floating Callouts (Perimeter bulk + staggered elevations + subtle leader lines) */
  function updateNandLabelPlacement(lbl, x, y, z, ax, ay, az) {
    if (!lbl) return;
    lbl.position.set(x, y, z);
    if (lbl.userData && lbl.userData.restPos) lbl.userData.restPos.set(x, y, z);
    var line = lbl.userData && lbl.userData.leaderLine;
    if (line) {
      line.position.set(x, y, z);
      if (line.userData && line.userData.restPos) line.userData.restPos.set(x, y, z);
      if (line.geometry && typeof line.geometry.setFromPoints === 'function') {
        line.geometry.setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(ax - x, ay - y, az - z)
        ]);
      }
    }
  }

  var lblRefs = {
    vdd:   addLabel('VDD', -10.8, Y.metalTop + 0.70, RAIL_Z + 0.95, 'metal', '#e35d5d', { anchor: [-10.2, Y.metalTop, RAIL_Z] }),
    gnd:   addLabel('GND', -10.8, Y.metalTop + 0.70, -RAIL_Z - 0.95, 'metal', '#9aa6b6', { anchor: [-10.2, Y.metalTop, -RAIL_Z] }),
    inA:   addLabel('IN A', -10.8, Y.metalTop + 0.85, 1.85, 'metal', '#e6c94a', { anchor: [-10.0, Y.metalTop, 1.55] }),
    inB:   addLabel('IN B', -10.8, Y.metalTop + 0.85, -1.85, 'metal', '#e6c94a', { anchor: [-10.0, Y.metalTop, -1.55] }),
    out:   addLabel('OUT', 10.2, Y.metalTop + 0.85, 0.80, 'metal', '#57cf8f', { anchor: [9.8, Y.metalTop, 0.80] }),

    nwell: addLabel('N-WELL', 7.6, Y.wellTop + 0.90, 8.65, 'well', '#4ade80', { anchor: [7.4, Y.wellTop, 8.30] }),
    pwell: addLabel('P-WELL', 7.6, Y.wellTop + 0.90, -8.65, 'well', '#60a5fa', { anchor: [7.4, Y.wellTop, -8.30] }),
    psub:  addLabel('P-SUBSTRATE', 9.5, Y.subTop + 0.55, -11.4, 'substrate', '#9aa6b6', { anchor: [9.5, Y.subTop, -11.4] }),

    polyA: addLabel('POLY A', GATE_A_X - 0.3, Y.polyTop + 1.15, -8.55, 'poly', '#d8503c', { anchor: [GATE_A_X, Y.polyTop, -7.8] }),
    polyB: addLabel('POLY B', GATE_B_X + 0.3, Y.polyTop + 1.15, -8.55, 'poly', '#d8503c', { anchor: [GATE_B_X, Y.polyTop, -7.8] }),

    mp1:   addLabel('PMOS A (MP1)', -6.0, Y.actTop + 1.25, 5.20, 'active', '#60a5fa', { anchor: [LEFT_X, Y.actTop, PMOS_ZC] }),
    mp2:   addLabel('PMOS B (MP2)',  6.0, Y.actTop + 1.25, 5.20, 'active', '#60a5fa', { anchor: [RIGHT_X, Y.actTop, PMOS_ZC] }),
    mn1:   addLabel('NMOS A (MN1)', -6.0, Y.actTop + 1.25, -5.20, 'active', '#4ade80', { anchor: [LEFT_X, Y.actTop, NMOS_ZC] }),
    mn2:   addLabel('NMOS B (MN2)',  6.0, Y.actTop + 1.25, -5.20, 'active', '#4ade80', { anchor: [RIGHT_X, Y.actTop, NMOS_ZC] }),

    shP:   addLabel('SHARED P+ DRAIN',  MID_X, Y.actTop + 2.25, 6.20, 'active', '#60a5fa', { anchor: [MID_X, Y.actTop, PMOS_ZC + 0.6] }),
    shN:   addLabel('SERIES N+ BRIDGE', MID_X, Y.actTop + 2.25, -5.00, 'active', '#4ade80', { anchor: [MID_X, Y.actTop, NMOS_ZC] }),
    depl:  addLabel('DEPLETION', 3.3, Y.actTop + 1.85, 2.30, 'depletion', '#94a3b8', { anchor: [2.1, Y.actTop - 0.05, 2.4] }),

    psde:  addLabel('P-SDE', -3.925, Y.actTop + 1.65, 2.15, 'sde', '#93c5fd', { explodeLayer: 'active', anchor: [-3.925, Y.actTop, 2.40] }),
    nsde:  addLabel('N-SDE', -3.925, Y.actTop + 1.65, -2.15, 'sde', '#86efac', { explodeLayer: 'active', anchor: [-3.925, Y.actTop, -2.40] }),
    oxide: addLabel('SiO2 OXIDE', GATE_A_X, Y.oxideTop + 2.55, 4.00, 'oxide', '#8fc9dc', { anchor: [GATE_A_X, Y.oxideTop, 3.30] }),
    highk: addLabel('HIGH-K (HfO2)', GATE_B_X, Y.highkTop + 2.65, 4.00, 'highk', '#c084fc', { anchor: [GATE_B_X, Y.highkTop, 3.30] })
  };

  function setMeshRest(m, x, y, z, sx, sy, sz) {
    if (!m) return;
    if (sx !== undefined) m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    if (m.userData && m.userData.restPos) m.userData.restPos.set(x, y, z);
  }

  /* Dynamic 3D NAND2 Geometry Deformation (Wp, Wn, L) preserving 4.0-unit inner bridge & restPos */
  window.updateNandGeometry3D = function(Wp_nm, Wn_nm, L_nm) {
    var wP = typeof Wp_nm === 'number' ? Wp_nm : 240;
    var wN = typeof Wn_nm === 'number' ? Wn_nm : 240;
    var lN = typeof L_nm === 'number' ? L_nm : 28;

    var hL = 1.0 * Math.pow(Math.max(18, lN) / 28.0, 0.50);
    var dH = hL - 1.0;
    var wp3d = ACTIVE_W * Math.pow(Math.max(40, wP) / 240.0, 0.48);
    var wn3d = ACTIVE_W * Math.pow(Math.max(40, wN) / 240.0, 0.48);

    // Fix inner active edges at ±1.85 to preserve 1.90 central P-substrate corridor [-0.95, +0.95]
    var zcP = 1.85 + wp3d * 0.5;
    var zcN = -(1.85 + wn3d * 0.5);

    // Fix inner bridge [-2.0, +2.0] and shift Gate A / Gate B / outer S/D / tap outward symmetrically
    var gAX = -(2.0 + hL);
    var gBX = +(2.0 + hL);
    var leftX = -(3.5 + 2.0 * hL);
    var rightX = +(3.5 + 2.0 * hL);
    var tapX = -(7.0 + 2.0 * hL);

    var polyZ0 = zcN - wn3d * 0.5;
    var polyZ1 = zcP + wp3d * 0.5;
    var railZp = zcP + wp3d * 0.5 + 1.60;
    var railZn = -(Math.abs(zcN) + wn3d * 0.5 + 1.60);

    var wpScale = wp3d / ACTIVE_W;
    var wnScale = wn3d / ACTIVE_W;
    var lScale = hL / 1.0;

    var newWellW = wellW + 4.0 * Math.max(0, dH);
    var newWellDP = wp3d + 1.80;
    var newWellDN = wn3d + 1.80;
    var newSubW = Math.max(24.0, 24.0 + 4.4 * Math.max(0, dH));
    var newSubD = Math.max(25.0, (Math.max(railZp, -railZn) + 3.0) * 2.0);

    nandGeom3D.Wp_nm = wP;
    nandGeom3D.Wn_nm = wN;
    nandGeom3D.L_nm = lN;
    nandGeom3D.halfL = hL;
    nandGeom3D.wp3d = wp3d;
    nandGeom3D.wn3d = wn3d;
    nandGeom3D.pmosZC = zcP;
    nandGeom3D.nmosZC = zcN;
    nandGeom3D.gateAX = gAX;
    nandGeom3D.gateBX = gBX;
    nandGeom3D.leftX = leftX;
    nandGeom3D.midX = 0.0;
    nandGeom3D.rightX = rightX;
    nandGeom3D.tapX = tapX;
    nandGeom3D.railZp = railZp;
    nandGeom3D.railZn = railZn;
    nandGeom3D.subHalfW = newSubW * 0.5;
    nandGeom3D.subHalfD = newSubD * 0.5;

    // 1. Substrate & Twin Wells
    setMeshRest(psub, -0.5, (Y.subBot + Y.subTop) / 2, 0, newSubW / 24.0, 1, newSubD / 25.0);
    setMeshRest(nwell, wellX, wellMidY, zcP, newWellW / wellW, 1, newWellDP / wellD);
    setMeshRest(pwell, wellX, wellMidY, zcN, newWellW / wellW, 1, newWellDN / wellD);

    // 2. Body Taps & 6 Active Diffusions
    setMeshRest(welltapAct, tapX, actMidY, zcP, 1, 1, 1);
    setMeshRest(subtapAct, tapX, actMidY, zcN, 1, 1, 1);
    setMeshRest(pmosASrc, leftX, actMidY, zcP, 1, 1, wpScale);
    setMeshRest(pmosSharedDrn, 0.0, actMidY, zcP, 1, 1, wpScale);
    setMeshRest(pmosBSrc, rightX, actMidY, zcP, 1, 1, wpScale);
    setMeshRest(nmosASrc, leftX, actMidY, zcN, 1, 1, wnScale);
    setMeshRest(nmosMidNode, 0.0, actMidY, zcN, 1, 1, wnScale);
    setMeshRest(nmosBDrn, rightX, actMidY, zcN, 1, 1, wnScale);

    // 3. 8 SDE Extensions (inner ±2.075 fixed; outer ±(2.0 + 2*hL - 0.075))
    var outerSdeMag = 2.0 + 2.0 * hL - 0.075;
    var sdeScaleP = (wp3d - 0.1) / (ACTIVE_W - 0.1);
    var sdeScaleN = (wn3d - 0.1) / (ACTIVE_W - 0.1);
    for (var si = 0; si < sdeRefs.length; si++) {
      var sr = sdeRefs[si];
      var gxBase = sr.spec.gate === 'A' ? gAX : gBX;
      var sX = gxBase + sr.spec.side * (hL - 0.075);
      var sZ = sr.spec.isPmos ? zcP : zcN;
      setMeshRest(sr.mesh, sX, sdeMidY, sZ, 1, 1, sr.spec.isPmos ? sdeScaleP : sdeScaleN);
    }

    // 4. Dielectrics & Dual Poly Gates
    for (var gi = 0; gi < gateSiteRefs.length; gi++) {
      var gr = gateSiteRefs[gi];
      var gX = gr.spec.gate === 'A' ? gAX : gBX;
      var gZ = gr.spec.isPmos ? zcP : zcN;
      var gScaleZ = gr.spec.isPmos ? wpScale : wnScale;
      setMeshRest(gr.oxMesh, gX, oxMidY, gZ, lScale, 1, gScaleZ);
      setMeshRest(gr.hkMesh, gX, hkMidY, gZ, lScale, 1, gScaleZ);
    }
    setMeshRest(polyRefs.polyA, gAX, polyMidY, (polyZ0 + polyZ1) / 2, lScale, 1, (polyZ1 - polyZ0) / polyD);
    setMeshRest(polyRefs.polyB, gBX, polyMidY, (polyZ0 + polyZ1) / 2, lScale, 1, (polyZ1 - polyZ0) / polyD);

    // 5. 8 Flush Sidewall Spacers (anchored dynamics: ±(hL + w/2 + 0.002))
    var spOff = hL + nandSpacerW * 0.5 + nandSpacerGap;
    for (var k = 0; k < spacerRefs.length; k++) {
      var rec = spacerRefs[k];
      var baseG = rec.gate === 'A' ? gAX : gBX;
      setMeshRest(rec.mesh, baseG + rec.side * spOff, nandSpacerMidY, rec.isPmos ? zcP : zcN, 1, 1, rec.isPmos ? wpScale : wnScale);
    }

    // 6. Self-Aligned Silicide Pads (strictly clear of spacers)
    var outerSilMid = 3.584 + 2.0 * hL;
    setMeshRest(silRefs.pmosLeft,  -outerSilMid, silMidYNand, zcP, 1, 1, wpScale);
    setMeshRest(silRefs.pmosMid,   0.0,          silMidYNand, zcP, 1, 1, wpScale);
    setMeshRest(silRefs.pmosRight,  outerSilMid, silMidYNand, zcP, 1, 1, wpScale);
    setMeshRest(silRefs.pmosTap,   tapX,         silMidYNand, zcP, 1, 1, 1);

    setMeshRest(silRefs.nmosLeft,  -outerSilMid, silMidYNand, zcN, 1, 1, wnScale);
    setMeshRest(silRefs.nmosMid,   0.0,          silMidYNand, zcN, 1, 1, wnScale);
    setMeshRest(silRefs.nmosRight,  outerSilMid, silMidYNand, zcN, 1, 1, wnScale);
    setMeshRest(silRefs.nmosTap,   tapX,         silMidYNand, zcN, 1, 1, 1);

    // 7. 9 Tungsten Plug Contacts
    setMeshRest(ctRefs.welltap,       tapX,   ctRefs.welltap.position.y,       zcP);
    setMeshRest(ctRefs.pmosASrc,      leftX,  ctRefs.pmosASrc.position.y,      zcP);
    setMeshRest(ctRefs.pmosSharedDrn, 0.0,    ctRefs.pmosSharedDrn.position.y, zcP);
    setMeshRest(ctRefs.pmosBSrc,      rightX, ctRefs.pmosBSrc.position.y,      zcP);
    setMeshRest(ctRefs.subtap,        tapX,   ctRefs.subtap.position.y,        zcN);
    setMeshRest(ctRefs.nmosASrc,      leftX,  ctRefs.nmosASrc.position.y,      zcN);
    setMeshRest(ctRefs.nmosBDrn,      rightX, ctRefs.nmosBDrn.position.y,      zcN);
    setMeshRest(ctRefs.polyA,         gAX,    ctRefs.polyA.position.y,         0.8);
    setMeshRest(ctRefs.polyB,         gBX,    ctRefs.polyB.position.y,         -0.8);

    // 8. Metal-1 Rails, Stubs, Vias, T-Junctions
    var railW = Math.max(22.0, 22.0 + 4.4 * Math.max(0, dH));
    setMeshRest(metalRefs.vddRail,      -0.5, metalMidY, railZp, railW / 22.0, 1, 1);
    setMeshRest(metalRefs.vddStubTap,   tapX, metalMidY, (zcP + railZp) / 2, 1, 1, Math.max(0.2, railZp - zcP) / metalRefs.vddStubTap.userData.baseD);
    setMeshRest(metalRefs.vddStubPmosA, leftX, metalMidY, (zcP + railZp) / 2, 1, 1, Math.max(0.2, railZp - zcP) / metalRefs.vddStubPmosA.userData.baseD);
    setMeshRest(metalRefs.vddStubPmosB, rightX, metalMidY, (zcP + railZp) / 2, 1, 1, Math.max(0.2, railZp - zcP) / metalRefs.vddStubPmosB.userData.baseD);
    setMeshRest(metalRefs.jVddTap,      tapX, metalMidY, railZp);
    setMeshRest(metalRefs.jVddPmosA,    leftX, metalMidY, railZp);
    setMeshRest(metalRefs.jVddPmosB,    rightX, metalMidY, railZp);
    setMeshRest(metalRefs.padVddTap,    tapX, metalMidY, zcP);
    setMeshRest(metalRefs.padVddPmosA,  leftX, metalMidY, zcP);
    setMeshRest(metalRefs.padVddPmosB,  rightX, metalMidY, zcP);

    setMeshRest(metalRefs.gndRail,      -0.5, metalMidY, railZn, railW / 22.0, 1, 1);
    setMeshRest(metalRefs.gndStubTap,   tapX, metalMidY, (zcN + railZn) / 2, 1, 1, Math.max(0.2, zcN - railZn) / metalRefs.gndStubTap.userData.baseD);
    setMeshRest(metalRefs.gndStubNmosA, leftX, metalMidY, (zcN + railZn) / 2, 1, 1, Math.max(0.2, zcN - railZn) / metalRefs.gndStubNmosA.userData.baseD);
    setMeshRest(metalRefs.jGndTap,      tapX, metalMidY, railZn);
    setMeshRest(metalRefs.jGndNmosA,    leftX, metalMidY, railZn);
    setMeshRest(metalRefs.padGndTap,    tapX, metalMidY, zcN);
    setMeshRest(metalRefs.padGndNmosA,  leftX, metalMidY, zcN);

    var inStartX = tapX - 2.5; // -11.5 at L=28
    setMeshRest(metalRefs.inAPin, (inStartX + gAX) / 2, metalMidY, 0.8, (gAX - inStartX) / metalRefs.inAPin.userData.baseW, 1, 1);
    setMeshRest(metalRefs.padInA, gAX, metalMidY, 0.8);
    setMeshRest(metalRefs.inBPin, (inStartX + gBX) / 2, metalMidY, -0.8, (gBX - inStartX) / metalRefs.inBPin.userData.baseW, 1, 1);
    setMeshRest(metalRefs.padInB, gBX, metalMidY, -0.8);

    setMeshRest(metalRefs.outPmosBranch, 0.0, metalMidY, (0.575 + zcP) / 2, 1, 1, Math.max(0.4, zcP - 0.575) / metalRefs.outPmosBranch.userData.baseD);
    setMeshRest(metalRefs.padOutPmos, 0.0, metalMidY, zcP);
    setMeshRest(metalRefs.outSpine, (rightX - 0.225) / 2, metalMidY, 0.8, (rightX + 0.225) / metalRefs.outSpine.userData.baseW, 1, 1);
    setMeshRest(metalRefs.outNmosBranch, rightX, metalMidY, (0.80 + zcN) / 2, 1, 1, Math.max(0.5, 0.80 - zcN) / metalRefs.outNmosBranch.userData.baseD);
    setMeshRest(metalRefs.padOutNmos, rightX, metalMidY, zcN);
    setMeshRest(metalRefs.jOutNmos, rightX, metalMidY, 0.8);
    setMeshRest(metalRefs.outPin, rightX + 2.5, metalMidY, 0.8);

    // 9. Depletion Shells & Gate Cradles
    var leftDeplCX = -(3.325 + 2.0 * hL); // -5.325 at hL=1
    var rightDeplCX = +(3.325 + 2.0 * hL);
    mp1SrcDeplEntry.perim  = buildNandWellShellPerimeter(leftDeplCX,  1.675, wp3d * 0.5, 0.35);
    pmosDrnDeplEntry.perim = buildNandWellShellPerimeter(0.0,         2.350, wp3d * 0.5, 0.35);
    mp2SrcDeplEntry.perim  = buildNandWellShellPerimeter(rightDeplCX, 1.675, wp3d * 0.5, 0.35);
    mn1SrcDeplEntry.perim  = buildNandWellShellPerimeter(leftDeplCX,  1.675, wn3d * 0.5, 0.35);
    nmosMidDeplEntry.perim = buildNandWellShellPerimeter(0.0,         2.350, wn3d * 0.5, 0.35);
    mn2DrnDeplEntry.perim  = buildNandWellShellPerimeter(rightDeplCX, 1.675, wn3d * 0.5, 0.35);

    setMeshRest(mp1SrcDepl,  leftDeplCX,  Y.actTop, zcP);
    setMeshRest(pmosDrnDepl, 0.0,         Y.actTop, zcP);
    setMeshRest(mp2SrcDepl,  rightDeplCX, Y.actTop, zcP);
    setMeshRest(mn1SrcDepl,  leftDeplCX,  Y.actTop, zcN);
    setMeshRest(nmosMidDepl, 0.0,         Y.actTop, zcN);
    setMeshRest(mn2DrnDepl,  rightDeplCX, Y.actTop, zcN);

    var gateDeplScaleP = (wp3d - 0.14) / (ACTIVE_W - 0.14);
    var gateDeplScaleN = (wn3d - 0.14) / (ACTIVE_W - 0.14);
    setMeshRest(mp1GateDepl, gAX, Y.actTop, zcP, 1, 1, gateDeplScaleP);
    setMeshRest(mp2GateDepl, gBX, Y.actTop, zcP, 1, 1, gateDeplScaleP);
    setMeshRest(mn1GateDepl, gAX, Y.actTop, zcN, 1, 1, gateDeplScaleN);
    setMeshRest(mn2GateDepl, gBX, Y.actTop, zcN, 1, 1, gateDeplScaleN);

    // 10. 3D Floating Labels & Leader Lines
    updateNandLabelPlacement(lblRefs.vdd, -10.8, Y.metalTop + 0.70, railZp + 0.95, -10.2, Y.metalTop, railZp);
    updateNandLabelPlacement(lblRefs.gnd, -10.8, Y.metalTop + 0.70, railZn - 0.95, -10.2, Y.metalTop, railZn);
    updateNandLabelPlacement(lblRefs.inA, inStartX + 0.7, Y.metalTop + 0.85, 1.85, inStartX + 1.5, Y.metalTop, 1.55);
    updateNandLabelPlacement(lblRefs.inB, inStartX + 0.7, Y.metalTop + 0.85, -1.85, inStartX + 1.5, Y.metalTop, -1.55);
    updateNandLabelPlacement(lblRefs.out, rightX + 4.7, Y.metalTop + 0.85, 0.80, rightX + 4.3, Y.metalTop, 0.80);

    updateNandLabelPlacement(lblRefs.nwell, 7.6 + dH * 1.5, Y.wellTop + 0.90, zcP + wp3d * 0.5 + 0.80, 7.4 + dH * 1.5, Y.wellTop, zcP + wp3d * 0.5 + 0.45);
    updateNandLabelPlacement(lblRefs.pwell, 7.6 + dH * 1.5, Y.wellTop + 0.90, zcN - wn3d * 0.5 - 0.80, 7.4 + dH * 1.5, Y.wellTop, zcN - wn3d * 0.5 - 0.45);
    updateNandLabelPlacement(lblRefs.psub, 9.5 + dH * 1.5, Y.subTop + 0.55, -(newSubD * 0.5 - 1.1), 9.5 + dH * 1.5, Y.subTop, -(newSubD * 0.5 - 1.1));

    updateNandLabelPlacement(lblRefs.polyA, gAX - 0.3, Y.polyTop + 1.15, zcN - wn3d * 0.5 - 0.70, gAX, Y.polyTop, zcN - wn3d * 0.5);
    updateNandLabelPlacement(lblRefs.polyB, gBX + 0.3, Y.polyTop + 1.15, zcN - wn3d * 0.5 - 0.70, gBX, Y.polyTop, zcN - wn3d * 0.5);

    updateNandLabelPlacement(lblRefs.mp1, leftX - 0.5, Y.actTop + 1.25, zcP + 0.35, leftX, Y.actTop, zcP);
    updateNandLabelPlacement(lblRefs.mp2, rightX + 0.5, Y.actTop + 1.25, zcP + 0.35, rightX, Y.actTop, zcP);
    updateNandLabelPlacement(lblRefs.mn1, leftX - 0.5, Y.actTop + 1.25, zcN - 0.35, leftX, Y.actTop, zcN);
    updateNandLabelPlacement(lblRefs.mn2, rightX + 0.5, Y.actTop + 1.25, zcN - 0.35, rightX, Y.actTop, zcN);

    updateNandLabelPlacement(lblRefs.shP, 0.0, Y.actTop + 2.25, zcP + 1.35, 0.0, Y.actTop, zcP + 0.6);
    updateNandLabelPlacement(lblRefs.shN, 0.0, Y.actTop + 2.25, zcN - 0.15, 0.0, Y.actTop, zcN);
    updateNandLabelPlacement(lblRefs.depl, gBX + 0.3, Y.actTop + 1.85, zcP - wp3d * 0.42, 2.1, Y.actTop - 0.05, zcP - wp3d * 0.40);

    updateNandLabelPlacement(lblRefs.psde, -outerSdeMag, Y.actTop + 1.65, zcP - wp3d * 0.45, -outerSdeMag, Y.actTop, zcP - wp3d * 0.40);
    updateNandLabelPlacement(lblRefs.nsde, -outerSdeMag, Y.actTop + 1.65, zcN + wn3d * 0.45, -outerSdeMag, Y.actTop, zcN + wn3d * 0.40);
    updateNandLabelPlacement(lblRefs.oxide, gAX, Y.oxideTop + 2.55, zcP - wp3d * 0.14, gAX, Y.oxideTop, zcP - wp3d * 0.25);
    updateNandLabelPlacement(lblRefs.highk, gBX, Y.highkTop + 2.65, zcP - wp3d * 0.14, gBX, Y.highkTop, zcP - wp3d * 0.25);

    // Apply current Explode transform so restPos updates become visible immediately
    if (typeof applyExplode === 'function') applyExplode();
    if (typeof window.updateNandChannels === 'function') window.updateNandChannels(_lastNandSt);
    if (typeof rebuildFlowCurves === 'function') rebuildFlowCurves();
    if (typeof window.updateSubGateCarriers === 'function' && window.showSubstrateHoles) {
      window.updateSubGateCarriers(typeof performance !== 'undefined' ? performance.now() * 0.001 : 0);
    }
  };

  /* 10. Optional Bulk Carriers (Show Bulk Carriers Toggle - Default OFF) */
  function nandHalton(idx, base) {
    var r = 0, f = 1 / base, i = idx;
    while (i > 0) { r += f * (i % base); i = Math.floor(i / base); f /= base; }
    return r;
  }

  function createNandDecorativeInstanced(geom, mat, maxCount) {
    var mesh;
    if (typeof THREE.InstancedMesh === 'function') {
      mesh = new THREE.InstancedMesh(geom, mat, maxCount);
    } else {
      mesh = new THREE.Group();
      mesh.isInstancedMesh = true;
      mesh.geometry = geom;
      mesh.material = mat;
      mesh.count = 0;
      mesh.instanceMatrix = { needsUpdate: false };
      mesh.setMatrixAt = function () {};
    }
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.raycast = function () {};
    mesh.userData.decorative = true;
    return mesh;
  }

  var MAX_NAND_HOLES = 360;
  var MAX_NAND_ELECS = 180;
  var isInitCarrierLight = document.documentElement.getAttribute('data-theme') === 'light';

  var nandBulkGeom = new THREE.SphereGeometry(0.052, 8, 8);
  var nandHoleMat = new THREE.MeshBasicMaterial({
    color: isInitCarrierLight ? 0x1D4ED8 : 0x60A5FA,
    transparent: true,
    opacity: isInitCarrierLight ? 0.42 : 0.46,
    depthWrite: false
  });
  var nandElecMat = new THREE.MeshBasicMaterial({
    color: isInitCarrierLight ? 0x15803D : 0x4ADE80,
    transparent: true,
    opacity: isInitCarrierLight ? 0.40 : 0.44,
    depthWrite: false
  });

  var holeInstMesh = createNandDecorativeInstanced(nandBulkGeom, nandHoleMat, MAX_NAND_HOLES);
  holeInstMesh.renderOrder = 1;
  holeInstMesh.visible = false;
  cellGroup.add(holeInstMesh);

  var bulkElecInstMesh = createNandDecorativeInstanced(nandBulkGeom, nandElecMat, MAX_NAND_ELECS);
  bulkElecInstMesh.renderOrder = 2;
  bulkElecInstMesh.visible = false;
  cellGroup.add(bulkElecInstMesh);

  window.showSubstrateHoles = false;
  var _nandCarrierDummy = new THREE.Object3D();
  var _lastNandCarrierTick = -1;

  var holeSeeds = [];
  for (var nh = 0; nh < MAX_NAND_HOLES; nh++) {
    holeSeeds.push({ nx: nandHalton(nh + 1, 2), ny: nandHalton(nh + 1, 3), nz: nandHalton(nh + 1, 5), phase: nh * 0.71 });
  }
  var elecSeeds = [];
  for (var ne = 0; ne < MAX_NAND_ELECS; ne++) {
    elecSeeds.push({ nx: nandHalton(ne + 23, 2), ny: nandHalton(ne + 23, 3), nz: nandHalton(ne + 23, 7), phase: ne * 0.89 });
  }

  window.updateBulkCarriersTheme = function(theme) {
    var isL = theme === 'light';
    if (nandHoleMat) { nandHoleMat.color.setHex(isL ? 0x1D4ED8 : 0x60A5FA); nandHoleMat.opacity = isL ? 0.42 : 0.46; }
    if (nandElecMat) { nandElecMat.color.setHex(isL ? 0x15803D : 0x4ADE80); nandElecMat.opacity = isL ? 0.40 : 0.44; }
  };

  window.toggleSubstrateHoles = function(visible) {
    window.showSubstrateHoles = Boolean(visible);
    if (!window.showSubstrateHoles) {
      holeInstMesh.visible = false; holeInstMesh.count = 0;
      bulkElecInstMesh.visible = false; bulkElecInstMesh.count = 0;
      if (holeInstMesh.instanceMatrix) holeInstMesh.instanceMatrix.needsUpdate = true;
      if (bulkElecInstMesh.instanceMatrix) bulkElecInstMesh.instanceMatrix.needsUpdate = true;
    } else if (typeof window.updateSubGateCarriers === 'function') {
      _lastNandCarrierTick = -999;
      window.updateSubGateCarriers(typeof performance !== 'undefined' ? performance.now() * 0.001 : 0);
    }
  };

  window.updateSubGateCarriers = function(elapsedTime) {
    var t = typeof elapsedTime === 'number' ? elapsedTime : 0;
    if (t > 0 && Math.abs(t - _lastNandCarrierTick) < 0.008) return;
    _lastNandCarrierTick = t;

    if (!window.showSubstrateHoles) {
      holeInstMesh.visible = false; holeInstMesh.count = 0;
      bulkElecInstMesh.visible = false; bulkElecInstMesh.count = 0;
      return;
    }

    var st = _lastNandSt;
    var frozen = !st || st.frozen || st.a === 'off' || st.b === 'off';
    var va = frozen ? 0.0 : Number(st.a);
    var vb = frozen ? 0.0 : Number(st.b);
    var vout = frozen ? 0.5 : Number(st.vout);

    var hL = nandGeom3D.halfL;
    var gAX = nandGeom3D.gateAX;
    var gBX = nandGeom3D.gateBX;
    var halfWp = nandGeom3D.wp3d * 0.5;
    var halfWn = nandGeom3D.wn3d * 0.5;
    var zcP = nandGeom3D.pmosZC;
    var zcN = nandGeom3D.nmosZC;
    var tapX = nandGeom3D.tapX;

    // 1. P-Substrate & P-Well Majority Holes
    var showSub = (typeof layerVisibility === 'undefined') ? true : (layerVisibility.substrate !== false);
    if (showSub) {
      holeInstMesh.visible = true;
      if (psub.userData && psub.userData.restPos) {
        holeInstMesh.position.set(
          psub.position.x - psub.userData.restPos.x,
          psub.position.y - psub.userData.restPos.y,
          psub.position.z - psub.userData.restPos.z
        );
      }
      var subHW = nandGeom3D.subHalfW - 0.35;
      var subHD = nandGeom3D.subHalfD - 0.35;
      var yMinS = Y.subBot + 0.18;
      var yMaxS = Y.subTop - 0.12;
      var gatePushA = frozen ? 0 : 0.40 * Math.max(0, Math.min(1, va));
      var gatePushB = frozen ? 0 : 0.40 * Math.max(0, Math.min(1, vb));

      var hOut = 0;
      for (var i = 0; i < MAX_NAND_HOLES; i++) {
        var hs = holeSeeds[i];
        var jx = 0.028 * Math.sin(t * 2.1 + hs.phase);
        var jy = 0.018 * Math.cos(t * 2.4 + hs.phase * 1.27);
        var jz = 0.028 * Math.sin(t * 1.8 + hs.phase * 0.73);

        var hx = -0.5 + (hs.nx - 0.5) * 2.0 * subHW + jx;
        var hz = (hs.nz - 0.5) * 2.0 * subHD + jz;
        var hy = yMinS + hs.ny * (yMaxS - yMinS) + jy;

        // Exclude N-Well bulk volume (reserved for N-Well electrons)
        if (hz > 0.85 && hz < (zcP + halfWp + 0.95) && hx > (tapX - 1.5) && hx < (nandGeom3D.rightX + 2.6) && hy > Y.wellBot - 0.15) {
          hy = yMinS + hs.ny * Math.max(0.15, (Y.wellBot - 0.20) - yMinS) + jy * 0.5;
        }

        // Exclude NMOS N+ diffusions & gates MN1/MN2
        if (Math.abs(hz - zcN) < (halfWn + 0.30) && hy > Y.actBot - 0.30) {
          if (Math.abs(hx - nandGeom3D.leftX) < 1.65 || Math.abs(hx) < 2.15 || Math.abs(hx - nandGeom3D.rightX) < 1.65) {
            hy = yMinS + hs.ny * Math.max(0.15, (Y.actBot - 0.34) - yMinS);
          } else if (Math.abs(hx - gAX) < hL + 0.15 && gatePushA > 0.02) {
            hy = Math.min(hy, yMaxS - gatePushA);
          } else if (Math.abs(hx - gBX) < hL + 0.15 && gatePushB > 0.02) {
            hy = Math.min(hy, yMaxS - gatePushB);
          }
        }

        if (Math.abs(hx - tapX) < 0.8 && Math.abs(hz - zcN) < 0.8 && hy > Y.actBot - 0.1) {
          hy = yMinS + hs.ny * Math.max(0.15, (Y.actBot - 0.20) - yMinS);
        }

        _nandCarrierDummy.position.set(hx, hy, hz);
        _nandCarrierDummy.rotation.set(0, 0, 0);
        _nandCarrierDummy.scale.set(1, 1, 1);
        if (typeof _nandCarrierDummy.updateMatrix === 'function') _nandCarrierDummy.updateMatrix();
        holeInstMesh.setMatrixAt(hOut++, _nandCarrierDummy.matrix);
      }
      holeInstMesh.count = hOut;
      if (holeInstMesh.instanceMatrix) holeInstMesh.instanceMatrix.needsUpdate = true;
    } else {
      holeInstMesh.visible = false; holeInstMesh.count = 0;
    }

    // 2. N-Well Majority Electrons (tracks nwell explode offset!)
    var showWell = (typeof layerVisibility === 'undefined') ? true : (layerVisibility.well !== false);
    if (showWell) {
      bulkElecInstMesh.visible = true;
      if (nwell.userData && nwell.userData.restPos) {
        bulkElecInstMesh.position.set(
          nwell.position.x - nwell.userData.restPos.x,
          nwell.position.y - nwell.userData.restPos.y,
          nwell.position.z - nwell.userData.restPos.z
        );
      }
      var wMinX = tapX - 1.25;
      var wMaxX = nandGeom3D.rightX + 2.35;
      var wMinZ = 1.05;
      var wMaxZ = zcP + halfWp + 0.75;
      var yMinW = Y.wellBot + 0.16;
      var yMaxW = Y.wellTop - 0.12;
      var pPushA = frozen ? 0 : 0.40 * Math.max(0, Math.min(1, 1.0 - va));
      var pPushB = frozen ? 0 : 0.40 * Math.max(0, Math.min(1, 1.0 - vb));

      var eOut = 0;
      for (var j = 0; j < MAX_NAND_ELECS; j++) {
        var es = elecSeeds[j];
        var ex = wMinX + es.nx * (wMaxX - wMinX) + 0.025 * Math.cos(t * 2.2 + es.phase);
        var ez = wMinZ + es.nz * (wMaxZ - wMinZ) + 0.025 * Math.sin(t * 2.0 + es.phase * 0.81);
        var ey = yMinW + es.ny * (yMaxW - yMinW) + 0.016 * Math.sin(t * 2.5 + es.phase * 1.13);

        if (Math.abs(ez - zcP) < (halfWp + 0.30) && ey > Y.actBot - 0.30) {
          if (Math.abs(ex - nandGeom3D.leftX) < 1.65 || Math.abs(ex) < 2.15 || Math.abs(ex - nandGeom3D.rightX) < 1.65) {
            ey = yMinW + es.ny * Math.max(0.12, (Y.actBot - 0.32) - yMinW);
          } else if (Math.abs(ex - gAX) < hL + 0.15 && pPushA > 0.02) {
            ey = Math.min(ey, yMaxW - pPushA);
          } else if (Math.abs(ex - gBX) < hL + 0.15 && pPushB > 0.02) {
            ey = Math.min(ey, yMaxW - pPushB);
          }
        }

        _nandCarrierDummy.position.set(ex, ey, ez);
        _nandCarrierDummy.rotation.set(0, 0, 0);
        _nandCarrierDummy.scale.set(1, 1, 1);
        if (typeof _nandCarrierDummy.updateMatrix === 'function') _nandCarrierDummy.updateMatrix();
        bulkElecInstMesh.setMatrixAt(eOut++, _nandCarrierDummy.matrix);
      }
      bulkElecInstMesh.count = eOut;
      if (bulkElecInstMesh.instanceMatrix) bulkElecInstMesh.instanceMatrix.needsUpdate = true;
    } else {
      bulkElecInstMesh.visible = false; bulkElecInstMesh.count = 0;
    }
  };

  // Apply initial Balanced (2:2) dimensions (Wp=240nm, Wn=240nm, L=28nm)
  window.updateNandGeometry3D(240, 240, 28);
}

function toggleLabels(visible) {
  if (typeof showLabels3D !== 'undefined') showLabels3D = visible;
  if (typeof labelSprites !== 'undefined') {
    for (var i = 0; i < labelSprites.length; i++) {
      var s = labelSprites[i];
      if (s) {
        var layerVis = (typeof layerVisibility !== 'undefined' && s.userData && s.userData.layer) ? (layerVisibility[s.userData.layer] !== false) : true;
        var v = visible && layerVis;
        s.visible = v;
        if (s.userData && s.userData.leaderLine) {
          s.userData.leaderLine.visible = v;
        }
      }
    }
  }
}
window.toggleLabels = toggleLabels;

try {
  if (typeof THREE !== 'undefined' && typeof cellGroup !== 'undefined' && cellGroup) {
    buildNand2Cell();
  }
  var initLabelChk = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
  if (initLabelChk) {
    toggleLabels(initLabelChk.checked);
  }
} catch (err) {
  console.error('NAND2 3D geometry build failed:', err);
}
