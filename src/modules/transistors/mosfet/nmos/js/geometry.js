/**
 * geometry.js - NMOS CAD Viewer
 * 3D Physical model for a discrete N-channel MOSFET:
 * - P-substrate bulk wafer slab
 * - Heavily doped N+ Source and Drain diffusions with Gaussian profiles & lateral straggle
 * - Shallow N-SDE / LDD extensions flanking gate channel
 * - Ultra-thin interfacial SiO2 + High-k HfO2 gate dielectric stack
 * - Polysilicon / Metal gate electrode runner
 * - P+ Substrate / Body tap diffusion
 * - Tungsten CVD contact via plugs
 * - Metal-1 interconnects for Source (S), Drain (D), Gate (G), and Body (B)
 * - 3D Floating text annotations & depth testing
 */

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---------------------------------------------------------------------------
// GAUSSIAN DOPING DEPTH & SURFACE TEXTURE GENERATOR
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

  var tc = new THREE.Color(rawColor);
  var r0 = Math.round(tc.r * 255);
  var g0 = Math.round(tc.g * 255);
  var b0 = Math.round(tc.b * 255);

  var nIso = opts.isoLines !== undefined ? opts.isoLines : 5;

  for (var py = 0; py < TH; py++) {
    var v = py / (TH - 1);
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

  var tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  gaussTexCache[key] = tex;
  return tex;
}

// ---------------------------------------------------------------------------
// 3D GAUSSIAN DOPING MESH BUILDER
// ---------------------------------------------------------------------------
function gaussianDopingMesh(w, h, d, colorVar, opts) {
  opts = opts || {};
  var peakV    = opts.peakV !== undefined ? opts.peakV : 0.18;
  var sigmaV   = opts.sigmaV !== undefined ? opts.sigmaV : 0.26;
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.22;
  var cornerR  = opts.cornerR !== undefined ? opts.cornerR : 0.35;
  var outlineColor = opts.outlineColor || '#4fd1ff';

  var group = new THREE.Group();
  var geom = new THREE.BoxGeometry(w, h, d, 8, 8, 8);
  var pos = geom.attributes.position;
  var halfW = w / 2;
  var halfD = d / 2;

  for (var i = 0; i < pos.count; i++) {
    var px = pos.getX(i);
    var py = pos.getY(i);
    var pz = pos.getZ(i);

    var depthFrac = (h / 2 - py) / h;
    var latStraggle = Math.sin(depthFrac * Math.PI) * straggle;
    var signX = px >= 0 ? 1 : -1;
    var signZ = pz >= 0 ? 1 : -1;
    var offX = Math.abs(px) - (halfW - cornerR);
    var offZ = Math.abs(pz) - (halfD - cornerR);

    if (offX > 0 && offZ > 0) {
      var r = Math.sqrt(offX * offX + offZ * offZ);
      var angle = Math.atan2(offZ, offX);
      var newR = Math.min(cornerR, r) + latStraggle * 0.4;
      pos.setX(i, signX * (halfW - cornerR + Math.cos(angle) * newR));
      pos.setZ(i, signZ * (halfD - cornerR + Math.sin(angle) * newR));
    } else {
      if (Math.abs(px) > halfW * 0.7) pos.setX(i, px + signX * latStraggle);
      if (Math.abs(pz) > halfD * 0.7) pos.setZ(i, pz + signZ * latStraggle);
    }
  }
  geom.computeVertexNormals();

  var tex = gaussianDepthTexture(colorVar, peakV, sigmaV, { isoLines: 5 });
  var mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.40,
    metalness: 0.10,
    transparent: true,
    opacity: 0.94,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true
  });

  var mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (opts.renderOrder) mesh.renderOrder = opts.renderOrder;
  group.add(mesh);

  // Crisp perimeter ring
  var ringShape = new THREE.Shape();
  var rw = w / 2, rd = d / 2, cr = cornerR;
  ringShape.moveTo(-rw + cr, -rd);
  ringShape.lineTo(rw - cr, -rd);
  ringShape.quadraticCurveTo(rw, -rd, rw, -rd + cr);
  ringShape.lineTo(rw, rd - cr);
  ringShape.quadraticCurveTo(rw, rd, rw - cr, rd);
  ringShape.lineTo(-rw + cr, rd);
  ringShape.quadraticCurveTo(-rw, rd, -rw, rd - cr);
  ringShape.lineTo(-rw, -rd + cr);
  ringShape.quadraticCurveTo(-rw, -rd, -rw + cr, -rd);

  var ringPts = ringShape.getPoints(36);
  var ringGeom = new THREE.BufferGeometry().setFromPoints(ringPts);
  var ringMat = new THREE.LineBasicMaterial({
    color: new THREE.Color(outlineColor),
    linewidth: 1.5,
    transparent: true,
    opacity: 0.85
  });
  var ring = new THREE.Line(ringGeom, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = h / 2 + 0.01;
  group.add(ring);

  group.userData._isDopingMesh = true;
  group.userData._baseMat = mat;
  return group;
}

