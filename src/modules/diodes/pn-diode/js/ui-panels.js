/**
 * ui-panels.js - PN Junction Diode CAD Viewer
 * Left Workbench tabs, unified layer list with always-visible descriptions,
 * architecture tree generation, and accordion management.
 */

function switchWorkbenchTab(tabKey) {
  var tabBtns = document.querySelectorAll('.wb-tab-btn');
  var panes = document.querySelectorAll('.wb-pane');
  tabBtns.forEach(function(btn) {
    var active = (btn.dataset.tab === tabKey);
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  panes.forEach(function(pane) {
    pane.classList.toggle('active', pane.id === 'wb-pane-' + tabKey);
  });
  if (tabKey === 'controls' && typeof renderGraphs === 'function') {
    setTimeout(renderGraphs, 10);
  }
}
window.switchWorkbenchTab = switchWorkbenchTab;

function initUIPanels() {
  buildLayersList();
  buildArchitectureTree();
  setupWorkbenchTabs();
  setupAccordions();
}

function setupWorkbenchTabs() {
  document.querySelectorAll('.wb-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchWorkbenchTab(btn.dataset.tab);
    });
  });
}

function getLayerColor(layerId, pal) {
  if (!pal) {
    pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(currentTheme) : (window.getMaterialPalette ? window.getMaterialPalette(currentTheme) : null);
  }
  if (!pal) return null;
  switch (layerId) {
    case 'substrate': return pal.pSubstrate;
    case 'nwell': return pal.nWell;
    case 'active': return pal.pPlusDiffusion;
    case 'pRegion': return pal.pPlusDiffusion;
    case 'nRegion': return pal.nPlusDiffusion;
    case 'depletion': return (typeof currentTheme !== 'undefined' && currentTheme === 'light') ? '#64748B' : '#94A3B8';
    case 'depletionRegion': return (typeof currentTheme !== 'undefined' && currentTheme === 'light') ? '#64748B' : '#94A3B8';
    case 'passivation': return pal.fieldOxide;
    case 'sti': return pal.fieldOxide;
    case 'silicide':
    case 'anodeSilicide':
    case 'cathodeSilicide':
      return (typeof currentTheme !== 'undefined' && currentTheme === 'light') ? '#647082' : '#6e7887';
    case 'contact': return pal.via;
    case 'metal': return pal.metal;
    case 'ions': return '#14b8a6';
    case 'field': return '#f43f5e';
    default: return null;
  }
}

function updateLayersListTheme(pal) {
  if (!pal) {
    pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(currentTheme) : (window.getMaterialPalette ? window.getMaterialPalette(currentTheme) : null);
  }
  if (!pal) return;

  var layersBody = document.getElementById('layers-body');
  if (layersBody) {
    layersBody.querySelectorAll('.unified-layer-item').forEach(function(item) {
      var input = item.querySelector('input[data-layer]');
      var swatch = item.querySelector('.swatch');
      if (input && swatch) {
        var c = getLayerColor(input.dataset.layer, pal);
        if (c) swatch.style.background = c;
      }
    });
  }
}
window.updateLayersListTheme = updateLayersListTheme;

