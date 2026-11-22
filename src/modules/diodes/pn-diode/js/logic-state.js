/**
 * logic-state.js - PN Junction Diode CAD Viewer
 * Central state coordination, slider bindings, telemetry synchronization,
 * and 2D schematic overlay updates.
 */

// Active continuous diode state variables
var currentVa = 0.00;          // Applied bias voltage (-20.0V to +0.8V)
var currentLogNa = 17.0;       // Log10(NA in cm^-3) (15.0 to 19.0) -> NA = 10^17 cm^-3
var currentLogNd = 16.0;       // Log10(ND in cm^-3) (15.0 to 19.0) -> ND = 10^16 cm^-3
var currentTemp = 300;         // Temperature in Kelvin (250K to 400K)

/**
 * Public accessor returning complete calculated diode physics state
 */
window.getDiodeState = function () {
  var Na = Math.pow(10, currentLogNa);
  var Nd = Math.pow(10, currentLogNd);
  return DiodePhysics.computeState(currentVa, Na, Nd, currentTemp);
};

/**
 * Public setter for bias voltage (used by graph dragging & presets)
 */
window.setDiodeBiasVoltage = function (newVa) {
  currentVa = Math.max(-20.0, Math.min(0.80, newVa));
  applyDiodeState();
};

/**
 * Formatting helper for scientific notation (e.g. 1.0 × 10¹⁷ cm⁻³)
 */
function formatDoping(val) {
  var exp = Math.floor(Math.log10(val));
  var coeff = (val / Math.pow(10, exp)).toFixed(1);
  var superscripts = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹'
  };
  var expStr = exp.toString().split('').map(function(c) { return superscripts[c] || c; }).join('');
  return coeff + '×10' + expStr + ' cm⁻³';
}

function formatCurrent(ma) {
  var abs = Math.abs(ma);
  if (abs < 0.001) {
    var pA = abs * 1.0e9;
    return (ma < 0 ? '-' : '') + pA.toFixed(1) + ' pA';
  }
  if (abs < 0.1) {
    var uA = abs * 1.0e3;
    return (ma < 0 ? '-' : '') + uA.toFixed(2) + ' μA';
  }
  return ma.toFixed(2) + ' mA';
}

/**
 * Apply state to UI sliders, telemetry readouts, 3D meshes, flow particles, and schematic
 */
