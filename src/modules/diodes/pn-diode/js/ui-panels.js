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
  buildLegendList();
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

function buildLayersList() {
  var layersBody = document.getElementById('layers-body');
  if (!layersBody) return;
  layersBody.className = 'unified-layers-list';
  layersBody.innerHTML = '';

  LAYERS_LIST.forEach(function (layer) {
    var item = document.createElement('div');
    item.className = 'unified-layer-item';

    var row = document.createElement('div');
    row.className = 'unified-layer-row';
    row.innerHTML =
      '<input type="checkbox" ' + (layer.visible ? 'checked' : '') + ' data-layer="' + layer.id + '" title="Toggle ' + layer.name + ' visibility">' +
      '<span class="swatch" style="background:' + layer.color + '"></span>' +
      '<span class="layer-name" title="Toggle visibility">' + layer.name + '</span>';

    var descText = '';
    if (typeof COMPONENTS !== 'undefined' && COMPONENTS[layer.id]) {
      descText = COMPONENTS[layer.id].fn || COMPONENTS[layer.id].role || '';
    }

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

function buildLegendList() {
  var refLegendBody = document.getElementById('ref-legend-body');
  if (!refLegendBody || typeof COMPONENTS === 'undefined') return;
  refLegendBody.innerHTML = '';

  Object.keys(COMPONENTS).forEach(function (key) {
    var c = COMPONENTS[key];
    var div = document.createElement('div');
    div.className = 'ref-legend-item';
    div.innerHTML =
      '<div class="lh"><span class="swatch" style="background:' + c.colorHex + '"></span><b>' + c.name + '</b></div>' +
      '<p>' + (c.role || c.fn || '') + '</p>';
    refLegendBody.appendChild(div);
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
