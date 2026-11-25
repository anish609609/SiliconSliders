/**
 * src/shared/three/layerHighlight.ts
 * Unified Three.js layer discovery, raycasting, and material-aware highlight engine.
 * - Discovers clickable meshes automatically by traversing root for `userData.layerId`.
 * - Supports both opaque meshes (emissive + subtle albedo boost) and low-opacity /
 *   transparent meshes (opacity boost + color/emissive contrast + crisp edge outline).
 * - Restores exact original material properties (and shared material references) on deselect.
 */

export interface MaterialSnapshot {
  colorHex: number | null;
  emissiveHex: number | null;
  emissiveIntensity: number;
  opacity: number;
  transparent: boolean;
}

export interface HighlightOptions {
  color?: string | number | any;
  virtualMap?: Record<string, string[] | { info?: string; meshes: string[] }>;
}

export interface RaycastLayerOptions {
  skipInvisibleOpacity?: boolean;
  minOpacity?: number;
  minScale?: number;
  filter?: (hit: any) => boolean;
}

export interface RaycastLayerHit {
  layerId: string;
  object: any;
  hit: any;
  distance: number;
}

const DEFAULT_HIGHLIGHT_HEX = 0xff2fb0;

function getThree(): any {
  return (typeof globalThis !== 'undefined' && (globalThis as any).THREE) ||
         (typeof window !== 'undefined' && (window as any).THREE) ||
         null;
}

export function resolveHighlightColor(colorOverride?: string | number | any): any {
  const THREE = getThree();
  if (!THREE) return null;
  if (colorOverride && colorOverride.isColor) return colorOverride.clone();
  if (typeof colorOverride === 'string' || typeof colorOverride === 'number') {
    return new THREE.Color(colorOverride);
  }
  try {
    if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
      const css = getComputedStyle(document.documentElement).getPropertyValue('--highlight').trim();
      if (css) return new THREE.Color(css);
    }
  } catch (_) {}
  return new THREE.Color(DEFAULT_HIGHLIGHT_HEX);
}

export function getMeshLayerId(obj: any): string | null {
  let cur = obj;
  while (cur) {
    if (cur.userData && (cur.userData._isHighlightPart || cur.userData.decorative || cur.userData.isLabel || cur.userData.isFlowHelper)) return null;
    if (cur.name === 'flowGroup' || cur.name === 'markerGroup') return null;
    if (cur.userData && typeof cur.userData.layerId === 'string' && cur.userData.layerId) {
      return cur.userData.layerId;
    }
    if (cur.userData && typeof cur.userData.id === 'string' && cur.userData.id) {
      return cur.userData.id;
    }
    cur = cur.parent;
  }
  return null;
}

export function isObjectVisibleInHierarchy(obj: any): boolean {
  let cur = obj;
  while (cur) {
    if (cur.visible === false) return false;
    cur = cur.parent;
  }
  return true;
}

/**
 * Automatically discovers all raycastable meshes under `root` that carry `userData.layerId`
 * (or inherit it from a parent group with `userData.layerId`).
 */
export function discoverClickableMeshes(root: any): any[] {
  const out: any[] = [];
  if (!root || typeof root.traverse !== 'function') return out;
  root.traverse((obj: any) => {
    if (!obj || (!obj.isMesh && !obj.isSprite)) return;
    if (obj.isLine || obj.isLineSegments || obj.isPoints) return;
    if (obj.userData && (obj.userData._isHighlightPart || obj.userData.decorative || obj.userData.isLabel || obj.userData.isFlowHelper)) return;
    const lid = getMeshLayerId(obj);
    if (!lid) return;
    if (!obj.userData) obj.userData = {};
    if (!obj.userData.layerId) obj.userData.layerId = lid;
    out.push(obj);
  });
  return out;
}

/**
 * Collects all meshes matching `layerId` (expanding `virtualMap` entries if provided).
 */
