/* Left panel architecture TREE, VIRTUAL composite definitions, layer visibility & legend */

var VIRTUAL = {
  pmosA: ['pmosASrc', 'pmosSharedDrn', 'pmosASrcSde', 'pmosADrnSde', 'pmosAOxide', 'pmosAHighk', 'polyA'],
  pmosB: ['pmosBSrc', 'pmosSharedDrn', 'pmosBDrnSde', 'pmosBSrcSde', 'pmosBOxide', 'pmosBHighk', 'polyB'],
  nmosA: ['nmosASrc', 'nmosMidNode', 'nmosASrcSde', 'nmosADrnSde', 'nmosAOxide', 'nmosAHighk', 'polyA'],
  nmosB: ['nmosMidNode', 'nmosBDrn', 'nmosBSrcSde', 'nmosBDrnSde', 'nmosBOxide', 'nmosBHighk', 'polyB'],
  pmos: [
    'nwell', 'pmosASrc', 'pmosSharedDrn', 'pmosBSrc',
    'pmosASrcSde', 'pmosADrnSde', 'pmosBDrnSde', 'pmosBSrcSde',
    'pmosAOxide', 'pmosBOxide', 'pmosAHighk', 'pmosBHighk', 'polyA', 'polyB'
  ],
  nmos: [
    'pwell', 'nmosASrc', 'nmosMidNode', 'nmosBDrn',
    'nmosASrcSde', 'nmosADrnSde', 'nmosBSrcSde', 'nmosBDrnSde',
    'nmosAOxide', 'nmosBOxide', 'nmosAHighk', 'nmosBHighk', 'polyA', 'polyB'
  ]
};

var TREE = [
  {
    group: 'SUBSTRATE',
    items: [
      { id: 'psub', label: 'P-Substrate Wafer', tag: 'SI' }
    ]
  },
  {
    group: 'WELL (N-WELL & P-WELL)',
    items: [
      { id: 'nwell', label: 'N-Well (Pull-Up Body)', tag: 'NW' },
      { id: 'pwell', label: 'P-Well (Pull-Down Body)', tag: 'PW' },
      { id: 'welltapAct', label: 'N-Well Body Tap (N+)', tag: 'TAP' },
      { id: 'subtapAct', label: 'P-Well Body Tap (P+)', tag: 'TAP' }
    ]
  },
  {
    group: 'TRANSISTORS & DIFFUSIONS',
    items: [
      { id: 'pmosA', label: 'MP1 · PMOS A (Pull-Up)', tag: 'DEV' },
      { id: 'pmosB', label: 'MP2 · PMOS B (Pull-Up)', tag: 'DEV' },
      { id: 'nmosA', label: 'MN1 · NMOS A (Pull-Down)', tag: 'DEV' },
      { id: 'nmosB', label: 'MN2 · NMOS B (Pull-Down)', tag: 'DEV' },
      { id: 'pmosASrc', label: 'MP1 Source (P+ -> VDD)', tag: 'P+' },
      { id: 'pmosSharedDrn', label: 'Shared P+ Drain (OUT)', tag: 'P+' },
      { id: 'pmosBSrc', label: 'MP2 Source (P+ -> VDD)', tag: 'P+' },
      { id: 'nmosASrc', label: 'MN1 Source (N+ -> GND)', tag: 'N+' },
      { id: 'nmosMidNode', label: 'Series N+ Bridge', tag: 'N+' },
      { id: 'nmosBDrn', label: 'MN2 Drain (N+ -> OUT)', tag: 'N+' }
    ]
  },
  {
    group: 'GATE OXIDE (SiO2)',
    items: [
      { id: 'pmosAOxide', label: 'MP1 Gate Oxide', tag: 'OX' },
      { id: 'pmosBOxide', label: 'MP2 Gate Oxide', tag: 'OX' },
      { id: 'nmosAOxide', label: 'MN1 Gate Oxide', tag: 'OX' },
      { id: 'nmosBOxide', label: 'MN2 Gate Oxide', tag: 'OX' }
    ]
  },
  {
    group: 'HIGH-K DIELECTRIC (HfO2)',
    items: [
      { id: 'pmosAHighk', label: 'MP1 High-K (HfO2)', tag: 'HK' },
      { id: 'pmosBHighk', label: 'MP2 High-K (HfO2)', tag: 'HK' },
      { id: 'nmosAHighk', label: 'MN1 High-K (HfO2)', tag: 'HK' },
      { id: 'nmosBHighk', label: 'MN2 High-K (HfO2)', tag: 'HK' }
    ]
  },
  {
    group: 'POLYSILICON (GATES A & B)',
    items: [
      { id: 'polyA', label: 'Poly Gate A (MP1 + MN1)', tag: 'GA' },
      { id: 'polyB', label: 'Poly Gate B (MP2 + MN2)', tag: 'GB' }
    ]
  },
  {
    group: 'CONTACTS (9 TUNGSTEN)',
    items: [
      { id: 'welltapCt', label: 'N-Well Tap Contact', tag: 'W' },
      { id: 'pmosASrcCt', label: 'MP1 Source Contact', tag: 'W' },
      { id: 'pmosSharedDrnCt', label: 'Shared PMOS Drain Contact', tag: 'W' },
      { id: 'pmosBSrcCt', label: 'MP2 Source Contact', tag: 'W' },
      { id: 'subtapCt', label: 'P-Well Tap Contact', tag: 'W' },
      { id: 'nmosASrcCt', label: 'MN1 Source Contact', tag: 'W' },
      { id: 'nmosBDrnCt', label: 'MN2 Drain Contact', tag: 'W' },
      { id: 'polyACt', label: 'Poly Gate A Contact', tag: 'W' },
      { id: 'polyBCt', label: 'Poly Gate B Contact', tag: 'W' }
    ]
  },
  {
    group: 'METAL-1 INTERCONNECTS',
    items: [
      { id: 'vddRail', label: 'VDD Rail (+Z)', tag: 'M1' },
      { id: 'gndRail', label: 'GND Rail (-Z)', tag: 'M1' },
      { id: 'inAPin', label: 'Input A Pin (Z = +0.8)', tag: 'M1' },
      { id: 'inBPin', label: 'Input B Pin (Z = -0.8)', tag: 'M1' },
      { id: 'outPmosBranch', label: 'OUT PMOS Branch', tag: 'M1' },
      { id: 'outSpine', label: 'OUT Collector Spine', tag: 'M1' },
      { id: 'outNmosBranch', label: 'OUT NMOS Branch', tag: 'M1' },
      { id: 'outPin', label: 'OUT Output Pin', tag: 'M1' }
    ]
  }
];