// ---------------------------------------------------------------------------
// LAYER GROUPS & ORDER
// ---------------------------------------------------------------------------
var LAYER_ORDER = ['substrate', 'active', 'oxide', 'highk', 'poly', 'contact', 'metal'];
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
  selectable.push(mesh);
  groups[layerKey].add(mesh);
  return mesh;
}

function box(w, h, d, colorVar, opts) {
  opts = opts || {};
  var col = colorVar.indexOf('--') === 0 ? cssVar(colorVar) : colorVar;
  var mat = new THREE.MeshStandardMaterial({
    color: col,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.45,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.15,
    transparent: opts.transparent || false,
    opacity: opts.opacity !== undefined ? opts.opacity : 1.0,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true
  });
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cylinder(rt, rb, h, seg, colorVar, opts) {
  opts = opts || {};
  var col = colorVar.indexOf('--') === 0 ? cssVar(colorVar) : colorVar;
  var mat = new THREE.MeshStandardMaterial({
    color: col,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.25,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.65
  });
  var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------------------
// GEOMETRY ELEVATION COORDINATES (Y Stack)
// ---------------------------------------------------------------------------
var Y = {
  subBot: -3.0,
  subTop: 0.0,
  actBot: -1.2,
  actTop: 0.0,
  sdeBot: -0.5,
  sdeTop: 0.0,
  oxBot: 0.0,
  oxTop: 0.18,
  hkBot: 0.18,
  hkTop: 0.42,
  polyBot: 0.42,
  polyTop: 1.45,
  ctBot: 0.0,
  ctTop: 2.15,
  m1Bot: 2.15,
  m1Top: 2.85
};

// 1. P-SUBSTRATE BASE SLAB
var subMesh = box(22, Y.subTop - Y.subBot, 20, '--c-substrate', { roughness: 0.85, metalness: 0.05 });
subMesh.position.set(0, (Y.subTop + Y.subBot) / 2, 0);
reg(subMesh, 'psub', 'substrate');

// 2. ACTIVE REGIONS: SOURCE & DRAIN (N+)
var actW = 4.2;  // Lateral width along X
var actD = 7.0;  // Gate width dimension along Z
var actH = Y.actTop - Y.actBot;

var srcX = -4.2;
var drnX = 4.2;

var srcMesh = gaussianDopingMesh(actW, actH, actD, '--c-active-n', {
  peakV: 0.18,
  sigmaV: 0.26,
  straggle: 0.22,
  cornerR: 0.35,
  outlineColor: '#4fd1ff'
});
srcMesh.position.set(srcX, (Y.actTop + Y.actBot) / 2, 0);
reg(srcMesh, 'nmosSrc', 'active');

var drnMesh = gaussianDopingMesh(actW, actH, actD, '--c-active-n', {
  peakV: 0.18,
  sigmaV: 0.26,
  straggle: 0.22,
  cornerR: 0.35,
  outlineColor: '#4fd1ff'
});
drnMesh.position.set(drnX, (Y.actTop + Y.actBot) / 2, 0);
reg(drnMesh, 'nmosDrn', 'active');

// 3. SOURCE / DRAIN EXTENSIONS (N-SDE / LDD)
var sdeW = 1.1;
var sdeH = Y.sdeTop - Y.sdeBot;
var sdeSrcX = -1.55;
var sdeDrnX = 1.55;

var sdeSrcMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-n', {
  peakV: 0.12,
  sigmaV: 0.18,
  straggle: 0.15,
  cornerR: 0.20,
  outlineColor: '#8fd0f8'
});
sdeSrcMesh.position.set(sdeSrcX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeSrcMesh, 'sdeSrc', 'active');

var sdeDrnMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-n', {
  peakV: 0.12,
  sigmaV: 0.18,
  straggle: 0.15,
  cornerR: 0.20,
  outlineColor: '#8fd0f8'
});
sdeDrnMesh.position.set(sdeDrnX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeDrnMesh, 'sdeDrn', 'active');

// Dynamic Inversion Channel Indicator (lights up when VGS = 1.0V)
var chanGeom = new THREE.BoxGeometry(2.0, 0.18, actD);
var chanMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color(0x5fd9c4),
  emissive: new THREE.Color(0x228b78),
  emissiveIntensity: 0.15,
  transparent: true,
  opacity: 0.40,
  roughness: 0.3,
  metalness: 0.1
});
var channelMesh = new THREE.Mesh(chanGeom, chanMat);
channelMesh.position.set(0, -0.09, 0);
reg(channelMesh, 'channel', 'active');

// 4. SUBSTRATE / BODY TAP (P+)
var tapW = 2.4, tapD = 2.4;
var tapMesh = gaussianDopingMesh(tapW, actH, tapD, '--c-substrate', {
  peakV: 0.18,
  sigmaV: 0.24,
  straggle: 0.20,
  cornerR: 0.3,
  outlineColor: '#aab4c2'
});
tapMesh.position.set(-6.5, (Y.actTop + Y.actBot) / 2, 6.2);
reg(tapMesh, 'subtap', 'active');

// 5. GATE DIELECTRIC STACK (SiO2 + High-k HfO2)
var gateL = 2.0;    // Gate length along X
var gateW = 7.6;    // Dielectric width along Z

var oxMesh = box(gateL, Y.oxTop - Y.oxBot, gateW, '--c-oxide', {
  transparent: true,
  opacity: 0.88,
  roughness: 0.25,
  metalness: 0.05
});
oxMesh.position.set(0, (Y.oxTop + Y.oxBot) / 2, 0);
reg(oxMesh, 'oxide', 'oxide');

var hkMesh = box(gateL, Y.hkTop - Y.hkBot, gateW, '--c-highk', {
  transparent: true,
  opacity: 0.88,
  roughness: 0.25,
  metalness: 0.15
});
hkMesh.position.set(0, (Y.hkTop + Y.hkBot) / 2, 0);
reg(hkMesh, 'highk', 'highk');

// 6. POLYSILICON / METAL GATE RUNNER
// Crosses active area (Z: -3.8 to +3.8) and extends into poly tail (Z up to 6.2) for gate contact
var polyRunnerLength = 11.2;
var polyMesh = box(gateL, Y.polyTop - Y.polyBot, polyRunnerLength, '--c-poly', {
  roughness: 0.35,
  metalness: 0.25
});
polyMesh.position.set(0, (Y.polyTop + Y.polyBot) / 2, 1.2);
reg(polyMesh, 'poly', 'poly');

// Gate Spacers (Si3N4 / SiO2 spacer flanks)
var spacerW = 0.45;
var spacerMat = new THREE.MeshStandardMaterial({
  color: 0x8a9ba8,
  roughness: 0.6,
  metalness: 0.1,
  transparent: true,
  opacity: 0.75
});
var leftSpacer = new THREE.Mesh(new THREE.BoxGeometry(spacerW, Y.polyTop - Y.oxBot, actD), spacerMat);
leftSpacer.position.set(-gateL / 2 - spacerW / 2, (Y.polyTop + Y.oxBot) / 2, 0);
groups['poly'].add(leftSpacer);

var rightSpacer = new THREE.Mesh(new THREE.BoxGeometry(spacerW, Y.polyTop - Y.oxBot, actD), spacerMat);
rightSpacer.position.set(gateL / 2 + spacerW / 2, (Y.polyTop + Y.oxBot) / 2, 0);
groups['poly'].add(rightSpacer);

