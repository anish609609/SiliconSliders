/**
 * ui-panels.js
 * Left/right side-panel content: the architecture tree data + renderer, and the layer-visibility / legend list builders.
 */

// =====================================================================
// ARCHITECTURE TREE DATA  (section 18)
// =====================================================================
var TREE = [
  { label:'CMOS INVERTER', children:[
    { label:'SUBSTRATE', children:[ { label:'P-SUBSTRATE', id:'psub' } ] },
    { label:'WELL', children:[ { label:'N-WELL', id:'nwell' }, { label:'P-WELL', id:'pwell' } ] },
    { label:'TRANSISTORS', children:[
      { label:'PMOS', id:'pmos', children:[
        { label:'SOURCE', id:'pmosSrc' }, { label:'P-SDE (SRC)', id:'pmosSrcSde' }, { label:'GATE', id:'poly' }, { label:'P-SDE (DRN)', id:'pmosDrnSde' }, { label:'DRAIN', id:'pmosDrn' }
      ]},
      { label:'NMOS', id:'nmos', children:[
        { label:'SOURCE', id:'nmosSrc' }, { label:'N-SDE (SRC)', id:'nmosSrcSde' }, { label:'GATE', id:'poly' }, { label:'N-SDE (DRN)', id:'nmosDrnSde' }, { label:'DRAIN', id:'nmosDrn' }
      ]}
    ]},
    { label:'GATE OXIDE (SiO2)', children:[ { label:'PMOS OXIDE (SiO2)', id:'pmosOxide' }, { label:'NMOS OXIDE (SiO2)', id:'nmosOxide' } ] },
    { label:'HIGH-K DIELECTRIC (HfO2)', children:[ { label:'PMOS HIGH-K (HfO2)', id:'pmosHighk' }, { label:'NMOS HIGH-K (HfO2)', id:'nmosHighk' } ] },
    { label:'POLYSILICON & SPACERS', children:[
      { label:'COMMON GATE', id:'poly' },
      { label:'GATE SPACERS (Si3N4)', id:'spacer' }
    ]},
    { label:'SILICIDE (SALICIDE NiSi)', children:[
      { label:'S/D & TAP SILICIDE (NiSi)', id:'silicide' }
    ]},
    { label:'CONTACTS (TUNGSTEN)', id:'pmosSrcCt', children:[
      { label:'PMOS SRC CT', id:'pmosSrcCt' }, { label:'PMOS DRN CT', id:'pmosDrnCt' },
      { label:'NMOS SRC CT', id:'nmosSrcCt' }, { label:'NMOS DRN CT', id:'nmosDrnCt' },
      { label:'POLY / IN CT', id:'polyCt' }
    ]},
    { label:'METAL-1', children:[
      { label:'VDD', id:'vddRail' }, { label:'GND', id:'gndRail' },
      { label:'IN', id:'inPin' }, { label:'OUT', id:'outPin' }
    ]}
  ]}
];

// virtual (non-mesh) ids resolve to an aggregate info + representative mesh(es) to highlight
var VIRTUAL = {
  pmos: { info:'pmos', meshes:['pmosSrc','pmosDrn','pmosSrcSde','pmosDrnSde','poly'] },
  nmos: { info:'nmos', meshes:['nmosSrc','nmosDrn','nmosSrcSde','nmosDrnSde','poly'] }
};

function idToInfo(id){
  if (INFO[id]) return INFO[id];
  var map = { pmosSrc:'actP', pmosDrn:'actP', nmosSrc:'actN', nmosDrn:'actN',
    pmosSrcSde:'sdeP', pmosDrnSde:'sdeP', nmosSrcSde:'sdeN', nmosDrnSde:'sdeN',
    pmosOxide:'oxide', nmosOxide:'oxide', pmosHighk:'highk', nmosHighk:'highk',
    pmosSrcCt:'contact', pmosDrnCt:'contact', nmosSrcCt:'contact', nmosDrnCt:'contact', polyCt:'contact',
    welltapCt:'welltap', subtapCt:'subtap', welltapAct:'welltap', subtapAct:'subtap',
    vddRail:'vdd', vddStubPmos:'vdd', vddStubTap:'vdd', gndRail:'gnd', gndStubNmos:'gnd', gndStubTap:'gnd',
    inPin:'inNet', outPin:'outNet', outSpine:'outNet', poly:'poly', spacer:'spacer', silicide:'silicide', nwell:'nwell', pwell:'pwell', psub:'psub' };
  return INFO[map[id]] || null;
}

