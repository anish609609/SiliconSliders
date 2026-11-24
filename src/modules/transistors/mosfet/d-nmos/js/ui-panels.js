/**
 * ui-panels.js - NMOS CAD Viewer
 * Left/right side-panel content:
 * - Architecture tree data & renderer
 * - Layer visibility controls & legend builder
 * - Inspection node mappings
 */

var TREE = [
  { label: 'DEPLETION NMOS TRANSISTOR', children: [
    { label: 'SUBSTRATE', children: [
      { label: 'P-SUBSTRATE (BULK)', id: 'psub' },
      { label: 'P+ BODY TAP', id: 'subtap' }
    ]},
    { label: 'ACTIVE / DIFFUSION', children: [
      { label: 'N+ SOURCE REGION', id: 'nmosSrc' },
      { label: 'N-SDE / LDD (SOURCE)', id: 'sdeSrc' },
      { label: 'IMPLANTED N-CHANNEL (DEPLETION)', id: 'channel' },
      { label: 'N-SDE / LDD (DRAIN)', id: 'sdeDrn' },
      { label: 'N+ DRAIN REGION', id: 'nmosDrn' }
    ]},
    { label: 'GATE DIELECTRIC', children: [
      { label: 'INTERFACIAL SiO2', id: 'oxide' },
      { label: 'HIGH-K HfO2', id: 'highk' }
    ]},
    { label: 'GATE ELECTRODE & SPACERS', children: [
      { label: 'POLYSILICON RUNNER', id: 'poly' },
      { label: 'GATE SIDEWALL SPACERS (Si3N4)', id: 'spacer' }
    ]},
    { label: 'CONTACTS (TUNGSTEN)', id: 'contact', children: [
      { label: 'SOURCE CONTACT (W)', id: 'nmosSrcCt' },
      { label: 'DRAIN CONTACT (W)', id: 'nmosDrnCt' },
      { label: 'GATE CONTACT (W)', id: 'polyCt' },
      { label: 'BODY TAP CONTACT (W)', id: 'subtapCt' }
    ]},
    { label: 'METAL-1 INTERCONNECT', children: [
      { label: 'SOURCE PAD (GND)', id: 'srcRail' },
      { label: 'DRAIN PAD (VDS)', id: 'drnRail' },
      { label: 'GATE PAD (VGS)', id: 'gateRail' },
      { label: 'BODY PAD (GND)', id: 'bodyRail' }
    ]}
  ]}
];

var VIRTUAL = {
  nmos: { info: 'channel', meshes: ['nmosSrc', 'nmosDrn', 'sdeSrc', 'sdeDrn', 'poly', 'channel'] },
  contact: { info: 'contact', meshes: ['nmosSrcCt', 'nmosDrnCt', 'polyCt', 'subtapCt'] }
};

function idToInfo(id) {
  if (INFO[id]) return INFO[id];
  var map = {
    nmosSrc: 'nmosSrc',
    nmosDrn: 'nmosDrn',
    sdeSrc: 'sdeSrc',
    sdeDrn: 'sdeDrn',
    channel: 'channel',
    depletion: 'depletion',
    oxide: 'oxide',
    highk: 'highk',
    poly: 'poly',
    spacer: 'spacer',
    contact: 'contact',
    nmosSrcCt: 'nmosSrcCt',
    nmosDrnCt: 'nmosDrnCt',
    polyCt: 'polyCt',
    subtapCt: 'subtapCt',
    metal: 'metal',
    subtap: 'subtap',
    srcRail: 'srcRail',
    drnRail: 'drnRail',
    gateRail: 'gateRail',
    bodyRail: 'bodyRail',
    psub: 'psub'
  };
  return INFO[map[id]] || null;
}

function meshesForId(id) {
  if (VIRTUAL[id]) return VIRTUAL[id].meshes.map(findMesh).filter(Boolean);
  var m = findMesh(id);
  return m ? [m] : [];
}

function findMesh(id) {
  for (var i = 0; i < selectable.length; i++) {
    if (selectable[i].userData.id === id) return selectable[i];
  }
  return null;
}

// Build Architecture Tree DOM
var treeRoot = document.getElementById('tree');
function renderTree(nodes, depth) {
  var ul = document.createElement('ul');
  nodes.forEach(function(n) {
    var li = document.createElement('li');
    var row = document.createElement('div');
    row.className = 'node';
    row.dataset.id = n.id || '';
    row.dataset.label = n.label || '';
    var bullet = n.children ? '▸' : '·';
    row.innerHTML = '<span class="bullet">' + bullet + '</span><span>' + n.label + '</span>';
    if (n.id) {
      row.addEventListener('click', function(e) {
        e.stopPropagation();
        selectById(n.id);
      });
    }
    li.appendChild(row);
    if (n.children) li.appendChild(renderTree(n.children, depth + 1));
    ul.appendChild(li);
  });
  return ul;
}
if (treeRoot) treeRoot.appendChild(renderTree(TREE, 0));

// ---------------------------------------------------------------------------
// Left Workbench 3-Tab Controller
// ---------------------------------------------------------------------------
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
  if (tabKey === 'controls' && typeof applyLogicState === 'function') {
    setTimeout(applyLogicState, 10);
  }
}
window.switchWorkbenchTab = switchWorkbenchTab;

