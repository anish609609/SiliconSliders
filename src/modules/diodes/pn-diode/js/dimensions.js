/**
 * dimensions.js - PN Junction Diode CAD Viewer
 * Lambda-scaled layout rules table and process scaling selector.
 */

function initDimensions() {
  var lambdaSelect = document.getElementById('lambda-select');
  var dimsTable = document.getElementById('dims-table');

  if (lambdaSelect) {
    var lambdas = [
      { nm: 14, label: '14nm Node (λ = 7nm)' },
      { nm: 28, label: '28nm Node (λ = 14nm)' },
      { nm: 45, label: '45nm Node (λ = 22.5nm)' },
      { nm: 90, label: '90nm Node (λ = 45nm)' },
      { nm: 180, label: '180nm Planar (λ = 90nm)' }
    ];

    lambdaSelect.innerHTML = lambdas.map(function (item, idx) {
      return '<option value="' + item.nm + '"' + (idx === 1 ? ' selected' : '') + '>' + item.label + '</option>';
    }).join('');

    lambdaSelect.addEventListener('change', renderDimsTable);
  }

  function renderDimsTable() {
    if (!dimsTable) return;
    var nodeVal = lambdaSelect ? parseInt(lambdaSelect.value, 10) : 28;
    var lambdaVal = nodeVal / 2.0;

    var html = '<table class="dims-table"><thead><tr><th>RULE</th><th>DESIGN RULE</th><th>PHYSICAL</th></tr></thead><tbody>';
    LAMBDA_RULES.forEach(function (r) {
      var mult = parseFloat(r.lambda);
      var physNm = Math.round(mult * lambdaVal);
      html += '<tr><td><b>' + r.rule + '</b></td><td>' + r.lambda + '</td><td>' + physNm + ' nm</td></tr>';
    });
    html += '</tbody></table>';

    dimsTable.innerHTML = html;
  }

  renderDimsTable();
}