function meshesForId(id){
  if (VIRTUAL[id]) {
    var vList = [];
    VIRTUAL[id].meshes.forEach(function(mid){
      findAllMeshes(mid).forEach(function(m){
        if (vList.indexOf(m) === -1) vList.push(m);
      });
    });
    return vList;
  }
  return findAllMeshes(id);
}
function findMesh(id){
  for (var i=0;i<selectable.length;i++){ if (selectable[i].userData.id === id) return selectable[i]; }
  return null;
}
function findAllMeshes(id){
  var out = [];
  for (var i=0;i<selectable.length;i++){ if (selectable[i].userData.id === id) out.push(selectable[i]); }
  return out;
}

// build tree DOM
var treeRoot = document.getElementById('tree');
function renderTree(nodes, depth){
  var ul = document.createElement('ul');
  nodes.forEach(function(n){
    var li = document.createElement('li');
    var row = document.createElement('div');
    row.className = 'node';
    row.dataset.id = n.id || '';
    row.dataset.label = n.label || '';
    var bullet = n.children ? '▸' : '·';
    row.innerHTML = '<span class="bullet">'+bullet+'</span><span>'+n.label+'</span>';
    if (n.id){
      row.addEventListener('click', function(e){ e.stopPropagation(); selectById(n.id); });
    }
    li.appendChild(row);
    if (n.children) li.appendChild(renderTree(n.children, depth+1));
    ul.appendChild(li);
  });
  return ul;
}
treeRoot.appendChild(renderTree(TREE, 0));

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

// =====================================================================
// UNIFIED LAYER LIST & TERMINAL REFERENCE
// =====================================================================
var layerMeta = [
  { key: 'substrate', name: 'SUBSTRATE (P-BULK)', color: 'var(--c-substrate)' },
  { key: 'well',      name: 'WELLS (N-WELL & P-WELL)', color: 'var(--c-well)' },
  { key: 'active',    name: 'ACTIVE / DIFFUSION', color: 'var(--c-active-p)' },
  { key: 'sde',       name: 'EXTENSIONS (SDE / LDD)', color: 'var(--c-sde-p)' },
  { key: 'oxide',     name: 'GATE OXIDE (SiO2)', color: 'var(--c-oxide)' },
  { key: 'highk',     name: 'HIGH-K DIELECTRIC (HfO2)', color: 'var(--c-highk)' },
  { key: 'poly',      name: 'POLYSILICON / COMMON GATE', color: 'var(--c-poly)' },
  { key: 'spacer',    name: 'GATE SPACERS (Si3N4)', color: '#67e8f9' },
  { key: 'silicide',  name: 'SILICIDE (NiSi)', color: 'var(--c-silicide)' },
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

// Terminals & Net Reference (Non-toggleable items)
var refLegendBody = document.getElementById('ref-legend-body');
var nonToggleableKeys = ['vdd', 'gnd', 'in', 'out'];
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

// Collapsible accordion sections
function updateLayersListTheme(pal) {
  if (!pal) {
    var isLight = document.documentElement.getAttribute('data-theme') === 'light';
    pal = (typeof getMaterialPalette === 'function') ? getMaterialPalette(isLight ? 'light' : 'dark') : (window.getMaterialPalette ? window.getMaterialPalette(isLight ? 'light' : 'dark') : null);
  }
  if (!pal) return;

  var colorMap = {
    substrate: pal.pSubstrate,
    well: 'linear-gradient(135deg, ' + pal.nWell + ' 50%, ' + pal.pWell + ' 50%)',
    active: 'linear-gradient(135deg, ' + pal.pPlusDiffusion + ' 50%, ' + pal.nPlusDiffusion + ' 50%)',
    sde: 'linear-gradient(135deg, ' + pal.pSDE + ' 50%, ' + pal.nSDE + ' 50%)',
    oxide: pal.gateOxide,
    poly: pal.polysilicon,
    silicide: isLight ? '#647082' : '#6e7887',
    contact: pal.via,
    metal: pal.metal,
    vdd: '#e35d5d',
    gnd: '#6b7686',
    in: '#e6c94a',
    out: '#57cf8f'
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
updateLayersListTheme();

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