export function collectLayerMeshes(
  root: any,
  layerId: string,
  virtualMap?: Record<string, string[] | { info?: string; meshes: string[] }>
): any[] {
  if (!root || !layerId) return [];
  const targetIds: string[] = [];
  if (virtualMap && virtualMap[layerId]) {
    const entry = virtualMap[layerId];
    const list = Array.isArray(entry) ? entry : (entry.meshes || []);
    for (let i = 0; i < list.length; i++) {
      if (targetIds.indexOf(list[i]) === -1) targetIds.push(list[i]);
    }
  } else {
    targetIds.push(layerId);
  }

  const all = discoverClickableMeshes(root);
  const matched: any[] = [];
  for (let i = 0; i < all.length; i++) {
    const m = all[i];
    const lid = m.userData.layerId || m.userData.id;
    if (targetIds.indexOf(lid) !== -1 && matched.indexOf(m) === -1) {
      matched.push(m);
    }
  }
  return matched;
}

/**
 * Raycasts against all auto-discovered `userData.layerId` meshes under `root`,
 * updating world matrices (for EXPLODE offsets) and returning sorted hits.
 */
export function raycastLayers(
  raycaster: any,
  root: any,
  options?: RaycastLayerOptions
): RaycastLayerHit[] {
  if (!raycaster || !root) return [];
  const opts = options || {};
  const minOpacity = opts.minOpacity !== undefined ? opts.minOpacity : 0.01;
  const minScale = opts.minScale !== undefined ? opts.minScale : 0.001;
  const candidates = discoverClickableMeshes(root);
  if (!candidates.length) return [];

  // Ensure world matrices reflect any parent/group EXPLODE translations before intersecting
  let top = root;
  while (top.parent) top = top.parent;
  if (typeof top.updateMatrixWorld === 'function') {
    top.updateMatrixWorld(true);
  } else if (typeof root.updateMatrixWorld === 'function') {
    root.updateMatrixWorld(true);
  }

  const rawHits = raycaster.intersectObjects(candidates, true) || [];
  rawHits.sort((a: any, b: any) => (a.distance || 0) - (b.distance || 0));

  const results: RaycastLayerHit[] = [];
  for (let i = 0; i < rawHits.length; i++) {
    const h = rawHits[i];
    const obj = h.object;
    if (!obj || (obj.userData && (obj.userData._isHighlightPart || obj.userData.decorative || obj.userData.isLabel || obj.userData.isFlowHelper))) continue;
    if (obj.isLine || obj.isLineSegments || obj.isPoints) continue;
    if (!isObjectVisibleInHierarchy(obj)) continue;
    if (obj.scale && (obj.scale.x <= minScale || obj.scale.y <= minScale || obj.scale.z <= minScale)) continue;
    if (opts.skipInvisibleOpacity !== false && obj.material && typeof obj.material.opacity === 'number' && obj.material.opacity <= minOpacity) {
      continue;
    }
    const lid = getMeshLayerId(obj);
    if (!lid) continue;
    if (typeof opts.filter === 'function' && !opts.filter(h, lid)) continue;
    results.push({ layerId: lid, object: obj, hit: h, distance: h.distance || 0 });
  }
  return results;
}

/**
 * Returns the primary raycast hit for `root`, preferring inner depletion/channel
 * when clicking through a transparent `isChannelShell`.
 */
export function raycastLayer(
  raycaster: any,
  root: any,
  options?: RaycastLayerOptions
): { layerId: string; object: any; hit: any } | null {
  const hits = raycastLayers(raycaster, root, options);
  if (!hits.length) return null;

  if (hits[0].object && hits[0].object.userData && hits[0].object.userData.isChannelShell) {
    for (let k = 1; k < hits.length; k++) {
      if ((hits[k].distance - hits[0].distance) > 0.6) break;
      const innerLid = hits[k].layerId;
      if (innerLid === 'depletion' || (innerLid === 'channel' && !(hits[k].object.userData && hits[k].object.userData.isChannelShell))) {
        return { layerId: hits[k].layerId, object: hits[k].object, hit: hits[k].hit };
      }
    }
  }
  return { layerId: hits[0].layerId, object: hits[0].object, hit: hits[0].hit };
}

