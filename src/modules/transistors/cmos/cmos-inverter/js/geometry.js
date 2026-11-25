/**
 * geometry.js
 * The physical CMOS inverter model: layout constants, geometry helper functions,
 * physically accurate Gaussian doping-profile textures, 3D curved tub geometries
 * with lateral straggle and iso-concentration contour rings, full layer construction
 * (substrate -> wells -> active S/D -> oxide -> poly -> contacts -> metal-1),
 * and depth-tested 3D floating labels.
 */

// =====================================================================
// GEOMETRY HELPERS
// =====================================================================
function cssVar(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
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
function resolveInverterCanonProp(colorVarOrHex, isLightTheme) {
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

var gaussTexCache = {};
function gaussianDepthTexture(colorVarOrHex, peakV, sigmaV, opts){
  opts = opts || {};
  var canonProp = resolveInverterCanonProp(colorVarOrHex);
  var rawColor = canonProp ? canonProp.color : (colorVarOrHex.indexOf('--') === 0 ? cssVar(colorVarOrHex) : colorVarOrHex);
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

  for (var py = 0; py < TH; py++){
    var v = py / (TH - 1); // 0 at surface, 1 at bottom junction
    var dv = (v - peakV) / sigmaV;
    var gDepth = Math.exp(-0.5 * dv * dv);

    for (var px = 0; px < TW; px++){
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
  isoRatios.forEach(function(ratio, i){
    // Solve ratio = exp(-0.5 * dv^2) => dv = sqrt(-2 ln(ratio)) * sigmaV
    var dv = Math.sqrt(-2.0 * Math.log(ratio)) * sigmaV;
    var alpha = 0.70 - i * 0.10;
    ctx.strokeStyle = 'rgba(255,255,255,' + alpha.toFixed(2) + ')';
    ctx.lineWidth = 1.4;

    // Shallower branch
    var vUp = peakV - dv;
    if (vUp >= 0 && vUp <= 1){
      var yUp = vUp * (TH - 1);
      ctx.beginPath();
      ctx.moveTo(0, yUp);
      ctx.lineTo(TW, yUp);
      ctx.stroke();
    }
    // Deeper branch
    var vDn = peakV + dv;
    if (vDn >= 0 && vDn <= 1){
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
// 3. This function constructs a 3D BufferGeometry with smoothly rounded corners,
//    curved sidewalls, a flat wafer-surface top cap, and a curved junction bottom.
// ---------------------------------------------------------------------------
function createGaussianTubGeometry(w, h, d, opts){
  opts = opts || {};
  var nLayers = opts.nLayers || 20;
  var nPerim = opts.nPerim || 48;
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.18;
  var cornerR = opts.cornerR !== undefined ? opts.cornerR : Math.min(w, d) * 0.22;

  var positions = [];
  var uvs = [];
  var indices = [];

  var halfW = w / 2;
  var halfD = d / 2;

  function getRoundedRectPoint(hx, hz, cr, theta){
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

  // Generate stacked rings from eta = 0 (top surface, y = +h/2) to eta = 1 (bottom apex, y = -h/2)
  for (var i = 0; i <= nLayers; i++){
    var eta = i / nLayers; // 0 at surface, 1 at bottom
    // Quarter-ellipse diffusion envelope
    var rFactor = Math.sqrt(Math.max(0, 1.0 - eta * eta));

    // Near top, lateral diffusion expands slightly; near bottom, it contracts into a rounded bowl
    var curHx = halfW * (1.0 - straggle * (1.0 - rFactor));
    var curHz = halfD * (1.0 - straggle * (1.0 - rFactor));
    var curCr = cornerR * (0.35 + 0.65 * rFactor);

    // Vertical position: top is +h/2, bottom is -h/2
    var y = h * 0.5 - h * eta;

    for (var j = 0; j < nPerim; j++){
      var theta = (j / nPerim) * Math.PI * 2;
      var pt = getRoundedRectPoint(curHx, curHz, curCr, theta);
      positions.push(pt[0], y, pt[1]);
      uvs.push(j / nPerim, eta);
    }
  }

  // Wall indices between rings
  for (var i = 0; i < nLayers; i++){
    var ring1 = i * nPerim;
    var ring2 = (i + 1) * nPerim;
    for (var j = 0; j < nPerim; j++){
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
  for (var j = 0; j < nPerim; j++){
    var nextJ = (j + 1) % nPerim;
    indices.push(bottomCenterIdx, lastRingStart + nextJ, lastRingStart + j);
  }

  // Top surface cap at y = +h/2 (wafer surface)
  var topCenterIdx = positions.length / 3;
  positions.push(0, h * 0.5, 0);
  uvs.push(0.5, 0.0);
  for (var j = 0; j < nPerim; j++){
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
// - 3D iso-concentration contour wire loops (giving scientific TCAD look)
// - Inner high-concentration volumetric core
// - Full MeshStandardMaterial with emissive properties for native
//   highlighting, ON/OFF logic state coloring, and current-flow pulsing.
// ---------------------------------------------------------------------------
function gaussianDopingMesh(w, h, d, colorVar, opts){
  opts = opts || {};
  var peakV = opts.peakV !== undefined ? opts.peakV : 0.25;
  var sigmaV = opts.sigmaV !== undefined ? opts.sigmaV : 0.25;
  var canonProp = resolveInverterCanonProp(colorVar);

  var geo = createGaussianTubGeometry(w, h, d, opts);
  var tex = gaussianDepthTexture(colorVar, peakV, sigmaV, opts);

  var rawHex = canonProp ? canonProp.color : (colorVar.indexOf('--') === 0 ? cssVar(colorVar) : colorVar);
  var baseColor = new THREE.Color(rawHex);
  var outlineHex = opts.outlineColor || (canonProp && canonProp.outlineColor) || null;
  var mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: tex,
    roughness: opts.roughness !== undefined ? opts.roughness : (canonProp && canonProp.roughness !== undefined ? canonProp.roughness : 0.50),
    metalness: opts.metalness !== undefined ? opts.metalness : (canonProp && canonProp.metalness !== undefined ? canonProp.metalness : 0.15),
    transparent: true,
    opacity: opts.opacity !== undefined ? opts.opacity : (canonProp && canonProp.opacity !== undefined ? canonProp.opacity : 0.88),
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
  mesh.userData.outlineColor = outlineHex;
  mesh.renderOrder = opts.renderOrder || 2;

  // Add 3D Iso-concentration Contour Wire Loops at depths eta = 0.25, 0.50, 0.75
  var contourEtas = [0.25, 0.50, 0.75];
  var nPerim = opts.nPerim || 48;
  var cornerR = opts.cornerR !== undefined ? opts.cornerR : Math.min(w, d) * 0.22;
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.18;
  var halfW = w / 2;
  var halfD = d / 2;

  function getRoundedRectPt(hx, hz, cr, theta){
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

  contourEtas.forEach(function(eta, idx){
    var rFactor = Math.sqrt(Math.max(0, 1.0 - eta * eta));
    var curHx = halfW * (1.0 - straggle * (1.0 - rFactor));
    var curHz = halfD * (1.0 - straggle * (1.0 - rFactor));
    var curCr = cornerR * (0.35 + 0.65 * rFactor);
    var y = h * 0.5 - h * eta;

    var pts = [];
    for (var j = 0; j < nPerim; j++){
      var theta = (j / nPerim) * Math.PI * 2;
      var p = getRoundedRectPt(curHx, curHz, curCr, theta);
      p.y = y;
      pts.push(p);
    }
    var lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    var lineMat = new THREE.LineBasicMaterial({
      color: outlineHex ? new THREE.Color(outlineHex) : baseColor.clone().offsetHSL(0, 0.1, 0.2),
      transparent: true,
      opacity: 0.70 - idx * 0.15,
      depthWrite: false
    });
    var loop = new THREE.LineLoop(lineGeo, lineMat);
    loop.userData.isGaussOutline = true;
    loop.userData.isDepthRing = true;
    loop.userData.hasFixedOutline = Boolean(opts.outlineColor);
    loop.raycast = function(){}; // Keep clicks focused on parent mesh
    mesh.add(loop);
  });

  // Top surface perimeter boundary line
  var topPts = [];
  for (var j = 0; j < nPerim; j++){
    var theta = (j / nPerim) * Math.PI * 2;
    var p = getRoundedRectPt(halfW, halfD, cornerR, theta);
    p.y = h * 0.5 + 0.005;
    topPts.push(p);
  }
  var topGeo = new THREE.BufferGeometry().setFromPoints(topPts);
  var topMat = new THREE.LineBasicMaterial({
    color: outlineHex ? new THREE.Color(outlineHex) : baseColor,
    transparent: true,
    opacity: 0.85,
    depthWrite: false
  });
  var topLoop = new THREE.LineLoop(topGeo, topMat);
  topLoop.userData.isGaussOutline = true;
  topLoop.userData.isDepthRing = false;
  topLoop.userData.hasFixedOutline = Boolean(opts.outlineColor);
  topLoop.raycast = function(){};
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
  coreMesh.raycast = function(){};
  mesh.userData.coreMesh = coreMesh;
  mesh.add(coreMesh);

  return mesh;
}

// ---------------------------------------------------------------------------
// FILLETED TRACE & PDK INTERCONNECT GEOMETRIES
// ---------------------------------------------------------------------------
// Extrudes planar Metal-1 routing traces with flat ribbon cross-section (3λ width : 1λ thickness),
// rounded fillets (R = 1λ), 45-degree chamfered bends, and expanded octagonal contact landing pads.
function createFilletedTraceGeometry(w, h, d, cornerRadius, bevel){
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

// Expanded 5λ x 5λ octagonal via landing pad with 45-degree chamfered corners (1λ via enclosure rule)
function createOctagonalViaPadGeometry(size, h, chamfer, bevel){
  size = size || 0.75;           // 5λ = 0.75 (0.45 trace + 2 * 0.15 enclosure)
  chamfer = chamfer || 0.15;     // 1λ = 0.15 45° chamfer
  bevel = bevel !== undefined ? bevel : 0.02;
  var hs = size / 2;             // 0.375
  var c = Math.min(chamfer, hs * 0.6);

  var shape = new THREE.Shape();
  // 8-sided polygon with 45-degree chamfered corners
  shape.moveTo(-hs + c, -hs);
  shape.lineTo(hs - c, -hs);
  shape.lineTo(hs, -hs + c);
  shape.lineTo(hs, hs - c);
  shape.lineTo(hs - c, hs);
  shape.lineTo(-hs + c, hs);
  shape.lineTo(-hs, hs - c);
  shape.lineTo(-hs, -hs + c);
  shape.closePath();

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

// 45-degree chamfered T-junction bracket (1λ chamfer on 90-degree interconnect turns)
function createChamferedTJunctionGeometry(branchDir, railW, branchW, chamfer, height, bevel){
  railW = railW || 0.45;
  branchW = branchW || 0.45;
  chamfer = chamfer || 0.15;
  height = height || 0.15;
  bevel = bevel !== undefined ? bevel : 0.02;

  var hwRail = railW / 2;
  var hwBranch = branchW / 2;
  var c = chamfer;
  var armRail = hwBranch + c + 0.20;
  var armBranch = hwRail + c + 0.20;

  // Base 2D shape in X-Y plane: rail along Y, branch pointing along +X
  var shape = new THREE.Shape();
  shape.moveTo(-hwRail, armRail);
  shape.lineTo(hwRail, armRail);
  shape.lineTo(hwRail, hwBranch + c);
  shape.lineTo(hwRail + c, hwBranch);        // 45° chamfer at upper turn
  shape.lineTo(armBranch, hwBranch);
  shape.lineTo(armBranch, -hwBranch);
  shape.lineTo(hwRail + c, -hwBranch);
  shape.lineTo(hwRail, -hwBranch - c);       // 45° chamfer at lower turn
  shape.lineTo(hwRail, -armRail);
  shape.lineTo(-hwRail, -armRail);
  shape.closePath();

  var extrudeSettings = {
    steps: 1,
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 2
  };
  var geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.rotateX(Math.PI / 2);

  // Center bounding box on Y axis (vertical height)
  geo.computeBoundingBox();
  var bb = geo.boundingBox;
  var midY_geo = (bb.min.y + bb.max.y) / 2;
  geo.translate(0, -midY_geo, 0);

  // Rotate to align with branch direction
  if (branchDir === '-z'){
    geo.rotateY(Math.PI / 2);
  } else if (branchDir === '+z'){
    geo.rotateY(-Math.PI / 2);
  } else if (branchDir === '-x'){
    geo.rotateY(Math.PI);
  }
  return geo;
}

// Procedural brushed metallic texture with directional micro-scratches
var brushedMetalTexCache = null;
function getBrushedMetalTexture(){
  if (brushedMetalTexCache) return brushedMetalTexCache;
  var c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(0, 0, 256, 256);
  for (var i = 0; i < 300; i++){
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
// BOX BUILDER (for dielectric, poly, contacts, metal wires, substrate)
// ---------------------------------------------------------------------------
function box(w,h,d, colorVar, opts){
  opts = opts || {};
  var matParams = {
    color: new THREE.Color(cssVar(colorVar)),
    roughness: opts.roughness !== undefined ? opts.roughness : 0.65,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.15,
    transparent: !!opts.transparent,
    opacity: opts.opacity !== undefined ? opts.opacity : 1,
    emissive: 0x000000,
    emissiveIntensity: 0
  };
  var mat = new THREE.MeshStandardMaterial(matParams);
  var geo = new THREE.BoxGeometry(w,h,d);
  var mesh = new THREE.Mesh(geo, mat);
  mesh.userData.colorVar = colorVar;
  mesh.castShadow = !opts.noShadow;
  mesh.receiveShadow = true;
  mesh.userData.baseEmissive = 0x000000;
  mesh.userData.baseEmissiveIntensity = 0;
  if (opts.outline !== false && (opts.doping || opts.outlineColor)){
    var edges = new THREE.EdgesGeometry(geo);
    var lineMat = new THREE.LineBasicMaterial({
      color: opts.outlineColor ? new THREE.Color(opts.outlineColor) : new THREE.Color(cssVar(colorVar)),
      transparent: true, opacity: 0.85
    });
    var line = new THREE.LineSegments(edges, lineMat);
    line.raycast = function(){}; // outlines shouldn't intercept clicks
    mesh.add(line);
  }
  return mesh;
}
function put(mesh, x,y,z){ mesh.position.set(x,y,z); return mesh; }

// canvas-sprite labels with depth testing enabled so viewing from below correctly occludes them
var labelSprites = [];

function makeLabel(text, colorHex){
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var pad = 12, fontSize = 32;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = 'bold ' + fontSize + 'px "IBM Plex Mono", monospace';
  var metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width) + pad*2;
  canvas.height = fontSize + pad*2;
  ctx.font = 'bold ' + fontSize + 'px "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,14,22,0.96)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = colorHex; ctx.lineWidth = 2.5;
  ctx.strokeRect(1.25,1.25,canvas.width-2.5,canvas.height-2.5);
  ctx.fillStyle = colorHex;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, canvas.height/2 + 1);
  var tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  var mat = new THREE.SpriteMaterial({ map: tex, depthTest:true, depthWrite:false, transparent:true });
  var sprite = new THREE.Sprite(mat);
  var scale = 0.014;
  sprite.scale.set(canvas.width*scale, canvas.height*scale, 1);
  sprite.renderOrder = 999;
  sprite.userData.isLabel = true;
  sprite.userData.labelText = text;
  sprite.userData.colorHex = colorHex;
  labelSprites.push(sprite);
  return sprite;
}

function updateLabelSprite(sprite, text, colorHex, isLight){
  var pad = 12, fontSize = 32;
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.font = 'bold ' + fontSize + 'px "IBM Plex Mono", monospace';
  var metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width) + pad*2;
  canvas.height = fontSize + pad*2;
  ctx.font = 'bold ' + fontSize + 'px "IBM Plex Mono", monospace';
  ctx.fillStyle = isLight ? 'rgba(255,255,255,0.97)' : 'rgba(10,14,22,0.96)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = colorHex; ctx.lineWidth = 2.5;
  ctx.strokeRect(1.25,1.25,canvas.width-2.5,canvas.height-2.5);
  ctx.fillStyle = colorHex;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, canvas.height/2 + 1);
  if (sprite.material && sprite.material.map){
    sprite.material.map.dispose();
  }
  var tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  sprite.material.map = tex;
  sprite.material.needsUpdate = true;
}

function updateMaterialsTheme(){
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
  var propsFn = (typeof getMaterialProperties === 'function') ? getMaterialProperties : window.getMaterialProperties;
  var props = propsFn ? propsFn(isLight ? 'light' : 'dark') : null;

  selectable.forEach(function(m){
    if (m && m.userData && m.userData.colorVar && m.material && m.material.color){
      if (typeof nmosChanMesh !== 'undefined' && m === nmosChanMesh) return;
      if (typeof pmosChanMesh !== 'undefined' && m === pmosChanMesh) return;
      var cv = m.userData.colorVar;
      var canonProp = resolveInverterCanonProp(cv, isLight);
      var hex = canonProp ? canonProp.color : cssVar(cv);
      if (!canonProp && pal) {
        if (cv === '--c-substrate' && pal.pSubstrate) hex = pal.pSubstrate;
        else if (cv === '--c-well' && pal.nWell) hex = pal.nWell;
        else if (cv === '--c-pwell' && pal.pWell) hex = pal.pWell;
        else if (cv === '--c-active-p' && pal.pPlusDiffusion) hex = pal.pPlusDiffusion;
        else if (cv === '--c-active-n' && pal.nPlusDiffusion) hex = pal.nPlusDiffusion;
        else if (cv === '--c-sde-p' && pal.pSDE) hex = pal.pSDE;
        else if (cv === '--c-sde-n' && pal.nSDE) hex = pal.nSDE;
      }

      if (hex){
        m.material.color.set(hex);
      }

      if (m.userData.isGaussianDoping) {
        try {
          var newTex = gaussianDepthTexture(cv, m.userData.peakV || 0.25, m.userData.sigmaV || 0.25, m.userData.opts || {});
          if (newTex) {
            m.material.map = newTex;
            m.material.needsUpdate = true;
          }
        } catch (_) {}
      }

      if (canonProp) {
        if (canonProp.roughness !== undefined) m.material.roughness = canonProp.roughness;
        if (canonProp.metalness !== undefined) m.material.metalness = canonProp.metalness;
      }
      if (cv === '--c-substrate' || cv === '--c-well' || cv === '--c-pwell') {
        if (cv === '--c-substrate') m.material.roughness = 0.85;
        else m.material.roughness = isLight ? 0.75 : 0.60;
        if (m.material.emissive) m.material.emissive.set(0x000000);
        m.material.emissiveIntensity = 0;
      }
      if (m.userData.coreMesh && m.userData.coreMesh.material && m.userData.coreMesh.material.color && hex) {
        m.userData.coreMesh.material.color.set(hex);
      }
      if (m.children && m.children.length) {
        var nextOutlineHex = (canonProp && canonProp.outlineColor) || hex;
        m.children.forEach(function(ch){
          if (ch.isLineLoop && ch.userData && ch.userData.isGaussOutline && !ch.userData.hasFixedOutline && ch.material && ch.material.color && nextOutlineHex) {
            ch.material.color.set(nextOutlineHex);
          }
        });
      }
    }
  });

  if (typeof subMesh !== 'undefined' && subMesh && subMesh.material) {
    if (props && props.substrate) {
      subMesh.material.color.set(props.substrate.color);
      subMesh.material.roughness = props.substrate.roughness;
      subMesh.material.metalness = props.substrate.metalness;
    } else if (pal && pal.pSubstrate) {
      subMesh.material.color.set(pal.pSubstrate);
      subMesh.material.roughness = 0.85;
      subMesh.material.metalness = 0.05;
    }
    if (subMesh.material.emissive) subMesh.material.emissive.set(0x000000);
    subMesh.material.emissiveIntensity = 0;
  }

  if (typeof oxidePmos !== 'undefined' && oxidePmos && oxidePmos.material && pal) {
    oxidePmos.material.color.set(pal.gateOxide);
    oxidePmos.material.opacity = pal.gateOxideOpacity || (isLight ? 0.28 : 0.35);
  }
  if (typeof oxideNmos !== 'undefined' && oxideNmos && oxideNmos.material && pal) {
    oxideNmos.material.color.set(pal.gateOxide);
    oxideNmos.material.opacity = pal.gateOxideOpacity || (isLight ? 0.28 : 0.35);
  }

  if (typeof silMatInverter !== 'undefined' && silMatInverter && silMatInverter.color) {
    silMatInverter.color.setHex(isLight ? 0x647082 : 0x6e7887);
  }
  var dp = (props && props.depletion) ? props.depletion : {
    colorHex: isLight ? 0x64748b : 0x94a3b8,
    emissiveHex: isLight ? 0x334155 : 0x475569,
    emissiveIntensity: 0.14,
    opacity: 0.38,
    roughness: 0.55,
    metalness: 0.08,
    edgeOpacity: 0.55
  };
  if (typeof cmosDeplMat !== 'undefined' && cmosDeplMat) {
    cmosDeplMat.color.setHex(dp.colorHex);
    cmosDeplMat.emissive.setHex(dp.emissiveHex);
    cmosDeplMat.emissiveIntensity = dp.emissiveIntensity;
    cmosDeplMat.opacity = dp.opacity;
    cmosDeplMat.roughness = dp.roughness;
    cmosDeplMat.metalness = dp.metalness;
  }
  if (typeof cmosDeplEdgeMat !== 'undefined' && cmosDeplEdgeMat) {
    cmosDeplEdgeMat.color.setHex(dp.colorHex);
    cmosDeplEdgeMat.opacity = dp.edgeOpacity;
  }
  if (groups && groups['depletion']) {
    groups['depletion'].children.forEach(function(dm){
      if (dm && dm.userData && dm.userData.layerId === 'depletion' && dm.material) {
        dm.material.color.setHex(dp.colorHex);
        if (dm.material.emissive) dm.material.emissive.setHex(dp.emissiveHex);
        dm.material.emissiveIntensity = dp.emissiveIntensity;
        dm.material.opacity = dp.opacity;
        dm.userData.baseEmissive = dp.emissiveHex;
        dm.userData.baseEmissiveIntensity = dp.emissiveIntensity;
      }
    });
  }

  labelSprites.forEach(function(s){
    if (s && s.userData && s.userData.labelText && s.userData.colorHex){
      updateLabelSprite(s, s.userData.labelText, s.userData.colorHex, isLight);
    }
  });

  if (typeof updateLayersListTheme === 'function') {
    updateLayersListTheme(pal);
  }

  if (typeof window.updateChannelThemes === 'function') {
    window.updateChannelThemes(isLight ? 'light' : 'dark');
  }

  if (typeof renderer !== 'undefined' && renderer && typeof scene !== 'undefined' && scene && typeof activeCamera !== 'undefined' && activeCamera) {
    renderer.render(scene, activeCamera);
  }
}
window.updateMaterialsTheme = updateMaterialsTheme;

// =====================================================================
// LAYOUT CONSTANTS
// =====================================================================
var Y = {
  subBot: 0.0, subTop: 2.0,
  wellBot: 1.10, wellTop: 2.05,     // sits in the UPPER part of the substrate slab, barely proud of it
  actBot: 1.55, actTop: 1.95,       // recessed well below the well/substrate top surface
  silBot: 1.952, silTop: 1.992,     // self-aligned NiSi silicide contact pads atop exposed silicon
  oxideBot: 1.95, oxideTop: 1.985,  // thin chemical SiO2 interfacial oxide under the gates
  highkBot: 1.985, highkTop: 2.02,  // High-k HfO2 dielectric layer
  polyBot: 2.02, polyTop: 2.32,
  metalBot: 2.95, metalTop: 3.10    // Flat ribbon aspect ratio: thickness = 0.15 = 1λ vs width = 0.45 = 3λ
};

var CH = { min:-1.0, max:1.0 };            // gate/channel — 2 units = 2λ gate length
var SRC_X0 = -4.0, SRC_X1 = CH.min;        // source diffusion block — flush against the gate
var DRN_X0 = CH.max, DRN_X1 = 4.0;         // drain diffusion block — flush against the gate
var SRC_X = (SRC_X0+SRC_X1)/2;             // -2.5 — source contact, centered in its diffusion block
var DRN_X = (DRN_X0+DRN_X1)/2;             //  2.5 — drain contact, centered in its diffusion block
var TAP_X = -6.0;                          // well/substrate tap, clear of the source block (-4.0)

var ACTIVE_W = 6.0;                        // transistor width (Z-depth of source/gate/drain) — matches 6λ gate-width rule
var PMOS_ZC = 4.55, PMOS_Z0 = PMOS_ZC-ACTIVE_W/2, PMOS_Z1 = PMOS_ZC+ACTIVE_W/2;
var NMOS_ZC = -4.55, NMOS_Z0 = NMOS_ZC-ACTIVE_W/2, NMOS_Z1 = NMOS_ZC+ACTIVE_W/2;

var POLY_Z0 = NMOS_Z0;
var POLY_Z1 = PMOS_Z1 + 0.6;
var POLY_CT_Z = PMOS_Z1 + 0.3;             // IN contact — on the poly tail, just past PMOS diffusion edge

var RAIL_Z = PMOS_Z1 + 1.6;                // VDD/GND rails sit outside active/poly footprint

var LAYER_ORDER = ['substrate','well','depletion','active','sde','oxide','highk','poly','spacer','silicide','contact','metal'];
var EXPLODE_GAP = 3.2;

var groups = {};
LAYER_ORDER.forEach(function(k){ groups[k] = new THREE.Group(); groups[k].name = k; scene.add(groups[k]); });

var selectable = [];   // meshes clickable / highlightable

function reg(mesh, id, layerKey){
  mesh.userData.id = id;
  mesh.userData.layerId = id;
  mesh.userData.layer = layerKey;
  if (mesh.isGroup) {
    mesh.traverse(function(child) {
      if (child.isLine || child.isLineSegments || child.isPoints) return;
      child.userData.id = id;
      child.userData.layerId = id;
      child.userData.layer = layerKey;
    });
  }
  selectable.push(mesh);
  groups[layerKey].add(mesh);
  return mesh;
}

// ---------- SUBSTRATE ----------
// Base wafer slab — spans Z in [-12, 12], cleanly exposing P-substrate in the 1.50 gap [-0.75, 0.75]
var subMesh = box(22, Y.subTop-Y.subBot, 24, '--c-substrate', { roughness:0.85, metalness:0.05 });
subMesh.renderOrder = 1;
put(subMesh, -0.5, (Y.subTop+Y.subBot)/2, 0);
reg(subMesh, 'psub', 'substrate');

// ---------- WELLS — Physically accurate Gaussian retrograde implant tubs ----------
// Enforces both the "Well overlap of active" (6λ overlap) and realistic "Well-to-well spacing" (~10λ rule):
// Metal-1 wire width = 0.45. Well gap = 1.50 (3.333x metal width, 10λ vs 3λ rule).
// N-WELL spans Z in [0.75, 8.35] (center Z = +4.55, depth 7.60).
// P-WELL spans Z in [-8.35, -0.75] (center Z = -4.55, depth 7.60).
// PMOS active is centered at Z = 4.55, spanning Z in [1.55, 7.55] (margin 0.80 on both sides).
// NMOS active is centered at Z = -4.55, spanning Z in [-7.55, -1.55] (margin 0.80 on both sides).
// In X, wells span [-8.80, 6.20] (width 15.0, center X = -1.30), enclosing active and tap diffusions.
// The 1.50-unit gap between N-WELL and P-WELL cleanly reveals the underlying P-substrate silicon.
var wellH = Y.wellTop - Y.wellBot;
var wellW = 15.0;
var wellD = 7.60;
var wellX = -1.30;
var nwellZC = 4.55;
var pwellZC = -4.55;

// N-WELL (Phosphorus retrograde implant for PMOS)
var wellMesh = gaussianDopingMesh(wellW, wellH, wellD, '--c-well', {
  peakV: 0.35,      // Retrograde implant peak sits ~35% down into the well
  sigmaV: 0.28,     // Broad Gaussian with high thermal straggle
  straggle: 0.08,   // Controlled lateral straggle ensuring active is fully enclosed at all depths
  cornerR: 0.35,    // Tight corner radius so active corners never protrude
  depthWrite: false,
  renderOrder: 2
});
put(wellMesh, wellX, (Y.wellTop+Y.wellBot)/2, nwellZC);
reg(wellMesh, 'nwell', 'well');

// P-WELL (Boron retrograde implant for NMOS in twin-well CMOS)
var pwellMesh = gaussianDopingMesh(wellW, wellH, wellD, '--c-pwell', {
  peakV: 0.35,
  sigmaV: 0.28,
  straggle: 0.08,
  cornerR: 0.35,
  depthWrite: false,
  renderOrder: 2
});
put(pwellMesh, wellX, (Y.wellTop+Y.wellBot)/2, pwellZC);
reg(pwellMesh, 'pwell', 'well');

// ---------- ACTIVE / DIFFUSION & SDE / LDD REGIONS ----------
// Source and drain are shallow implants: peak close to surface (BF2 for p+, As/P for n+),
// tight sigma, with lateral straggle extending under the poly gate edges.
// Lightly doped extensions (SDE/LDD) sit shallowly at channel edges under gate spacer interfaces.
function buildActiveRow(zc, srcColorVar, sdeColorVar, idPrefix, layerKey, dopingHex, sdeHex){
  var actH    = Y.actTop - Y.actBot;
  var actW_SD = SRC_X1 - SRC_X0;        // 3.0 units lateral width
  var actW_D  = DRN_X1 - DRN_X0;        // 3.0 units lateral width

  // Source — shallow Gaussian implant
  var src = gaussianDopingMesh(actW_SD, actH, ACTIVE_W, srcColorVar, {
    peakV: 0.15,      // Peak close to surface (~20 nm projected range)
    sigmaV: 0.22,     // Tight sigma for abrupt shallow junction
    straggle: 0.16,   // Lateral straggle under gate edge
    cornerR: 0.5,
    outlineColor: dopingHex,
    depthWrite: false,
    renderOrder: 3
  });
  put(src, SRC_X, (Y.actTop+Y.actBot)/2, zc);
  src.userData.colorVar = srcColorVar;
  reg(src, idPrefix+'Src', layerKey);

  // Source/Drain Extension (SDE / LDD) regions:
  // Ultra-shallow, lightly doped extensions at channel edges
  var sdeH = actH * 0.65; // Shallower than main S/D (0.26 vs 0.40)
  var sdeMidY = Y.actTop - sdeH / 2;
  var sdeW = 0.55;

  // Source SDE (channel-facing edge at X = -0.925)
  var srcSde = gaussianDopingMesh(sdeW, sdeH, ACTIVE_W, sdeColorVar, {
    peakV: 0.10,
    sigmaV: 0.28,
    straggle: 0.12,
    cornerR: 0.25,
    opacity: 0.72,
    outlineColor: sdeHex,
    depthWrite: false,
    renderOrder: 4
  });
  put(srcSde, -0.925, sdeMidY, zc);
  srcSde.userData.colorVar = sdeColorVar;
  reg(srcSde, idPrefix+'SrcSde', 'sde');

  // Decorative gate inversion channel segment under the gate
  var gateSeg = box(CH.max-CH.min, actH*0.7, ACTIVE_W, srcColorVar,
    { roughness:0.5, opacity:0.28, transparent:true, outline:false });
  put(gateSeg, 0, (Y.actTop+Y.actBot)/2 - actH*0.15, zc);
  gateSeg.userData.decorative = true;
  gateSeg.userData.colorVar = srcColorVar;
  gateSeg.renderOrder = 3;
  groups[layerKey].add(gateSeg);

  // Drain SDE (channel-facing edge at X = +0.925)
  var drnSde = gaussianDopingMesh(sdeW, sdeH, ACTIVE_W, sdeColorVar, {
    peakV: 0.10,
    sigmaV: 0.28,
    straggle: 0.12,
    cornerR: 0.25,
    opacity: 0.72,
    outlineColor: sdeHex,
    depthWrite: false,
    renderOrder: 4
  });
  put(drnSde, 0.925, sdeMidY, zc);
  drnSde.userData.colorVar = sdeColorVar;
  reg(drnSde, idPrefix+'DrnSde', 'sde');

  // Drain — shallow Gaussian implant
  var drn = gaussianDopingMesh(actW_D, actH, ACTIVE_W, srcColorVar, {
    peakV: 0.15,
    sigmaV: 0.22,
    straggle: 0.16,
    cornerR: 0.5,
    outlineColor: dopingHex,
    depthWrite: false,
    renderOrder: 3
  });
  put(drn, DRN_X, (Y.actTop+Y.actBot)/2, zc);
  drn.userData.colorVar = srcColorVar;
  reg(drn, idPrefix+'Drn', layerKey);

  return { src:src, drn:drn, srcSde:srcSde, drnSde:drnSde };
}
var pmosAct = buildActiveRow(PMOS_ZC, '--c-active-p', '--c-sde-p', 'pmos', 'active', null, null);
var nmosAct = buildActiveRow(NMOS_ZC, '--c-active-n', '--c-sde-n', 'nmos', 'active', null, null);

// ---------- WELL TAP / SUBSTRATE TAP — Gaussian ohmic contact diffusions ----------
var wellTapPad = gaussianDopingMesh(1.3, Y.actTop-Y.actBot, 1.3, '--c-well', {
  peakV: 0.18, sigmaV: 0.24, straggle: 0.20, cornerR: 0.3, outlineColor: '#8fe6c8', depthWrite: false, renderOrder: 3
});
put(wellTapPad, TAP_X, (Y.actTop+Y.actBot)/2, PMOS_ZC);
reg(wellTapPad, 'welltapAct', 'active');

var subTapPad = gaussianDopingMesh(1.3, Y.actTop-Y.actBot, 1.3, '--c-substrate', {
  peakV: 0.18, sigmaV: 0.24, straggle: 0.20, cornerR: 0.3, outlineColor: '#aab4c2', depthWrite: false, renderOrder: 3
});
put(subTapPad, TAP_X, (Y.actTop+Y.actBot)/2, NMOS_ZC);
reg(subTapPad, 'subtapAct', 'active');

// ---------- 3D SCULPTED WRAP-AROUND SPACE-CHARGE DEPLETION REGIONS ----------
var isInitLight = document.documentElement.getAttribute('data-theme') === 'light';
var palInitCMOS = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isInitLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isInitLight ? 'light' : 'dark') : null);
var propsInitCMOS = (typeof getMaterialProperties === 'function') ? getMaterialProperties(isInitLight ? 'light' : 'dark') : (window.getMaterialProperties ? window.getMaterialProperties(isInitLight ? 'light' : 'dark') : null);
var deplPropsInit = (propsInitCMOS && propsInitCMOS.depletion) ? propsInitCMOS.depletion : {
  colorHex: isInitLight ? 0x64748b : 0x94a3b8,
  emissiveHex: isInitLight ? 0x334155 : 0x475569,
  emissiveIntensity: 0.14,
  opacity: 0.38,
  roughness: 0.55,
  metalness: 0.08,
  edgeOpacity: 0.55
};

var cmosDeplMat = new THREE.MeshStandardMaterial({
  color: deplPropsInit.colorHex,
  emissive: deplPropsInit.emissiveHex,
  emissiveIntensity: deplPropsInit.emissiveIntensity,
  transparent: true,
  opacity: deplPropsInit.opacity,
  depthWrite: false,
  roughness: deplPropsInit.roughness,
  metalness: deplPropsInit.metalness,
  polygonOffset: true,
  polygonOffsetFactor: -0.5,
  polygonOffsetUnits: -0.5,
  side: THREE.DoubleSide
});

var cmosDeplEdgeMat = new THREE.LineBasicMaterial({
  color: deplPropsInit.colorHex,
  transparent: true,
  opacity: deplPropsInit.edgeOpacity,
  depthWrite: false
});

var CMOS_DEPL_ETA = [0.0, 0.15, 0.30, 0.45, 0.51, 0.58, 0.65, 0.72, 0.79, 0.86, 0.92, 0.97, 1.0];

function cmosDeplSmoothstep(a, b, x) {
  var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// Build local rounded-rectangle perimeter for an S/D + SDE island (cx in world X, half-extents hx/hz)
function buildCmosWellShellPerimeter(cx, hx, hz, cr) {
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
  for (i = 0; i < nX; i++) {
    t = i / nX;
    addPt(-sx + t * (2 * sx), hz);
  }
  for (i = 0; i < nC; i++) {
    ang = (Math.PI / 2) * (1 - i / nC);
    addPt(sx + cr * Math.cos(ang), sz + cr * Math.sin(ang));
  }
  for (i = 0; i < nZ; i++) {
    t = i / nZ;
    addPt(hx, sz - t * (2 * sz));
  }
  for (i = 0; i < nC; i++) {
    ang = -(Math.PI / 2) * (i / nC);
    addPt(sx + cr * Math.cos(ang), -sz + cr * Math.sin(ang));
  }
  for (i = 0; i < nX; i++) {
    t = i / nX;
    addPt(sx - t * (2 * sx), -hz);
  }
  for (i = 0; i < nC; i++) {
    ang = -Math.PI / 2 - (Math.PI / 2) * (i / nC);
    addPt(-sx + cr * Math.cos(ang), -sz + cr * Math.sin(ang));
  }
  for (i = 0; i < nZ; i++) {
    t = i / nZ;
    addPt(-hx, -sz + t * (2 * sz));
  }
  for (i = 0; i < nC; i++) {
    ang = Math.PI - (Math.PI / 2) * (i / nC);
    addPt(-sx + cr * Math.cos(ang), sz + cr * Math.sin(ang));
  }
  return pts;
}

function createCmosWellShellGeometry(perim) {
  var nP = perim.length;
  var nR = CMOS_DEPL_ETA.length;
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

function makeCmosShellMesh(cx, zc, perim) {
  var geo = createCmosWellShellGeometry(perim);
  var m = new THREE.Mesh(geo, cmosDeplMat.clone());
  m.position.set(cx, Y.actTop, zc);
  m.renderOrder = 2;
  m.userData.baseEmissive = cmosDeplMat.emissive.getHex();
  m.userData.baseEmissiveIntensity = cmosDeplMat.emissiveIntensity;
  m.userData.isSculptedDepletion = true;

  var edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(perim.length * 3), 3));
  var edgeLoop = new THREE.LineLoop(edgeGeo, cmosDeplEdgeMat);
  edgeLoop.raycast = function() {};
  m.add(edgeLoop);

  reg(m, 'depletion', 'depletion');
  return { mesh: m, geo: geo, edgeGeo: edgeGeo, perim: perim };
}

function getCmosChanThicknessAtWorldX(worldX, hasChannel, maxH, isSat, dL, ratio) {
  if (!hasChannel || worldX < -1.001 || worldX > 1.001) return 0;
  var pinchX = 1.0 - dL;
  if (isSat) {
    if (worldX >= pinchX) return 0;
    var sSat = Math.max(0, Math.min(1, (worldX + 1.0) / Math.max(0.001, 2.0 - dL)));
    return maxH * Math.max(0, 1.0 - sSat);
  }
  var sLin = Math.max(0, Math.min(1, (worldX + 1.0) / 2.0));
  return maxH * Math.max(0, 1.0 - sLin * ratio);
}

function updateCmosWellShell(entry, isDrain, wDep, chState) {
  var geo = entry.geo;
  var edgeGeo = entry.edgeGeo;
  var perim = entry.perim;
  var posAttr = geo.attributes.position;
  var pos = posAttr.array;
  var edgeAttr = edgeGeo.attributes.position;
  var edgeArr = edgeAttr.array;

  var nP = perim.length;
  var nR = CMOS_DEPL_ETA.length;
  var outerCount = nR * nP;
  var topInnerStart = outerCount * 2;
  var topOuterStart = topInnerStart + nP;
  var actH = Y.actTop - Y.actBot;       // 0.40 deep S/D tub
  var sdeH = actH * 0.65;               // 0.26 shallow SDE wing
  var minLocalY = (Y.wellBot + 0.03) - Y.actTop; // keep inside well (-0.82)

  for (var i = 0; i < nR; i++) {
    var eta = CMOS_DEPL_ETA[i];
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

      var tWell = cmosDeplSmoothstep(0.90, 1.15, Math.abs(worldX));
      var depth = sdeH + (actH - sdeH) * tWell;
      var inY = 0.002 - depth * tDepth;

      var localW = wDep;
      if (isDrain) {
        var bulbFactor = 0.72 + 0.28 * cmosDeplSmoothstep(0.90, 2.50, Math.abs(worldX));
        localW = wDep * bulbFactor;
      }

      var outX = inX + pt.nxh * localW * outHWeight;
      var outZ = inZ + pt.nzh * localW * outHWeight;
      var outY = Math.max(minLocalY, inY - localW * outVWeight);

      if (chState && chState.hasChannel && Math.abs(inZ) <= (ACTIVE_W * 0.5 + 0.02)) {
        var cTIn = getCmosChanThicknessAtWorldX(worldX, true, chState.maxH, chState.isSat, chState.dL, chState.ratio);
        if (cTIn > 0.002) inY = Math.min(inY, -0.05 - cTIn * 0.5 - 0.004);
        var worldOutX = pt.cx + outX;
        var cTOut = getCmosChanThicknessAtWorldX(worldOutX, true, chState.maxH, chState.isSat, chState.dL, chState.ratio);
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

// Source [-4.0, -0.65] -> cx = -2.325, hx = 1.675 ; Drain [+0.65, +4.0] -> cx = +2.325, hx = 1.675
var cmosSrcPerim = buildCmosWellShellPerimeter(-2.325, 1.675, ACTIVE_W * 0.5, 0.35);
var cmosDrnPerim = buildCmosWellShellPerimeter( 2.325, 1.675, ACTIVE_W * 0.5, 0.35);

var pmosSrcDeplEntry = makeCmosShellMesh(-2.325, PMOS_ZC, cmosSrcPerim);
var pmosDrnDeplEntry = makeCmosShellMesh( 2.325, PMOS_ZC, cmosDrnPerim);
var nmosSrcDeplEntry = makeCmosShellMesh(-2.325, NMOS_ZC, cmosSrcPerim);
var nmosDrnDeplEntry = makeCmosShellMesh( 2.325, NMOS_ZC, cmosDrnPerim);

var pmosSrcDepl = pmosSrcDeplEntry.mesh;
var pmosDrnDepl = pmosDrnDeplEntry.mesh;
var nmosSrcDepl = nmosSrcDeplEntry.mesh;
var nmosDrnDepl = nmosDrnDeplEntry.mesh;

function makeCmosGateDeplMesh(zc) {
  var gGeo = new THREE.BoxGeometry(1.0, 1.0, ACTIVE_W, 24, 1, 2);
  var pos = gGeo.attributes.position;
  var initX = new Float32Array(pos.count);
  var initSignY = new Int8Array(pos.count);
  for (var k = 0; k < pos.count; k++) {
    initX[k] = pos.getX(k);
    initSignY[k] = pos.getY(k) >= 0 ? 1 : -1;
  }
  gGeo.userData.initialX = initX;
  gGeo.userData.initialSignY = initSignY;

  var m = new THREE.Mesh(gGeo, cmosDeplMat.clone());
  m.position.set(0, Y.actTop, zc);
  m.renderOrder = 2;
  m.visible = false;
  m.userData.baseEmissive = cmosDeplMat.emissive.getHex();
  m.userData.baseEmissiveIntensity = cmosDeplMat.emissiveIntensity;
  m.userData.isSculptedDepletion = true;
  reg(m, 'depletion', 'depletion');
  return m;
}

var pmosGateDepl = makeCmosGateDeplMesh(PMOS_ZC);
var nmosGateDepl = makeCmosGateDeplMesh(NMOS_ZC);

function updateCmosGateCradle(mesh, gateDrive, vRev, wSrc, wDrn, chState) {
  if (!mesh) return;
  if (gateDrive <= 0.001) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  var subFrac = Math.min(1.0, Math.max(0, gateDrive / 0.40));
  var xLeft = -0.65 + wSrc * 0.90;
  var xRight = Math.max(xLeft + 0.12, 0.65 - wDrn * 0.72);
  var gGeo = mesh.geometry;
  var pos = gGeo.attributes.position;
  var initX = gGeo.userData.initialX;
  var initSignY = gGeo.userData.initialSignY;

  for (var g = 0; g < pos.count; g++) {
    var gs = initX[g] + 0.5;
    var gx = xLeft + gs * (xRight - xLeft);
    var cT = (chState && chState.hasChannel)
      ? getCmosChanThicknessAtWorldX(gx, true, chState.maxH, chState.isSat, chState.dL, chState.ratio)
      : 0;
    var topY = (cT > 0.002) ? (-0.05 - cT * 0.5 - 0.004) : -0.004;
    var drainBias = cmosDeplSmoothstep(0.15, 1.0, gs);
    var pocketDepth = 0.24 * subFrac + 0.16 * vRev * drainBias;
    var botY = Math.max(-0.78, Math.min(topY - 0.01, -0.004 - pocketDepth));
    pos.setX(g, gx);
    pos.setY(g, initSignY[g] > 0 ? topY : botY);
  }
  pos.needsUpdate = true;
  gGeo.computeVertexNormals();
}

window.updateInverterDepletion = function(vin, vout, nmosReg, pmosReg) {
  var isOff = (vin === 'off' || vin === null || vin === undefined);
  var vInNum = isOff ? 0.50 : Number(vin);
  var vOutNum = isOff ? 0.50 : Number(vout);
  var maxH = 0.12;

  var pmosDrnRev = isOff ? 0.0 : Math.sqrt(Math.max(0, 1.00 - vOutNum));
  var nmosDrnRev = isOff ? 0.0 : Math.sqrt(Math.max(0, vOutNum));

  var wPSrc = 0.14;
  var wPDrn = 0.14 + 0.18 * pmosDrnRev;
  var wNSrc = 0.14;
  var wNDrn = 0.14 + 0.18 * nmosDrnRev;

  var vovN = isOff ? 0 : Math.max(0, vInNum - 0.40);
  var hasChanN = !isOff && nmosReg !== 'CUTOFF' && nmosReg !== 'SUBTHRESHOLD' && vovN > 0.001;
  var isSatN = hasChanN && (vOutNum >= vovN) && (nmosReg === 'SATURATION');
  var nState = {
    hasChannel: hasChanN,
    maxH: maxH,
    isSat: isSatN,
    dL: isSatN ? 2.0 * Math.min(0.40, 0.22 * Math.sqrt(Math.max(0, vOutNum - vovN))) : 0.0,
    ratio: (vovN > 0.0001) ? Math.min(1.0, Math.max(0, vOutNum / vovN)) : 1.0
  };

  var vovP = isOff ? 0 : Math.max(0, (1.00 - vInNum) - 0.40);
  var vsdP = 1.00 - vOutNum;
  var hasChanP = !isOff && pmosReg !== 'CUTOFF' && pmosReg !== 'SUBTHRESHOLD' && vovP > 0.001;
  var isSatP = hasChanP && (vsdP >= vovP) && (pmosReg === 'SATURATION');
  var pState = {
    hasChannel: hasChanP,
    maxH: maxH,
    isSat: isSatP,
    dL: isSatP ? 2.0 * Math.min(0.40, 0.22 * Math.sqrt(Math.max(0, vsdP - vovP))) : 0.0,
    ratio: (vovP > 0.0001) ? Math.min(1.0, Math.max(0, vsdP / vovP)) : 1.0
  };

  updateCmosWellShell(pmosSrcDeplEntry, false, wPSrc, pState);
  updateCmosWellShell(pmosDrnDeplEntry, true,  wPDrn, pState);
  updateCmosWellShell(nmosSrcDeplEntry, false, wNSrc, nState);
  updateCmosWellShell(nmosDrnDeplEntry, true,  wNDrn, nState);

  updateCmosGateCradle(pmosGateDepl, isOff ? 0 : Math.max(0, 1.00 - vInNum), pmosDrnRev, wPSrc, wPDrn, pState);
  updateCmosGateCradle(nmosGateDepl, isOff ? 0 : Math.max(0, vInNum),        nmosDrnRev, wNSrc, wNDrn, nState);
};

// Initial equilibrium sculpted shells
window.updateInverterDepletion('off', 0.50, 'CUTOFF', 'CUTOFF');

// ---------- 3D DYNAMIC INVERSION CHANNELS & PINCH-OFF REGIONS ----------

// NMOS Channel (Electron Inversion Layer)
var nmosChanGeom = new THREE.BoxGeometry(CH.max - CH.min, 0.12, ACTIVE_W, 24, 1, 2);
var nmosChanMat = new THREE.MeshStandardMaterial({
  color: palInitCMOS ? palInitCMOS.electronChannel : (isInitLight ? 0x4ADE80 : 0x34D399),
  emissive: palInitCMOS ? palInitCMOS.electronChannel : (isInitLight ? 0x4ADE80 : 0x34D399),
  emissiveIntensity: isInitLight ? 0.15 : 0.40,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  roughness: 0.40,
  metalness: 0.15,
  side: THREE.DoubleSide
});
var nmosChanMesh = new THREE.Mesh(nmosChanGeom, nmosChanMat);
put(nmosChanMesh, 0, Y.actTop - 0.05, NMOS_ZC);
nmosChanMesh.renderOrder = 4;
reg(nmosChanMesh, 'nmosChannel', 'active');

var nmosPinchGeom = new THREE.BoxGeometry(1.0, 0.12, ACTIVE_W, 12, 1, 2);
var nmosPinchMat = new THREE.MeshStandardMaterial({
  color: isInitLight ? 0xb45309 : 0xf59e0b,
  emissive: 0xd97706,
  emissiveIntensity: 0.55,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  roughness: 0.40,
  metalness: 0.15,
  side: THREE.DoubleSide
});
var nmosPinchMesh = new THREE.Mesh(nmosPinchGeom, nmosPinchMat);
put(nmosPinchMesh, 0.65, Y.actTop - 0.05, NMOS_ZC);
nmosPinchMesh.renderOrder = 4;
nmosPinchMesh.visible = false;
groups['active'].add(nmosPinchMesh);

// PMOS Channel (Hole Inversion Layer)
var pmosChanGeom = new THREE.BoxGeometry(CH.max - CH.min, 0.12, ACTIVE_W, 24, 1, 2);
var pmosChanMat = new THREE.MeshStandardMaterial({
  color: palInitCMOS ? palInitCMOS.holeChannel : (isInitLight ? 0x60A5FA : 0x38BDF8),
  emissive: palInitCMOS ? palInitCMOS.holeChannel : (isInitLight ? 0x60A5FA : 0x38BDF8),
  emissiveIntensity: isInitLight ? 0.15 : 0.40,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  roughness: 0.40,
  metalness: 0.15,
  side: THREE.DoubleSide
});
var pmosChanMesh = new THREE.Mesh(pmosChanGeom, pmosChanMat);
put(pmosChanMesh, 0, Y.actTop - 0.05, PMOS_ZC);
pmosChanMesh.renderOrder = 4;
reg(pmosChanMesh, 'pmosChannel', 'active');

var pmosPinchGeom = new THREE.BoxGeometry(1.0, 0.12, ACTIVE_W, 12, 1, 2);
var pmosPinchMat = new THREE.MeshStandardMaterial({
  color: isInitLight ? 0xb45309 : 0xf59e0b,
  emissive: 0xd97706,
  emissiveIntensity: 0.55,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  roughness: 0.40,
  metalness: 0.15,
  side: THREE.DoubleSide
});
var pmosPinchMesh = new THREE.Mesh(pmosPinchGeom, pmosPinchMat);
put(pmosPinchMesh, 0.65, Y.actTop - 0.05, PMOS_ZC);
pmosPinchMesh.renderOrder = 4;
pmosPinchMesh.visible = false;
groups['active'].add(pmosPinchMesh);

// Function to dynamically update channel inversion profiles based on CMOS operating regions
window.updateInverterChannels = function(vin, vout, nmosReg, pmosReg) {
  if (typeof window.updateInverterDepletion === 'function') {
    window.updateInverterDepletion(vin, vout, nmosReg, pmosReg);
  }
  if (vin === 'off') {
    nmosChanMesh.visible = false;
    nmosPinchMesh.visible = false;
    pmosChanMesh.visible = false;
    pmosPinchMesh.visible = false;
    return;
  }

  var maxH = 0.12;

  // 1. NMOS Channel (Source at X = -1.0, Drain at X = +1.0)
  var vovN = Math.max(0, vin - 0.40);
  if (nmosReg === 'CUTOFF' || nmosReg === 'SUBTHRESHOLD' || vovN <= 0.001) {
    nmosChanMesh.visible = false;
    nmosPinchMesh.visible = false;
  } else {
    nmosChanMesh.visible = true;
    var npos = nmosChanGeom.attributes.position;

    if (!nmosChanGeom.userData.initialX) {
      var initX = new Float32Array(npos.count);
      for (var k = 0; k < npos.count; k++) initX[k] = npos.getX(k);
      nmosChanGeom.userData.initialX = initX;
    }
    var nInitX = nmosChanGeom.userData.initialX;

    var vdsDiffN = Math.max(0, vout - vovN);
    var isSatN = (vout >= vovN) && (nmosReg === 'SATURATION');
    var dLN = isSatN ? 2.0 * Math.min(0.40, 0.22 * Math.sqrt(vdsDiffN)) : 0.0;
    var ratioN = (vovN > 0.0001) ? Math.min(1.0, Math.max(0, vout / vovN)) : 1.0;

    for (var i = 0; i < npos.count; i++) {
      var origX = nInitX[i];
      var s = (origX + 1.0) / 2.0; // 0 at Source (-1.0), 1 at Drain (+1.0)
      var mappedX, thickness;

      if (!isSatN) {
        mappedX = origX;
        thickness = maxH * Math.max(0.002, 1.0 - s * ratioN);
      } else {
        mappedX = -1.0 + s * (2.0 - dLN);
        thickness = maxH * Math.max(0.002, 1.0 - s);
      }

      npos.setX(i, mappedX);
      var signY = npos.getY(i) >= 0 ? 1 : -1;
      npos.setY(i, (signY * thickness) / 2);
    }
    npos.needsUpdate = true;
    nmosChanGeom.computeVertexNormals();

    if (isSatN && dLN > 0.0005) {
      nmosPinchMesh.visible = true;
      nmosPinchMesh.scale.x = dLN;
      nmosPinchMesh.position.x = 1.0 - dLN / 2;
      nmosPinchMesh.position.y = Y.actTop - 0.05;
    } else {
      nmosPinchMesh.visible = false;
    }
  }

  // 2. PMOS Channel (Source at X = -1.0, Drain at X = +1.0)
  var vovP = Math.max(0, (1.00 - vin) - 0.40);
  var vsdP = 1.00 - vout;
  if (pmosReg === 'CUTOFF' || pmosReg === 'SUBTHRESHOLD' || vovP <= 0.001) {
    pmosChanMesh.visible = false;
    pmosPinchMesh.visible = false;
  } else {
    pmosChanMesh.visible = true;
    var ppos = pmosChanGeom.attributes.position;

    if (!pmosChanGeom.userData.initialX) {
      var initXp = new Float32Array(ppos.count);
      for (var kp = 0; kp < ppos.count; kp++) initXp[kp] = ppos.getX(kp);
      pmosChanGeom.userData.initialX = initXp;
    }
    var pInitX = pmosChanGeom.userData.initialX;

    var vsdDiffP = Math.max(0, vsdP - vovP);
    var isSatP = (vsdP >= vovP) && (pmosReg === 'SATURATION');
    var dLP = isSatP ? 2.0 * Math.min(0.40, 0.22 * Math.sqrt(vsdDiffP)) : 0.0;
    var ratioP = (vovP > 0.0001) ? Math.min(1.0, Math.max(0, vsdP / vovP)) : 1.0;

    for (var j = 0; j < ppos.count; j++) {
      var origXp = pInitX[j];
      var sp = (origXp + 1.0) / 2.0;
      var mappedXp, thicknessP;

      if (!isSatP) {
        mappedXp = origXp;
        thicknessP = maxH * Math.max(0.002, 1.0 - sp * ratioP);
      } else {
        mappedXp = -1.0 + sp * (2.0 - dLP);
        thicknessP = maxH * Math.max(0.002, 1.0 - sp);
      }

      ppos.setX(j, mappedXp);
      var signYp = ppos.getY(j) >= 0 ? 1 : -1;
      ppos.setY(j, (signYp * thicknessP) / 2);
    }
    ppos.needsUpdate = true;
    pmosChanGeom.computeVertexNormals();

    if (isSatP && dLP > 0.0005) {
      pmosPinchMesh.visible = true;
      pmosPinchMesh.scale.x = dLP;
      pmosPinchMesh.position.x = 1.0 - dLP / 2;
      pmosPinchMesh.position.y = Y.actTop - 0.05;
    } else {
      pmosPinchMesh.visible = false;
    }
  }
};

window.updateChannelThemes = function(theme) {
  var isLight = theme === 'light' || document.documentElement.getAttribute('data-theme') === 'light';
  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
  if (typeof nmosChanMat !== 'undefined' && nmosChanMat) {
    var cN = pal ? pal.electronChannel : (isLight ? 0x4ADE80 : 0x34D399);
    nmosChanMat.color.set(cN);
    nmosChanMat.emissive.set(cN);
    nmosChanMat.emissiveIntensity = isLight ? 0.15 : 0.40;
  }
  if (typeof pmosChanMat !== 'undefined' && pmosChanMat) {
    var cP = pal ? pal.holeChannel : (isLight ? 0x60A5FA : 0x38BDF8);
    pmosChanMat.color.set(cP);
    pmosChanMat.emissive.set(cP);
    pmosChanMat.emissiveIntensity = isLight ? 0.15 : 0.40;
  }
  if (typeof nmosPinchMat !== 'undefined' && nmosPinchMat) {
    nmosPinchMat.color.setHex(isLight ? 0xb45309 : 0xf59e0b);
  }
  if (typeof pmosPinchMat !== 'undefined' && pmosPinchMat) {
    pmosPinchMat.color.setHex(isLight ? 0xb45309 : 0xf59e0b);
  }
};

// ---------- GATE OXIDE (Interfacial SiO2) ----------
var oxideH = Y.oxideTop - Y.oxideBot;
var oxideMidY = (Y.oxideTop + Y.oxideBot) / 2;

var oxidePmos = box(CH.max-CH.min, oxideH, ACTIVE_W, '--c-oxide', { roughness:0.15, metalness:0.0, transparent:true, opacity:0.85, outline:false });
put(oxidePmos, 0, oxideMidY, PMOS_ZC);
reg(oxidePmos, 'pmosOxide', 'oxide');

var oxideNmos = box(CH.max-CH.min, oxideH, ACTIVE_W, '--c-oxide', { roughness:0.15, metalness:0.0, transparent:true, opacity:0.85, outline:false });
put(oxideNmos, 0, oxideMidY, NMOS_ZC);
reg(oxideNmos, 'nmosOxide', 'oxide');

// ---------- HIGH-K DIELECTRIC (HfO2) ----------
// High-k dielectric (HfO2) layer sandwiched directly above interfacial SiO2 and below the gate
var highkH = Y.highkTop - Y.highkBot;
var highkMidY = (Y.highkTop + Y.highkBot) / 2;
var highkMat = { roughness:0.12, metalness:0.10, transparent:true, opacity:0.78, outline:false };

var highkPmos = box(CH.max-CH.min, highkH, ACTIVE_W, '--c-highk', highkMat);
put(highkPmos, 0, highkMidY, PMOS_ZC);
reg(highkPmos, 'pmosHighk', 'highk');

var highkNmos = box(CH.max-CH.min, highkH, ACTIVE_W, '--c-highk', highkMat);
put(highkNmos, 0, highkMidY, NMOS_ZC);
reg(highkNmos, 'nmosHighk', 'highk');

// ---------- POLYSILICON (single continuous strip) ----------
var polyMesh = box(CH.max-CH.min, Y.polyTop-Y.polyBot, POLY_Z1-POLY_Z0, '--c-poly', { roughness:0.45, metalness:0.2 });
put(polyMesh, 0, (Y.polyTop+Y.polyBot)/2, (POLY_Z0+POLY_Z1)/2);
reg(polyMesh, 'poly', 'poly');

// ---------- GATE SIDEWALL SPACERS (Si3N4) - flush with SDE/LDD outer edges (±1.20) ----------
var cmosSpacerGap = 0.004;
var cmosSpacerOuterX = 1.20;
var cmosSpacerW = cmosSpacerOuterX - CH.max - cmosSpacerGap; // 0.196
var cmosSpacerBot = Y.oxideBot + 0.002;
var cmosSpacerH = Y.polyTop - cmosSpacerBot;
var cmosSpacerMidY = (Y.polyTop + cmosSpacerBot) / 2;
var cmosSpacerCX = CH.max + cmosSpacerGap + cmosSpacerW / 2;

var cmosSpacerMat = new THREE.MeshStandardMaterial({
  color: 0x7dd3fc,
  roughness: 0.45,
  metalness: 0.04,
  transparent: true,
  opacity: 0.62,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -0.5,
  polygonOffsetUnits: -0.5,
  side: THREE.DoubleSide
});
var cmosSpacerGeo = new THREE.BoxGeometry(cmosSpacerW, cmosSpacerH, ACTIVE_W);
var cmosSpacerEdges = new THREE.EdgesGeometry(cmosSpacerGeo, 24);
var cmosSpacerEdgeMat = new THREE.LineBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.35, depthWrite: false });

[PMOS_ZC, NMOS_ZC].forEach(function(zcRow) {
  [-cmosSpacerCX, cmosSpacerCX].forEach(function(sx) {
    var sp = new THREE.Mesh(cmosSpacerGeo, cmosSpacerMat);
    put(sp, sx, cmosSpacerMidY, zcRow);
    sp.renderOrder = 6;
    var el = new THREE.LineSegments(cmosSpacerEdges, cmosSpacerEdgeMat);
    el.raycast = function() {};
    sp.add(el);
    reg(sp, 'spacer', 'spacer');
  });
});

// ---------- SELF-ALIGNED SILICIDE (SALICIDE / NiSi) CONTACT PADS ----------
var silHInv = Y.silTop - Y.silBot;
var silMidYInv = (Y.silTop + Y.silBot) / 2;
var silInnerInv = cmosSpacerOuterX + 0.006; // strictly outside spacers (1.206)
var silOuterInv = Math.abs(SRC_X0) - 0.04;    // 3.96
var silWInv = silOuterInv - silInnerInv;      // 2.754
var silCXInv = (silOuterInv + silInnerInv) / 2; // 2.583

function createCmosSalicideGeo(w, h, d, outerDir) {
  var hw = w / 2, hd = d / 2;
  var rIn = outerDir === 0 ? 0.15 : 0.01;
  var rOut = Math.min(0.35, hw * 0.45, hd * 0.45);
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

var silMatInverter = new THREE.MeshStandardMaterial({
  color: isInitLight ? 0x647082 : 0x6e7887,
  roughness: 0.28,
  metalness: 0.80,
  roughnessMap: getBrushedMetalTexture(),
  polygonOffset: true,
  polygonOffsetFactor: -1.5,
  polygonOffsetUnits: -1.5,
  emissive: 0x000000,
  emissiveIntensity: 0
});

function addInverterSilicide(geo, xPos, zPos) {
  var m = new THREE.Mesh(geo, silMatInverter);
  m.castShadow = true;
  m.receiveShadow = true;
  m.renderOrder = 5;
  var el = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 24),
    new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.45, depthWrite: false })
  );
  el.raycast = function() {};
  m.add(el);
  put(m, xPos, silMidYInv, zPos);
  reg(m, 'silicide', 'silicide');
  return m;
}

[PMOS_ZC, NMOS_ZC].forEach(function(zcRow) {
  addInverterSilicide(createCmosSalicideGeo(silWInv, silHInv, ACTIVE_W, -1), -silCXInv, zcRow);
  addInverterSilicide(createCmosSalicideGeo(silWInv, silHInv, ACTIVE_W, 1), silCXInv, zcRow);
  addInverterSilicide(createFilletedTraceGeometry(1.12, silHInv, 1.12, 0.20, 0.006), TAP_X, zcRow);
});

// ---------- CONTACTS (Tapered Tungsten Plugs) ----------
function contactAt(x, z, topOfLower, id){
  var h = Y.metalBot - topOfLower;
  // Subtle conical taper: radiusTop = 0.21, radiusBottom = 0.17
  var geo = new THREE.CylinderGeometry(0.21, 0.17, h, 16);
  var mat = new THREE.MeshStandardMaterial({
    color: 0x4a4d54, // Dark tungsten/titanium metallic plug
    metalness: 0.95,
    roughness: 0.25,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  var c = new THREE.Mesh(geo, mat);
  c.castShadow = true;
  c.receiveShadow = true;
  c.userData.baseEmissive = 0x000000;
  c.userData.baseEmissiveIntensity = 0;
  put(c, x, topOfLower + h / 2, z);
  reg(c, id, 'contact');
  return c;
}
contactAt(SRC_X, PMOS_ZC, Y.silTop, 'pmosSrcCt');
contactAt(DRN_X, PMOS_ZC, Y.silTop, 'pmosDrnCt');
contactAt(SRC_X, NMOS_ZC, Y.silTop, 'nmosSrcCt');
contactAt(DRN_X, NMOS_ZC, Y.silTop, 'nmosDrnCt');
contactAt(0, POLY_CT_Z, Y.polyTop, 'polyCt');
contactAt(TAP_X, PMOS_ZC, Y.silTop, 'welltapCt');
contactAt(TAP_X, NMOS_ZC, Y.silTop, 'subtapCt');

// ---------- METAL-1 (Flat Ribbon Routes, 45° Chamfered Bends, Landing Pads & Metallic Shaders) ----------
var metalH = Y.metalTop - Y.metalBot; // 0.15 = 1λ (flat ribbon thickness)
var midY = (Y.metalTop + Y.metalBot) / 2; // 3.025
var METAL_W = 0.45; // 3λ wire width

function metalBar(x0, x1, z0, z1, colorVar, id, cornerRadius){
  var w = Math.abs(x1 - x0) || METAL_W;
  var d = Math.abs(z1 - z0) || METAL_W;
  var finalW = Math.max(w, METAL_W);
  var finalD = Math.max(d, METAL_W);

  var geo = createFilletedTraceGeometry(finalW, metalH, finalD, cornerRadius !== undefined ? cornerRadius : 0.15, 0.02);
  var mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cssVar(colorVar)),
    metalness: 0.90,
    roughness: 0.20,
    roughnessMap: getBrushedMetalTexture(),
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  var m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.baseEmissive = 0x000000;
  m.userData.baseEmissiveIntensity = 0;
  put(m, (x0 + x1) / 2, midY, (z0 + z1) / 2);
  reg(m, id, 'metal');
  return m;
}

// Expanded 5λ x 5λ octagonal via landing pad (1λ PDK via enclosure rule on all sides)
function metalViaPad(x, z, colorVar, parentId){
  var padGeo = createOctagonalViaPadGeometry(0.75, metalH, 0.15, 0.02);
  var mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cssVar(colorVar)),
    metalness: 0.90,
    roughness: 0.20,
    roughnessMap: getBrushedMetalTexture(),
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  var m = new THREE.Mesh(padGeo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.baseEmissive = 0x000000;
  m.userData.baseEmissiveIntensity = 0;
  m.userData.isViaLanding = true;
  put(m, x, midY, z);
  reg(m, parentId || 'metal', 'metal');
  return m;
}

// 45-degree chamfered T-junction at 90° interconnect turns (prevents sharp rectangular bends)
function metalJunction(x, z, branchDir, colorVar, parentId){
  var juncGeo = createChamferedTJunctionGeometry(branchDir, METAL_W, METAL_W, 0.15, metalH, 0.02);
  var mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(cssVar(colorVar)),
    metalness: 0.90,
    roughness: 0.20,
    roughnessMap: getBrushedMetalTexture(),
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  var m = new THREE.Mesh(juncGeo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.baseEmissive = 0x000000;
  m.userData.baseEmissiveIntensity = 0;
  m.userData.isViaLanding = true;
  put(m, x, midY, z);
  reg(m, parentId || 'metal', 'metal');
  return m;
}

// VDD rail + stubs
metalBar(-9, 9, RAIL_Z, RAIL_Z, '--c-vdd', 'vddRail');
metalBar(SRC_X, SRC_X, PMOS_ZC, RAIL_Z, '--c-vdd', 'vddStubPmos');
metalBar(TAP_X, TAP_X, PMOS_ZC, RAIL_Z, '--c-vdd', 'vddStubTap');
// VDD 45-degree chamfered turns & expanded via landing pads
metalJunction(SRC_X, RAIL_Z, '-z', '--c-vdd', 'vddStubPmos');
metalJunction(TAP_X, RAIL_Z, '-z', '--c-vdd', 'vddStubTap');
metalViaPad(SRC_X, PMOS_ZC, '--c-vdd', 'vddStubPmos');
metalViaPad(TAP_X, PMOS_ZC, '--c-vdd', 'vddStubTap');

// GND rail + stubs
metalBar(-9, 9, -RAIL_Z, -RAIL_Z, '--c-gnd', 'gndRail');
metalBar(SRC_X, SRC_X, NMOS_ZC, -RAIL_Z, '--c-gnd', 'gndStubNmos');
metalBar(TAP_X, TAP_X, NMOS_ZC, -RAIL_Z, '--c-gnd', 'gndStubTap');
// GND 45-degree chamfered turns & expanded via landing pads
metalJunction(SRC_X, -RAIL_Z, '+z', '--c-gnd', 'gndStubNmos');
metalJunction(TAP_X, -RAIL_Z, '+z', '--c-gnd', 'gndStubTap');
metalViaPad(SRC_X, NMOS_ZC, '--c-gnd', 'gndStubNmos');
metalViaPad(TAP_X, NMOS_ZC, '--c-gnd', 'gndStubTap');

// OUT spine + pin
metalBar(DRN_X, DRN_X, PMOS_ZC, NMOS_ZC, '--c-out', 'outSpine');
metalBar(DRN_X, DRN_X+3.5, 0, 0, '--c-out', 'outPin');
// OUT 45-degree chamfered turn & expanded via landing pads
metalJunction(DRN_X, 0, '+x', '--c-out', 'outSpine');
metalViaPad(DRN_X, PMOS_ZC, '--c-out', 'outSpine');
metalViaPad(DRN_X, NMOS_ZC, '--c-out', 'outSpine');

// IN pin + poly via landing pad
metalBar(0, 0, POLY_CT_Z, POLY_CT_Z+0.9, '--c-in', 'inPin');
metalViaPad(0, POLY_CT_Z, '--c-in', 'inPin');

// =====================================================================
// LABELS
// =====================================================================
function addLabel(text, x,y,z, colorHex, groupKey){
  var s = makeLabel(text, colorHex);
  s.position.set(x,y,z);
  s.userData.isLabel = true;
  groups[groupKey].add(s);
  return s;
}
addLabel('VDD', -9, Y.metalTop+0.6, RAIL_Z, '#e35d5d', 'metal');
addLabel('PMOS', SRC_X-1.2, Y.actTop+0.9, PMOS_ZC, '#60a5fa', 'active');
addLabel('P-SDE', -0.925, Y.actTop+0.45, PMOS_ZC - 3.4, '#93c5fd', 'sde');
addLabel('N-WELL', 4.8, Y.wellTop+0.5, nwellZC, '#4ade80', 'well');
addLabel('P-WELL', 4.8, Y.wellTop+0.5, pwellZC, '#60a5fa', 'well');
addLabel('DEPLETION', 4.8, Y.actTop+0.35, PMOS_ZC - 1.9, '#94a3b8', 'depletion');
addLabel('POLY GATE', 0, Y.polyTop+0.7, 0, '#d8503c', 'poly');
addLabel('HIGH-K (HfO2)', -1.9, Y.highkTop+0.35, PMOS_ZC, '#c084fc', 'highk');
addLabel('SiO2 OXIDE', 1.9, Y.oxideTop+0.35, PMOS_ZC, '#8fc9dc', 'oxide');
addLabel('IN', 0, Y.metalTop+0.6, POLY_CT_Z+1.1, '#e6c94a', 'metal');
addLabel('OUT', DRN_X+3.6, Y.metalTop+0.6, 0, '#57cf8f', 'metal');
addLabel('NMOS', SRC_X-1.2, Y.actTop+0.9, NMOS_ZC, '#4ade80', 'active');
addLabel('N-SDE', -0.925, Y.actTop+0.45, NMOS_ZC - 3.4, '#86efac', 'sde');
addLabel('P-SUBSTRATE', 8.5, Y.subTop+0.4, 0, '#9aa6b6', 'substrate');
addLabel('GND', -9, Y.metalTop+0.6, -RAIL_Z, '#9aa6b6', 'metal');

function toggleLabels(visible) {
  if (typeof labelSprites !== 'undefined') {
    labelSprites.forEach(function(s) {
      if (s) s.visible = visible;
    });
  }
}
window.toggleLabels = toggleLabels;

var initLabelChk = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
if (initLabelChk) {
  toggleLabels(initLabelChk.checked);
}
