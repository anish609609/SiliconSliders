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
  var outlineColor = opts.outlineColor || '#cf8a4a';

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
  var rawColor = colorVar.indexOf('--') === 0 ? cssVar(colorVar) : colorVar;
  var baseColor = new THREE.Color(rawColor);
  var mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    map: tex,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.40,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.10,
    transparent: true,
    opacity: opts.opacity !== undefined ? opts.opacity : 0.94,
    depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  var mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.colorVar = colorVar;
  mesh.userData.baseEmissive = 0x000000;
  mesh.userData.baseEmissiveIntensity = 0;
  if (opts.renderOrder) mesh.renderOrder = opts.renderOrder;
  group.add(mesh);

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
  group.userData.colorVar = colorVar;
  return group;
}

// ---------------------------------------------------------------------------
// LAYER GROUPS & ORDER
// ---------------------------------------------------------------------------
var LAYER_ORDER = ['substrate', 'well', 'active', 'sde', 'oxide', 'highk', 'poly', 'spacer', 'contact', 'metal'];
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
    emissive: 0x000000,
    emissiveIntensity: 0
  });
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = !opts.noShadow;
  m.receiveShadow = true;
  m.userData.colorVar = colorVar;
  m.userData.baseEmissive = 0x000000;
  m.userData.baseEmissiveIntensity = 0;
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
  m1Top: 5.859
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
  peakV: 0.32,
  sigmaV: 0.30,
  straggle: 0.24,
  cornerR: 0.6,
  roughness: 0.50,
  metalness: 0.15,
  outlineColor: '#5fd9c4',
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
  peakV: 0.18,
  sigmaV: 0.26,
  straggle: 0.22,
  cornerR: 0.35,
  outlineColor: '#f0b47a'
});
srcMesh.position.set(srcX, (Y.actTop + Y.actBot) / 2, 0);
reg(srcMesh, 'pmosSrc', 'active');

var drnMesh = gaussianDopingMesh(actW, actH, actD, '--c-active-p', {
  peakV: 0.18,
  sigmaV: 0.26,
  straggle: 0.22,
  cornerR: 0.35,
  outlineColor: '#f0b47a'
});
drnMesh.position.set(drnX, (Y.actTop + Y.actBot) / 2, 0);
reg(drnMesh, 'pmosDrn', 'active');

// 4. SOURCE / DRAIN EXTENSIONS (P-SDE / LDD)
var sdeW = 1.1;
var sdeH = Y.sdeTop - Y.sdeBot;
var sdeSrcX = -1.55;
var sdeDrnX = 1.55;

var sdeSrcMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-p', {
  peakV: 0.12,
  sigmaV: 0.18,
  straggle: 0.15,
  cornerR: 0.20,
  outlineColor: '#f0b47a'
});
sdeSrcMesh.position.set(sdeSrcX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeSrcMesh, 'sdeSrc', 'sde');

var sdeDrnMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-p', {
  peakV: 0.12,
  sigmaV: 0.18,
  straggle: 0.15,
  cornerR: 0.20,
  outlineColor: '#f0b47a'
});
sdeDrnMesh.position.set(sdeDrnX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeDrnMesh, 'sdeDrn', 'sde');

// ---------------------------------------------------------------------------
// 5. CONTINUOUS 3D HOLE INVERSION CHANNEL & PINCH-OFF REGION
// ---------------------------------------------------------------------------
var chanGeom = new THREE.BoxGeometry(2.0, 0.18, actD, 32, 1, 2);
var chanMat = new THREE.MeshStandardMaterial({
  color: 0xf43f5e,
  emissive: 0xbe123c,
  emissiveIntensity: 0.45,
  transparent: true,
  opacity: 0.75,
  roughness: 0.22,
  metalness: 0.15,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1
});
var channelMesh = new THREE.Mesh(chanGeom, chanMat);
channelMesh.position.set(0, 2.919, 0);
reg(channelMesh, 'channel', 'active');