function applyDiodeState() {
  var state = window.getDiodeState();

  // 1. Update Bias Voltage Slider & Value
  var vaSlider = document.getElementById('va-slider');
  var vaVal = document.getElementById('va-val');
  if (vaSlider && Math.abs(parseFloat(vaSlider.value) - state.va) > 0.01) {
    vaSlider.value = state.va.toFixed(2);
  }
  if (vaVal) {
    vaVal.textContent = (state.va >= 0 ? '+' : '') + state.va.toFixed(2) + ' V';
  }

  // 2. Update Acceptor Doping Slider & Value
  var naSlider = document.getElementById('na-slider');
  var naVal = document.getElementById('na-val');
  if (naSlider && Math.abs(parseFloat(naSlider.value) - currentLogNa) > 0.05) {
    naSlider.value = currentLogNa.toFixed(1);
  }
  if (naVal) {
    naVal.textContent = formatDoping(state.na);
  }

  // 3. Update Donor Doping Slider & Value
  var ndSlider = document.getElementById('nd-slider');
  var ndVal = document.getElementById('nd-val');
  if (ndSlider && Math.abs(parseFloat(ndSlider.value) - currentLogNd) > 0.05) {
    ndSlider.value = currentLogNd.toFixed(1);
  }
  if (ndVal) {
    ndVal.textContent = formatDoping(state.nd);
  }

  // 4. Update Temperature Slider & Value
  var tempSlider = document.getElementById('temp-slider');
  var tempVal = document.getElementById('temp-val');
  if (tempSlider && parseInt(tempSlider.value, 10) !== currentTemp) {
    tempSlider.value = currentTemp;
  }
  if (tempVal) {
    tempVal.textContent = currentTemp + ' K';
  }

  // 5. Operating Region Badge & Presets
  var regionPill = document.getElementById('diode-region-pill');
  if (regionPill) {
    regionPill.textContent = state.regimeLabel;
    regionPill.className = 'region-pill ' + state.regimeCode;
  }

  var presetSeg = document.getElementById('diode-preset-seg');
  if (presetSeg) {
    presetSeg.querySelectorAll('button').forEach(function (btn) {
      var p = btn.dataset.preset;
      btn.classList.toggle('active', (state.regimeCode === p));
    });
  }

  // 6. Docked Panel Telemetry Readouts
  var rVa = document.getElementById('tele-va');
  var rI = document.getElementById('tele-i');
  var rVbi = document.getElementById('tele-vbi');
  var rW = document.getElementById('tele-w');
  var rXp = document.getElementById('tele-xp');
  var rXn = document.getElementById('tele-xn');
  var rEmax = document.getElementById('tele-emax');
  var rVbr = document.getElementById('tele-vbr');
  var rDesc = document.getElementById('diode-state-desc');

  if (rVa) rVa.textContent = (state.va >= 0 ? '+' : '') + state.va.toFixed(2) + ' V';
  if (rI) rI.textContent = formatCurrent(state.currentMa);
  if (rVbi) rVbi.textContent = state.vbi.toFixed(2) + ' V';
  if (rW) rW.textContent = (state.wNm < 1000) ? state.wNm.toFixed(0) + ' nm' : state.wUm.toFixed(2) + ' μm';
  if (rXp) rXp.textContent = state.xpNm.toFixed(0) + ' nm';
  if (rXn) rXn.textContent = state.xnNm.toFixed(0) + ' nm';
  if (rEmax) rEmax.textContent = (state.emax / 1e5).toFixed(1) + '×10⁵ V/cm';
  if (rVbr) rVbr.textContent = state.vbr.toFixed(1) + ' V (' + (state.vbr < 5 ? 'Zener' : 'Avalanche') + ')';

  if (rDesc) {
    if (state.regime === 'EQUILIBRIUM') {
      rDesc.textContent = 'Thermal equilibrium · Barrier Vbi = ' + state.vbi.toFixed(2) + 'V';
    } else if (state.regime === 'FORWARD') {
      rDesc.textContent = 'Forward conduction · Carrier injection across narrowed W';
    } else if (state.regime === 'REVERSE') {
      rDesc.textContent = 'Reverse bias · Depletion layer widened to ' + state.wUm.toFixed(2) + 'μm';
    } else if (state.regime === 'ZENER') {
      rDesc.textContent = 'Zener breakdown · Quantum band-to-band electron tunneling';
    } else {
      rDesc.textContent = 'Avalanche breakdown · Impact ionization carrier multiplication';
    }
  }

  // 7. Update 2D Schematic SVG Elements & Annotations
  updateSchematicSVG(state);

  // 8. Update 3D Geometry (Depletion width, fixed ions, breakdown glow)
  if (typeof updateDiode3DGeometry === 'function') {
    updateDiode3DGeometry(state);
  }

  // 9. Rebuild 3D Carrier/Current particles
  if (typeof rebuildFlowSimulation === 'function') {
    rebuildFlowSimulation();
  }

  // 10. Update Graphs
  if (typeof renderGraphs === 'function') {
    renderGraphs();
  }
}

/**
 * 2D Schematic SVG telemetry & animated flow arrow updates
 */
