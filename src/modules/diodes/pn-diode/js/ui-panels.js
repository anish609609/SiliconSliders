/**
 * ui-panels.js - PN Junction Diode CAD Viewer
 * Left and right panel building, layer visibility management,
 * architecture tree generation, and docked panel tabs.
 */

function initUIPanels() {
  buildLayersList();
  buildLegendList();
  buildArchitectureTree();
  setupPanelToggles();
  setupDockedPanelTabs();
}

function buildLayersList() {
  var layersBody = document.getElementById('layers-body');
  if (!layersBody) return;

  var html = '';
  LAYERS_LIST.forEach(function (layer) {
    html += '<label class="layer-row">';
    html += '<input type="checkbox" data-layer="' + layer.id + '"' + (layer.visible ? ' checked' : '') + '>';
    html += '<span class="layer-color-dot" style="background:' + layer.color + '"></span>';
    html += '<span>' + layer.name + '</span>';
    html += '</label>';
  });
  layersBody.innerHTML = html;

  layersBody.querySelectorAll('input[type="checkbox"]').forEach(function (chk) {
    chk.addEventListener('change', function () {
      var layerId = chk.dataset.layer;
      var isVis = chk.checked;
      if (groups[layerId]) {
        groups[layerId].visible = isVis;
      }
    });
  });
}

function buildLegendList() {
  var legendBody = document.getElementById('legend-body');
  if (!legendBody) return;

  var html = '';
  Object.keys(COMPONENTS).forEach(function (key) {
    var c = COMPONENTS[key];
    html += '<div class="layer-row" style="cursor:default;">';
    html += '<span class="layer-color-dot" style="background:' + c.colorHex + '"></span>';
    html += '<span style="font-family:var(--mono); font-size:11px;">' + c.name + '</span>';
    html += '</div>';
  });
  legendBody.innerHTML = html;
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

function setupPanelToggles() {
  var leftPanel = document.getElementById('left-panel');
  var rightPanel = document.getElementById('right-panel');
  var leftToggle = document.getElementById('left-toggle');
  var rightToggle = document.getElementById('right-toggle');
  var bodyRow = document.getElementById('body-row');

  if (leftToggle && leftPanel) {
    leftToggle.addEventListener('click', function () {
      leftPanel.classList.toggle('collapsed');
      if (bodyRow) bodyRow.classList.toggle('left-collapsed', leftPanel.classList.contains('collapsed'));
      setTimeout(resize, 220);
    });
  }

  if (rightToggle && rightPanel) {
    rightToggle.addEventListener('click', function () {
      rightPanel.classList.toggle('collapsed');
      if (bodyRow) bodyRow.classList.toggle('right-collapsed', rightPanel.classList.contains('collapsed'));
      setTimeout(resize, 220);
    });
  }

  // Accordion heads inside panels
  document.querySelectorAll('.panel-head').forEach(function (head) {
    head.addEventListener('click', function () {
      var section = head.closest('.panel-section');
      if (section) section.classList.toggle('collapsed');
    });
  });
}

function setupDockedPanelTabs() {
  var dpTabs = document.querySelectorAll('.dp-tab-btn');
  var dpContents = document.querySelectorAll('.dp-tab-content');
  var dpCollapseBtn = document.getElementById('dp-collapse-btn');
  var dpBody = document.getElementById('dp-body');

  dpTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.dataset.tab;
      dpTabs.forEach(function (t) { t.classList.remove('active'); });
      dpContents.forEach(function (c) { c.classList.remove('active'); });
      tab.classList.add('active');
      var activeContent = document.getElementById('tab-content-' + target);
      if (activeContent) activeContent.classList.add('active');

      if (target === 'physics' && typeof renderGraphs === 'function') {
        setTimeout(renderGraphs, 50);
      }
    });
  });

  if (dpCollapseBtn && dpBody) {
    dpCollapseBtn.addEventListener('click', function () {
      var isHidden = (dpBody.style.display === 'none');
      dpBody.style.display = isHidden ? 'flex' : 'none';
      dpCollapseBtn.textContent = isHidden ? '▾' : '▴';
    });
  }
}