function getLayerDescription(layerId) {
  if (typeof COMPONENTS !== 'undefined' && COMPONENTS[layerId]) {
    return COMPONENTS[layerId].fn || COMPONENTS[layerId].role || '';
  }
  switch (layerId) {
    case 'active':
      return 'Heavily doped P+ Anode tub (injects holes under VA > 0) and degenerate N+ Cathode ohmic tap inside the N-Well.';
    case 'depletion':
      return (typeof COMPONENTS !== 'undefined' && COMPONENTS.depletionRegion)
        ? COMPONENTS.depletionRegion.fn
        : 'Continuous space-charge barrier swept free of mobile carriers straddling the metallurgical P+/N junction.';
    case 'ions':
      return 'Fixed ionized Boron acceptors (NA⁻) on the P+ side and Phosphorus donors (ND⁺) on the N-Well side supporting the built-in electric field.';
    case 'field':
      return (typeof COMPONENTS !== 'undefined' && COMPONENTS.breakdownGlow)
        ? COMPONENTS.breakdownGlow.fn
        : 'Visualizes peak electric field concentration along junction sidewalls when VA ≤ -VBR.';
    case 'passivation':
      return 'Shallow Trench Isolation (STI) oxide separating active zones beneath thick CVD SiO2 Interlayer Dielectric with etched contact windows.';
    case 'contact':
      return (typeof COMPONENTS !== 'undefined' && COMPONENTS.tungstenVias)
        ? COMPONENTS.tungstenVias.fn
        : 'Vertical CVD Tungsten plugs with Ti/TiN liners punching through the ILD down to P+ Anode and N+ Cathode silicide pads.';
    case 'metal':
      return 'Metal-1 interconnect pads delivering external applied anode bias VA and cathode ground reference (GND).';
    default:
      return '';
  }
}

function buildLayersList() {
  var layersBody = document.getElementById('layers-body');
  if (!layersBody) return;
  layersBody.className = 'unified-layers-list';
  layersBody.innerHTML = '';

  var pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(currentTheme) : (window.getMaterialPalette ? window.getMaterialPalette(currentTheme) : null);

  LAYERS_LIST.forEach(function (layer) {
    var item = document.createElement('div');
    item.className = 'unified-layer-item';

    var swatchCol = getLayerColor(layer.id, pal) || layer.color;

    var row = document.createElement('div');
    row.className = 'unified-layer-row';
    row.innerHTML =
      '<input type="checkbox" ' + (layer.visible ? 'checked' : '') + ' data-layer="' + layer.id + '" title="Toggle ' + layer.name + ' visibility">' +
      '<span class="swatch" style="background:' + swatchCol + '"></span>' +
      '<span class="layer-name" title="Toggle visibility">' + layer.name + '</span>';

    var descText = getLayerDescription(layer.id);

    var desc = document.createElement('div');
    desc.className = 'unified-layer-desc';
    desc.textContent = descText;

    item.appendChild(row);
    if (descText) item.appendChild(desc);
    layersBody.appendChild(item);

    var cb = row.querySelector('input');
    cb.addEventListener('change', function(e) {
      if (groups[layer.id]) {
        groups[layer.id].visible = e.target.checked;
      }
    });

    row.querySelector('.layer-name').addEventListener('click', function() {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  });
}

function buildArchitectureTree() {
  var treeEl = document.getElementById('tree');
  if (!treeEl) return;

  function renderNode(node) {
    var html = '';
    if (node.children) {
      html += '<div class="tree-node" style="font-weight:600; color:var(--text);">' + node.name + '</div>';
      html += '<div class="tree-branch">';
      node.children.forEach(function (child) {
        html += renderNode(child);
      });
      html += '</div>';
    } else {
      html += '<div class="tree-node" data-id="' + node.id + '">' + node.name + '</div>';
    }
    return html;
  }

  var rootHtml = '';
  ARCHITECTURE_TREE.forEach(function (rootNode) {
    rootHtml += renderNode(rootNode);
  });
  treeEl.innerHTML = rootHtml;

  treeEl.querySelectorAll('.tree-node[data-id]').forEach(function (el) {
    el.addEventListener('click', function () {
      var id = el.dataset.id;
      if (typeof selectComponentById === 'function') {
        selectComponentById(id);
      }
    });
  });
}

function setupAccordions() {
  document.querySelectorAll('.wb-accordion-head, .panel-head').forEach(function(h) {
    h.addEventListener('click', function() {
      if (h.classList.contains('static-head')) return;
      var targetId = h.dataset.target;
      if (!targetId) return;
      var body = document.getElementById(targetId);
      var chev = h.querySelector('.wb-chev, .chev');
      if (body) body.classList.toggle('hidden');
      if (chev) chev.classList.toggle('closed');
    });
  });
}
