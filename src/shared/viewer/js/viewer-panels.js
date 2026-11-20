/**
 * Silicon Sliders - Unified Viewer Panels Engine
 * Unifies Layer Visibility, Layer Legend, Lambda (λ) Rules & Dimensions,
 * View Controls (Explode X/Y/Z & Scrub X/Y/Z), and Architecture Tree.
 */

(function (root) {
  'use strict';

  // Format nm to µm or nm string
  function formatNm(valueNm) {
    if (valueNm >= 1000) {
      return (valueNm / 1000).toFixed(valueNm % 1000 === 0 ? 1 : 2) + ' \u00B5m';
    }
    return (Math.round(valueNm * 100) / 100) + ' nm';
  }

  // 1. Build Dimensions (λ Design Rules) Panel
  function initDimensions(config) {
    var presets = config.lambdaPresets || [
      { label: 'λ = 1000 nm  (legacy 2 µm process)', nm: 1000 },
      { label: 'λ = 350 nm  (0.35 µm process)', nm: 350 },
      { label: 'λ = 130 nm  (0.13 µm process)', nm: 130 },
      { label: 'λ = 90 nm (default)', nm: 90 },
      { label: 'λ = 45 nm', nm: 45 },
      { label: 'λ = 16 nm  (illustrative)', nm: 16 }
    ];
    var rules = config.dimRules || [];
    var currentLambda = config.defaultLambda || 90;

    var selectEl = document.getElementById('lambda-select') || document.getElementById('select-lambda');
    var tableEl = document.getElementById('dims-table') || document.getElementById('lambda-rules-table');

    function renderTable() {
      if (!tableEl) return;
      var html = '';
      rules.forEach(function (r) {
        if (r.note) {
          html += '<div class="dims-table-row" style="display:block;">' +
            '<span class="k">' + r.label + '</span>' +
            '<div class="note">' + r.note + '</div></div>';
        } else if (typeof r.lambda === 'number') {
          var val = r.lambda * currentLambda;
          html += '<div class="dims-table-row">' +
            '<span class="k">' + r.label + ' <span style="opacity:0.6;">(' + r.lambda + 'λ)</span></span>' +
            '<span class="v">' + formatNm(val) + '</span></div>';
        }
      });
      tableEl.innerHTML = html;
    }

    if (selectEl) {
      selectEl.innerHTML = '';
      presets.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.nm;
        opt.textContent = p.label;
        if (p.nm === currentLambda) opt.selected = true;
        selectEl.appendChild(opt);
      });

      selectEl.addEventListener('change', function (e) {
        currentLambda = parseFloat(e.target.value) || 90;
        renderTable();
        if (typeof config.onLambdaChange === 'function') {
          config.onLambdaChange(currentLambda);
        }
      });
    }

    renderTable();
  }

  // 2. Build Layer Visibility & Legend Panels
  function initLayersAndLegend(config) {
    var legend = config.legend || [];
    var layersBody = document.getElementById('layers-body');
    var legendBody = document.getElementById('legend-body');

    if (layersBody && legend.length > 0 && layersBody.children.length === 0) {
      legend.forEach(function (item) {
        var row = document.createElement('label');
        row.className = 'layer-row';
        row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:4px 0; font-family:"IBM Plex Mono",monospace; font-size:11px; cursor:pointer;';
        row.innerHTML = '<input type="checkbox" checked data-layer="' + item.id + '" style="cursor:pointer;" />' +
          '<span class="dot" style="width:8px; height:8px; border-radius:50%; background:' + item.color + '; display:inline-block;"></span>' +
          '<span>' + item.name + '</span>';
        
        var chk = row.querySelector('input');
        chk.addEventListener('change', function () {
          if (typeof config.onToggleLayer === 'function') {
            config.onToggleLayer(item.id, chk.checked);
          }
        });
        layersBody.appendChild(row);
      });
    }

    if (legendBody && legend.length > 0 && legendBody.children.length === 0) {
      legend.forEach(function (item) {
        var badge = document.createElement('div');
        badge.className = 'legend-badge';
        badge.style.cssText = 'display:inline-flex; align-items:center; gap:6px; margin:3px 6px 3px 0; padding:3px 7px; border-radius:4px; font-family:"IBM Plex Mono",monospace; font-size:10px; border:1px solid var(--v-border); background:var(--v-bg-input);';
        badge.innerHTML = '<span style="width:8px; height:8px; border-radius:2px; background:' + item.color + ';"></span><span>' + item.name + '</span>';
        legendBody.appendChild(badge);
      });
    }
  }

  // 3. Bind Collapsible Drawer Panels
  function initCollapsiblePanels() {
    document.querySelectorAll('.panel-head').forEach(function (head) {
      head.addEventListener('click', function () {
        var targetId = head.getAttribute('data-target');
        var body = document.getElementById(targetId);
        var chev = head.querySelector('.chev');
        if (body) {
          var isClosed = body.style.display === 'none';
          body.style.display = isClosed ? 'block' : 'none';
          if (chev) chev.textContent = isClosed ? '▾' : '▸';
        }
      });
    });
  }

  root.ViewerPanels = {
    initDimensions: initDimensions,
    initLayersAndLegend: initLayersAndLegend,
    initCollapsiblePanels: initCollapsiblePanels,
    formatNm: formatNm
  };

})(typeof window !== 'undefined' ? window : this);