// Dedicated pinch-off space-charge gap mesh visible during Saturation (VSD >= VSG - |VTH,p|)
var pinchGeom = new THREE.BoxGeometry(0.8, 0.16, actD, 12, 1, 2);
var pinchMat = new THREE.MeshStandardMaterial({
  color: 0xf59e0b,
  emissive: 0xd97706,
  emissiveIntensity: 0.50,
  transparent: true,
  opacity: 0.50,
  roughness: 0.25,
  metalness: 0.20,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1
});
var pinchMesh = new THREE.Mesh(pinchGeom, pinchMat);
pinchMesh.position.set(0.6, 2.929, 0);
pinchMesh.visible = false;
groups['active'].add(pinchMesh);

// Function to dynamically deform channel thickness and taper based on PMOS physics
window.updateChannelGeometry = function(vsg, vsd, isd, region, deltaL) {
  var vth = 0.40;
  var vov = Math.max(0, vsg - vth);

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
    var u = (pos.getX(i) + 1.0) / 2.0;

    var thickness = 0;
    if (region === 'LINEAR') {
      var localV = u * vsd;
      var localCharge = Math.max(0.08, (vov - localV) / Math.max(0.1, vov));
      thickness = maxH * (0.35 + 0.65 * localCharge);
    } else {
      if (pos.getX(i) <= pinchX) {
        var fracToPinch = (pos.getX(i) + 1.0) / (pinchX + 1.0);
        thickness = maxH * Math.pow(Math.max(0.04, 1.0 - fracToPinch * 0.95), 0.7);
      } else {
        thickness = 0.01;
      }
    }

    var origSignY = pos.getY(i) >= 0 ? 1 : -1;
    pos.setY(i, (origSignY * thickness) / 2);
  }

  pos.needsUpdate = true;
  chanGeom.computeVertexNormals();

  var intensityNorm = Math.min(1.0, isd / 0.5);
  chanMat.opacity = 0.35 + 0.55 * intensityNorm;
  chanMat.emissiveIntensity = 0.20 + 0.65 * intensityNorm;

  if (region === 'SATURATION') {
    pinchMesh.visible = true;
    var gapW = Math.max(0.15, 1.0 - pinchX);
    pinchMesh.scale.x = gapW / 0.8;
    pinchMesh.position.x = pinchX + gapW / 2;
    pinchMat.opacity = 0.30 + 0.40 * Math.min(1.0, (vsd - vov) / 0.8);
  } else {
    pinchMesh.visible = false;
  }
};

// 6. N-WELL TAP (N+ OHMIC CONTACT TO VDD)
var tapW = 2.4, tapD = 2.4;
var tapMesh = gaussianDopingMesh(tapW, actH, tapD, '--c-well', {
  peakV: 0.18,
  sigmaV: 0.24,
  straggle: 0.20,
  cornerR: 0.3,
  outlineColor: '#5fd9c4'
});
tapMesh.position.set(-6.5, (Y.actTop + Y.actBot) / 2, 6.2);
reg(tapMesh, 'welltap', 'active');

// ---------------------------------------------------------------------------
// 7. GATE DIELECTRIC STACK (SiO2 + High-k HfO2) - PRESERVE BLUE SiO2
// ---------------------------------------------------------------------------
var gateL = 2.0;
var gateW = 9.8;

// Interfacial Gate Oxide (SiO2) - PRESERVED IN BLUE PALETTE
var oxMesh = box(gateL, Y.oxTop - Y.oxBot, gateW, '--c-oxide', {
  transparent: true,
  opacity: 0.85,
  roughness: 0.15,
  metalness: 0.05
});
oxMesh.position.set(0, (Y.oxTop + Y.oxBot) / 2, 0);
reg(oxMesh, 'oxide', 'oxide');

// High-k Dielectric (HfO2) - Translucent high-permittivity purple
var hkMesh = box(gateL, Y.hkTop - Y.hkBot, gateW, '--c-highk', {
  transparent: true,
  opacity: 0.82,
  roughness: 0.14,
  metalness: 0.12
});
hkMesh.position.set(0, (Y.hkTop + Y.hkBot) / 2, 0);
reg(hkMesh, 'highk', 'highk');

