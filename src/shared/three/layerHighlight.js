/**
 * src/shared/three/layerHighlight.js
 * Zero-bundler browser UMD companion to src/shared/three/layerHighlight.ts.
 * Exposes window.SiliconLayerHighlight (and updates SiliconSelectionHighlight.apply/updateColor).
 */
(function (root) {
  'use strict';

  var DEFAULT_HIGHLIGHT_HEX = 0xff2fb0;

  function getThree() {
    return (typeof globalThis !== 'undefined' && globalThis.THREE) ||
           (typeof root !== 'undefined' && root.THREE) ||
           null;
  }

  function resolveHighlightColor(colorOverride) {
    var THREE = getThree();
    if (!THREE) return null;
    if (colorOverride && colorOverride.isColor) return colorOverride.clone();
    if (typeof colorOverride === 'string' || typeof colorOverride === 'number') {
      return new THREE.Color(colorOverride);
    }
    try {
      if (typeof document !== 'undefined' && typeof getComputedStyle === 'function') {
        var css = getComputedStyle(document.documentElement).getPropertyValue('--highlight').trim();
        if (css) return new THREE.Color(css);
      }
    } catch (_) {}
    return new THREE.Color(DEFAULT_HIGHLIGHT_HEX);
  }

  function getMeshLayerId(obj) {
    var cur = obj;
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

  function isObjectVisibleInHierarchy(obj) {
    var cur = obj;
    while (cur) {
      if (cur.visible === false) return false;
      cur = cur.parent;
    }
    return true;
  }

  function discoverClickableMeshes(rootObj) {
    var out = [];
    if (!rootObj || typeof rootObj.traverse !== 'function') return out;
    rootObj.traverse(function (obj) {
      if (!obj || (!obj.isMesh && !obj.isSprite)) return;
      if (obj.isLine || obj.isLineSegments || obj.isPoints) return;
      if (obj.userData && (obj.userData._isHighlightPart || obj.userData.decorative || obj.userData.isLabel || obj.userData.isFlowHelper)) return;
      var lid = getMeshLayerId(obj);
      if (!lid) return;
      if (!obj.userData) obj.userData = {};
      if (!obj.userData.layerId) obj.userData.layerId = lid;
      out.push(obj);
    });
    return out;
  }

  function collectLayerMeshes(rootObj, layerId, virtualMap) {
    if (!rootObj || !layerId) return [];
    var targetIds = [];
    if (virtualMap && virtualMap[layerId]) {
      var entry = virtualMap[layerId];
      var list = Array.isArray(entry) ? entry : (entry.meshes || []);
      for (var i = 0; i < list.length; i++) {
        if (targetIds.indexOf(list[i]) === -1) targetIds.push(list[i]);
      }
    } else {
      targetIds.push(layerId);
    }

    var all = discoverClickableMeshes(rootObj);
    var matched = [];
    for (var j = 0; j < all.length; j++) {
      var m = all[j];
      var lid = m.userData.layerId || m.userData.id;
      if (targetIds.indexOf(lid) !== -1 && matched.indexOf(m) === -1) {
        matched.push(m);
      }
    }
    return matched;
  }

  function raycastLayers(raycaster, rootObj, options) {
    if (!raycaster || !rootObj) return [];
    var opts = options || {};
    var minOpacity = opts.minOpacity !== undefined ? opts.minOpacity : 0.01;
    var minScale = opts.minScale !== undefined ? opts.minScale : 0.001;
    var candidates = discoverClickableMeshes(rootObj);
    if (!candidates.length) return [];

    // Update world matrices up to top-level Scene so exploded layers raycast accurately
    var top = rootObj;
    while (top.parent) top = top.parent;
    if (typeof top.updateMatrixWorld === 'function') {
      top.updateMatrixWorld(true);
    } else if (typeof rootObj.updateMatrixWorld === 'function') {
      rootObj.updateMatrixWorld(true);
    }

    var rawHits = raycaster.intersectObjects(candidates, true) || [];
    rawHits.sort(function (a, b) { return (a.distance || 0) - (b.distance || 0); });

    var results = [];
    for (var i = 0; i < rawHits.length; i++) {
      var h = rawHits[i];
      var obj = h.object;
      if (!obj || (obj.userData && (obj.userData._isHighlightPart || obj.userData.decorative || obj.userData.isLabel || obj.userData.isFlowHelper))) continue;
      if (obj.isLine || obj.isLineSegments || obj.isPoints) continue;
      if (!isObjectVisibleInHierarchy(obj)) continue;
      if (obj.scale && (obj.scale.x <= minScale || obj.scale.y <= minScale || obj.scale.z <= minScale)) continue;
      if (opts.skipInvisibleOpacity !== false && obj.material && typeof obj.material.opacity === 'number' && obj.material.opacity <= minOpacity) {
        continue;
      }
      var lid = getMeshLayerId(obj);
      if (!lid) continue;
      if (typeof opts.filter === 'function' && !opts.filter(h, lid)) continue;
      results.push({ layerId: lid, object: obj, hit: h, distance: h.distance || 0 });
    }
    return results;
  }

  function raycastLayer(raycaster, rootObj, options) {
    var hits = raycastLayers(raycaster, rootObj, options);
    if (!hits.length) return null;

    if (hits[0].object && hits[0].object.userData && hits[0].object.userData.isChannelShell) {
      for (var k = 1; k < hits.length; k++) {
        if ((hits[k].distance - hits[0].distance) > 0.6) break;
        var innerLid = hits[k].layerId;
        if (innerLid === 'depletion' || (innerLid === 'channel' && !(hits[k].object.userData && hits[k].object.userData.isChannelShell))) {
          return { layerId: hits[k].layerId, object: hits[k].object, hit: hits[k].hit };
        }
      }
    }
    return { layerId: hits[0].layerId, object: hits[0].object, hit: hits[0].hit };
  }

  function materialIsSharedOutsideSelection(mesh, rootObj, targetLayerIds) {
    if (!rootObj || typeof rootObj.traverse !== 'function' || !mesh.material) return false;
    var shared = false;
    rootObj.traverse(function (other) {
      if (shared || !other || !other.isMesh || other === mesh) return;
      if (other.userData && other.userData._isHighlightPart) return;
      var otherMat = (other.userData && other.userData._hlOrigMatRef) || other.material;
      if (otherMat === mesh.material) {
        var otherLid = getMeshLayerId(other);
        if (!otherLid || !targetLayerIds[otherLid]) {
          shared = true;
        }
      }
    });
    return shared;
  }

  function clearSingleMeshHighlight(mesh) {
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

    var saved = mesh.userData._hlSavedMat;
    if (mesh.userData._hlOrigMatRef) {
      if (mesh.material && mesh.material !== mesh.userData._hlOrigMatRef && typeof mesh.material.dispose === 'function') {
        mesh.material.dispose();
      }
      mesh.material = mesh.userData._hlOrigMatRef;
      mesh.userData._hlOrigMatRef = null;
    }

    if (saved && mesh.material) {
      var mat = mesh.material;
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

  function applySingleMeshHighlight(mesh, on, hlColor, rootObj, targetLayerIds) {
    var THREE = getThree();
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

    var origMat = mesh.material;
    var saved = {
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

    var mat = mesh.material;
    var isTransparentLowOpacity = saved.transparent && saved.opacity < 0.85;

    if (isTransparentLowOpacity) {
      mat.opacity = Math.min(0.90, Math.max(saved.opacity + 0.36, 0.68));
      if (mat.color) mat.color.lerp(hlColor, 0.48);
      if (mat.emissive) {
        mat.emissive.copy(hlColor);
        mat.emissiveIntensity = Math.max(saved.emissiveIntensity, 0.65);
      }
    } else {
      var isMetallic = typeof mat.metalness === 'number' && mat.metalness >= 0.65;
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
        var clipPlanes = (mat && mat.clippingPlanes) || null;
        var edgeGeo = new THREE.EdgesGeometry(mesh.geometry, isTransparentLowOpacity ? 15 : 24);
        var edgeMat = new THREE.LineBasicMaterial({
          color: hlColor.clone(),
          transparent: true,
          opacity: 0.95,
          depthWrite: false,
          clippingPlanes: clipPlanes
        });
        var edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
        edgeLines.userData._isHighlightPart = true;
        edgeLines.renderOrder = 61;
        edgeLines.raycast = function () {};
        mesh.add(edgeLines);
        mesh.userData._hlEdge = edgeLines;
      } catch (_) {}
    }
  }

  function applyHighlight(obj, on, colorOverride, rootObj) {
    if (!obj) return;
    var hlColor = on ? resolveHighlightColor(colorOverride) : null;
    var targetLayerIds = {};
    var collectId = function (node) {
      var lid = getMeshLayerId(node);
      if (lid) targetLayerIds[lid] = true;
    };
    if (typeof obj.traverse === 'function') {
      obj.traverse(function (child) {
        if (child.userData && child.userData._isHighlightPart) return;
        collectId(child);
      });
      obj.traverse(function (child) {
        if (child.userData && child.userData._isHighlightPart) return;
        applySingleMeshHighlight(child, !!on, hlColor, rootObj, targetLayerIds);
      });
    } else {
      collectId(obj);
      applySingleMeshHighlight(obj, !!on, hlColor, rootObj, targetLayerIds);
    }
  }

  function selectLayer(rootObj, layerId, options) {
    clearHighlight(rootObj);
    if (!rootObj || !layerId) return [];
    var opts = options || {};
    var meshes = collectLayerMeshes(rootObj, layerId, opts.virtualMap);
    var hlColor = resolveHighlightColor(opts.color);
    var targetLayerIds = {};
    for (var i = 0; i < meshes.length; i++) {
      var lid = getMeshLayerId(meshes[i]);
      if (lid) targetLayerIds[lid] = true;
    }
    for (var j = 0; j < meshes.length; j++) {
      applySingleMeshHighlight(meshes[j], true, hlColor, rootObj, targetLayerIds);
    }
    return meshes;
  }

  function clearHighlight(rootOrMeshes) {
    if (!rootOrMeshes) return;
    if (Array.isArray(rootOrMeshes)) {
      for (var i = 0; i < rootOrMeshes.length; i++) {
        var item = rootOrMeshes[i];
        if (!item) continue;
        if (typeof item.traverse === 'function') {
          item.traverse(function (c) {
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
      rootOrMeshes.traverse(function (child) {
        if (child.userData && child.userData._isHighlightPart) return;
        if (child.userData && (child.userData._hlActive || child.userData._hlEdge || child.userData._hlOverlay)) {
          clearSingleMeshHighlight(child);
        }
      });
    } else {
      clearSingleMeshHighlight(rootOrMeshes);
    }
  }

  function updateHighlightColor(meshes, colorOverride) {
    if (!meshes || !meshes.length) return;
    var hlColor = resolveHighlightColor(colorOverride);
    if (!hlColor) return;
    for (var i = 0; i < meshes.length; i++) {
      var obj = meshes[i];
      if (!obj) continue;
      var applyColor = function (node) {
        if (!node || !node.userData || !node.userData._hlActive) return;
        if (node.userData._hlEdge && node.userData._hlEdge.material && node.userData._hlEdge.material.color) {
          node.userData._hlEdge.material.color.copy(hlColor);
        }
        if (node.material && node.material.emissive) {
          node.material.emissive.copy(hlColor);
        }
      };
      if (typeof obj.traverse === 'function') {
        obj.traverse(function (c) {
          if (!c.userData || !c.userData._isHighlightPart) applyColor(c);
        });
      } else {
        applyColor(obj);
      }
    }
  }

  var SiliconLayerHighlight = {
    resolveHighlightColor: resolveHighlightColor,
    getMeshLayerId: getMeshLayerId,
    isObjectVisibleInHierarchy: isObjectVisibleInHierarchy,
    discoverClickableMeshes: discoverClickableMeshes,
    collectLayerMeshes: collectLayerMeshes,
    raycastLayers: raycastLayers,
    raycastLayer: raycastLayer,
    apply: applyHighlight,
    selectLayer: selectLayer,
    clearSelection: clearHighlight,
    clearHighlight: clearHighlight,
    updateColor: updateHighlightColor
  };

  root.SiliconLayerHighlight = SiliconLayerHighlight;
})(typeof window !== 'undefined' ? window : globalThis);