document.querySelectorAll('.wb-tab-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    switchWorkbenchTab(btn.dataset.tab);
  });
});

// ---------------------------------------------------------------------------
// Unified Layer List (10 Toggleable Layers with inline description)
// ---------------------------------------------------------------------------
var layerMeta = [
  { key: 'substrate', name: 'SUBSTRATE (P-BULK)', color: 'var(--c-substrate)' },
  { key: 'active',    name: 'ACTIVE / DIFFUSION (N+)', color: 'var(--c-active-n)' },
  { key: 'dchannel',  name: 'IMPLANTED N-CHANNEL (DEPLETION)', color: 'var(--c-sde-n)' },
  { key: 'sde',       name: 'EXTENSIONS (N-SDE / LDD)', color: 'var(--c-sde-n)' },
  { key: 'oxide',     name: 'GATE OXIDE (SiO2)', color: 'var(--c-oxide)' },
  { key: 'highk',     name: 'HIGH-K DIELECTRIC (HfO2)', color: 'var(--c-highk)' },
  { key: 'poly',      name: 'POLYSILICON / METAL GATE', color: 'var(--c-poly)' },
  { key: 'spacer',    name: 'GATE SPACERS (Si3N4)', color: '#67e8f9' },
  { key: 'contact',   name: 'CONTACTS (TUNGSTEN W)', color: 'var(--c-contact)' },
  { key: 'metal',     name: 'METAL-1 INTERCONNECTS', color: 'var(--c-metal)' }
];

var layersBody = document.getElementById('layers-body');
if (layersBody) {
  layersBody.className = 'unified-layers-list';
  layersBody.innerHTML = '';
  layerMeta.forEach(function(l) {
    var descText = '';
    if (typeof LEGEND !== 'undefined') {
      for (var i = 0; i < LEGEND.length; i++) {
        if (LEGEND[i].key === l.key) {
          descText = LEGEND[i].desc;
          break;
        }
      }
    }

    var item = document.createElement('div');
    item.className = 'unified-layer-item';

    var row = document.createElement('div');
    row.className = 'unified-layer-row';
    row.innerHTML =
      '<input type="checkbox" checked data-layer="' + l.key + '" title="Toggle ' + l.name + ' visibility">' +
      '<span class="swatch" style="background:' + l.color + '"></span>' +
      '<span class="layer-name" title="Toggle visibility">' + l.name + '</span>';

    var desc = document.createElement('div');
    desc.className = 'unified-layer-desc';
    desc.textContent = descText;

    item.appendChild(row);
    item.appendChild(desc);
    layersBody.appendChild(item);

    var cb = row.querySelector('input');
    cb.addEventListener('change', function(e) {
      if (groups[l.key]) groups[l.key].visible = e.target.checked;
    });

    row.querySelector('.layer-name').addEventListener('click', function() {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    });
  });
}

// ---------------------------------------------------------------------------
// Terminals & Channel Reference (Non-toggleable items)
// ---------------------------------------------------------------------------
var refLegendBody = document.getElementById('ref-legend-body');
var nonToggleableKeys = ['src', 'drn', 'gate', 'body'];
if (refLegendBody && typeof LEGEND !== 'undefined') {
  refLegendBody.innerHTML = '';
  LEGEND.filter(function(l) {
    return nonToggleableKeys.indexOf(l.key) !== -1;
  }).forEach(function(l) {
    var div = document.createElement('div');
    div.className = 'ref-legend-item';
    div.innerHTML =
      '<div class="lh"><span class="swatch" style="background:' + l.color + '"></span><b>' + l.name + '</b></div>' +
      '<p>' + l.desc + '</p>';
    refLegendBody.appendChild(div);
  });
}

// ---------------------------------------------------------------------------
// Collapsible Accordion Sections
// ---------------------------------------------------------------------------
function updateLayersListTheme(pal) {
  if (!pal) {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
  }
  if (!pal) return;

  var colorMap = {
    substrate: pal.pSubstrate,
    active: pal.nPlusDiffusion,
    sde: pal.implantedNChannel,
    channel: pal.implantedNChannel,
    oxide: pal.gateOxide,
    poly: pal.polysilicon,
    contact: pal.via,
    metal: pal.metal,
    src: pal.nPlusDiffusion,
    drn: '#57cf8f',
    gate: '#e6c94a',
    body: pal.pSubstrate
  };

  var layersBody = document.getElementById('layers-body');
  if (layersBody) {
    layersBody.querySelectorAll('.unified-layer-item').forEach(function(item) {
      var input = item.querySelector('input[data-layer]');
      var swatch = item.querySelector('.swatch');
      if (input && swatch && colorMap[input.dataset.layer]) {
        swatch.style.background = colorMap[input.dataset.layer];
      }
    });
  }

  var refLegendBody = document.getElementById('ref-legend-body');
  if (refLegendBody) {
    refLegendBody.querySelectorAll('.ref-legend-item').forEach(function(item, idx) {
      var swatch = item.querySelector('.swatch');
      if (swatch && nonToggleableKeys[idx] && colorMap[nonToggleableKeys[idx]]) {
        swatch.style.background = colorMap[nonToggleableKeys[idx]];
      }
    });
  }
}
window.updateLayersListTheme = updateLayersListTheme;
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