// 7. TUNGSTEN CONTACT VIA PLUGS
var ctRadius = 0.45;
var ctH = Y.ctTop - Y.ctBot;

// Source Contact
var srcCt = cylinder(ctRadius, ctRadius * 0.92, ctH, 20, '--c-contact');
srcCt.position.set(srcX, (Y.ctTop + Y.ctBot) / 2, 0);
reg(srcCt, 'contact', 'contact');

// Drain Contact
var drnCt = cylinder(ctRadius, ctRadius * 0.92, ctH, 20, '--c-contact');
drnCt.position.set(drnX, (Y.ctTop + Y.ctBot) / 2, 0);
reg(drnCt, 'contact', 'contact');

// Gate Contact (drops onto poly runner tail)
var gateCtH = Y.ctTop - Y.polyTop;
var gateCt = cylinder(ctRadius, ctRadius * 0.92, gateCtH, 20, '--c-contact');
gateCt.position.set(0, (Y.ctTop + Y.polyTop) / 2, 5.2);
reg(gateCt, 'contact', 'contact');

// Substrate Body Tap Contact
var subCt = cylinder(ctRadius, ctRadius * 0.92, ctH, 20, '--c-contact');
subCt.position.set(-6.5, (Y.ctTop + Y.ctBot) / 2, 6.2);
reg(subCt, 'contact', 'contact');

// 8. METAL-1 INTERCONNECT PADS / RUNNERS
var m1H = Y.m1Top - Y.m1Bot;
var m1Y = (Y.m1Top + Y.m1Bot) / 2;

// Source Pad (S / GND)
var srcPad = box(3.4, m1H, 3.4, '#4a92c9', { roughness: 0.25, metalness: 0.65 });
srcPad.position.set(srcX, m1Y, 0);
reg(srcPad, 'srcRail', 'metal');

// Drain Pad (D / VDS)
var drnPad = box(3.4, m1H, 3.4, '#57cf8f', { roughness: 0.25, metalness: 0.65 });
drnPad.position.set(drnX, m1Y, 0);
reg(drnPad, 'drnRail', 'metal');

// Gate Pad (G / VGS)
var gatePad = box(2.6, m1H, 2.6, '#e6c94a', { roughness: 0.25, metalness: 0.65 });
gatePad.position.set(0, m1Y, 5.2);
reg(gatePad, 'gateRail', 'metal');

// Body Tap Pad (B / GND)
var bodyPad = box(2.6, m1H, 2.6, '#9aa6b6', { roughness: 0.25, metalness: 0.65 });
bodyPad.position.set(-6.5, m1Y, 6.2);
reg(bodyPad, 'bodyRail', 'metal');

// ---------------------------------------------------------------------------
// 3D FLOATING TEXT LABELS WITH DEPTH TESTING
// ---------------------------------------------------------------------------
var labelSprites = [];

function makeTextSprite(text, colorHex, opts) {
  opts = opts || {};
  var c = document.createElement('canvas');
  c.width = 384;
  c.height = 128;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = opts.bg || 'rgba(10, 16, 26, 0.88)';
  ctx.strokeStyle = colorHex;
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

  ctx.fillStyle = colorHex;
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
  return sprite;
}

function addLabel(text, colorHex, x, y, z) {
  var s = makeTextSprite(text, colorHex);
  s.position.set(x, y, z);
  scene.add(s);
  labelSprites.push(s);
  return s;
}

// Add primary 3D terminal annotations
addLabel('SOURCE (S)', '#4a92c9', srcX, Y.m1Top + 0.9, 0);
addLabel('DRAIN (D)', '#57cf8f', drnX, Y.m1Top + 0.9, 0);
addLabel('GATE (G)', '#e6c94a', 0, Y.m1Top + 0.9, 5.2);
addLabel('BODY (B)', '#9aa6b6', -6.5, Y.m1Top + 0.9, 6.2);
addLabel('L = 28nm', '#ffffff', 0, Y.polyTop + 0.8, -1.0);

function toggleLabels(visible) {
  labelSprites.forEach(function(s) {
    s.visible = visible;
  });
}