function materialIsSharedOutsideSelection(mesh: any, root: any, targetLayerIds: Set<string>): boolean {
  if (!root || typeof root.traverse !== 'function' || !mesh.material) return false;
  let shared = false;
  root.traverse((other: any) => {
    if (shared || !other || !other.isMesh || other === mesh) return;
    if (other.userData && other.userData._isHighlightPart) return;
    const otherMat = (other.userData && other.userData._hlOrigMatRef) || other.material;
    if (otherMat === mesh.material) {
      const otherLid = getMeshLayerId(other);
      if (!otherLid || !targetLayerIds.has(otherLid)) {
        shared = true;
      }
    }
  });
  return shared;
}

function clearSingleMeshHighlight(mesh: any): void {
  if (!mesh || !mesh.userData) return;

  if (mesh.userData._hlEdge) {
    if (mesh.userData._hlEdge.parent) mesh.userData._hlEdge.parent.remove(mesh.userData._hlEdge);
    if (mesh.userData._hlEdge.geometry && typeof mesh.userData._hlEdge.geometry.dispose === 'function') {
      mesh.userData._hlEdge.geometry.dispose();
    }
    if (mesh.userData._hlEdge.material && typeof mesh.userData._hlEdge.material.dispose === 'function') {
      mesh.userData._hlEdge.material.dispose();
    }
    mesh.userData._hlEdge = null;
  }

  if (mesh.userData._hlOverlay) {
    if (mesh.userData._hlOverlay.parent) mesh.userData._hlOverlay.parent.remove(mesh.userData._hlOverlay);
    if (mesh.userData._hlOverlay.material && typeof mesh.userData._hlOverlay.material.dispose === 'function') {
      mesh.userData._hlOverlay.material.dispose();
    }
    mesh.userData._hlOverlay = null;
  }

  if (mesh.isSprite && mesh.userData._hlSpriteSaved) {
    if (mesh.material && mesh.material.color && mesh.userData._hlOrigColor) {
      mesh.material.color.copy(mesh.userData._hlOrigColor);
    }
    if (mesh.userData._hlOrigScale) {
      mesh.scale.copy(mesh.userData._hlOrigScale);
    }
    mesh.userData._hlSpriteSaved = false;
  }

  const saved: MaterialSnapshot | undefined = mesh.userData._hlSavedMat;
  if (mesh.userData._hlOrigMatRef) {
    if (mesh.material && mesh.material !== mesh.userData._hlOrigMatRef && typeof mesh.material.dispose === 'function') {
      mesh.material.dispose();
    }
    mesh.material = mesh.userData._hlOrigMatRef;
    mesh.userData._hlOrigMatRef = null;
  }

  if (saved && mesh.material) {
    const mat = mesh.material;
    if (mat.color && saved.colorHex !== null) mat.color.setHex(saved.colorHex);
    if (mat.emissive && saved.emissiveHex !== null) mat.emissive.setHex(saved.emissiveHex);
    if (typeof saved.emissiveIntensity === 'number') mat.emissiveIntensity = saved.emissiveIntensity;
    if (typeof saved.opacity === 'number') mat.opacity = saved.opacity;
    mat.transparent = saved.transparent;
    mat.needsUpdate = true;
  }

  mesh.userData._hlSavedMat = null;
  mesh.userData._hlActive = false;
}

