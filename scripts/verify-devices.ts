/**
 * scripts/verify-devices.ts
 * Automated verification harness for all 7 SiliconSliders solid-state 3D CAD modules:
 *   1. Inspect Tree Integrity: every node in TREE resolves to >= 1 real 3D mesh with matching userData.layerId (+ valid INFO).
 *   2. Selection Round-Trip: SiliconLayerHighlight.selectLayer(id) mutates materials & attaches _hlEdge; clearSelection() restores exact original material properties and shared references.
 *   3. Tour Step Integrity: every FAB_STEPS entry references valid scene layer keys, forces cutoff/equilibrium on PLAY TOUR, and suppresses carrier particles.
 *   4. Physics Stability: physics models return finite numbers across full min/max bias sweeps (no NaN/Infinity).
 *   5. Time-of-Day Theme & Shared LayerHighlight Parity: verifies 06:00-17:59 -> 'light' / 18:00-05:59 -> 'dark' & shared .ts/.js highlight engine alignment.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import SiliconLayerHighlight from '../src/shared/three/layerHighlight.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const paletteMod = require(path.join(ROOT, 'src/shared/materialPalette.js'));

interface ModuleSpec {
  id: string;
  dir: string;
  mode: 'diode' | 'mosfet' | 'cmos';
  scripts: string[];
}

const MODULES: ModuleSpec[] = [
  {
    id: 'pn-diode',
    dir: 'src/modules/diodes/pn-diode',
    mode: 'diode',
    scripts: [
      'js/data.js',
      'js/physics.js',
      'js/scene.js',
      'js/theme.js',
      '../../../shared/three/layerHighlight.js',
      '../../../shared/viewer/js/viewer-core.js',
      'js/geometry.js',
      'js/controls-explode-scrub.js',
      'js/dimensions.js',
      'js/ui-panels.js',
      'js/selection.js',
      'js/flow.js',
      'js/logic-state.js',
      'js/build-anim.js',
    ],
  },
  {
    id: 'e-nmos',
    dir: 'src/modules/transistors/mosfet/nmos',
    mode: 'mosfet',
    scripts: [
      'js/data.js',
      'js/scene.js',
      'js/theme.js',
      '../../../../shared/three/layerHighlight.js',
      '../../../../shared/viewer/js/viewer-core.js',
      'js/geometry.js',
      'js/controls-explode-scrub.js',
      'js/dimensions.js',
      'js/ui-panels.js',
      'js/selection.js',
      'js/flow.js',
      'js/logic-state.js',
      'js/build-anim.js',
    ],
  },
  {
    id: 'e-pmos',
    dir: 'src/modules/transistors/mosfet/pmos',
    mode: 'mosfet',
    scripts: [
      'js/data.js',
      'js/scene.js',
      'js/theme.js',
      '../../../../shared/three/layerHighlight.js',
      '../../../../shared/viewer/js/viewer-core.js',
      'js/geometry.js',
      'js/controls-explode-scrub.js',
      'js/dimensions.js',
      'js/ui-panels.js',
      'js/selection.js',
      'js/flow.js',
      'js/logic-state.js',
      'js/build-anim.js',
    ],
  },
  {
    id: 'd-nmos',
    dir: 'src/modules/transistors/mosfet/d-nmos',
    mode: 'mosfet',
    scripts: [
      'js/data.js',
      'js/scene.js',
      'js/theme.js',
      '../../../../shared/three/layerHighlight.js',
      '../../../../shared/viewer/js/viewer-core.js',
      'js/geometry.js',
      'js/controls-explode-scrub.js',
      'js/dimensions.js',
      'js/ui-panels.js',
      'js/selection.js',
      'js/flow.js',
      'js/logic-state.js',
      'js/build-anim.js',
    ],
  },
  {
    id: 'd-pmos',
    dir: 'src/modules/transistors/mosfet/d-pmos',
    mode: 'mosfet',
    scripts: [
      'js/data.js',
      'js/scene.js',
      'js/theme.js',
      '../../../../shared/three/layerHighlight.js',
      '../../../../shared/viewer/js/viewer-core.js',
      'js/geometry.js',
      'js/controls-explode-scrub.js',
      'js/dimensions.js',
      'js/ui-panels.js',
      'js/selection.js',
      'js/flow.js',
      'js/logic-state.js',
      'js/build-anim.js',
    ],
  },
  {
    id: 'cmos-inverter',
    dir: 'src/modules/transistors/cmos/cmos-inverter',
    mode: 'cmos',
    scripts: [
      'js/data.js',
      'js/scene.js',
      'js/theme.js',
      '../../../../shared/three/layerHighlight.js',
      '../../../../shared/viewer/js/viewer-core.js',
      'js/geometry.js',
      'js/controls-explode-scrub.js',
      'js/dimensions.js',
      'js/ui-panels.js',
      'js/selection.js',
      'js/flow.js',
      'js/logic-state.js',
      'js/build-anim.js',
    ],
  },
  {
    id: 'cmos-nand',
    dir: 'src/modules/transistors/cmos/cmos-nand',
    mode: 'cmos',
    scripts: [
      'js/data.js',
      'js/scene.js',
      'js/theme.js',
      '../../../../shared/three/layerHighlight.js',
      '../../../../shared/viewer/js/viewer-core.js',
      'js/geometry.js',
      'js/controls-explode-scrub.js',
      'js/dimensions.js',
      'js/ui-panels.js',
      'js/selection.js',
      'js/flow.js',
      'js/logic-state.js',
      'js/build-anim.js',
    ],
  },
];

function createThreeMock() {
  class Vector2 {
    x: number;
    y: number;
    constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
    set(x: number, y: number) { this.x = x; this.y = y; return this; }
  }

  class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
    copy(v: any) { this.x = v.x || 0; this.y = v.y || 0; this.z = v.z || 0; return this; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    add(v: any) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
    sub(v: any) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
    multiplyScalar(s: number) { this.x *= s; this.y *= s; this.z *= s; return this; }
    lerpVectors(a: any, b: any, t: number) {
      this.x = a.x + (b.x - a.x) * t;
      this.y = a.y + (b.y - a.y) * t;
      this.z = a.z + (b.z - a.z) * t;
      return this;
    }
    distanceTo(v: any) { return Math.hypot(this.x - v.x, this.y - v.y, this.z - v.z); }
    project() {
      this.x = Math.max(-0.9, Math.min(0.9, this.x / 20));
      this.y = Math.max(-0.9, Math.min(0.9, this.y / 20));
      this.z = 0.25;
      return this;
    }
  }

  class Box3 {
    min = new Vector3(-1, -1, -1);
    max = new Vector3(1, 1, 1);
    private _empty = false;
    makeEmpty() { this._empty = true; this.min.set(Infinity, Infinity, Infinity); this.max.set(-Infinity, -Infinity, -Infinity); return this; }
    expandByObject(obj: any) {
      if (!obj) return this;
      let wx = obj.position?.x || 0, wy = obj.position?.y || 0, wz = obj.position?.z || 0;
      let p = obj.parent;
      while (p) {
        wx += p.position?.x || 0;
        wy += p.position?.y || 0;
        wz += p.position?.z || 0;
        p = p.parent;
      }
      if (this._empty) {
        this._empty = false;
        this.min.set(wx - 0.5, wy - 0.5, wz - 0.5);
        this.max.set(wx + 0.5, wy + 0.5, wz + 0.5);
      } else {
        this.min.x = Math.min(this.min.x, wx - 0.5);
        this.min.y = Math.min(this.min.y, wy - 0.5);
        this.min.z = Math.min(this.min.z, wz - 0.5);
        this.max.x = Math.max(this.max.x, wx + 0.5);
        this.max.y = Math.max(this.max.y, wy + 0.5);
        this.max.z = Math.max(this.max.z, wz + 0.5);
      }
      return this;
    }
    setFromObject(obj: any) { return this.makeEmpty().expandByObject(obj); }
    isEmpty() { return this._empty; }
    getCenter(target?: Vector3) {
      const t = target || new Vector3();
      if (this._empty) return t.set(0, 0, 0);
      return t.set((this.min.x + this.max.x) * 0.5, (this.min.y + this.max.y) * 0.5, (this.min.z + this.max.z) * 0.5);
    }
    getSize(target?: Vector3) {
      const t = target || new Vector3();
      if (this._empty) return t.set(0, 0, 0);
      return t.set(this.max.x - this.min.x, this.max.y - this.min.y, this.max.z - this.min.z);
    }
  }

  const NAMED_COLORS: Record<string, number> = {
    white: 0xffffff,
    black: 0x000000,
    red: 0xff0000,
    green: 0x00ff00,
    blue: 0x0000ff,
  };

  class Color {
    r = 1;
    g = 1;
    b = 1;
    isColor = true;
    constructor(val: any = 0xffffff) {
      this.set(val);
    }
    set(val: any) {
      if (val && val.isColor) return this.copy(val);
      if (typeof val === 'number') return this.setHex(val);
      if (typeof val === 'string') {
        const s = val.trim().toLowerCase();
        if (s.startsWith('#')) {
          let hex = s.slice(1);
          if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
          const n = parseInt(hex, 16);
          return this.setHex(Number.isFinite(n) ? n : 0xffffff);
        }
        if (s.startsWith('rgb')) {
          const nums = s.match(/[\d.]+/g) || [];
          this.r = Number(nums[0] || 0) / 255;
          this.g = Number(nums[1] || 0) / 255;
          this.b = Number(nums[2] || 0) / 255;
          return this;
        }
        if (NAMED_COLORS[s] !== undefined) return this.setHex(NAMED_COLORS[s]);
      }
      return this.setHex(0x888888);
    }
    setHex(hex: number) {
      const h = Math.floor(hex) >>> 0;
      this.r = ((h >> 16) & 255) / 255;
      this.g = ((h >> 8) & 255) / 255;
      this.b = (h & 255) / 255;
      return this;
    }
    getHex(): number {
      const r = Math.max(0, Math.min(255, Math.round(this.r * 255)));
      const g = Math.max(0, Math.min(255, Math.round(this.g * 255)));
      const b = Math.max(0, Math.min(255, Math.round(this.b * 255)));
      return (r << 16) | (g << 8) | b;
    }
    getStyle(): string {
      const r = Math.round(this.r * 255);
      const g = Math.round(this.g * 255);
      const b = Math.round(this.b * 255);
      return `rgb(${r},${g},${b})`;
    }
    copy(c: any) { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
    clone() { return new Color().copy(this); }
    lerp(c: any, alpha: number) {
      this.r += (c.r - this.r) * alpha;
      this.g += (c.g - this.g) * alpha;
      this.b += (c.b - this.b) * alpha;
      return this;
    }
    offsetHSL(_h: number, _s: number, l: number) {
      this.r = Math.max(0, Math.min(1, this.r + l));
      this.g = Math.max(0, Math.min(1, this.g + l));
      this.b = Math.max(0, Math.min(1, this.b + l));
      return this;
    }
  }

  class Plane {
    normal: Vector3;
    constant: number;
    constructor(n = new Vector3(0, 1, 0), c = 0) { this.normal = n; this.constant = c; }
  }

  class AttributeMock {
    array: Float32Array;
    itemSize: number;
    count: number;
    needsUpdate = false;
    constructor(arr: any, itemSize = 3) {
      this.array = arr instanceof Float32Array ? arr : new Float32Array(arr || 72);
      this.itemSize = itemSize;
      this.count = Math.floor(this.array.length / itemSize);
    }
    getX(i: number) { return this.array[i * this.itemSize] || 0; }
    getY(i: number) { return this.array[i * this.itemSize + 1] || 0; }
    getZ(i: number) { return this.array[i * this.itemSize + 2] || 0; }
    setX(i: number, v: number) { this.array[i * this.itemSize] = v; }
    setY(i: number, v: number) { this.array[i * this.itemSize + 1] = v; }
    setZ(i: number, v: number) { this.array[i * this.itemSize + 2] = v; }
    setXYZ(i: number, x: number, y: number, z: number) {
      const idx = i * this.itemSize;
      this.array[idx] = x;
      this.array[idx + 1] = y;
      this.array[idx + 2] = z;
    }
  }

  class BufferGeometry {
    attributes: Record<string, AttributeMock> = {
      position: new AttributeMock(new Float32Array(72), 3),
      normal: new AttributeMock(new Float32Array(72), 3),
      uv: new AttributeMock(new Float32Array(48), 2),
    };
    boundingBox: Box3 | null = new Box3();
    boundingSphere: any = { center: new Vector3(), radius: 1 };
    userData: Record<string, any> = {};
    setAttribute(name: string, attr: AttributeMock) { this.attributes[name] = attr; return this; }
    getAttribute(name: string) { return this.attributes[name]; }
    setIndex() { return this; }
    setFromPoints(pts: any[]) {
      const arr = new Float32Array(Math.max(1, pts.length) * 3);
      for (let i = 0; i < pts.length; i++) {
        arr[i * 3] = pts[i].x || 0;
        arr[i * 3 + 1] = pts[i].y || 0;
        arr[i * 3 + 2] = pts[i].z || 0;
      }
      this.attributes.position = new AttributeMock(arr, 3);
      return this;
    }
    computeVertexNormals() {}
    computeBoundingSphere() { this.boundingSphere = { center: new Vector3(), radius: 1 }; }
    computeBoundingBox() { this.boundingBox = new Box3(); }
    center() { return this; }
    translate() { return this; }
    rotateX() { return this; }
    rotateY() { return this; }
    rotateZ() { return this; }
    clone() { return new BufferGeometry(); }
    dispose() {}
  }

  class Material {
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
    depthTest: boolean;
    roughness: number;
    metalness: number;
    side: number;
    needsUpdate = false;
    map: any = null;
    clippingPlanes: any = null;
    constructor(opts: any = {}) {
      this.color = new Color(opts.color !== undefined ? opts.color : 0xffffff);
      this.emissive = new Color(opts.emissive !== undefined ? opts.emissive : 0x000000);
      this.emissiveIntensity = opts.emissiveIntensity !== undefined ? opts.emissiveIntensity : 0;
      this.opacity = opts.opacity !== undefined ? opts.opacity : 1;
      this.transparent = !!opts.transparent;
      this.depthWrite = opts.depthWrite !== undefined ? opts.depthWrite : true;
      this.depthTest = opts.depthTest !== undefined ? opts.depthTest : true;
      this.roughness = opts.roughness !== undefined ? opts.roughness : 0.5;
      this.metalness = opts.metalness !== undefined ? opts.metalness : 0.1;
      this.side = opts.side || 0;
      this.map = opts.map || null;
      this.clippingPlanes = opts.clippingPlanes || null;
    }
    clone() {
      return new Material({
        color: this.color.getHex(),
        emissive: this.emissive.getHex(),
        emissiveIntensity: this.emissiveIntensity,
        opacity: this.opacity,
        transparent: this.transparent,
        depthWrite: this.depthWrite,
        depthTest: this.depthTest,
        roughness: this.roughness,
        metalness: this.metalness,
        side: this.side,
        map: this.map,
        clippingPlanes: this.clippingPlanes,
      });
    }
    dispose() {}
  }

  class Object3D {
    name = '';
    position = new Vector3();
    rotation = { x: 0, y: 0, z: 0, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } };
    scale = new Vector3(1, 1, 1);
    visible = true;
    renderOrder = 0;
    castShadow = false;
    receiveShadow = false;
    parent: Object3D | null = null;
    children: Object3D[] = [];
    userData: Record<string, any> = {};
    add(...objs: Object3D[]) {
      for (const o of objs) {
        if (!o) continue;
        if (o.parent && o.parent !== this) o.parent.remove(o);
        o.parent = this;
        if (this.children.indexOf(o) === -1) this.children.push(o);
      }
      return this;
    }
    remove(...objs: Object3D[]) {
      for (const o of objs) {
        const idx = this.children.indexOf(o);
        if (idx !== -1) {
          this.children.splice(idx, 1);
          o.parent = null;
        }
      }
      return this;
    }
    traverse(cb: (o: Object3D) => void) {
      cb(this);
      for (const c of [...this.children]) c.traverse(cb);
    }
    updateMatrixWorld() {
      this.userData._matrixWorldCalls = (this.userData._matrixWorldCalls || 0) + 1;
      for (const c of this.children) {
        if (typeof c.updateMatrixWorld === 'function') c.updateMatrixWorld();
      }
    }
    lookAt() {}
  }

  class Group extends Object3D { isGroup = true; }
  class Scene extends Object3D {
    background: any = null;
    fog: any = null;
    environment: any = null;
  }
  class Mesh extends Object3D {
    isMesh = true;
    geometry: any;
    material: any;
    constructor(geo = new BufferGeometry(), mat = new Material()) {
      super();
      this.geometry = geo;
      this.material = mat;
    }
  }
  class Sprite extends Object3D {
    isSprite = true;
    material: any;
    constructor(mat = new Material()) {
      super();
      this.material = mat;
    }
  }
  class Line extends Object3D {
    isLine = true;
    geometry: any;
    material: any;
    constructor(geo = new BufferGeometry(), mat = new Material()) {
      super();
      this.geometry = geo;
      this.material = mat;
    }
  }
  class LineLoop extends Line {}
  class LineSegments extends Line { isLineSegments = true; }

  class Shape {
    moveTo() { return this; }
    lineTo() { return this; }
    quadraticCurveTo() { return this; }
    bezierCurveTo() { return this; }
    absarc() { return this; }
    closePath() { return this; }
  }

  class CurvePath {
    curves: any[] = [];
    add(c: any) { this.curves.push(c); }
    getPointAt(t: number, target?: Vector3) {
      const out = target || new Vector3();
      return out.set(t, 0, 0);
    }
    getPoints(n = 32) {
      const pts: Vector3[] = [];
      for (let i = 0; i <= n; i++) pts.push(this.getPointAt(i / Math.max(1, n)));
      return pts;
    }
  }

  class Raycaster {
    static _testHitQueue: any[] = [];
    static _setFromCameraCalls = 0;
    setFromCamera() {
      Raycaster._setFromCameraCalls++;
    }
    intersectObjects(objects: any[], recursive = false) {
      const target = Raycaster._testHitQueue.length ? Raycaster._testHitQueue.shift() : null;
      if (!target) return [];
      const set = new Set<any>();
      const collect = (obj: any) => {
        if (!obj) return;
        set.add(obj);
        if (recursive && Array.isArray(obj.children)) {
          obj.children.forEach(collect);
        }
      };
      (objects || []).forEach(collect);
      if (!set.has(target)) return [];
      const wp = { x: target.position?.x || 0, y: target.position?.y || 0, z: target.position?.z || 0 };
      let p = target.parent;
      while (p) {
        wp.x += p.position?.x || 0;
        wp.y += p.position?.y || 0;
        wp.z += p.position?.z || 0;
        p = p.parent;
      }
      return [{ object: target, distance: 1.0, point: new Vector3(wp.x, wp.y, wp.z) }];
    }
  }

  class Texture {
    minFilter = 0;
    magFilter = 0;
    wrapS = 0;
    wrapT = 0;
    repeat = new Vector2(1, 1);
    dispose() {}
  }

  class PMREMGenerator {
    constructor() {}
    compileEquirectangularShader() {}
    fromEquirectangular() { return { texture: new Texture() }; }
    fromScene() { return { texture: new Texture() }; }
    dispose() {}
  }

  return {
    Vector2,
    Vector3,
    Box3,
    Color,
    Plane,
    BufferAttribute: AttributeMock,
    Float32BufferAttribute: AttributeMock,
    BufferGeometry,
    BoxGeometry: BufferGeometry,
    CylinderGeometry: BufferGeometry,
    SphereGeometry: BufferGeometry,
    PlaneGeometry: BufferGeometry,
    EdgesGeometry: BufferGeometry,
    ExtrudeGeometry: BufferGeometry,
    TubeGeometry: BufferGeometry,
    TorusGeometry: BufferGeometry,
    MeshStandardMaterial: Material,
    MeshBasicMaterial: Material,
    MeshPhysicalMaterial: Material,
    ShadowMaterial: Material,
    LineBasicMaterial: Material,
    SpriteMaterial: Material,
    Object3D,
    Group,
    Scene,
    Mesh,
    Sprite,
    Line,
    LineLoop,
    LineSegments,
    Shape,
    Path: Shape,
    CurvePath,
    CatmullRomCurve3: CurvePath,
    LineCurve3: CurvePath,
    Raycaster,
    CanvasTexture: Texture,
    PMREMGenerator,
    AmbientLight: class extends Object3D { intensity = 1; color = new Color(); },
    DirectionalLight: class extends Object3D {
      intensity = 1;
      color = new Color();
      shadow = { mapSize: new Vector2(1024, 1024), bias: 0, normalBias: 0, radius: 1, camera: { left: -15, right: 15, top: 15, bottom: -15, near: 0.5, far: 100 } };
    },
    HemisphereLight: class extends Object3D { intensity = 1; color = new Color(); groundColor = new Color(); },
    PointLight: class extends Object3D {
      intensity = 1;
      color = new Color();
      shadow = { mapSize: new Vector2(1024, 1024), bias: 0, camera: { near: 0.5, far: 100 } };
    },
    GridHelper: class extends Object3D { material: any = new Material({ transparent: true, opacity: 0.25 }); },
    Fog: class {
      color: any; near: number; far: number;
      constructor(color: any, near: number, far: number) { this.color = new Color(color); this.near = near; this.far = far; }
    },
    FogExp2: class {
      color: any; density: number;
      constructor(color: any, density: number) { this.color = new Color(color); this.density = density; }
    },
    PerspectiveCamera: class extends Object3D {
      aspect = 1.6;
      fov = 40;
      near = 0.1;
      far = 500;
      updateProjectionMatrix() {}
    },
    OrthographicCamera: class extends Object3D {
      left = -10; right = 10; top = 10; bottom = -10;
      zoom = 1;
      updateProjectionMatrix() {}
    },
    WebGLRenderer: class {
      domElement: any;
      shadowMap = { enabled: false, type: 0 };
      localClippingEnabled = false;
      toneMapping = 0;
      toneMappingExposure = 1;
      outputEncoding = 0;
      constructor(opts: any = {}) {
        this.domElement = opts.canvas || (opts._fallbackCanvas) || {
          _listeners: {} as Record<string, Function[]>,
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 1024, height: 640 }),
          addEventListener(type: string, fn: any) {
            if (!this._listeners[type]) this._listeners[type] = [];
            this._listeners[type].push(fn);
          },
          removeEventListener(type: string, fn: any) {
            if (!this._listeners[type]) return;
            this._listeners[type] = this._listeners[type].filter((f: any) => f !== fn);
          },
          dispatchEvent(evt: any) {
            const e = evt || {};
            if (!e.target) e.target = this;
            (this._listeners[e.type] || []).forEach((fn: any) => fn.call(this, e));
          },
          setPointerCapture() {},
          releasePointerCapture() {},
          style: {},
        };
      }
      setSize() {}
      setPixelRatio() {}
      render() {}
    },
    OrbitControls: class {
      target = new Vector3();
      enableDamping = true;
      autoRotate = false;
      autoRotateSpeed = 2;
      addEventListener() {}
      update() {}
      dispose() {}
    },
    Clock: class {
      getDelta() { return 0.016; }
      getElapsedTime() { return 1.0; }
    },
    FrontSide: 0,
    BackSide: 1,
    DoubleSide: 2,
    LinearFilter: 1006,
    RepeatWrapping: 1000,
    ClampToEdgeWrapping: 1001,
    ACESFilmicToneMapping: 4,
    PCFSoftShadowMap: 2,
    sRGBEncoding: 3001,
  };
}

function createDomSandbox(cssDefaults: Record<string, string>) {
  const elementsById = new Map<string, any>();
  const storage = new Map<string, string>();
  const ctx2d = new Proxy(
    {
      createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData() {},
      measureText: (t: string) => ({ width: (t ? t.length : 1) * 7 }),
      fillRect() {},
      strokeRect() {},
      clearRect() {},
      beginPath() {},
      closePath() {},
      moveTo() {},
      lineTo() {},
      arc() {},
      quadraticCurveTo() {},
      fill() {},
      stroke() {},
      fillText() {},
      setLineDash() {},
      save() {},
      restore() {},
      translate() {},
      rotate() {},
      scale() {},
      setTransform() {},
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} }),
    },
    {
      get(target, prop) {
        if (prop in target) return (target as any)[prop];
        return () => {};
      },
      set(target, prop, value) {
        (target as any)[prop] = value;
        return true;
      },
    }
  );

  function makeEl(tag = 'div', id = ''): any {
    const classes = new Set<string>();
    const attrs: Record<string, string> = {};
    const children: any[] = [];
    const listeners: Record<string, Function[]> = {};
    const el: any = {
      tagName: tag.toUpperCase(),
      id,
      value: '0',
      checked: false,
      disabled: false,
      textContent: '',
      _innerHTML: '',
      get innerHTML() { return this._innerHTML; },
      set innerHTML(v: string) { this._innerHTML = String(v); },
      width: 512,
      height: 256,
      clientWidth: 800,
      clientHeight: 500,
      offsetWidth: 260,
      offsetHeight: 160,
      style: { display: '' },
      dataset: {},
      children,
      classList: {
        add: (...c: string[]) => c.forEach((x) => classes.add(x)),
        remove: (...c: string[]) => c.forEach((x) => classes.delete(x)),
        contains: (c: string) => classes.has(c),
        toggle: (c: string, force?: boolean) => {
          const on = force !== undefined ? !!force : !classes.has(c);
          if (on) classes.add(c);
          else classes.delete(c);
          return on;
        },
      },
      setAttribute: (k: string, v: string) => { attrs[k] = String(v); if (k === 'id') { el.id = v; elementsById.set(v, el); } },
      getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
      removeAttribute: (k: string) => { delete attrs[k]; },
      appendChild: (c: any) => { c.parentElement = el; children.push(c); return c; },
      removeChild: (c: any) => c,
      addEventListener(type: string, fn: any) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
      },
      removeEventListener(type: string, fn: any) {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter((f) => f !== fn);
      },
      dispatchEvent(evt: any) {
        const e = evt || {};
        if (!e.target) e.target = el;
        (listeners[e.type] || []).forEach((fn) => fn.call(el, e));
      },
      setPointerCapture() {},
      releasePointerCapture() {},
      scrollIntoView() {},
      querySelector: (sel: string) => {
        if (sel === 'input') return makeEl('input');
        if (sel === '.layer-name') return makeEl('span');
        if (sel.startsWith('#')) return elementsById.get(sel.slice(1)) || null;
        return null;
      },
      querySelectorAll: (sel: string) => {
        if (sel.includes('.node') || sel.includes('.tree-node')) {
          const treeEl = elementsById.get('tree');
          if (!treeEl) return [];
          const matched: any[] = [];
          const walkDom = (node: any) => {
            if (!node) return;
            if (node.dataset?.id || node.getAttribute?.('data-id') || node.classList?.contains('node') || node.classList?.contains('tree-node')) {
              matched.push(node);
            }
            (node.children || []).forEach(walkDom);
          };
          walkDom(treeEl);
          if (!matched.length && treeEl._innerHTML) {
            const re = /data-id=["']([^"']+)["']/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(treeEl._innerHTML)) !== null) {
              const vNode = makeEl('div');
              vNode.dataset.id = m[1];
              matched.push(vNode);
            }
          }
          return matched;
        }
        return [];
      },
      closest: () => null,
      getContext: () => ctx2d,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1024, height: 640 }),
    };
    if (id) elementsById.set(id, el);
    return el;
  }

  // Pre-seed known IDs so UI scripts populate clean mock elements
  for (const id of [
    'viewport', 'viewport-wrap', 'webgl-canvas', 'c', 'tree', 'layers-body', 'ref-legend-body',
    'inspector', 'inspector-body', 'crumb-sel', 'popover', 'pop-title', 'pop-sub', 'pop-body',
    'left-workbench', 'wb-tabs', 'tab-inspect', 'tab-arch', 'tab-layers',
    'tour-banner', 'tb-step-badge', 'tb-step-title', 'tb-step-desc', 'tb-progress-fill',
    'tb-btn-prev', 'tb-btn-pause', 'tb-btn-next', 'tb-btn-close', 'btn-build-anim',
    'iv-canvas', 'iv-modal-canvas', 'iv-modal-backdrop', 'iv-expand-btn', 'iv-modal-close',
    'flow-caption', 'flow-seg', 'flow-mode-group', 'btn-theme-toggle', 'loading',
    'explode-slider', 'explode-val',
  ]) {
    makeEl('div', id);
  }

  const docListeners: Record<string, Function[]> = {};
  const winListeners: Record<string, Function[]> = {};
  const docEl = makeEl('html');
  docEl.setAttribute('data-theme', 'dark');

  const documentMock: any = {
    readyState: 'complete',
    documentElement: docEl,
    body: makeEl('body'),
    createElement: (tag: string) => makeEl(tag),
    getElementById: (id: string) => {
      if (elementsById.has(id)) return elementsById.get(id);
      return makeEl('div', id);
    },
    querySelector: (sel: string) => {
      if (sel.startsWith('#')) return documentMock.getElementById(sel.slice(1));
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel.includes('.node') || sel.includes('.tree-node')) {
        return elementsById.get('tree')?.querySelectorAll(sel) || [];
      }
      return [];
    },
    addEventListener(type: string, fn: any) {
      if (!docListeners[type]) docListeners[type] = [];
      docListeners[type].push(fn);
    },
    removeEventListener(type: string, fn: any) {
      if (!docListeners[type]) return;
      docListeners[type] = docListeners[type].filter((f) => f !== fn);
    },
    dispatchEvent(evt: any) {
      (docListeners[evt?.type] || []).forEach((fn) => fn.call(documentMock, evt));
    },
  };

  const THREE = createThreeMock();
  const sandbox: any = {
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Set,
    Map,
    Float32Array,
    Int8Array,
    Uint8ClampedArray,
    Date,
    RegExp,
    JSON,
    Error,
    setTimeout: (fn: any) => 1,
    clearTimeout: () => {},
    setInterval: (fn: any) => 1,
    clearInterval: () => {},
    requestAnimationFrame: () => 1,
    navigator: { userAgent: 'node-verify' },
    document: documentMock,
    THREE,
    localStorage: {
      getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
      setItem: (k: string, v: string) => storage.set(k, String(v)),
      removeItem: (k: string) => storage.delete(k),
    },
    getComputedStyle: () => ({
      getPropertyValue: (prop: string) => cssDefaults[prop] || '#94A3B8',
    }),
    Event: class {
      type: string;
      constructor(type: string) { this.type = type; }
    },
    ResizeObserver: undefined,
    MutationObserver: class { observe() {} disconnect() {} },
    getMaterialPalette: paletteMod.getMaterialPalette,
    MATERIAL_PALETTE: paletteMod.MATERIAL_PALETTE,
    getMaterialProperties: paletteMod.getMaterialProperties,
    MATERIAL_PROPERTIES: paletteMod.MATERIAL_PROPERTIES,
    addEventListener(type: string, fn: any) {
      if (!winListeners[type]) winListeners[type] = [];
      winListeners[type].push(fn);
    },
    removeEventListener(type: string, fn: any) {
      if (!winListeners[type]) return;
      winListeners[type] = winListeners[type].filter((f) => f !== fn);
    },
    dispatchEvent(evt: any) {
      const e = evt || {};
      (winListeners[e.type] || []).forEach((fn) => fn.call(sandbox, e));
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function collectTreeIds(tree: any[]): string[] {
  const ids: string[] = [];
  function walk(node: any) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node.id === 'string' && node.id) {
      ids.push(node.id);
    }
    if (Array.isArray(node.items)) walk(node.items);
    if (Array.isArray(node.children)) walk(node.children);
  }
  walk(tree);
  return [...new Set(ids)];
}

function assertAllFinite(obj: Record<string, any>, label: string, errors: string[]) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number' && !Number.isFinite(v)) {
      errors.push(`${label}: field "${k}" is non-finite (${v})`);
    }
  }
}

function snapshotMeshMaterials(root: any): Map<any, any> {
  const snaps = new Map<any, any>();
  root.traverse((o: any) => {
    if ((!o.isMesh && !o.isSprite) || (o.userData && (o.userData._isHighlightPart || o.userData.isLabel)) || !o.material) return;
    const m = o.material;
    snaps.set(o, {
      isSprite: !!o.isSprite,
      matRef: m,
      colorHex: m.color ? m.color.getHex() : null,
      emissiveHex: m.emissive ? m.emissive.getHex() : null,
      emissiveIntensity: m.emissiveIntensity,
      opacity: m.opacity,
      transparent: m.transparent,
      scaleX: o.scale ? o.scale.x : 1,
      scaleY: o.scale ? o.scale.y : 1,
    });
  });
  return snaps;
}

function runModuleVerification(mod: ModuleSpec): { ok: boolean; errors: string[]; stats: string } {
  const errors: string[] = [];
  const modDir = path.join(ROOT, mod.dir);

  const cssDefaults: Record<string, string> = {
    '--highlight': '#ff2fb0',
    '--accent': '#5fd9c4',
    '--c-substrate': '#1E3A5F',
    '--c-well': '#166534',
    '--c-pwell': '#1D4ED8',
    '--c-active-p': '#3B82F6',
    '--c-active-n': '#22C55E',
    '--c-sde-p': '#60A5FA',
    '--c-sde-n': '#4ADE80',
    '--c-oxide': '#67E8F9',
    '--c-highk': '#a855f7',
    '--c-poly': '#DC2626',
    '--c-silicide': '#6e7887',
    '--c-depletion': '#94A3B8',
    '--c-contact': '#CBD5E1',
    '--c-metal': '#94A3B8',
    '--c-vdd': '#e35d5d',
    '--c-gnd': '#6b7686',
    '--c-in': '#e6c94a',
    '--c-out': '#57cf8f',
    '--c-p': '#3B82F6',
    '--c-n': '#22C55E',
    '--c-cathode': '#22C55E',
    '--c-anode': '#3B82F6',
  };

  const sandbox = createDomSandbox(cssDefaults);
  const ctx = vm.createContext(sandbox);

  for (const relScript of mod.scripts) {
    const absPath = path.resolve(modDir, relScript);
    const code = fs.readFileSync(absPath, 'utf8');
    try {
      vm.runInContext(code, ctx, { filename: absPath });
    } catch (err: any) {
      errors.push(`Script execution failed (${relScript}): ${err?.message || err}`);
      return { ok: false, errors, stats: 'script error' };
    }
  }

  if (mod.id === 'pn-diode') {
    if (typeof ctx.buildDiodeGeometry === 'function') ctx.buildDiodeGeometry();
    if (typeof ctx.initUIPanels === 'function') ctx.initUIPanels();
    if (typeof ctx.initSelection === 'function') ctx.initSelection();
    if (typeof ctx.initFlowControls === 'function') ctx.initFlowControls();
    if (typeof ctx.initLogicControls === 'function') ctx.initLogicControls();
  }

  const root = ctx.cellGroup || ctx.scene;
  if (!root) {
    errors.push('Missing Three.js root (scene/cellGroup)');
    return { ok: false, errors, stats: 'missing root' };
  }

  // Also ensure TS helper uses this sandbox's THREE global
  (globalThis as any).THREE = ctx.THREE;

  const clickable = SiliconLayerHighlight.discoverClickableMeshes(root);
  const discoveredIds = new Set<string>(clickable.map((m) => m.userData.layerId));

  // Ensure key layers (including silicide & depletion) exist with userData.layerId
  const requiredIds = mod.id === 'pn-diode'
    ? ['anodeSilicide', 'cathodeSilicide', 'depletionRegion']
    : (mod.mode === 'mosfet'
      ? ['srcSil', 'drnSil', 'depletion']
      : ['silicide', 'depletion']);
  for (const requiredId of requiredIds) {
    if (!discoveredIds.has(requiredId)) {
      errors.push(`Missing auto-discovered layerId "${requiredId}" in 3D scene`);
    }
  }

  // 1. Inspect Tree Integrity
  const treeIds = collectTreeIds(ctx.TREE || ctx.ARCHITECTURE_TREE || []);
  const virtualMap = ctx.VIRTUAL || {};
  for (const id of treeIds) {
    const meshes = SiliconLayerHighlight.collectLayerMeshes(root, id, virtualMap);
    if (!meshes.length) {
      errors.push(`Inspect Tree node "${id}" has 0 matching userData.layerId meshes`);
    }
    const info = typeof ctx.idToInfo === 'function'
      ? ctx.idToInfo(id)
      : ((ctx.INFO && ctx.INFO[id]) || (ctx.COMPONENTS && ctx.COMPONENTS[id]));
    if (!info) {
      errors.push(`Inspect Tree node "${id}" has no inspector info metadata`);
    }
  }

  // 2. Selection Round-Trip (across all TREE IDs + every discovered layerId)
  const testIds = [...new Set([...treeIds, ...discoveredIds])];
  const baseline = snapshotMeshMaterials(root);
  let roundTripCount = 0;

  for (const id of testIds) {
    const selected = SiliconLayerHighlight.selectLayer(root, id, {
      virtualMap,
      color: '#ff2fb0',
    });
    if (!selected.length) {
      errors.push(`selectLayer("${id}") returned 0 meshes`);
      continue;
    }

    // Verify at least one selected mesh/sprite was visibly mutated
    let mutated = false;
    for (const m of selected) {
      const snap = baseline.get(m);
      if (!snap || !m.material) continue;
      const matChanged =
        (m.material.emissive && snap.emissiveHex !== m.material.emissive.getHex()) ||
        m.material.emissiveIntensity !== snap.emissiveIntensity ||
        m.material.opacity !== snap.opacity ||
        (m.material.color && snap.colorHex !== m.material.color.getHex()) ||
        (snap.isSprite && m.scale && Math.abs(m.scale.x - snap.scaleX) > 1e-6);
      if (matChanged || m.userData._hlActive) mutated = true;
    }
    if (!mutated) {
      errors.push(`selectLayer("${id}") did not mutate material state`);
    }

    SiliconLayerHighlight.clearSelection(root);

    // Verify exact restoration across ALL meshes
    for (const [m, snap] of baseline.entries()) {
      if (m.material !== snap.matRef) {
        errors.push(`clearSelection() after "${id}" left cloned material reference on "${m.userData.layerId}"`);
      }
      if (snap.colorHex !== null && m.material.color.getHex() !== snap.colorHex) {
        errors.push(`clearSelection() after "${id}" altered color on "${m.userData.layerId}"`);
      }
      if (snap.emissiveHex !== null && m.material.emissive.getHex() !== snap.emissiveHex) {
        errors.push(`clearSelection() after "${id}" altered emissive on "${m.userData.layerId}"`);
      }
      if (Math.abs(m.material.emissiveIntensity - snap.emissiveIntensity) > 1e-6) {
        errors.push(`clearSelection() after "${id}" altered emissiveIntensity on "${m.userData.layerId}"`);
      }
      if (Math.abs(m.material.opacity - snap.opacity) > 1e-6) {
        errors.push(`clearSelection() after "${id}" altered opacity on "${m.userData.layerId}"`);
      }
      if (m.material.transparent !== snap.transparent) {
        errors.push(`clearSelection() after "${id}" altered transparent flag on "${m.userData.layerId}"`);
      }
      if (snap.isSprite && m.scale && (Math.abs(m.scale.x - snap.scaleX) > 1e-6 || Math.abs(m.scale.y - snap.scaleY) > 1e-6)) {
        errors.push(`clearSelection() after "${id}" altered sprite scale on "${m.userData.layerId}"`);
      }
      if (m.userData._hlEdge || m.userData._hlActive) {
        errors.push(`clearSelection() after "${id}" left leftover highlight helper on "${m.userData.layerId}"`);
      }
    }
    roundTripCount++;
  }

  // 2B. Simulated Canvas Click-to-Inspect (Normal, EXPLODE Y > 0%, Collapsed Sidebar Popover, Drag Reject)
  if (ctx.renderer && ctx.renderer.domElement && typeof ctx.renderer.domElement.dispatchEvent === 'function') {
    const canvas = ctx.renderer.domElement;
    const workbench = ctx.document.getElementById('left-workbench');
    const popover = ctx.document.getElementById('popover');
    const inspector = ctx.document.getElementById('inspector');
    const crumbSel = ctx.document.getElementById('crumb-sel');
    const origSwitchTab = ctx.switchWorkbenchTab;
    const tabCalls: string[] = [];
    ctx.switchWorkbenchTab = function (tab: string) {
      tabCalls.push(tab);
      if (typeof origSwitchTab === 'function') return origSwitchTab.apply(this, arguments);
    };
    ctx.window.switchWorkbenchTab = ctx.switchWorkbenchTab;

    const getSelectedStateId = () => vm.runInContext(
      `typeof selectedId !== 'undefined' ? selectedId : (typeof lastSelectedId !== 'undefined' ? lastSelectedId : null)`,
      ctx
    );

    const simulateCanvasClick = (targetObj: any, dx = 2, dy = 1) => {
      ctx.THREE.Raycaster._testHitQueue = targetObj ? [targetObj] : [];
      const beforeMat = root.userData._matrixWorldCalls || 0;
      const beforeRay = ctx.THREE.Raycaster._setFromCameraCalls;
      canvas.dispatchEvent({
        type: 'pointerdown',
        button: 0,
        pointerId: 1,
        clientX: 400,
        clientY: 250,
        target: canvas,
      });
      ctx.window.dispatchEvent({
        type: 'pointermove',
        button: 0,
        pointerId: 1,
        clientX: 400 + dx,
        clientY: 250 + dy,
        target: canvas,
      });
      ctx.window.dispatchEvent({
        type: 'pointerup',
        button: 0,
        pointerId: 1,
        clientX: 400 + dx,
        clientY: 250 + dy,
        target: canvas,
      });
      canvas.dispatchEvent({
        type: 'click',
        button: 0,
        clientX: 400 + dx,
        clientY: 250 + dy,
        target: canvas,
      });
      return {
        matrixUpdated: (root.userData._matrixWorldCalls || 0) > beforeMat,
        rayUpdated: ctx.THREE.Raycaster._setFromCameraCalls > beforeRay,
      };
    };

    const pickTargetById = (preferIds: string[]) => {
      for (const pid of preferIds) {
        const match = clickable.find((m) => m.userData?.layerId === pid && !m.userData?.decorative && !m.userData?._isHighlightPart);
        if (match) return match;
      }
      return clickable.find((m) => !m.userData?.decorative && !m.userData?._isHighlightPart) || null;
    };

    // Child-mesh parent-walk test setup: create an untagged child on an active layer mesh
    const activeTarget = pickTargetById(
      mod.id === 'pn-diode' ? ['pCore', 'nCore', 'depletionRegion'] :
      mod.mode === 'mosfet' ? ['nmosSrc', 'pmosSrc', 'depletion'] :
      ['pmosASrc', 'pmosSrc', 'depletion']
    );
    const deplTarget = pickTargetById(['depletionRegion', 'depletion']);

    if (!activeTarget || !deplTarget) {
      errors.push('Could not locate clickable mesh targets for simulated canvas click test');
    } else {
      // Case 1: Normal click with sidebar open -> Inspect tab + selectedId
      workbench.classList.remove('collapsed');
      if (typeof ctx.clearSelection === 'function') ctx.clearSelection();
      tabCalls.length = 0;

      const clickNormal = simulateCanvasClick(activeTarget, 2, 1);
      if (!clickNormal.matrixUpdated) errors.push('Simulated canvas click did not call updateMatrixWorld(true)');
      if (!clickNormal.rayUpdated) errors.push('Simulated canvas click did not call raycaster.setFromCamera(...)');
      if (getSelectedStateId() !== activeTarget.userData.layerId) {
        errors.push(`Normal canvas click on "${activeTarget.userData.layerId}" resulted in selected="${getSelectedStateId()}"`);
      }
      if (!tabCalls.includes('inspect')) {
        errors.push(`Normal canvas click with open sidebar did not switch workbench to "inspect"`);
      }
      const inspHtml = inspector.innerHTML || ctx.document.getElementById('inspector-body').innerHTML;
      if (!inspHtml || (mod.id !== 'cmos-nand' && !crumbSel.textContent)) {
        errors.push('Normal canvas click did not populate inspector / crumb metadata');
      }

      // Case 2: Child-mesh hit walks parent chain to userData.layerId
      const childProbe = new ctx.THREE.Mesh(new ctx.THREE.BufferGeometry(), activeTarget.material.clone());
      activeTarget.add(childProbe);
      if (typeof ctx.clearSelection === 'function') ctx.clearSelection();
      simulateCanvasClick(childProbe, 1, 1);
      activeTarget.remove(childProbe);
      if (getSelectedStateId() !== activeTarget.userData.layerId) {
        errors.push(`Child mesh canvas click failed parent-walk to "${activeTarget.userData.layerId}"`);
      }

      // Case 3: Exploded view (EXPLODE Y > 0%) click selects exact layer
      if (typeof ctx.applyExplode === 'function') {
        if (typeof ctx.clearSelection === 'function') ctx.clearSelection();
        ctx.applyExplode(0.6);
        simulateCanvasClick(deplTarget, 1, 2);
        if (getSelectedStateId() !== deplTarget.userData.layerId) {
          errors.push(`Exploded (60%) canvas click on "${deplTarget.userData.layerId}" failed (got "${getSelectedStateId()}")`);
        }
        ctx.applyExplode(0);
      }

      // Case 4: Collapsed sidebar click opens floating #popover
      if (typeof ctx.clearSelection === 'function') ctx.clearSelection();
      workbench.classList.add('collapsed');
      popover.classList.remove('visible');
      popover.classList.add('hidden');
      simulateCanvasClick(activeTarget, 1, 1);
      if (getSelectedStateId() !== activeTarget.userData.layerId) {
        errors.push(`Collapsed-sidebar click on "${activeTarget.userData.layerId}" did not select layer`);
      }
      if (!popover.classList.contains('visible') || popover.classList.contains('hidden')) {
        errors.push('Collapsed-sidebar click failed to show floating #popover (.visible without .hidden)');
      }

      // Case 5: Drag >= 6px must NOT trigger selection
      if (typeof ctx.clearSelection === 'function') ctx.clearSelection();
      simulateCanvasClick(activeTarget, 12, 8);
      if (getSelectedStateId() !== null) {
        errors.push(`Pointer drag (14.4px) wrongly triggered selection="${getSelectedStateId()}"`);
      }
      workbench.classList.remove('collapsed');
      if (typeof ctx.clearSelection === 'function') ctx.clearSelection();
    }
  }

  // 2C. Bug 2 & 3 CMOS Sculpted Depletion Geometry + Implant Color Parity Check
  if (mod.id === 'cmos-inverter' || mod.id === 'cmos-nand') {
    const deplMeshes = SiliconLayerHighlight.collectLayerMeshes(root, 'depletion', virtualMap);
    const expectedDeplCount = mod.id === 'cmos-inverter' ? 6 : 10;
    if (deplMeshes.length !== expectedDeplCount) {
      errors.push(`${mod.id} expected ${expectedDeplCount} depletion meshes, found ${deplMeshes.length}`);
    }
    const sculptedShells = deplMeshes.filter((m) => (m.geometry?.attributes?.position?.count || 0) > 200);
    const expectedShells = mod.id === 'cmos-inverter' ? 4 : 6;
    if (sculptedShells.length !== expectedShells) {
      errors.push(`${mod.id} expected ${expectedShells} sculpted S/D depletion shells (>200 verts), found ${sculptedShells.length}`);
    }
    for (const sh of sculptedShells) {
      const hasEdgeLoop = Array.isArray(sh.children) && sh.children.some((c: any) => c && c.isLine && !c.isLineSegments);
      if (!hasEdgeLoop) {
        errors.push(`${mod.id} sculpted depletion shell missing perimeter LineLoop contour`);
      }
    }

    // Check dark & light theme canonical MATERIAL_PROPERTIES parity
    const checkThemeParity = (theme: 'dark' | 'light') => {
      if (typeof ctx.applyTheme === 'function') {
        ctx.applyTheme(theme);
      } else if (typeof ctx.updateMaterialsTheme === 'function') {
        ctx.document.documentElement.setAttribute('data-theme', theme);
        ctx.updateMaterialsTheme();
      }
      // Exercise bias transitions so logic tint never washes out P+ / N+ implants
      if (mod.id === 'cmos-inverter' && typeof ctx.setVinState === 'function') {
        ctx.setVinState(0);
        ctx.setVinState(1);
        ctx.setVinState('off');
      } else if (mod.id === 'cmos-nand' && typeof ctx.setInputs === 'function') {
        ctx.setInputs(0, 0);
        ctx.setInputs(1, 1);
        ctx.setInputs('off', 'off');
      }

      const props = paletteMod.getMaterialProperties(theme);
      const expectMeshProp = (layerId: string, prop: any, checkEmissiveZero = true) => {
        const ms = SiliconLayerHighlight.collectLayerMeshes(root, layerId, virtualMap);
        if (!ms.length) {
          errors.push(`${mod.id} missing mesh "${layerId}" for parity check`);
          return;
        }
        const mat = ms[0].material;
        const expectedHex = parseInt(prop.color.replace('#', ''), 16);
        if (mat.color.getHex() !== expectedHex) {
          errors.push(`${mod.id} [${theme}] ${layerId} color #${mat.color.getHex().toString(16)} !== canonical #${expectedHex.toString(16)}`);
        }
        if (Math.abs(mat.roughness - prop.roughness) > 1e-4) {
          errors.push(`${mod.id} [${theme}] ${layerId} roughness ${mat.roughness} !== ${prop.roughness}`);
        }
        if (Math.abs(mat.metalness - prop.metalness) > 1e-4) {
          errors.push(`${mod.id} [${theme}] ${layerId} metalness ${mat.metalness} !== ${prop.metalness}`);
        }
        if (Math.abs(mat.opacity - prop.opacity) > 1e-4) {
          errors.push(`${mod.id} [${theme}] ${layerId} opacity ${mat.opacity} !== ${prop.opacity}`);
        }
        if (checkEmissiveZero && (mat.emissive.getHex() !== 0 || mat.emissiveIntensity !== 0)) {
          errors.push(`${mod.id} [${theme}] ${layerId} has washout emissive 0x${mat.emissive.getHex().toString(16)} (${mat.emissiveIntensity})`);
        }
      };

      expectMeshProp('psub', props.substrate);
      expectMeshProp('nwell', props.nWell);
      expectMeshProp('pwell', props.pWell);
      expectMeshProp(mod.id === 'cmos-inverter' ? 'pmosSrc' : 'pmosASrc', props.pPlusImplant);
      expectMeshProp(mod.id === 'cmos-inverter' ? 'nmosSrc' : 'nmosASrc', props.nPlusImplant);
      expectMeshProp(mod.id === 'cmos-inverter' ? 'pmosSrcSde' : 'pmosASrcSde', props.pSDE);
      expectMeshProp(mod.id === 'cmos-inverter' ? 'nmosSrcSde' : 'nmosASrcSde', props.nSDE);

      const dp = deplMeshes[0].material;
      if (dp.color.getHex() !== props.depletion.colorHex || dp.emissive.getHex() !== props.depletion.emissiveHex || Math.abs(dp.opacity - props.depletion.opacity) > 1e-4) {
        errors.push(`${mod.id} [${theme}] depletion material diverges from canonical MATERIAL_PROPERTIES.depletion`);
      }
    };
    checkThemeParity('dark');
    checkThemeParity('light');
    if (typeof ctx.applyTheme === 'function') ctx.applyTheme('dark');
  }

  // 3. Process Tour Step Integrity & Cutoff/Carrier Suppression
  const fabSteps = ctx.FAB_STEPS || [];
  if (!fabSteps.length) {
    errors.push('Missing FAB_STEPS tour definitions');
  } else {
    const sceneLayerKeys = new Set<string>();
    if (Array.isArray(ctx.LAYER_ORDER)) {
      ctx.LAYER_ORDER.forEach((l: string) => sceneLayerKeys.add(l));
    }
    if (ctx.groups && typeof ctx.groups === 'object') {
      Object.keys(ctx.groups).forEach((k: string) => sceneLayerKeys.add(k));
    }
    root.traverse((o: any) => {
      if (o.userData && typeof o.userData.layer === 'string') sceneLayerKeys.add(o.userData.layer);
      if (o.userData && typeof o.userData.layerKey === 'string') sceneLayerKeys.add(o.userData.layerKey);
    });
    for (let i = 0; i < fabSteps.length; i++) {
      const step = fabSteps[i];
      const stepLayers = step.layers || (step.layer ? [step.layer] : []);
      if (!stepLayers.length) {
        errors.push(`FAB_STEPS[${i}] defines no layerKeys`);
      }
      for (const lk of stepLayers) {
        if (!sceneLayerKeys.has(lk)) {
          errors.push(`FAB_STEPS[${i}] references unknown layerKey "${lk}"`);
        }
      }
    }

    // Verify PLAY TOUR forces cutoff / equilibrium and hides carriers, then restores
    if (typeof ctx.startBuildAnimation === 'function' && typeof ctx.stopBuildAnimation === 'function') {
      // Bias device ON first
      if (mod.id === 'pn-diode' && typeof ctx.setDiodeBiasVoltage === 'function') {
        ctx.setDiodeBiasVoltage(0.75);
      } else if (mod.id === 'e-nmos') {
        ctx.currentVgs = 1.4;
        if (typeof ctx.applyLogicState === 'function') ctx.applyLogicState();
      } else if (mod.id === 'e-pmos') {
        ctx.currentVsg = 1.4;
        if (typeof ctx.applyLogicState === 'function') ctx.applyLogicState();
      } else if (mod.id === 'd-nmos' || mod.id === 'd-pmos') {
        ctx.currentVgs = 0.0;
        if (typeof ctx.applyLogicState === 'function') ctx.applyLogicState();
      } else if (mod.id === 'cmos-inverter' && typeof ctx.setVinState === 'function') {
        ctx.setVinState(1.0);
      } else if (mod.id === 'cmos-nand' && typeof ctx.setInputs === 'function') {
        ctx.setInputs(1, 1);
      }

      ctx.startBuildAnimation();
      if (ctx.isTourActive !== true && ctx.isTourRunning !== true) {
        errors.push('startBuildAnimation() did not activate tour flag');
      }
      if (mod.id === 'pn-diode') {
        if (Math.abs(Number(ctx.currentVa)) > 0.001) {
          errors.push(`pn-diode PLAY TOUR left bias Va=${ctx.currentVa} instead of 0.00V`);
        }
      } else if (mod.mode === 'mosfet' && typeof ctx.getMosfetPhysicsState === 'function') {
        const st = ctx.getMosfetPhysicsState();
        if (st.region !== 'CUTOFF') {
          errors.push(`PLAY TOUR left MOSFET in "${st.region}" instead of CUTOFF`);
        }
      } else if (mod.id === 'cmos-inverter' && ctx.currentVin !== 'off') {
        errors.push(`cmos-inverter PLAY TOUR left currentVin=${ctx.currentVin} instead of "off"`);
      } else if (mod.id === 'cmos-nand' && (ctx.currentA !== 'off' || ctx.currentB !== 'off')) {
        errors.push(`cmos-nand PLAY TOUR left inputs=(${ctx.currentA},${ctx.currentB}) instead of off`);
      }

      ctx.stopBuildAnimation(true);
    }
  }

  // 4. Physics Stability Across Min/Max Sweeps
  if (mod.id === 'pn-diode' && ctx.DiodePhysics) {
    for (let v = -25; v <= 1.0 + 1e-6; v += 0.5) {
      const st = ctx.DiodePhysics.computeState(v, 1e16, 5e16, 300);
      assertAllFinite(st, `pn-diode Va=${v.toFixed(2)}`, errors);
      const prof = ctx.DiodePhysics.computeSpatialProfiles(v, 1e16, 5e16, 300);
      assertAllFinite({ xpNm: prof.xpNm, xnNm: prof.xnNm, wNm: prof.wNm, emax: prof.emax }, `pn-diode profile Va=${v.toFixed(2)}`, errors);
    }
  } else if (mod.mode === 'mosfet' && typeof ctx.getMosfetPhysicsState === 'function') {
    const isDepl = mod.id.startsWith('d-');
    const vgMin = isDepl ? -1.2 : 0.0;
    const vgMax = isDepl ? 1.2 : 1.8;
    for (let vg = vgMin; vg <= vgMax + 1e-6; vg += 0.2) {
      for (let vd = 0.0; vd <= 1.8 + 1e-6; vd += 0.3) {
        if (mod.id === 'e-pmos') {
          ctx.currentVsg = vg;
          ctx.currentVsd = vd;
        } else if (mod.id === 'd-pmos') {
          ctx.currentVgs = vg;
          ctx.currentVsd = vd;
        } else {
          ctx.currentVgs = vg;
          ctx.currentVds = vd;
        }
        const st = ctx.getMosfetPhysicsState();
        assertAllFinite(st, `${mod.id} Vg=${vg.toFixed(2)} Vd=${vd.toFixed(2)}`, errors);
      }
    }
  } else if (mod.id === 'cmos-inverter' && typeof ctx.calcCmosState === 'function') {
    const offSt = ctx.calcCmosState('off');
    if (!offSt || offSt.vin !== 'off') errors.push('cmos-inverter calcCmosState("off") invalid');
    for (let vin = 0; vin <= 1.0 + 1e-6; vin += 0.05) {
      const st = ctx.calcCmosState(vin);
      assertAllFinite(st, `cmos-inverter Vin=${vin.toFixed(2)}`, errors);
      if (typeof ctx.getVoutAt === 'function' && !Number.isFinite(ctx.getVoutAt(vin))) {
        errors.push(`cmos-inverter getVoutAt(${vin}) non-finite`);
      }
      if (typeof ctx.getIddAt === 'function' && !Number.isFinite(ctx.getIddAt(vin))) {
        errors.push(`cmos-inverter getIddAt(${vin}) non-finite`);
      }
    }
  } else if (mod.id === 'cmos-nand' && typeof ctx.computeNand2State === 'function') {
    const offSt = ctx.computeNand2State('off', 'off');
    if (!offSt || !offSt.frozen) errors.push('cmos-nand computeNand2State("off","off") should be frozen');
    for (let va = 0; va <= 1.0 + 1e-6; va += 0.2) {
      for (let vb = 0; vb <= 1.0 + 1e-6; vb += 0.2) {
        const st = ctx.computeNand2State(va, vb);
        assertAllFinite({ a: st.a, b: st.b, vout: st.vout, vx: st.regions?.vx }, `cmos-nand (${va.toFixed(1)},${vb.toFixed(1)})`, errors);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    stats: `tree=${treeIds.length} layers=${discoveredIds.size} roundTrips=${roundTripCount} tourSteps=${fabSteps.length}`,
  };
}

function verifyTimeOfDayThemeHelpers(errors: string[]) {
  const viewerThemePath = path.join(ROOT, 'src/shared/viewer/js/viewer-theme.js');
  const code = fs.readFileSync(viewerThemePath, 'utf8');
  for (let h = 0; h < 24; h++) {
    const expected = h >= 6 && h < 18 ? 'light' : 'dark';
    const sandbox: any = {
      Date: class {
        getHours() { return h; }
      },
      localStorage: { getItem: () => null, setItem() {} },
      document: { documentElement: { setAttribute() {}, classList: { toggle() {}, add() {}, remove() {} } }, getElementById: () => null },
      addEventListener() {},
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    const ctx = vm.createContext(sandbox);
    vm.runInContext(code, ctx, { filename: viewerThemePath });
    const actual = ctx.ViewerTheme.getTheme();
    if (actual !== expected) {
      errors.push(`Time-of-day theme at hour ${h} expected "${expected}", got "${actual}"`);
    }
  }
}

function main() {
  let totalErrors = 0;
  console.log('SiliconSliders Device Verification Suite\n');

  const todErrors: string[] = [];
  verifyTimeOfDayThemeHelpers(todErrors);
  if (todErrors.length) {
    totalErrors += todErrors.length;
    console.error('[FAIL] time-of-day-theme:', todErrors.join('; '));
  } else {
    console.log('[PASS] time-of-day-theme: 24h cycle (06:00-17:59 light, 18:00-05:59 dark)');
  }

  for (const mod of MODULES) {
    const res = runModuleVerification(mod);
    if (res.ok) {
      console.log(`[PASS] ${mod.id.padEnd(14)} ${res.stats}`);
    } else {
      totalErrors += res.errors.length;
      console.error(`[FAIL] ${mod.id.padEnd(14)} (${res.errors.length} error${res.errors.length === 1 ? '' : 's'})`);
      for (const e of res.errors) {
        console.error(`       - ${e}`);
      }
    }
  }

  console.log('');
  if (totalErrors > 0) {
    console.error(`Verification failed with ${totalErrors} error(s).`);
    process.exit(1);
  }
  console.log('All 7 device viewers passed all verification checks.');
}

main();
