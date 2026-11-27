/**
 * chamber-3d.js - Procedural Three.js r128 Horizontal Thermal Oxidation Furnace
 *
 * Renders:
 *  - Translucent horizontal quartz furnace tube with stainless-steel inlet & exhaust end-caps
 *  - 3-zone helical heating coils driven dynamically by T(t) via OxidationThermal
 *  - Slotted quartz carrier boat holding 8 crystalline silicon wafers (T-colored + oxide sheen)
 *  - 4 laminar left-to-right continuum gas streamlines color-coded by active gas (N2 / Dry O2 / Wet H2O / ISSG)
 *  - OrbitControls with damping & clamped zoom/pan + Raycaster wafer hover/click zoom-in transition
 */
(function (global) {
  'use strict';

  var GAS_PALETTE = {
    n2:   { hex: 0x94a3b8, emissive: 0x475569, label: 'N₂ Inert Purge' },
    dry:  { hex: 0x22d3ee, emissive: 0x0891b2, label: 'Dry O₂' },
    wet:  { hex: 0x3b82f6, emissive: 0x1d4ed8, label: 'Wet H₂O Steam' },
    issg: { hex: 0xc084fc, emissive: 0x9333ea, label: 'ISSG Radical' }
  };

  var INITIAL_POS = [0.4, 2.35, 7.65];
  var INITIAL_TARGET = [0.0, 0.02, 0.0];
  var DRAG_THRESHOLD_PX = 6;

  function resolveThermalRgb(T) {
    if (global.OxidationThermal && global.OxidationThermal.temperatureToRgb) {
      return global.OxidationThermal.temperatureToRgb(T);
    }
    return { r: 220, g: 85, b: 22 };
  }

  function resolveHeatFrac(T) {
    if (global.OxidationThermal && global.OxidationThermal.heatFraction) {
      return global.OxidationThermal.heatFraction(T);
    }
    return Math.max(0, Math.min(1, (T - 600) / 600));
  }

  function clampTarget(ctrl) {
    if (!ctrl || !ctrl.target) return;
    ctrl.target.x = Math.max(-3.5, Math.min(3.5, ctrl.target.x));
    ctrl.target.y = Math.max(-1.4, Math.min(1.6, ctrl.target.y));
    ctrl.target.z = Math.max(-1.8, Math.min(1.8, ctrl.target.z));
  }

  function ThermalChamber3D(containerEl, options) {
    this.host = containerEl;
    options = options || {};
    this.onHoverWafer = options.onHoverWafer || null;
    this.onWaferClick = options.onWaferClick || null;
    this.onZoomTransition = options.onZoomTransition || null;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;

    this.ambientLight = null;
    this.keyLight = null;
    this.furnaceLight = null;
    this.gridHelper = null;

    this.coilZones = [];
    this.waferMeshes = [];
    this.waferRimMeshes = [];
    this.streamlines = [];
    this.quartzTubeMat = null;
    this.boatMat = null;
    this.metalCapMat = null;

    this.hoveredIdx = -1;
    this.activeTween = null;
    this.streamPhase = 0;
    this.pointerDown = false;
    this.isDragging = false;
    this.downPos = { x: 0, y: 0 };
    this.raycaster = typeof THREE !== 'undefined' ? new THREE.Raycaster() : null;
    this.pointerNdc = typeof THREE !== 'undefined' ? new THREE.Vector2() : null;
    this.disposed = false;

    this.init();
  }

  ThermalChamber3D.prototype.init = function () {
    if (!this.host || typeof THREE === 'undefined') return;

    var w = Math.max(1, this.host.clientWidth || 640);
    var h = Math.max(1, this.host.clientHeight || 320);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(INITIAL_POS[0], INITIAL_POS[1], INITIAL_POS[2]);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.host.appendChild(this.renderer.domElement);

    if (typeof THREE.OrbitControls === 'function') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(INITIAL_TARGET[0], INITIAL_TARGET[1], INITIAL_TARGET[2]);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minDistance = 3.4;
      this.controls.maxDistance = 15.0;
      this.controls.minPolarAngle = Math.PI * 0.18;
      this.controls.maxPolarAngle = Math.PI * 0.64;
      this.controls.panSpeed = 0.65;
      var self = this;
      this.controls.addEventListener('change', function () {
        clampTarget(self.controls);
      });
      this.controls.update();
    }

    this.ambientLight = new THREE.AmbientLight(0x94a3b8, 1.35);
    this.scene.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    this.keyLight.position.set(5.5, 8.5, 7.0);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.keyLight);

    var fillLight = new THREE.DirectionalLight(0x38bdf8, 0.45);
    fillLight.position.set(-6.0, 4.0, -5.0);
    this.scene.add(fillLight);

    this.furnaceLight = new THREE.PointLight(0xff7722, 0.4, 14, 1.6);
    this.furnaceLight.position.set(0, 0.4, 0.6);
    this.scene.add(this.furnaceLight);

    this.gridHelper = new THREE.GridHelper(24, 24, 0x475569, 0x1e293b);
    this.gridHelper.position.y = -1.92;
    this.gridHelper.material.transparent = true;
    this.gridHelper.material.opacity = 0.22;
    this.gridHelper.material.depthWrite = false;
    this.scene.add(this.gridHelper);

    this.buildFurnace();
    this.bindEvents();
  };

  ThermalChamber3D.prototype.buildFurnace = function () {
    var rootGrp = new THREE.Group();
    this.scene.add(rootGrp);

    // 1. Stainless-steel End Caps & Inlet / Exhaust Manifolds
    this.metalCapMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.85,
      roughness: 0.26
    });
    var trimMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.78,
      roughness: 0.34
    });

    // Left Gas Inlet Flange + Nozzle (-X)
    var leftFlangeGeo = new THREE.CylinderGeometry(1.52, 1.56, 0.26, 48);
    leftFlangeGeo.rotateZ(Math.PI / 2);
    var leftFlange = new THREE.Mesh(leftFlangeGeo, this.metalCapMat);
    leftFlange.position.x = -3.72;
    rootGrp.add(leftFlange);

    var leftSealGeo = new THREE.CylinderGeometry(1.42, 1.42, 0.14, 48);
    leftSealGeo.rotateZ(Math.PI / 2);
    var leftSeal = new THREE.Mesh(leftSealGeo, trimMat);
    leftSeal.position.x = -3.86;
    rootGrp.add(leftSeal);

    var inletPipeGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.95, 24);
    inletPipeGeo.rotateZ(Math.PI / 2);
    var inletPipe = new THREE.Mesh(inletPipeGeo, this.metalCapMat);
    inletPipe.position.set(-4.35, 0.0, 0.0);
    rootGrp.add(inletPipe);

    // Right Exhaust Flange + Exhaust Neck (+X)
    var rightFlangeGeo = new THREE.CylinderGeometry(1.56, 1.52, 0.26, 48);
    rightFlangeGeo.rotateZ(Math.PI / 2);
    var rightFlange = new THREE.Mesh(rightFlangeGeo, this.metalCapMat);
    rightFlange.position.x = 3.72;
    rootGrp.add(rightFlange);

    var rightSealGeo = new THREE.CylinderGeometry(1.42, 1.42, 0.14, 48);
    rightSealGeo.rotateZ(Math.PI / 2);
    var rightSeal = new THREE.Mesh(rightSealGeo, trimMat);
    rightSeal.position.x = 3.86;
    rootGrp.add(rightSeal);

    var exhaustPipeGeo = new THREE.CylinderGeometry(0.24, 0.20, 0.95, 24);
    exhaustPipeGeo.rotateZ(Math.PI / 2);
    var exhaustPipe = new THREE.Mesh(exhaustPipeGeo, this.metalCapMat);
    exhaustPipe.position.set(4.35, 0.0, 0.0);
    rootGrp.add(exhaustPipe);

    // Pedestal Support Saddles
    [-2.9, 2.9].forEach(function (sx) {
      var ped = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.62, 1.85), trimMat);
      ped.position.set(sx, -1.62, 0);
      rootGrp.add(ped);
    });

    // 2. 3-Zone Helical Heating Coils (Left, Center, Right)
    var zoneCenters = [-2.25, 0.0, 2.25];
    var self = this;
    zoneCenters.forEach(function (zx, zIdx) {
      var coilMat = new THREE.MeshStandardMaterial({
        color: 0x3b2c2a,
        emissive: 0x232d3e,
        emissiveIntensity: 0.15,
        metalness: 0.72,
        roughness: 0.32
      });
      // Helical ribbon path around outer quartz tube (arc biased toward back/top/bottom so front view is unobstructed)
      var turns = 3;
      var width = 1.65;
      var coilRadius = 1.58;
      var pts = [];
      var samples = 72;
      for (var i = 0; i <= samples; i++) {
        var frac = i / samples;
        var ang = frac * turns * Math.PI * 2 + 0.35;
        var px = zx - width * 0.5 + frac * width;
        var py = Math.sin(ang) * coilRadius;
        var pz = Math.cos(ang) * coilRadius;
        pts.push(new THREE.Vector3(px, py, pz));
      }
      var coilCurve = new THREE.CatmullRomCurve3(pts);
      var coilGeo = new THREE.TubeGeometry(coilCurve, 72, 0.048, 8, false);
      var coilMesh = new THREE.Mesh(coilGeo, coilMat);
      coilMesh.renderOrder = 3;
      rootGrp.add(coilMesh);
      self.coilZones.push({ mesh: coilMesh, mat: coilMat, zoneIndex: zIdx });
    });

    // 3. Quartz Carrier Boat + 8 Silicon Wafers
    this.boatMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      transparent: true,
      opacity: 0.42,
      roughness: 0.18,
      metalness: 0.08,
      depthWrite: false
    });

    [-0.52, 0.52].forEach(function (bz) {
      var railGeo = new THREE.CylinderGeometry(0.045, 0.045, 4.9, 12);
      railGeo.rotateZ(Math.PI / 2);
      var rail = new THREE.Mesh(railGeo, self.boatMat);
      rail.position.set(0, -0.78, bz);
      rail.renderOrder = 3;
      rootGrp.add(rail);
    });
    [-2.35, 0.0, 2.35].forEach(function (bx) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.15), self.boatMat);
      bar.position.set(bx, -0.82, 0);
      bar.renderOrder = 3;
      rootGrp.add(bar);
    });

    // 8 Vertical Silicon Wafers Seated in Quartz Boat
    var numWafers = 8;
    var waferSpan = 3.9;
    for (var wi = 0; wi < numWafers; wi++) {
      var wx = -waferSpan * 0.5 + (wi / (numWafers - 1)) * waferSpan;
      var wMat = new THREE.MeshStandardMaterial({
        color: 0x232d3e,
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        metalness: 0.65,
        roughness: 0.22
      });
      var wGeo = new THREE.CylinderGeometry(0.76, 0.76, 0.06, 40);
      wGeo.rotateZ(Math.PI / 2);
      var wMesh = new THREE.Mesh(wGeo, wMat);
      wMesh.position.set(wx, -0.08, 0);
      wMesh.castShadow = true;
      wMesh.receiveShadow = true;
      wMesh.userData = { waferIndex: wi, isWafer: true };
      rootGrp.add(wMesh);
      self.waferMeshes.push(wMesh);

      // Growing SiO2 subtle glassy rim around wafer edge
      var rimMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        depthWrite: false
      });
      var rimGeo = new THREE.TorusGeometry(0.77, 0.022, 8, 40);
      rimGeo.rotateY(Math.PI / 2);
      var rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.position.copy(wMesh.position);
      rimMesh.renderOrder = 4;
      rootGrp.add(rimMesh);
      self.waferRimMeshes.push({ mesh: rimMesh, mat: rimMat });
    }

    // 4. Horizontal Translucent Quartz Tube (Rendered after internals for clean alpha sorting)
    this.quartzTubeMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      transparent: true,
      opacity: 0.22,
      roughness: 0.10,
      metalness: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    var tubeGeo = new THREE.CylinderGeometry(1.38, 1.38, 7.2, 48, 1, true);
    tubeGeo.rotateZ(Math.PI / 2);
    var tubeMesh = new THREE.Mesh(tubeGeo, this.quartzTubeMat);
    tubeMesh.renderOrder = 5;
    rootGrp.add(tubeMesh);

    // 5. 4 Laminar Left-to-Right Continuum Gas Streamlines (no bouncing spheres)
    var streamSpecs = [
      { y: 0.88, z: 0.28, amp: 0.09 },
      { y: 0.56, z: -0.68, amp: 0.07 },
      { y: -0.58, z: 0.66, amp: 0.07 },
      { y: 0.14, z: 0.92, amp: 0.08 }
    ];
    streamSpecs.forEach(function (sp, sIdx) {
      var pts = [];
      for (var k = 0; k <= 10; k++) {
        var u = k / 10;
        var sx = -3.65 + u * 7.3;
        var arch = Math.sin(u * Math.PI);
        var sy = sp.y * (0.28 + 0.72 * arch) + Math.sin(u * Math.PI * 3 + sIdx) * sp.amp;
        var sz = sp.z * (0.22 + 0.78 * arch);
        pts.push(new THREE.Vector3(sx, sy, sz));
      }
      var curve = new THREE.CatmullRomCurve3(pts);
      var lineGeo = new THREE.TubeGeometry(curve, 56, 0.024, 6, false);
      var lineMat = new THREE.MeshBasicMaterial({
        color: GAS_PALETTE.n2.hex,
        transparent: true,
        opacity: 0.28,
        depthWrite: false
      });
      var lineMesh = new THREE.Mesh(lineGeo, lineMat);
      lineMesh.renderOrder = 6;
      rootGrp.add(lineMesh);

      // Smooth elongated continuum flow pulses gliding left -> right along the streamline
      var pulses = [];
      for (var p = 0; p < 2; p++) {
        var pGeo = new THREE.CylinderGeometry(0.036, 0.018, 0.34, 8);
        pGeo.rotateZ(Math.PI / 2);
        var pMat = new THREE.MeshBasicMaterial({
          color: GAS_PALETTE.n2.hex,
          transparent: true,
          opacity: 0.65,
          depthWrite: false
        });
        var pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.renderOrder = 7;
        rootGrp.add(pMesh);
        pulses.push({ mesh: pMesh, mat: pMat, offset: p * 0.5 + sIdx * 0.19 });
      }

      self.streamlines.push({
        curve: curve,
        lineMat: lineMat,
        pulses: pulses
      });
    });
  };

  ThermalChamber3D.prototype.applyTheme = function (theme) {
    if (!this.scene) return;
    var isLight = theme === 'light';
    this.scene.background = new THREE.Color(isLight ? 0xf1f5f9 : 0x0a0e17);
    if (this.gridHelper && this.gridHelper.material) {
      this.gridHelper.material.color.setHex(isLight ? 0x94a3b8 : 0x334155);
      this.gridHelper.material.opacity = isLight ? 0.28 : 0.22;
    }
    if (this.quartzTubeMat) {
      this.quartzTubeMat.color.setHex(isLight ? 0x93c5fd : 0xdbeafe);
      this.quartzTubeMat.opacity = isLight ? 0.26 : 0.22;
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = isLight ? 1.75 : 1.35;
    }
  };

  ThermalChamber3D.prototype.bindEvents = function () {
    if (!this.renderer || !this.renderer.domElement) return;
    var dom = this.renderer.domElement;
    var self = this;

    dom.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      self.pointerDown = true;
      self.isDragging = false;
      self.downPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointermove', function (e) {
      if (self.disposed) return;
      if (self.pointerDown) {
        var d = Math.hypot(e.clientX - self.downPos.x, e.clientY - self.downPos.y);
        if (d > DRAG_THRESHOLD_PX) self.isDragging = true;
      } else if (e.target === dom) {
        var idx = self.pickWaferAt(e.clientX, e.clientY);
        if (idx !== self.hoveredIdx) {
          self.hoveredIdx = idx;
          dom.style.cursor = idx >= 0 ? 'pointer' : 'grab';
          if (self.onHoverWafer) self.onHoverWafer(idx >= 0, idx);
        }
      }
    });

    window.addEventListener('pointerup', function () {
      self.pointerDown = false;
    });

    dom.addEventListener('mouseleave', function () {
      if (self.hoveredIdx !== -1) {
        self.hoveredIdx = -1;
        dom.style.cursor = 'grab';
        if (self.onHoverWafer) self.onHoverWafer(false, -1);
      }
    });

    dom.addEventListener('click', function (e) {
      if (self.isDragging) {
        self.isDragging = false;
        return;
      }
      var idx = self.pickWaferAt(e.clientX, e.clientY);
      if (idx >= 0) {
        self.zoomToWafer(idx);
      }
    });
  };

  ThermalChamber3D.prototype.pickWaferAt = function (clientX, clientY) {
    if (!this.raycaster || !this.camera || !this.renderer || !this.waferMeshes.length) return -1;
    var rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return -1;
    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    var hits = this.raycaster.intersectObjects(this.waferMeshes, false);
    if (hits.length > 0 && hits[0].object && hits[0].object.userData) {
      return hits[0].object.userData.waferIndex;
    }
    return -1;
  };

  ThermalChamber3D.prototype.zoomToWafer = function (waferIndex) {
    var wMesh = this.waferMeshes[waferIndex] || this.waferMeshes[Math.floor(this.waferMeshes.length / 2)];
    if (!wMesh || !this.camera || !this.controls) return;
    if (this.onWaferClick) this.onWaferClick(waferIndex);

    var wx = wMesh.position.x;
    this.activeTween = {
      startTime: performance.now(),
      duration: 600,
      crossfaded: false,
      fromPos: this.camera.position.clone(),
      toPos: new THREE.Vector3(wx + 0.35, 0.12, 1.85),
      fromTarget: this.controls.target.clone(),
      toTarget: new THREE.Vector3(wx, -0.05, 0.0)
    };
  };

  ThermalChamber3D.prototype.resetCamera = function (animate) {
    if (!this.camera || !this.controls) return;
    if (!animate) {
      this.activeTween = null;
      this.camera.position.set(INITIAL_POS[0], INITIAL_POS[1], INITIAL_POS[2]);
      this.controls.target.set(INITIAL_TARGET[0], INITIAL_TARGET[1], INITIAL_TARGET[2]);
      this.controls.update();
      return;
    }
    this.activeTween = {
      startTime: performance.now(),
      duration: 520,
      crossfaded: true,
      fromPos: this.camera.position.clone(),
      toPos: new THREE.Vector3(INITIAL_POS[0], INITIAL_POS[1], INITIAL_POS[2]),
      fromTarget: this.controls.target.clone(),
      toTarget: new THREE.Vector3(INITIAL_TARGET[0], INITIAL_TARGET[1], INITIAL_TARGET[2])
    };
  };

  ThermalChamber3D.prototype.resize = function () {
    if (!this.host || !this.renderer || !this.camera) return;
    var w = this.host.clientWidth;
    var h = this.host.clientHeight;
    if (w <= 0 || h <= 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  ThermalChamber3D.prototype.update = function (state, chemistry, activeGas, isPlaying, theme, dtSec) {
    if (!this.renderer || !this.scene || !this.camera || !state) return;

    this.applyTheme(theme);

    var T = state.T || 600;
    var x_ox = typeof state.x_ox === 'number' ? state.x_ox : 1.0;
    var C_ox = state.C_ox || 0.0;
    var dt = Math.min(0.05, Math.max(0.001, dtSec || 0.016));

    // 1. Update 3-Zone Heating Coils using shared thermal colormap
    var heatFrac = resolveHeatFrac(T);
    for (var i = 0; i < this.coilZones.length; i++) {
      var zc = this.coilZones[i];
      var edgeOffset = (zc.zoneIndex === 1) ? 0 : -15 * (1 - heatFrac * 0.4);
      var zoneRgb = resolveThermalRgb(T + edgeOffset);
      var hexColor = (zoneRgb.r << 16) | (zoneRgb.g << 8) | zoneRgb.b;
      zc.mat.color.setHex(hexColor);
      zc.mat.emissive.setHex(hexColor);
      zc.mat.emissiveIntensity = 0.08 + 1.35 * Math.pow(heatFrac, 1.15);
    }

    // 2. Update Furnace Radiance Light
    var mainRgb = resolveThermalRgb(T);
    var mainHex = (mainRgb.r << 16) | (mainRgb.g << 8) | mainRgb.b;
    if (this.furnaceLight) {
      this.furnaceLight.color.setHex(mainHex);
      this.furnaceLight.intensity = 0.15 + 1.65 * heatFrac;
    }

    // 3. Update Wafers (same T(t) thermal glow + hover highlight + SiO2 edge sheen)
    var oxideRimAlpha = Math.min(0.85, 0.16 + 0.65 * Math.min(1, Math.log10(1 + x_ox) / 2.2));
    for (var wi = 0; wi < this.waferMeshes.length; wi++) {
      var wMesh = this.waferMeshes[wi];
      var isHover = wi === this.hoveredIdx;
      wMesh.material.color.setHex(mainHex);
      if (isHover) {
        wMesh.material.emissive.setHex(0x38bdf8);
        wMesh.material.emissiveIntensity = 0.55;
      } else {
        wMesh.material.emissive.setHex(mainHex);
        wMesh.material.emissiveIntensity = heatFrac * 0.42;
      }
      var rim = this.waferRimMeshes[wi];
      if (rim) {
        rim.mat.color.setHex(isHover ? 0x7dd3fc : 0x38bdf8);
        rim.mat.opacity = isHover ? 0.92 : oxideRimAlpha;
      }
    }

    // 4. Update Laminar Left-to-Right Continuum Gas Streamlines
    var gasKey = (activeGas && GAS_PALETTE[activeGas]) ? activeGas : (C_ox >= 0.08 ? (chemistry || 'dry') : 'n2');
    var gasSpec = GAS_PALETTE[gasKey] || GAS_PALETTE.n2;
    var flowRate = isPlaying ? (0.45 + 0.55 * C_ox) : 0.12;
    this.streamPhase = (this.streamPhase + dt * flowRate) % 100.0;

    for (var si = 0; si < this.streamlines.length; si++) {
      var sl = this.streamlines[si];
      sl.lineMat.color.setHex(gasSpec.hex);
      sl.lineMat.opacity = (gasKey === 'n2' ? 0.22 : (0.28 + 0.26 * C_ox));

      for (var pi = 0; pi < sl.pulses.length; pi++) {
        var pu = sl.pulses[pi];
        var tFrac = (this.streamPhase + pu.offset) % 1.0;
        var pos = sl.curve.getPointAt(tFrac);
        var tangent = sl.curve.getTangentAt(tFrac);
        pu.mesh.position.copy(pos);
        // Align elongation along local flow tangent
        pu.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), tangent.normalize());
        pu.mat.color.setHex(gasSpec.hex);
        var edgeFade = Math.sin(tFrac * Math.PI);
        pu.mat.opacity = (isPlaying ? 0.82 : 0.36) * edgeFade;
      }
    }

    // 5. Camera Click-to-Zoom Tween (~600ms ease-in-out, cross-fade trigger at 70%)
    if (this.activeTween && this.controls) {
      var elapsed = performance.now() - this.activeTween.startTime;
      var rawT = Math.min(1, elapsed / this.activeTween.duration);
      var ease = rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

      this.camera.position.lerpVectors(this.activeTween.fromPos, this.activeTween.toPos, ease);
      this.controls.target.lerpVectors(this.activeTween.fromTarget, this.activeTween.toTarget, ease);

      if (!this.activeTween.crossfaded && rawT >= 0.70) {
        this.activeTween.crossfaded = true;
        if (this.onZoomTransition) this.onZoomTransition();
      }
      if (rawT >= 1) {
        this.activeTween = null;
      }
    }

    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  ThermalChamber3D.prototype.dispose = function () {
    this.disposed = true;
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      if (this.renderer.dispose) this.renderer.dispose();
    }
  };

  global.ThermalChamber3D = ThermalChamber3D;
})(typeof window !== 'undefined' ? window : globalThis);