function applySingleMeshHighlight(
  mesh: any,
  on: boolean,
  hlColor: any,
  root?: any,
  targetLayerIds?: Set<string>
): void {
  const THREE = getThree();
  if (!mesh || !THREE) return;
  if (mesh.userData && mesh.userData._isHighlightPart) return;

  clearSingleMeshHighlight(mesh);
  if (!on) return;
  if (!mesh.userData) mesh.userData = {};

  if (mesh.isSprite) {
    mesh.userData._hlOrigScale = mesh.scale.clone();
    mesh.userData._hlOrigColor = (mesh.material && mesh.material.color) ? mesh.material.color.clone() : null;
    mesh.userData._hlSpriteSaved = true;
    if (mesh.material && mesh.material.color) {
      mesh.material.color.copy(hlColor);
    }
    mesh.scale.set(
      mesh.userData._hlOrigScale.x * 1.35,
      mesh.userData._hlOrigScale.y * 1.35,
      mesh.userData._hlOrigScale.z
    );
    mesh.userData._hlActive = true;
    return;
  }

  if (!mesh.isMesh || mesh.userData.decorative || !mesh.material) return;

  const origMat = mesh.material;
  const saved: MaterialSnapshot = {
    colorHex: origMat.color ? origMat.color.getHex() : null,
    emissiveHex: origMat.emissive ? origMat.emissive.getHex() : null,
    emissiveIntensity: typeof origMat.emissiveIntensity === 'number' ? origMat.emissiveIntensity : 0,
    opacity: typeof origMat.opacity === 'number' ? origMat.opacity : 1,
    transparent: !!origMat.transparent
  };

  if (typeof origMat.clone === 'function') {
    mesh.userData._hlOrigMatRef = origMat;
    mesh.material = origMat.clone();
  }

  const mat = mesh.material;
  const isTransparentLowOpacity = saved.transparent && saved.opacity < 0.85;

  if (isTransparentLowOpacity) {
    // Low-opacity / transparent profile (e.g. DEPLETION REGION, SiO2, HfO2):
    // boost opacity + color/emissive contrast + crisp outline emphasis.
    mat.opacity = Math.min(0.90, Math.max(saved.opacity + 0.36, 0.68));
    if (mat.color) mat.color.lerp(hlColor, 0.48);
    if (mat.emissive) {
      mat.emissive.copy(hlColor);
      mat.emissiveIntensity = Math.max(saved.emissiveIntensity, 0.65);
    }
  } else {
    // Opaque profile (e.g. SILICIDE (NiSi), metal, poly, active):
    // apply emissive glow + subtle albedo boost.
    const isMetallic = typeof mat.metalness === 'number' && mat.metalness >= 0.65;
    if (mat.color) mat.color.lerp(hlColor, isMetallic ? 0.32 : 0.22);
    if (mat.emissive) {
      mat.emissive.copy(hlColor);
      mat.emissiveIntensity = Math.max(saved.emissiveIntensity, isMetallic ? 0.72 : 0.55);
    }
  }
  mat.needsUpdate = true;
  mesh.userData._hlSavedMat = saved;
  mesh.userData._hlActive = true;

  if (mesh.geometry && typeof THREE.EdgesGeometry === 'function') {
    try {
      const clipPlanes = (mat && mat.clippingPlanes) || null;
      const edgeGeo = new THREE.EdgesGeometry(mesh.geometry, isTransparentLowOpacity ? 15 : 24);
      const edgeMat = new THREE.LineBasicMaterial({
        color: hlColor.clone(),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        clippingPlanes: clipPlanes
      });
      const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
      edgeLines.userData._isHighlightPart = true;
      edgeLines.renderOrder = 61;
      edgeLines.raycast = function () {};
      mesh.add(edgeLines);
      mesh.userData._hlEdge = edgeLines;
    } catch (_) {}
  }
}

