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

// canvas-sprite labels with depthTest disabled so scene geometry never clips through badges
var labelSprites = [];

function makeLabel(text, colorHex){
  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var pad = 10, fontSize = 30;
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
  var mat = new THREE.SpriteMaterial({ map: tex, depthTest:false, depthWrite:false, transparent:true });
  var sprite = new THREE.Sprite(mat);
  var scale = 0.0118;
  sprite.scale.set(canvas.width*scale, canvas.height*scale, 1);
  sprite.renderOrder = 999;
  sprite.raycast = function(){};
  sprite.userData.isLabel = true;
  sprite.userData.labelText = text;
  sprite.userData.colorHex = colorHex;
  labelSprites.push(sprite);
  return sprite;
}

function updateLabelSprite(sprite, text, colorHex, isLight){
  var pad = 10, fontSize = 30;
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
  sprite.scale.set(canvas.width * 0.0118, canvas.height * 0.0118, 1);
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

  if (typeof window.updateBulkCarriersTheme === 'function') {
    window.updateBulkCarriersTheme(isLight ? 'light' : 'dark');
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

  return { src:src, drn:drn, srcSde:srcSde, drnSde:drnSde, gateSeg:gateSeg };
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

function getCmosChanThicknessAtWorldX(worldX, hasChannel, maxH, isSat, dL, ratio, optHalfL) {
  var hL = typeof optHalfL === 'number' ? optHalfL : ((typeof cmosGeom3D !== 'undefined' && cmosGeom3D) ? cmosGeom3D.halfL : 1.0);
  var fullL = Math.max(0.002, hL * 2.0);
  if (!hasChannel || worldX < -(hL + 0.001) || worldX > (hL + 0.001)) return 0;
  var pinchX = hL - dL;
  if (isSat) {
    if (worldX >= pinchX) return 0;
    var sSat = Math.max(0, Math.min(1, (worldX + hL) / Math.max(0.001, fullL - dL)));
    return maxH * Math.max(0, 1.0 - sSat);
  }
  var sLin = Math.max(0, Math.min(1, (worldX + hL) / fullL));
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
  var hL = (typeof cmosGeom3D !== 'undefined' && cmosGeom3D) ? cmosGeom3D.halfL : 1.0;
  var subFrac = Math.min(1.0, Math.max(0, gateDrive / 0.40));
  var xLeft = -hL * 0.65 + wSrc * 0.90;
  var xRight = Math.max(xLeft + 0.12, hL * 0.65 - wDrn * 0.72);
  var gGeo = mesh.geometry;
  var pos = gGeo.attributes.position;
  var initX = gGeo.userData.initialX;
  var initSignY = gGeo.userData.initialSignY;

  for (var g = 0; g < pos.count; g++) {
    var gs = initX[g] + 0.5;
    var gx = xLeft + gs * (xRight - xLeft);
    var cT = (chState && chState.hasChannel)
      ? getCmosChanThicknessAtWorldX(gx, true, chState.maxH, chState.isSat, chState.dL, chState.ratio, hL)
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

var _lastInvDeplArgs = ['off', 0.50, 'CUTOFF', 'CUTOFF', 0.30, 0.30];

window.updateInverterDepletion = function(vin, vout, nmosReg, pmosReg, optVthN, optVthP) {
  var vthN = typeof optVthN === 'number' ? optVthN : 0.30;
  var vthP = typeof optVthP === 'number' ? optVthP : 0.30;
  _lastInvDeplArgs = [vin, vout, nmosReg, pmosReg, vthN, vthP];

  var hL = (typeof cmosGeom3D !== 'undefined' && cmosGeom3D) ? cmosGeom3D.halfL : 1.0;
  var fullL = hL * 2.0;

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

  var vovN = isOff ? 0 : Math.max(0, vInNum - vthN);
  var hasChanN = !isOff && nmosReg !== 'CUTOFF' && nmosReg !== 'SUBTHRESHOLD' && vovN > 0.001;
  var isSatN = hasChanN && (vOutNum >= vovN) && (nmosReg === 'SATURATION');
  var nState = {
    hasChannel: hasChanN,
    maxH: maxH,
    isSat: isSatN,
    dL: isSatN ? fullL * Math.min(0.40, 0.22 * Math.sqrt(Math.max(0, vOutNum - vovN))) : 0.0,
    ratio: (vovN > 0.0001) ? Math.min(1.0, Math.max(0, vOutNum / vovN)) : 1.0
  };

  var vovP = isOff ? 0 : Math.max(0, (1.00 - vInNum) - vthP);
  var vsdP = 1.00 - vOutNum;
  var hasChanP = !isOff && pmosReg !== 'CUTOFF' && pmosReg !== 'SUBTHRESHOLD' && vovP > 0.001;
  var isSatP = hasChanP && (vsdP >= vovP) && (pmosReg === 'SATURATION');
  var pState = {
    hasChannel: hasChanP,
    maxH: maxH,
    isSat: isSatP,
    dL: isSatP ? fullL * Math.min(0.40, 0.22 * Math.sqrt(Math.max(0, vsdP - vovP))) : 0.0,
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
window.updateInverterChannels = function(vin, vout, nmosReg, pmosReg, optVthN, optVthP) {
  var vthN = typeof optVthN === 'number' ? optVthN : 0.30;
  var vthP = typeof optVthP === 'number' ? optVthP : 0.30;
  if (typeof window.updateInverterDepletion === 'function') {
    window.updateInverterDepletion(vin, vout, nmosReg, pmosReg, vthN, vthP);
  }
  if (vin === 'off') {
    nmosChanMesh.visible = false;
    nmosPinchMesh.visible = false;
    pmosChanMesh.visible = false;
    pmosPinchMesh.visible = false;
    return;
  }

  var hL = (typeof cmosGeom3D !== 'undefined' && cmosGeom3D) ? cmosGeom3D.halfL : 1.0;
  var fullL = hL * 2.0;
  var wpScale = (typeof cmosGeom3D !== 'undefined' && cmosGeom3D) ? (cmosGeom3D.wp3d / ACTIVE_W) : 1.0;
  var wnScale = (typeof cmosGeom3D !== 'undefined' && cmosGeom3D) ? (cmosGeom3D.wn3d / ACTIVE_W) : 1.0;
  var pZC = (typeof cmosGeom3D !== 'undefined' && cmosGeom3D) ? cmosGeom3D.pmosZC : PMOS_ZC;
  var nZC = (typeof cmosGeom3D !== 'undefined' && cmosGeom3D) ? cmosGeom3D.nmosZC : NMOS_ZC;

  nmosChanMesh.scale.set(1, 1, wnScale);
  nmosChanMesh.position.z = nZC;
  pmosChanMesh.scale.set(1, 1, wpScale);
  pmosChanMesh.position.z = pZC;

  var maxH = 0.12;

  // 1. NMOS Channel (Source at X = -halfL, Drain at X = +halfL)
  var vovN = Math.max(0, vin - vthN);
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
    var dLN = isSatN ? fullL * Math.min(0.40, 0.22 * Math.sqrt(vdsDiffN)) : 0.0;
    var ratioN = (vovN > 0.0001) ? Math.min(1.0, Math.max(0, vout / vovN)) : 1.0;

    for (var i = 0; i < npos.count; i++) {
      var origX = nInitX[i];
      var s = (origX + 1.0) / 2.0; // 0 at Source, 1 at Drain
      var mappedX, thickness;

      if (!isSatN) {
        mappedX = -hL + s * fullL;
        thickness = maxH * Math.max(0.002, 1.0 - s * ratioN);
      } else {
        mappedX = -hL + s * (fullL - dLN);
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
      nmosPinchMesh.scale.set(dLN, 1, wnScale);
      nmosPinchMesh.position.set(hL - dLN / 2, Y.actTop - 0.05, nZC);
    } else {
      nmosPinchMesh.visible = false;
    }
  }

  // 2. PMOS Channel (Source at X = -halfL, Drain at X = +halfL)
  var vovP = Math.max(0, (1.00 - vin) - vthP);
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
    var dLP = isSatP ? fullL * Math.min(0.40, 0.22 * Math.sqrt(vsdDiffP)) : 0.0;
    var ratioP = (vovP > 0.0001) ? Math.min(1.0, Math.max(0, vsdP / vovP)) : 1.0;

    for (var j = 0; j < ppos.count; j++) {
      var origXp = pInitX[j];
      var sp = (origXp + 1.0) / 2.0;
      var mappedXp, thicknessP;

      if (!isSatP) {
        mappedXp = -hL + sp * fullL;
        thicknessP = maxH * Math.max(0.002, 1.0 - sp * ratioP);
      } else {
        mappedXp = -hL + sp * (fullL - dLP);
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
      pmosPinchMesh.scale.set(dLP, 1, wpScale);
      pmosPinchMesh.position.set(hL - dLP / 2, Y.actTop - 0.05, pZC);
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

// ---------- GATE SIDEWALL SPACERS (Si3N4) - flush with gate faces (±(halfL + w/2 + 0.002)) ----------
var cmosSpacerGap = 0.002;
var cmosSpacerW = 0.20;
var cmosSpacerOuterX = CH.max + cmosSpacerGap + cmosSpacerW;
var cmosSpacerBot = Y.oxideBot + 0.002;
var cmosSpacerH = Y.polyTop - cmosSpacerBot;
var cmosSpacerMidY = (Y.polyTop + cmosSpacerBot) / 2;
var cmosSpacerCX = CH.max + cmosSpacerW / 2 + cmosSpacerGap;

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

var cmosSpacerList = [];
[PMOS_ZC, NMOS_ZC].forEach(function(zcRow, rIdx) {
  [-cmosSpacerCX, cmosSpacerCX].forEach(function(sx, sIdx) {
    var sp = new THREE.Mesh(cmosSpacerGeo, cmosSpacerMat);
    put(sp, sx, cmosSpacerMidY, zcRow);
    sp.renderOrder = 6;
    var el = new THREE.LineSegments(cmosSpacerEdges, cmosSpacerEdgeMat);
    el.raycast = function() {};
    sp.add(el);
    reg(sp, 'spacer', 'spacer');
    cmosSpacerList.push({ mesh: sp, isPmos: rIdx === 0, side: sIdx === 0 ? -1 : 1 });
  });
});

// ---------- SELF-ALIGNED SILICIDE (SALICIDE / NiSi) CONTACT PADS ----------
var silHInv = Y.silTop - Y.silBot;
var silMidYInv = (Y.silTop + Y.silBot) / 2;
var silInnerInv = cmosSpacerOuterX + 0.006; // strictly outside spacers
var silOuterInv = Math.abs(SRC_X0) - 0.04;    // 3.96
var silWInv = silOuterInv - silInnerInv;      // 2.752
var silCXInv = (silOuterInv + silInnerInv) / 2; // 2.584

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

var silRefs = {};
[PMOS_ZC, NMOS_ZC].forEach(function(zcRow, rIdx) {
  var key = rIdx === 0 ? 'pmos' : 'nmos';
  silRefs[key + 'Src'] = addInverterSilicide(createCmosSalicideGeo(silWInv, silHInv, ACTIVE_W, -1), -silCXInv, zcRow);
  silRefs[key + 'Drn'] = addInverterSilicide(createCmosSalicideGeo(silWInv, silHInv, ACTIVE_W, 1), silCXInv, zcRow);
  silRefs[key + 'Tap'] = addInverterSilicide(createFilletedTraceGeometry(1.12, silHInv, 1.12, 0.20, 0.006), TAP_X, zcRow);
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
var ctRefs = {
  pmosSrc: contactAt(SRC_X, PMOS_ZC, Y.silTop, 'pmosSrcCt'),
  pmosDrn: contactAt(DRN_X, PMOS_ZC, Y.silTop, 'pmosDrnCt'),
  nmosSrc: contactAt(SRC_X, NMOS_ZC, Y.silTop, 'nmosSrcCt'),
  nmosDrn: contactAt(DRN_X, NMOS_ZC, Y.silTop, 'nmosDrnCt'),
  poly:    contactAt(0, POLY_CT_Z, Y.polyTop, 'polyCt'),
  welltap: contactAt(TAP_X, PMOS_ZC, Y.silTop, 'welltapCt'),
  subtap:  contactAt(TAP_X, NMOS_ZC, Y.silTop, 'subtapCt')
};

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
  m.userData.baseW = finalW;
  m.userData.baseD = finalD;
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

var metalRefs = {
  vddRail:      metalBar(-9, 9, RAIL_Z, RAIL_Z, '--c-vdd', 'vddRail'),
  vddStubPmos:  metalBar(SRC_X, SRC_X, PMOS_ZC, RAIL_Z, '--c-vdd', 'vddStubPmos'),
  vddStubTap:   metalBar(TAP_X, TAP_X, PMOS_ZC, RAIL_Z, '--c-vdd', 'vddStubTap'),
  jVddPmos:     metalJunction(SRC_X, RAIL_Z, '-z', '--c-vdd', 'vddStubPmos'),
  jVddTap:      metalJunction(TAP_X, RAIL_Z, '-z', '--c-vdd', 'vddStubTap'),
  padVddPmos:   metalViaPad(SRC_X, PMOS_ZC, '--c-vdd', 'vddStubPmos'),
  padVddTap:    metalViaPad(TAP_X, PMOS_ZC, '--c-vdd', 'vddStubTap'),

  gndRail:      metalBar(-9, 9, -RAIL_Z, -RAIL_Z, '--c-gnd', 'gndRail'),
  gndStubNmos:  metalBar(SRC_X, SRC_X, NMOS_ZC, -RAIL_Z, '--c-gnd', 'gndStubNmos'),
  gndStubTap:   metalBar(TAP_X, TAP_X, NMOS_ZC, -RAIL_Z, '--c-gnd', 'gndStubTap'),
  jGndNmos:     metalJunction(SRC_X, -RAIL_Z, '+z', '--c-gnd', 'gndStubNmos'),
  jGndTap:      metalJunction(TAP_X, -RAIL_Z, '+z', '--c-gnd', 'gndStubTap'),
  padGndNmos:   metalViaPad(SRC_X, NMOS_ZC, '--c-gnd', 'gndStubNmos'),
  padGndTap:    metalViaPad(TAP_X, NMOS_ZC, '--c-gnd', 'gndStubTap'),

  outSpine:     metalBar(DRN_X, DRN_X, PMOS_ZC, NMOS_ZC, '--c-out', 'outSpine'),
  outPin:       metalBar(DRN_X, DRN_X+3.5, 0, 0, '--c-out', 'outPin'),
  jOut:         metalJunction(DRN_X, 0, '+x', '--c-out', 'outSpine'),
  padOutPmos:   metalViaPad(DRN_X, PMOS_ZC, '--c-out', 'outSpine'),
  padOutNmos:   metalViaPad(DRN_X, NMOS_ZC, '--c-out', 'outSpine'),

  inPin:        metalBar(0, 0, POLY_CT_Z, POLY_CT_Z+0.9, '--c-in', 'inPin'),
  padIn:        metalViaPad(0, POLY_CT_Z, '--c-in', 'inPin')
};

// =====================================================================
// LABELS (Perimeter bulk + staggered elevations + subtle leader lines)
// =====================================================================
function addLabel(text, x, y, z, colorHex, groupKey, anchorPt){
  var s = makeLabel(text, colorHex);
  s.position.set(x, y, z);
  s.userData.isLabel = true;
  groups[groupKey].add(s);

  if (anchorPt && anchorPt.length === 3) {
    var dx = anchorPt[0] - x;
    var dy = anchorPt[1] - y;
    var dz = anchorPt[2] - z;
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
      var line = new THREE.Line(lineGeo, lineMat);
      line.position.set(x, y, z);
      line.renderOrder = 998;
      line.raycast = function(){};
      line.userData.isLabel = true;
      groups[groupKey].add(line);
      s.userData.leaderLine = line;
    }
  }
  return s;
}

function updateLabelPlacement(s, x, y, z, ax, ay, az) {
  if (!s) return;
  s.position.set(x, y, z);
  var line = s.userData && s.userData.leaderLine;
  if (line) {
    line.position.set(x, y, z);
    if (line.geometry && typeof line.geometry.setFromPoints === 'function') {
      line.geometry.setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(ax - x, ay - y, az - z)
      ]);
    }
  }
}

var lblRefs = {
  vdd:   addLabel('VDD', -9.0, Y.metalTop + 0.85, RAIL_Z + 0.35, '#e35d5d', 'metal', [-9.0, Y.metalTop, RAIL_Z]),
  gnd:   addLabel('GND', -9.0, Y.metalTop + 0.85, -RAIL_Z - 0.35, '#9aa6b6', 'metal', [-9.0, Y.metalTop, -RAIL_Z]),
  inPin: addLabel('IN', 0.0, Y.metalTop + 0.90, POLY_CT_Z + 1.35, '#e6c94a', 'metal', [0.0, Y.metalTop, POLY_CT_Z]),
  out:   addLabel('OUT', DRN_X + 3.8, Y.metalTop + 0.85, 0.0, '#57cf8f', 'metal', [DRN_X + 3.2, Y.metalTop, 0.0]),

  nwell: addLabel('N-WELL', 5.5, Y.wellTop + 0.85, 8.2, '#4ade80', 'well', [5.4, Y.wellTop, 8.0]),
  pwell: addLabel('P-WELL', 5.5, Y.wellTop + 0.85, -8.2, '#60a5fa', 'well', [5.4, Y.wellTop, -8.0]),
  psub:  addLabel('P-SUBSTRATE', 8.8, Y.subTop + 0.55, -10.8, '#9aa6b6', 'substrate', [8.8, Y.subTop, -10.8]),

  poly:  addLabel('POLY GATE', 0.0, Y.polyTop + 1.85, 0.0, '#d8503c', 'poly', [0.0, Y.polyTop, 0.0]),
  pmos:  addLabel('PMOS', SRC_X - 1.0, Y.actTop + 1.55, PMOS_ZC, '#60a5fa', 'active', [SRC_X, Y.actTop, PMOS_ZC]),
  nmos:  addLabel('NMOS', SRC_X - 1.0, Y.actTop + 1.55, NMOS_ZC, '#4ade80', 'active', [SRC_X, Y.actTop, NMOS_ZC]),
  depl:  addLabel('DEPLETION', 3.2, Y.actTop + 1.35, PMOS_ZC - 1.9, '#94a3b8', 'depletion', [2.6, Y.actTop - 0.05, PMOS_ZC - 1.6]),
  psde:  addLabel('P-SDE', -1.05, Y.actTop + 1.05, PMOS_ZC - 3.2, '#93c5fd', 'sde', [-0.925, Y.actTop, PMOS_ZC - 2.6]),
  nsde:  addLabel('N-SDE', -1.05, Y.actTop + 1.05, NMOS_ZC + 3.2, '#86efac', 'sde', [-0.925, Y.actTop, NMOS_ZC + 2.6]),
  highk: addLabel('HIGH-K (HfO2)', -2.0, Y.highkTop + 2.35, PMOS_ZC + 1.5, '#c084fc', 'highk', [-0.85, Y.highkTop, PMOS_ZC + 0.8]),
  oxide: addLabel('SiO2 OXIDE', 1.9, Y.oxideTop + 2.15, PMOS_ZC + 1.6, '#8fc9dc', 'oxide', [0.85, Y.oxideTop, PMOS_ZC + 0.8])
};

function toggleLabels(visible) {
  if (typeof labelSprites !== 'undefined') {
    labelSprites.forEach(function(s) {
      if (s) {
        s.visible = visible;
        if (s.userData && s.userData.leaderLine) {
          s.userData.leaderLine.visible = visible;
        }
      }
    });
  }
}
window.toggleLabels = toggleLabels;

var initLabelChk = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
if (initLabelChk) {
  toggleLabels(initLabelChk.checked);
}

// =====================================================================
// DYNAMIC 3D CMOS GEOMETRY SCALING (Wp, Wn, L)
// =====================================================================
var BASE_POLY_D = POLY_Z1 - POLY_Z0;
var cmosGeom3D = {
  Wp_nm: 240,
  Wn_nm: 120,
  L_nm: 28,
  halfL: 1.0,
  wp3d: ACTIVE_W,
  wn3d: 4.30,
  pmosZC: PMOS_ZC,
  nmosZC: NMOS_ZC,
  srcX: SRC_X,
  drnX: DRN_X,
  tapX: TAP_X,
  railZp: RAIL_Z,
  railZn: -RAIL_Z,
  polyCtZ: POLY_CT_Z,
  subHalfW: 11.0,
  subHalfD: 12.0
};

function getCmosGeom3DState() {
  return cmosGeom3D;
}
window.getCmosGeom3DState = getCmosGeom3DState;

function mapWidthNmTo3D(wNm) {
  return ACTIVE_W * Math.pow(Math.max(40, wNm) / 240.0, 0.48);
}

function mapLengthNmToHalfL(lNm) {
  return 1.0 * Math.pow(Math.max(18, lNm) / 28.0, 0.50);
}

window.updateCmosGeometry3D = function(Wp_nm, Wn_nm, L_nm) {
  var wP = typeof Wp_nm === 'number' ? Wp_nm : 240;
  var wN = typeof Wn_nm === 'number' ? Wn_nm : 120;
  var lN = typeof L_nm === 'number' ? L_nm : 28;

  var hL = mapLengthNmToHalfL(lN);
  var deltaHalfL = hL - 1.0;
  var wp3d = mapWidthNmTo3D(wP);
  var wn3d = mapWidthNmTo3D(wN);

  // Anchor inner active boundaries at ±1.55 to guarantee a constant P-substrate isolation strip [-0.75, +0.75]
  var zcP = 1.55 + wp3d * 0.5;
  var zcN = -(1.55 + wn3d * 0.5);
  var srcX = -(hL + 1.5);
  var drnX = hL + 1.5;
  var tapX = -6.0 - deltaHalfL;

  var polyZ0 = zcN - wn3d * 0.5;
  var polyZ1 = zcP + wp3d * 0.5 + 0.60;
  var polyCtZ = zcP + wp3d * 0.5 + 0.30;
  var railZp = zcP + wp3d * 0.5 + 1.60;
  var railZn = -(Math.abs(zcN) + wn3d * 0.5 + 1.60);

  var wpScale = wp3d / ACTIVE_W;
  var wnScale = wn3d / ACTIVE_W;
  var lScale = hL / 1.0;

  var newWellW = wellW + 2.0 * Math.max(0, deltaHalfL);
  var newWellDP = wp3d + 1.60;
  var newWellDN = wn3d + 1.60;
  var newSubW = Math.max(22.0, 22.0 + 2.2 * Math.max(0, deltaHalfL));
  var newSubD = Math.max(24.0, (Math.max(railZp, -railZn) + 2.8) * 2.0);

  cmosGeom3D.Wp_nm = wP;
  cmosGeom3D.Wn_nm = wN;
  cmosGeom3D.L_nm = lN;
  cmosGeom3D.halfL = hL;
  cmosGeom3D.wp3d = wp3d;
  cmosGeom3D.wn3d = wn3d;
  cmosGeom3D.pmosZC = zcP;
  cmosGeom3D.nmosZC = zcN;
  cmosGeom3D.srcX = srcX;
  cmosGeom3D.drnX = drnX;
  cmosGeom3D.tapX = tapX;
  cmosGeom3D.railZp = railZp;
  cmosGeom3D.railZn = railZn;
  cmosGeom3D.polyCtZ = polyCtZ;
  cmosGeom3D.subHalfW = newSubW * 0.5;
  cmosGeom3D.subHalfD = newSubD * 0.5;

  // Substrate & Twin Wells
  subMesh.scale.set(newSubW / 22.0, 1, newSubD / 24.0);
  wellMesh.scale.set(newWellW / wellW, 1, newWellDP / wellD);
  wellMesh.position.z = zcP;
  pwellMesh.scale.set(newWellW / wellW, 1, newWellDN / wellD);
  pwellMesh.position.z = zcN;

  // Active S/D, SDE & GateSeg
  var sdeOffX = hL - 0.075;
  pmosAct.src.position.set(srcX, (Y.actTop + Y.actBot) / 2, zcP);
  pmosAct.src.scale.set(1, 1, wpScale);
  pmosAct.drn.position.set(drnX, (Y.actTop + Y.actBot) / 2, zcP);
  pmosAct.drn.scale.set(1, 1, wpScale);
  pmosAct.srcSde.position.set(-sdeOffX, pmosAct.srcSde.position.y, zcP);
  pmosAct.srcSde.scale.set(1, 1, wpScale);
  pmosAct.drnSde.position.set(sdeOffX, pmosAct.drnSde.position.y, zcP);
  pmosAct.drnSde.scale.set(1, 1, wpScale);
  if (pmosAct.gateSeg) {
    pmosAct.gateSeg.scale.set(lScale, 1, wpScale);
    pmosAct.gateSeg.position.z = zcP;
  }

  nmosAct.src.position.set(srcX, (Y.actTop + Y.actBot) / 2, zcN);
  nmosAct.src.scale.set(1, 1, wnScale);
  nmosAct.drn.position.set(drnX, (Y.actTop + Y.actBot) / 2, zcN);
  nmosAct.drn.scale.set(1, 1, wnScale);
  nmosAct.srcSde.position.set(-sdeOffX, nmosAct.srcSde.position.y, zcN);
  nmosAct.srcSde.scale.set(1, 1, wnScale);
  nmosAct.drnSde.position.set(sdeOffX, nmosAct.drnSde.position.y, zcN);
  nmosAct.drnSde.scale.set(1, 1, wnScale);
  if (nmosAct.gateSeg) {
    nmosAct.gateSeg.scale.set(lScale, 1, wnScale);
    nmosAct.gateSeg.position.z = zcN;
  }

  // Body & Well Taps
  wellTapPad.position.set(tapX, wellTapPad.position.y, zcP);
  subTapPad.position.set(tapX, subTapPad.position.y, zcN);

  // Dielectrics & Continuous Polysilicon Gate
  oxidePmos.scale.set(lScale, 1, wpScale);
  oxidePmos.position.z = zcP;
  highkPmos.scale.set(lScale, 1, wpScale);
  highkPmos.position.z = zcP;

  oxideNmos.scale.set(lScale, 1, wnScale);
  oxideNmos.position.z = zcN;
  highkNmos.scale.set(lScale, 1, wnScale);
  highkNmos.position.z = zcN;

  polyMesh.scale.set(lScale, 1, (polyZ1 - polyZ0) / BASE_POLY_D);
  polyMesh.position.z = (polyZ0 + polyZ1) / 2;

  // Flush Sidewall Spacers (anchored dynamically to gate faces with 0.002 gap)
  var spCX = hL + cmosSpacerW / 2 + cmosSpacerGap;
  for (var si = 0; si < cmosSpacerList.length; si++) {
    var rec = cmosSpacerList[si];
    rec.mesh.position.x = rec.side * spCX;
    rec.mesh.position.z = rec.isPmos ? zcP : zcN;
    rec.mesh.scale.z = rec.isPmos ? wpScale : wnScale;
  }

  // Self-Aligned Silicide Pads (strictly outside spacers)
  var silMidX = hL + 1.584;
  silRefs.pmosSrc.position.set(-silMidX, silMidYInv, zcP);
  silRefs.pmosSrc.scale.set(1, 1, wpScale);
  silRefs.pmosDrn.position.set(silMidX, silMidYInv, zcP);
  silRefs.pmosDrn.scale.set(1, 1, wpScale);
  silRefs.pmosTap.position.set(tapX, silMidYInv, zcP);

  silRefs.nmosSrc.position.set(-silMidX, silMidYInv, zcN);
  silRefs.nmosSrc.scale.set(1, 1, wnScale);
  silRefs.nmosDrn.position.set(silMidX, silMidYInv, zcN);
  silRefs.nmosDrn.scale.set(1, 1, wnScale);
  silRefs.nmosTap.position.set(tapX, silMidYInv, zcN);

  // Tungsten Plug Contacts
  ctRefs.pmosSrc.position.set(srcX, ctRefs.pmosSrc.position.y, zcP);
  ctRefs.pmosDrn.position.set(drnX, ctRefs.pmosDrn.position.y, zcP);
  ctRefs.nmosSrc.position.set(srcX, ctRefs.nmosSrc.position.y, zcN);
  ctRefs.nmosDrn.position.set(drnX, ctRefs.nmosDrn.position.y, zcN);
  ctRefs.poly.position.set(0, ctRefs.poly.position.y, polyCtZ);
  ctRefs.welltap.position.set(tapX, ctRefs.welltap.position.y, zcP);
  ctRefs.subtap.position.set(tapX, ctRefs.subtap.position.y, zcN);

  // Metal-1 Rails, Stubs, Via Pads & T-Junctions
  var railLenX = Math.max(18.0, 18.0 + 2.0 * Math.max(0, deltaHalfL));
  metalRefs.vddRail.position.set(0, midY, railZp);
  metalRefs.vddRail.scale.x = railLenX / metalRefs.vddRail.userData.baseW;
  metalRefs.vddStubPmos.position.set(srcX, midY, (zcP + railZp) / 2);
  metalRefs.vddStubPmos.scale.z = Math.max(0.2, railZp - zcP) / metalRefs.vddStubPmos.userData.baseD;
  metalRefs.vddStubTap.position.set(tapX, midY, (zcP + railZp) / 2);
  metalRefs.vddStubTap.scale.z = Math.max(0.2, railZp - zcP) / metalRefs.vddStubTap.userData.baseD;
  metalRefs.jVddPmos.position.set(srcX, midY, railZp);
  metalRefs.jVddTap.position.set(tapX, midY, railZp);
  metalRefs.padVddPmos.position.set(srcX, midY, zcP);
  metalRefs.padVddTap.position.set(tapX, midY, zcP);

  metalRefs.gndRail.position.set(0, midY, railZn);
  metalRefs.gndRail.scale.x = railLenX / metalRefs.gndRail.userData.baseW;
  metalRefs.gndStubNmos.position.set(srcX, midY, (zcN + railZn) / 2);
  metalRefs.gndStubNmos.scale.z = Math.max(0.2, zcN - railZn) / metalRefs.gndStubNmos.userData.baseD;
  metalRefs.gndStubTap.position.set(tapX, midY, (zcN + railZn) / 2);
  metalRefs.gndStubTap.scale.z = Math.max(0.2, zcN - railZn) / metalRefs.gndStubTap.userData.baseD;
  metalRefs.jGndNmos.position.set(srcX, midY, railZn);
  metalRefs.jGndTap.position.set(tapX, midY, railZn);
  metalRefs.padGndNmos.position.set(srcX, midY, zcN);
  metalRefs.padGndTap.position.set(tapX, midY, zcN);

  metalRefs.outSpine.position.set(drnX, midY, (zcP + zcN) / 2);
  metalRefs.outSpine.scale.z = Math.max(0.5, zcP - zcN) / metalRefs.outSpine.userData.baseD;
  metalRefs.outPin.position.set(drnX + 1.75, midY, 0.0);
  metalRefs.jOut.position.set(drnX, midY, 0.0);
  metalRefs.padOutPmos.position.set(drnX, midY, zcP);
  metalRefs.padOutNmos.position.set(drnX, midY, zcN);

  metalRefs.inPin.position.set(0, midY, polyCtZ + 0.45);
  metalRefs.padIn.position.set(0, midY, polyCtZ);

  // Depletion Perimeters & Gate Cradles
  var deplSrcCX = -(hL + 1.325);
  var deplDrnCX = hL + 1.325;
  pmosSrcDeplEntry.perim = buildCmosWellShellPerimeter(deplSrcCX, 1.675, wp3d * 0.5, 0.35);
  pmosSrcDeplEntry.mesh.position.set(deplSrcCX, Y.actTop, zcP);
  pmosDrnDeplEntry.perim = buildCmosWellShellPerimeter(deplDrnCX, 1.675, wp3d * 0.5, 0.35);
  pmosDrnDeplEntry.mesh.position.set(deplDrnCX, Y.actTop, zcP);

  nmosSrcDeplEntry.perim = buildCmosWellShellPerimeter(deplSrcCX, 1.675, wn3d * 0.5, 0.35);
  nmosSrcDeplEntry.mesh.position.set(deplSrcCX, Y.actTop, zcN);
  nmosDrnDeplEntry.perim = buildCmosWellShellPerimeter(deplDrnCX, 1.675, wn3d * 0.5, 0.35);
  nmosDrnDeplEntry.mesh.position.set(deplDrnCX, Y.actTop, zcN);

  pmosGateDepl.scale.z = wpScale;
  pmosGateDepl.position.z = zcP;
  nmosGateDepl.scale.z = wnScale;
  nmosGateDepl.position.z = zcN;

  // Refresh 3D Floating Labels & Leader Lines
  updateLabelPlacement(lblRefs.vdd, -9.0, Y.metalTop + 0.85, railZp + 0.35, -9.0, Y.metalTop, railZp);
  updateLabelPlacement(lblRefs.gnd, -9.0, Y.metalTop + 0.85, railZn - 0.35, -9.0, Y.metalTop, railZn);
  updateLabelPlacement(lblRefs.inPin, 0.0, Y.metalTop + 0.90, polyCtZ + 1.35, 0.0, Y.metalTop, polyCtZ);
  updateLabelPlacement(lblRefs.out, drnX + 3.8, Y.metalTop + 0.85, 0.0, drnX + 3.2, Y.metalTop, 0.0);

  updateLabelPlacement(lblRefs.nwell, 5.5 + deltaHalfL * 0.5, Y.wellTop + 0.85, zcP + wp3d * 0.5 + 0.65, 5.4 + deltaHalfL * 0.5, Y.wellTop, zcP + wp3d * 0.5 + 0.45);
  updateLabelPlacement(lblRefs.pwell, 5.5 + deltaHalfL * 0.5, Y.wellTop + 0.85, zcN - wn3d * 0.5 - 0.65, 5.4 + deltaHalfL * 0.5, Y.wellTop, zcN - wn3d * 0.5 - 0.45);
  updateLabelPlacement(lblRefs.psub, 8.8 + deltaHalfL * 0.5, Y.subTop + 0.55, -(newSubD * 0.5 - 1.2), 8.8 + deltaHalfL * 0.5, Y.subTop, -(newSubD * 0.5 - 1.2));

  updateLabelPlacement(lblRefs.poly, 0.0, Y.polyTop + 1.85, 0.0, 0.0, Y.polyTop, 0.0);
  updateLabelPlacement(lblRefs.pmos, srcX - 1.0, Y.actTop + 1.55, zcP, srcX, Y.actTop, zcP);
  updateLabelPlacement(lblRefs.nmos, srcX - 1.0, Y.actTop + 1.55, zcN, srcX, Y.actTop, zcN);
  updateLabelPlacement(lblRefs.depl, hL + 2.2, Y.actTop + 1.35, zcP - wp3d * 0.32, hL + 1.6, Y.actTop - 0.05, zcP - wp3d * 0.26);
  updateLabelPlacement(lblRefs.psde, -sdeOffX - 0.12, Y.actTop + 1.05, zcP - wp3d * 0.52, -sdeOffX, Y.actTop, zcP - wp3d * 0.42);
  updateLabelPlacement(lblRefs.nsde, -sdeOffX - 0.12, Y.actTop + 1.05, zcN + wn3d * 0.52, -sdeOffX, Y.actTop, zcN + wn3d * 0.42);
  updateLabelPlacement(lblRefs.highk, -(hL * 1.6), Y.highkTop + 2.35, zcP + wp3d * 0.25, -(hL * 0.85), Y.highkTop, zcP + wp3d * 0.14);
  updateLabelPlacement(lblRefs.oxide, hL * 1.5, Y.oxideTop + 2.15, zcP + wp3d * 0.27, hL * 0.85, Y.oxideTop, zcP + wp3d * 0.14);

  if (typeof window.updateInverterChannels === 'function') {
    window.updateInverterChannels.apply(null, _lastInvDeplArgs);
  }
  if (typeof window.rebuildFlowCurves === 'function') {
    window.rebuildFlowCurves();
  }
  if (typeof window.updateSubGateCarriers === 'function' && window.showSubstrateHoles) {
    window.updateSubGateCarriers(typeof performance !== 'undefined' ? performance.now() * 0.001 : 0);
  }
};

// =====================================================================
// OPTIONAL BULK CARRIERS (Show Bulk Carriers Toggle - Default OFF)
// =====================================================================
function cmosHalton(index, base) {
  var result = 0;
  var f = 1 / base;
  var i = index;
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  return result;
}

function createCmosDecorativeInstanced(geom, mat, maxCount) {
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
    mesh.setMatrixAt = function() {};
  }
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.raycast = function() {};
  mesh.userData.decorative = true;
  return mesh;
}

var MAX_CMOS_BULK_HOLES = 340;
var MAX_CMOS_BULK_ELECS = 170;

var bulkCarrierGeom = new THREE.SphereGeometry(0.052, 8, 8);
var bulkHoleMat = new THREE.MeshBasicMaterial({
  color: isInitLight ? 0x1D4ED8 : 0x60A5FA,
  transparent: true,
  opacity: isInitLight ? 0.42 : 0.46,
  depthWrite: false
});
var bulkElecMat = new THREE.MeshBasicMaterial({
  color: isInitLight ? 0x15803D : 0x4ADE80,
  transparent: true,
  opacity: isInitLight ? 0.40 : 0.44,
  depthWrite: false
});

var holeInstMesh = createCmosDecorativeInstanced(bulkCarrierGeom, bulkHoleMat, MAX_CMOS_BULK_HOLES);
holeInstMesh.renderOrder = 1;
holeInstMesh.visible = false;
groups['substrate'].add(holeInstMesh);

var bulkElecInstMesh = createCmosDecorativeInstanced(bulkCarrierGeom, bulkElecMat, MAX_CMOS_BULK_ELECS);
bulkElecInstMesh.renderOrder = 2;
bulkElecInstMesh.visible = false;
groups['well'].add(bulkElecInstMesh);

window.showSubstrateHoles = false;
var _carrierDummy = new THREE.Object3D();
var _lastCarrierTick = -1;

var bulkHoleSeeds = [];
for (var chi = 0; chi < MAX_CMOS_BULK_HOLES; chi++) {
  bulkHoleSeeds.push({
    nx: cmosHalton(chi + 1, 2),
    ny: cmosHalton(chi + 1, 3),
    nz: cmosHalton(chi + 1, 5),
    phase: chi * 0.71
  });
}

var bulkElecSeeds = [];
for (var cei = 0; cei < MAX_CMOS_BULK_ELECS; cei++) {
  bulkElecSeeds.push({
    nx: cmosHalton(cei + 19, 2),
    ny: cmosHalton(cei + 19, 3),
    nz: cmosHalton(cei + 19, 7),
    phase: cei * 0.89
  });
}

window.updateBulkCarriersTheme = function(theme) {
  var isLight = theme === 'light';
  if (bulkHoleMat) {
    bulkHoleMat.color.setHex(isLight ? 0x1D4ED8 : 0x60A5FA);
    bulkHoleMat.opacity = isLight ? 0.42 : 0.46;
  }
  if (bulkElecMat) {
    bulkElecMat.color.setHex(isLight ? 0x15803D : 0x4ADE80);
    bulkElecMat.opacity = isLight ? 0.40 : 0.44;
  }
};

window.toggleSubstrateHoles = function(visible) {
  window.showSubstrateHoles = Boolean(visible);
  if (holeInstMesh) {
    holeInstMesh.visible = window.showSubstrateHoles && Boolean(groups['substrate'] && groups['substrate'].visible !== false);
    if (!window.showSubstrateHoles) {
      holeInstMesh.count = 0;
      if (holeInstMesh.instanceMatrix) holeInstMesh.instanceMatrix.needsUpdate = true;
    }
  }
  if (bulkElecInstMesh) {
    bulkElecInstMesh.visible = window.showSubstrateHoles && Boolean(groups['well'] && groups['well'].visible !== false);
    if (!window.showSubstrateHoles) {
      bulkElecInstMesh.count = 0;
      if (bulkElecInstMesh.instanceMatrix) bulkElecInstMesh.instanceMatrix.needsUpdate = true;
    }
  }
  if (window.showSubstrateHoles && typeof window.updateSubGateCarriers === 'function') {
    _lastCarrierTick = -999;
    window.updateSubGateCarriers(typeof performance !== 'undefined' ? performance.now() * 0.001 : 0);
  }
};

window.updateSubGateCarriers = function(elapsedTime) {
  var t = typeof elapsedTime === 'number' ? elapsedTime : 0;
  if (t > 0 && Math.abs(t - _lastCarrierTick) < 0.008) return;
  _lastCarrierTick = t;

  if (!window.showSubstrateHoles) {
    holeInstMesh.visible = false;
    holeInstMesh.count = 0;
    bulkElecInstMesh.visible = false;
    bulkElecInstMesh.count = 0;
    return;
  }

  var st = (typeof window.calcCmosState === 'function')
    ? window.calcCmosState(typeof currentVin !== 'undefined' ? currentVin : 'off')
    : { vin: 'off', vout: 0.5 };

  var isOff = st.vin === 'off';
  var vInNum = isOff ? 0.0 : Number(st.vin);
  var vOutNum = isOff ? 0.5 : Number(st.vout);

  var hL = cmosGeom3D.halfL;
  var halfWp = cmosGeom3D.wp3d * 0.5;
  var halfWn = cmosGeom3D.wn3d * 0.5;
  var zcP = cmosGeom3D.pmosZC;
  var zcN = cmosGeom3D.nmosZC;
  var tapX = cmosGeom3D.tapX;

  var subHW = cmosGeom3D.subHalfW - 0.35;
  var subHD = cmosGeom3D.subHalfD - 0.35;

  // 1. Majority Holes in P-Substrate & P-Well
  if (groups['substrate'] && groups['substrate'].visible !== false) {
    holeInstMesh.visible = true;
    var yMinS = Y.subBot + 0.18;
    var yMaxS = Y.subTop - 0.12;
    var nGatePush = isOff ? 0 : 0.42 * Math.min(1.0, Math.max(0, vInNum));
    var nDrnDepl = 0.22 + (isOff ? 0 : 0.34 * Math.sqrt(Math.max(0, vOutNum)));

    var hOut = 0;
    for (var i = 0; i < MAX_CMOS_BULK_HOLES; i++) {
      var hs = bulkHoleSeeds[i];
      var jx = 0.028 * Math.sin(t * 2.1 + hs.phase);
      var jy = 0.018 * Math.cos(t * 2.4 + hs.phase * 1.27);
      var jz = 0.028 * Math.sin(t * 1.8 + hs.phase * 0.73);

      var hx = -0.5 + (hs.nx - 0.5) * 2.0 * subHW + jx;
      var hz = (hs.nz - 0.5) * 2.0 * subHD + jz;
      var hy = yMinS + hs.ny * (yMaxS - yMinS) + jy;

      if (hz > 0.65 && hz < (zcP + halfWp + 0.85) && hx > -8.6 && hx < (6.2 + (hL - 1.0) * 2) && hy > Y.wellBot - 0.15) {
        hy = yMinS + hs.ny * Math.max(0.15, (Y.wellBot - 0.20) - yMinS) + jy * 0.5;
      }

      var inNmosZ = Math.abs(hz - zcN) < (halfWn + nDrnDepl);
      if (inNmosZ && hy > Y.actBot - 0.30) {
        if ((hx > -(hL + 3.2) && hx < -(hL - 0.25)) || (hx > (hL - 0.25) && hx < (hL + 3.2))) {
          hy = yMinS + hs.ny * Math.max(0.15, (Y.actBot - 0.35 - 0.2 * nDrnDepl) - yMinS);
        } else if (Math.abs(hx) < hL + 0.2 && nGatePush > 0.02) {
          hy = Math.min(hy, yMaxS - nGatePush);
        }
      }

      if (Math.abs(hx - tapX) < 0.8 && Math.abs(hz - zcN) < 0.8 && hy > Y.actBot - 0.1) {
        hy = yMinS + hs.ny * Math.max(0.15, (Y.actBot - 0.20) - yMinS);
      }

      _carrierDummy.position.set(hx, hy, hz);
      _carrierDummy.rotation.set(0, 0, 0);
      _carrierDummy.scale.set(1, 1, 1);
      if (typeof _carrierDummy.updateMatrix === 'function') _carrierDummy.updateMatrix();
      holeInstMesh.setMatrixAt(hOut++, _carrierDummy.matrix);
    }
    holeInstMesh.count = hOut;
    if (holeInstMesh.instanceMatrix) holeInstMesh.instanceMatrix.needsUpdate = true;
  } else {
    holeInstMesh.visible = false;
    holeInstMesh.count = 0;
  }

  // 2. Majority Electrons in N-Well
  if (groups['well'] && groups['well'].visible !== false) {
    bulkElecInstMesh.visible = true;
    var wMinX = -8.4;
    var wMaxX = 5.8 + 2.0 * Math.max(0, hL - 1.0);
    var wMinZ = 0.90;
    var wMaxZ = zcP + halfWp + 0.65;
    var yMinW = Y.wellBot + 0.16;
    var yMaxW = Y.wellTop - 0.12;
    var pGatePush = isOff ? 0 : 0.42 * Math.min(1.0, Math.max(0, 1.0 - vInNum));
    var pDrnDepl = 0.22 + (isOff ? 0 : 0.34 * Math.sqrt(Math.max(0, 1.0 - vOutNum)));

    var eOut = 0;
    for (var j = 0; j < MAX_CMOS_BULK_ELECS; j++) {
      var es = bulkElecSeeds[j];
      var ex = wMinX + es.nx * (wMaxX - wMinX) + 0.025 * Math.cos(t * 2.2 + es.phase);
      var ez = wMinZ + es.nz * (wMaxZ - wMinZ) + 0.025 * Math.sin(t * 2.0 + es.phase * 0.81);
      var ey = yMinW + es.ny * (yMaxW - yMinW) + 0.016 * Math.sin(t * 2.5 + es.phase * 1.13);

      var inPmosZ = Math.abs(ez - zcP) < (halfWp + pDrnDepl);
      if (inPmosZ && ey > Y.actBot - 0.30) {
        if ((ex > -(hL + 3.2) && ex < -(hL - 0.25)) || (ex > (hL - 0.25) && ex < (hL + 3.2))) {
          ey = yMinW + es.ny * Math.max(0.12, (Y.actBot - 0.32 - 0.2 * pDrnDepl) - yMinW);
        } else if (Math.abs(ex) < hL + 0.2 && pGatePush > 0.02) {
          ey = Math.min(ey, yMaxW - pGatePush);
        }
      }

      _carrierDummy.position.set(ex, ey, ez);
      _carrierDummy.rotation.set(0, 0, 0);
      _carrierDummy.scale.set(1, 1, 1);
      if (typeof _carrierDummy.updateMatrix === 'function') _carrierDummy.updateMatrix();
      bulkElecInstMesh.setMatrixAt(eOut++, _carrierDummy.matrix);
    }
    bulkElecInstMesh.count = eOut;
    if (bulkElecInstMesh.instanceMatrix) bulkElecInstMesh.instanceMatrix.needsUpdate = true;
  } else {
    bulkElecInstMesh.visible = false;
    bulkElecInstMesh.count = 0;
  }
};

// Apply initial Balanced (2:1) 3D dimensions (Wp=240nm, Wn=120nm, L=28nm)
window.updateCmosGeometry3D(240, 120, 28);