// ---------------------------------------------------------------------------
// 8. POLYSILICON / METAL GATE RUNNER (Coral-red satin, non-burnt HKMG material)
// ---------------------------------------------------------------------------
var polyRunnerLength = 13.4;
var polyMesh = box(gateL, Y.polyTop - Y.polyBot, polyRunnerLength, '--c-poly', {
  roughness: 0.45,
  metalness: 0.20
});
polyMesh.position.set(0, (Y.polyTop + Y.polyBot) / 2, 1.2);
reg(polyMesh, 'poly', 'poly');

// Sleek, modern crystalline Si3N4 sidewall spacers (crisp translucent dielectric)
var spacerW = 0.20;
var spacerMat = new THREE.MeshStandardMaterial({
  color: 0x67e8f9,
  roughness: 0.30,
  metalness: 0.08,
  transparent: true,
  opacity: 0.72
});
var spacerGroup = new THREE.Group();
var leftSpacer = new THREE.Mesh(new THREE.BoxGeometry(spacerW, Y.polyTop - Y.oxBot, actD), spacerMat);
leftSpacer.position.set(-gateL / 2 - spacerW / 2, (Y.polyTop + Y.oxBot) / 2, 0);
leftSpacer.userData.id = 'spacer';
leftSpacer.userData.layer = 'spacer';
spacerGroup.add(leftSpacer);

var rightSpacer = new THREE.Mesh(new THREE.BoxGeometry(spacerW, Y.polyTop - Y.oxBot, actD), spacerMat);
rightSpacer.position.set(gateL / 2 + spacerW / 2, (Y.polyTop + Y.oxBot) / 2, 0);
rightSpacer.userData.id = 'spacer';
rightSpacer.userData.layer = 'spacer';
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
// 10. METAL-1 INTERCONNECT PADS (Flat metallic ribbons, matching CMOS palette)
// ---------------------------------------------------------------------------
var m1H = Y.m1Top - Y.m1Bot;
var m1Y = (Y.m1Top + Y.m1Bot) / 2;

// Source Pad (S / VDD)
var srcPad = box(3.4, m1H, 3.4, '--c-active-p', { roughness: 0.20, metalness: 0.90, roughnessMap: getBrushedMetalTexture() });
srcPad.position.set(srcX, m1Y, 0);
reg(srcPad, 'srcRail', 'metal');

// Drain Pad (D / OUT)
var drnPad = box(3.4, m1H, 3.4, '--c-out', { roughness: 0.20, metalness: 0.90, roughnessMap: getBrushedMetalTexture() });
drnPad.position.set(drnX, m1Y, 0);
reg(drnPad, 'drnRail', 'metal');

// Gate Pad (G / VG)
var gatePad = box(2.6, m1H, 2.6, '--c-in', { roughness: 0.20, metalness: 0.90, roughnessMap: getBrushedMetalTexture() });
gatePad.position.set(0, m1Y, 6.2);
reg(gatePad, 'gateRail', 'metal');

// N-Well Tap Pad (B / VDD)
var wellPad = box(2.6, m1H, 2.6, '--c-vdd', { roughness: 0.20, metalness: 0.90, roughnessMap: getBrushedMetalTexture() });
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
  var c = document.createElement('canvas');
  c.width = 384;
  c.height = 128;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = opts.bg || (isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(10, 16, 26, 0.90)');
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
  sprite.renderOrder = 999;
  sprite.userData.labelText = text;
  sprite.userData.colorHex = colorHex;
  return sprite;
}

function updateLabelSprite(sprite, text, colorHex, isLight) {
  var c = document.createElement('canvas');
  c.width = 384;
  c.height = 128;
  var ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.94)' : 'rgba(10, 16, 26, 0.90)';
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
      if (hex) m.material.color.set(hex);
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
  group.userData.isTerminalTag = true;
  group.name = 'callout_' + text.replace(/[^a-zA-Z0-9]/g, '_');
  labelCalloutGroups.push(group);
  return group;
}

// Spatially distributed terminal callouts attached to groups['metal']
var srcCallout = createTerminalCallout('SOURCE (S / VDD)', '#cf8a4a', srcX, Y.m1Top, 0, { x: -1.2, y: 1.6, z: -2.0 });
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
    s.visible = visible;
  });
  labelCalloutGroups.forEach(function(g) {
    g.visible = visible;
  });
}