export function applyHighlight(
  obj: any,
  on: boolean,
  colorOverride?: string | number | any,
  root?: any
): void {
  if (!obj) return;
  const hlColor = on ? resolveHighlightColor(colorOverride) : null;
  const targetLayerIds = new Set<string>();
  const collectIds = (node: any) => {
    const lid = getMeshLayerId(node);
    if (lid) targetLayerIds.add(lid);
  };
  if (typeof obj.traverse === 'function') {
    obj.traverse((child: any) => {
      if (child.userData && child.userData._isHighlightPart) return;
      collectIds(child);
    });
    obj.traverse((child: any) => {
      if (child.userData && child.userData._isHighlightPart) return;
      applySingleMeshHighlight(child, !!on, hlColor, root, targetLayerIds);
    });
  } else {
    collectIds(obj);
    applySingleMeshHighlight(obj, !!on, hlColor, root, targetLayerIds);
  }
}

export function selectLayer(
  root: any,
  layerId: string,
  options?: HighlightOptions
): any[] {
  clearHighlight(root);
  if (!root || !layerId) return [];
  const opts = options || {};
  const meshes = collectLayerMeshes(root, layerId, opts.virtualMap);
  const hlColor = resolveHighlightColor(opts.color);
  const targetLayerIds = new Set<string>();
  for (let i = 0; i < meshes.length; i++) {
    const lid = getMeshLayerId(meshes[i]);
    if (lid) targetLayerIds.add(lid);
  }
  for (let i = 0; i < meshes.length; i++) {
    applySingleMeshHighlight(meshes[i], true, hlColor, root, targetLayerIds);
  }
  return meshes;
}

export function clearHighlight(rootOrMeshes: any): void {
  if (!rootOrMeshes) return;
  if (Array.isArray(rootOrMeshes)) {
    for (let i = 0; i < rootOrMeshes.length; i++) {
      const item = rootOrMeshes[i];
      if (!item) continue;
      if (typeof item.traverse === 'function') {
        item.traverse((c: any) => {
          if (c.userData && c.userData._isHighlightPart) return;
          clearSingleMeshHighlight(c);
        });
      } else {
        clearSingleMeshHighlight(item);
      }
    }
    return;
  }
  if (typeof rootOrMeshes.traverse === 'function') {
    rootOrMeshes.traverse((child: any) => {
      if (child.userData && child.userData._isHighlightPart) return;
      if (child.userData && (child.userData._hlActive || child.userData._hlEdge || child.userData._hlOverlay)) {
        clearSingleMeshHighlight(child);
      }
    });
  } else {
    clearSingleMeshHighlight(rootOrMeshes);
  }
}

export function updateHighlightColor(meshes: any[], colorOverride?: string | number | any): void {
  if (!meshes || !meshes.length) return;
  const hlColor = resolveHighlightColor(colorOverride);
  if (!hlColor) return;
  for (let i = 0; i < meshes.length; i++) {
    const obj = meshes[i];
    if (!obj) continue;
    const applyColor = (node: any) => {
      if (!node || !node.userData || !node.userData._hlActive) return;
      if (node.userData._hlEdge && node.userData._hlEdge.material && node.userData._hlEdge.material.color) {
        node.userData._hlEdge.material.color.copy(hlColor);
      }
      if (node.material && node.material.emissive) {
        node.material.emissive.copy(hlColor);
      }
    };
    if (typeof obj.traverse === 'function') {
      obj.traverse((c: any) => {
        if (!c.userData || !c.userData._isHighlightPart) applyColor(c);
      });
    } else {
      applyColor(obj);
    }
  }
}

export const SiliconLayerHighlight = {
  resolveHighlightColor,
  getMeshLayerId,
  isObjectVisibleInHierarchy,
  discoverClickableMeshes,
  collectLayerMeshes,
  raycastLayers,
  raycastLayer,
  apply: applyHighlight,
  selectLayer,
  clearSelection: clearHighlight,
  clearHighlight,
  updateColor: updateHighlightColor
};

if (typeof globalThis !== 'undefined') {
  (globalThis as any).SiliconLayerHighlight = SiliconLayerHighlight;
}
if (typeof window !== 'undefined') {
  (window as any).SiliconLayerHighlight = SiliconLayerHighlight;
}

export default SiliconLayerHighlight;
