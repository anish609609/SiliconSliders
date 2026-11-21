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
// 3D GAUSSIAN DOPING MESH BUILDER (Clean Solid Matte Semiconductor Finish)
// ---------------------------------------------------------------------------
function gaussianDopingMesh(w, h, d, colorVar, opts) {
  opts = opts || {};
  var straggle = opts.straggle !== undefined ? opts.straggle : 0.22;
  var cornerR  = opts.cornerR !== undefined ? opts.cornerR : 0.35;

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

  var rawColor = colorVar.indexOf('--') === 0 ? cssVar(colorVar) : colorVar;
  var baseColor = new THREE.Color(rawColor);
  var mat = new THREE.MeshStandardMaterial({
    color: baseColor,
    roughness: opts.roughness !== undefined ? opts.roughness : 0.50,
    metalness: opts.metalness !== undefined ? opts.metalness : 0.15,
    transparent: false,
    opacity: 1.0,
    depthWrite: true,
    emissive: 0x000000,
    emissiveIntensity: 0
  });

  var mesh = new THREE.Mesh(geom, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.colorVar = colorVar;
  mesh.userData.baseEmissive = 0x000000;
  mesh.userData.baseEmissiveIntensity = 0;
  mesh.renderOrder = opts.renderOrder !== undefined ? opts.renderOrder : 3;

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
  m1Top: 5.858
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
  straggle: 0.22,
  cornerR: 0.35,
  renderOrder: 3
});
srcMesh.position.set(srcX, (Y.actTop + Y.actBot) / 2, 0);
reg(srcMesh, 'nmosSrc', 'active');

var drnMesh = gaussianDopingMesh(actW, actH, actD, '--c-active-n', {
  straggle: 0.22,
  cornerR: 0.35,
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
  straggle: 0.15,
  cornerR: 0.20,
  renderOrder: 4
});
sdeSrcMesh.position.set(sdeSrcX, (Y.sdeTop + Y.sdeBot) / 2, 0);
reg(sdeSrcMesh, 'sdeSrc', 'sde');

var sdeDrnMesh = gaussianDopingMesh(sdeW, sdeH, actD, '--c-sde-n', {
  straggle: 0.15,
  cornerR: 0.20,
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
  transparent: false,
  opacity: 1.0,
  depthWrite: true,
  roughness: 0.50,
  metalness: 0.15
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
  transparent: false,
  opacity: 1.0,
  depthWrite: true,
  roughness: 0.50,
  metalness: 0.15
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
  straggle: 0.20,
  cornerR: 0.30,
  renderOrder: 3
});
tapMesh.position.set(-6.5, (Y.actTop + Y.actBot) / 2, 6.2);
reg(tapMesh, 'subtap', 'active');

// ---------------------------------------------------------------------------
// 6. GATE DIELECTRIC STACK (SiO2 + High-k HfO2) - PRESERVE BLUE SiO2
// ---------------------------------------------------------------------------
var gateL = 2.0;    // Gate length along X
var gateW = 7.6;    // Dielectric width along Z

// Interfacial Gate Oxide (SiO2) - PRESERVED IN BLUE PALETTE
var oxMesh = box(gateL, Y.oxTop - Y.oxBot, gateW, '--c-oxide', {
  transparent: true,
  opacity: 0.85,
  roughness: 0.15,
  metalness: 0.05
});
oxMesh.position.set(0, (Y.oxTop + Y.oxBot) / 2, 0);
reg(oxMesh, 'oxide', 'oxide');

// High-k Dielectric (HfO2) - Pristine translucent high-permittivity purple
var hkMesh = box(gateL, Y.hkTop - Y.hkBot, gateW, '--c-highk', {
  transparent: true,
  opacity: 0.82,
  roughness: 0.14,
  metalness: 0.12
});
hkMesh.position.set(0, (Y.hkTop + Y.hkBot) / 2, 0);
reg(hkMesh, 'highk', 'highk');

// ---------------------------------------------------------------------------
// 7. POLYSILICON / METAL GATE RUNNER (Coral-red satin, non-burnt HKMG material)
// ---------------------------------------------------------------------------
var polyRunnerLength = 11.2;
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
// 9. METAL-1 INTERCONNECT PADS (Flat metallic ribbons, matching CMOS palette)
// ---------------------------------------------------------------------------
var m1H = Y.m1Top - Y.m1Bot;
var m1Y = (Y.m1Top + Y.m1Bot) / 2;

// Source Pad (S / GND)
var srcPad = box(3.4, m1H, 3.4, '--c-active-n', { roughness: 0.20, metalness: 0.90, roughnessMap: getBrushedMetalTexture() });
srcPad.position.set(srcX, m1Y, 0);
reg(srcPad, 'srcRail', 'metal');

// Drain Pad (D / VDS)
var drnPad = box(3.4, m1H, 3.4, '--c-out', { roughness: 0.20, metalness: 0.90, roughnessMap: getBrushedMetalTexture() });
drnPad.position.set(drnX, m1Y, 0);
reg(drnPad, 'drnRail', 'metal');

// Gate Pad (G / VGS)
var gatePad = box(2.6, m1H, 2.6, '--c-in', { roughness: 0.20, metalness: 0.90, roughnessMap: getBrushedMetalTexture() });
gatePad.position.set(0, m1Y, 5.2);
reg(gatePad, 'gateRail', 'metal');

// Body Tap Pad (B / GND)
var bodyPad = box(2.6, m1H, 2.6, '--c-gnd', { roughness: 0.20, metalness: 0.90, roughnessMap: getBrushedMetalTexture() });
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