function updateSchematicSVG(state) {
  var schVa = document.getElementById('sch-va-val');
  var schI = document.getElementById('sch-i-val');
  var schMode = document.getElementById('sch-diode-mode');
  var schArrow = document.getElementById('sch-current-arrow');
  var schArrowHead = document.getElementById('sch-arrow-head');

  if (schVa) schVa.textContent = 'VA = ' + (state.va >= 0 ? '+' : '') + state.va.toFixed(2) + ' V';
  if (schI) schI.textContent = 'I = ' + formatCurrent(state.currentMa);
  if (schMode) {
    schMode.textContent = state.regimeLabel.toUpperCase();
    schMode.setAttribute('fill', state.regime === 'FORWARD' ? '#57cf8f' : (state.regime === 'EQUILIBRIUM' ? '#5fd9c4' : (state.regime === 'REVERSE' ? '#e6a23c' : '#f43f5e')));
  }

  // Flow arrow direction:
  // Forward: Anode -> Cathode (Left to Right)
  // Breakdown: Cathode -> Anode (Right to Left)
  // Reverse/Equilibrium: Hide or dim arrow
  if (schArrow && schArrowHead) {
    if (state.regime === 'FORWARD') {
      schArrow.style.display = 'block';
      schArrowHead.style.display = 'block';
      schArrow.setAttribute('x1', '130');
      schArrow.setAttribute('x2', '240');
      schArrowHead.setAttribute('points', '240,75 250,80 240,85');
      schArrow.setAttribute('stroke', '#57cf8f');
      schArrowHead.setAttribute('fill', '#57cf8f');
    } else if (state.regime === 'ZENER' || state.regime === 'AVALANCHE' || state.regime === 'MIXED') {
      schArrow.style.display = 'block';
      schArrowHead.style.display = 'block';
      schArrow.setAttribute('x1', '250');
      schArrow.setAttribute('x2', '140');
      schArrowHead.setAttribute('points', '140,75 130,80 140,85');
      schArrow.setAttribute('stroke', '#f43f5e');
      schArrowHead.setAttribute('fill', '#f43f5e');
    } else {
      schArrow.style.display = 'none';
      schArrowHead.style.display = 'none';
    }
  }
}

/**
 * Initialize all slider inputs and preset button listeners
 */
function initLogicControls() {
  // 1. Bias Voltage Slider
  var vaSlider = document.getElementById('va-slider');
  if (vaSlider) {
    vaSlider.addEventListener('input', function () {
      currentVa = parseFloat(vaSlider.value);
      applyDiodeState();
    });
  }

  // 2. Acceptor Doping Slider (Log scale)
  var naSlider = document.getElementById('na-slider');
  if (naSlider) {
    naSlider.addEventListener('input', function () {
      currentLogNa = parseFloat(naSlider.value);
      applyDiodeState();
    });
  }

  // 3. Donor Doping Slider (Log scale)
  var ndSlider = document.getElementById('nd-slider');
  if (ndSlider) {
    ndSlider.addEventListener('input', function () {
      currentLogNd = parseFloat(ndSlider.value);
      applyDiodeState();
    });
  }

  // 4. Temperature Slider
  var tempSlider = document.getElementById('temp-slider');
  if (tempSlider) {
    tempSlider.addEventListener('input', function () {
      currentTemp = parseInt(tempSlider.value, 10);
      applyDiodeState();
    });
  }

  // 5. Operating Presets Buttons
  var presetSeg = document.getElementById('diode-preset-seg');
  if (presetSeg) {
    presetSeg.querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var p = btn.dataset.preset;
        if (p === 'breakdown') {
          var state = window.getDiodeState();
          currentVa = -(state.vbr + 0.5);
        } else if (p === 'reverse') {
          currentVa = -5.0;
        } else if (p === 'equilibrium') {
          currentVa = 0.0;
        } else if (p === 'forward') {
          currentVa = 0.70;
        }
        applyDiodeState();
      });
    });
  }

  // 6. Doping Configuration Presets
  var dopingPresetBtns = document.querySelectorAll('.doping-preset-btn');
  dopingPresetBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      dopingPresetBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var type = btn.dataset.doping;
      if (type === 'standard') {
        currentLogNa = 17.0; // 10^17 cm^-3
        currentLogNd = 16.0; // 10^16 cm^-3 (Avalanche breakdown > 6V)
      } else if (type === 'zener') {
        currentLogNa = 18.5; // 3x10^18 cm^-3
        currentLogNd = 18.5; // 3x10^18 cm^-3 (Heavy doping -> Zener breakdown < 5V)
      } else if (type === 'symmetric') {
        currentLogNa = 16.0;
        currentLogNd = 16.0;
      }
      applyDiodeState();
    });
  });

  applyDiodeState();
}