var layerVisibility = {};
for (var li = 0; li < LEGEND.length; li++) {
  layerVisibility[LEGEND[li].key] = true;
}
var showLabels3D = true;

function applyLayerVisibility() {
  for (var i = 0; i < allMeshes.length; i++) {
    var m = allMeshes[i];
    var vis = layerVisibility[m.userData.layer] !== false;
    m.visible = vis;
  }
  for (var j = 0; j < labelsList.length; j++) {
    var lbl = labelsList[j];
    var lvis = showLabels3D && (layerVisibility[lbl.userData.layer] !== false);
    lbl.visible = lvis;
  }
}

function syncVisibilityCheckboxes() {
  var checks = document.querySelectorAll('#layers-body input[data-layer]');
  for (var i = 0; i < checks.length; i++) {
    var key = checks[i].getAttribute('data-layer');
    checks[i].checked = layerVisibility[key] !== false;
  }
  var lblChk = document.getElementById('chk-labels');
  if (lblChk) lblChk.checked = showLabels3D;
  applyLayerVisibility();
}

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

function buildUiPanels() {
  /* Build Architecture Tree matching D-NMOS / CMOS Inverter tree structure */
  var treeRoot = document.getElementById('tree');
  if (treeRoot) {
    treeRoot.innerHTML = '';
    var hierarchy = [
      {
        label: 'CMOS 2-INPUT NAND',
        children: TREE.map(function (grp) {
          return {
            label: grp.group,
            children: grp.items.map(function (it) {
              return { label: it.label, id: it.id };
            })
          };
        })
      }
    ];

    function renderTree(nodes) {
      var ul = document.createElement('ul');
      nodes.forEach(function (n) {
        var li = document.createElement('li');
        var row = document.createElement('div');
        row.className = 'node';
        row.dataset.id = n.id || '';
        row.dataset.label = n.label || '';
        var bullet = n.children ? '▸' : '·';
        row.innerHTML = '<span class="bullet">' + bullet + '</span><span>' + n.label + '</span>';
        if (n.id) {
          row.addEventListener('click', function (e) {
            e.stopPropagation();
            if (typeof selectById === 'function') selectById(n.id);
          });
        }
        li.appendChild(row);
        if (n.children) li.appendChild(renderTree(n.children));
        ul.appendChild(li);
      });
      return ul;
    }

    treeRoot.appendChild(renderTree(hierarchy));
  }

  // Workbench Tab Switching Buttons
  document.querySelectorAll('.wb-tab-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchWorkbenchTab(btn.dataset.tab);
    });
  });

  /* Unified Layer List in Tab 2 (#layers-body) */
  var layersBody = document.getElementById('layers-body');
  if (layersBody && typeof LEGEND !== 'undefined') {
    layersBody.className = 'unified-layers-list';
    layersBody.innerHTML = '';
    LEGEND.forEach(function(l) {
      var item = document.createElement('div');
      item.className = 'unified-layer-item';

      var row = document.createElement('div');
      row.className = 'unified-layer-row';
      row.innerHTML =
        '<input type="checkbox" checked data-layer="' + l.key + '" title="Toggle ' + l.label + ' visibility">' +
        '<span class="swatch" style="background:' + l.color + '"></span>' +
        '<span class="layer-name" title="Toggle visibility">' + l.label + '</span>';

      var desc = document.createElement('div');
      desc.className = 'unified-layer-desc';
      desc.textContent = l.note || '';

      item.appendChild(row);
      item.appendChild(desc);
      layersBody.appendChild(item);

      var cb = row.querySelector('input');
      cb.addEventListener('change', function(e) {
        layerVisibility[l.key] = e.target.checked;
        applyLayerVisibility();
      });

      row.querySelector('.layer-name').addEventListener('click', function() {
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });
    });
  }

  /* Terminals & Net Reference (#ref-legend-body) */
  var refLegendBody = document.getElementById('ref-legend-body');
  if (refLegendBody) {
    var terminalsList = [
      { name: 'VDD RAIL (+Z)', color: 'var(--c-vdd)', desc: 'Supply voltage rail (+1.00V) routing to MP1/MP2 source diffusions and N-Well body tap.' },
      { name: 'GND RAIL (-Z)', color: 'var(--c-gnd)', desc: 'Ground return rail (0.00V) routing to MN1 source diffusion and P-Well body tap.' },
      { name: 'INPUT A (GATE A)', color: 'var(--c-in)', desc: 'Polysilicon gate A controlling pull-up MP1 and bottom series pull-down MN1.' },
      { name: 'INPUT B (GATE B)', color: 'var(--c-in)', desc: 'Polysilicon gate B controlling pull-up MP2 and top series pull-down MN2.' },
      { name: 'OUTPUT NET (OUT)', color: 'var(--c-out)', desc: 'Common output node driven by parallel PMOS pull-up or series NMOS pull-down.' },
      { name: 'SERIES N+ BRIDGE', color: 'var(--c-active-n)', desc: 'Intermediate internal diffusion node Vx between series NMOS transistors MN1 and MN2.' }
    ];
    refLegendBody.innerHTML = '';
    terminalsList.forEach(function(t) {
      var div = document.createElement('div');
      div.className = 'ref-legend-item';
      div.innerHTML =
        '<div class="lh"><span class="swatch" style="background:' + t.color + '"></span><b>' + t.name + '</b></div>' +
        '<p>' + t.desc + '</p>';
      refLegendBody.appendChild(div);
    });
  }

  /* Collapsible Accordion Section Headers */
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
      contact: pal.via,
      metal: pal.metal
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
      refLegendBody.querySelectorAll('.ref-legend-item').forEach(function(item) {
        var nameEl = item.querySelector('.lh b');
        var swatch = item.querySelector('.swatch');
        if (nameEl && swatch && nameEl.textContent.indexOf('SERIES N+ BRIDGE') !== -1) {
          swatch.style.background = pal.nPlusDiffusion;
        }
      });
    }
  }
  window.updateLayersListTheme = updateLayersListTheme;

  document.querySelectorAll('.wb-accordion-head, .panel-head').forEach(function(h) {
    h.addEventListener('click', function() {
      if (h.classList.contains('static-head')) return;
      var targetId = h.dataset.target || h.getAttribute('data-sec');
      if (!targetId) return;
      var body = document.getElementById(targetId);
      var chev = h.querySelector('.wb-chev, .sec-chevron, .chev');
      if (body) {
        var isHidden = body.classList.toggle('hidden');
        if (chev) {
          chev.classList.toggle('closed', isHidden);
          chev.textContent = isHidden ? '▸' : '▾';
        }
      }
    });
  });

  /* 3D Floating Labels Checkbox */
  var chkLabels = document.getElementById('toggle-labels') || document.getElementById('chk-labels');
  if (chkLabels) {
    chkLabels.addEventListener('change', function () {
      if (typeof window.toggleLabels === 'function') {
        window.toggleLabels(chkLabels.checked);
      } else {
        showLabels3D = chkLabels.checked;
        applyLayerVisibility();
      }
    });
    if (typeof window.toggleLabels === 'function') {
      window.toggleLabels(chkLabels.checked);
    } else {
      showLabels3D = chkLabels.checked;
      applyLayerVisibility();
    }
  }
}

buildUiPanels();
if (typeof updateLayersListTheme === 'function') updateLayersListTheme();
