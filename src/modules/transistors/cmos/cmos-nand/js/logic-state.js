/* CMOS 2-Input NAND (NAND2) Logic State Machine, Transfer Characteristic Graph, & Telemetry */

var currentA = 'off'; // 0.0 .. 1.0 or 'off'
var currentB = 'off'; // 0.0 .. 1.0 or 'off'
var currentSweep = 'va'; // 'va' | 'vb' | 'both'
var isCircuitFrozen = true;

var TINT_ON = { color: 0x2fbf7a, intensity: 0.40 };
var TINT_OFF = { color: 0x3a1414, intensity: 0.20 };
var TINT_PARTIAL = { color: 0xd97706, intensity: 0.32 };

/* Analytical NAND2 Voltage Transfer Characteristic function (VDD = 1.00V) */
function calcNandVout(va, vb) {
  if (va === 'off' || vb === 'off') return null;
  var vtn = 0.40;
  var vtp = 0.40;
  var vdd = 1.00;

  // Series pull-down requires both gates above VTN to conduct
  if (va <= vtn || vb <= vtn) {
    return 1.00;
  }

  var gnA = va - vtn;
  var gnB = vb - vtn;
  var gn = (gnA * gnB) / (gnA + gnB);

  var gpA = Math.max(0.0, (vdd - vtp) - va);
  var gpB = Math.max(0.0, (vdd - vtp) - vb);
  var gp = gpA + gpB;

  if (gp <= 1e-6) {
    return 0.00;
  }

  var ratio = gn / gp;
  var vout = 1.0 / (1.0 + Math.pow(ratio, 3.0));
  return Math.max(0.0, Math.min(1.0, vout));
}

/* Transistor Operating Regions */
function computeTransistorRegions(va, vb, vout) {
  if (va === 'off' || vb === 'off' || vout === null) {
    return {
      mp1: 'SUBTHRESHOLD',
      mp2: 'SUBTHRESHOLD',
      mn1: 'SUBTHRESHOLD',
      mn2: 'SUBTHRESHOLD',
      vx: 0
    };
  }

  var vdd = 1.00;
  var vtn = 0.40;
  var vtp = 0.40;

  // MP1 (PMOS A): S = VDD, G = VA, D = VOUT
  var vovP1 = (vdd - va) - vtp;
  var vsdP1 = vdd - vout;
  var regMP1;
  if (vovP1 <= 0.001) regMP1 = 'CUTOFF';
  else if (vsdP1 < vovP1) regMP1 = 'LINEAR';
  else regMP1 = 'SATURATION';

  // MP2 (PMOS B): S = VDD, G = VB, D = VOUT
  var vovP2 = (vdd - vb) - vtp;
  var vsdP2 = vdd - vout;
  var regMP2;
  if (vovP2 <= 0.001) regMP2 = 'CUTOFF';
  else if (vsdP2 < vovP2) regMP2 = 'LINEAR';
  else regMP2 = 'SATURATION';

  // Intermediate node Vx between MN1 and MN2
  var vx;
  if (va <= vtn) {
    vx = 0.00;
  } else {
    vx = Math.min(vout, 0.5 * vout);
  }

  // MN1 (NMOS A): S = GND, G = VA, D = Vx
  var vovN1 = va - vtn;
  var regMN1;
  if (vovN1 <= 0.001) regMN1 = 'CUTOFF';
  else if (vx < vovN1) regMN1 = 'LINEAR';
  else regMN1 = 'SATURATION';

  // MN2 (NMOS B): S = Vx, G = VB, D = VOUT
  var vovN2 = (vb - vx) - vtn;
  var vdsN2 = vout - vx;
  var regMN2;
  if (vovN2 <= 0.001) regMN2 = 'CUTOFF';
  else if (vdsN2 < vovN2) regMN2 = 'LINEAR';
  else regMN2 = 'SATURATION';

  return {
    mp1: regMP1,
    mp2: regMP2,
    mn1: regMN1,
    mn2: regMN2,
    vx: vx
  };
}

function computeNand2State(a, b) {
  var vout = calcNandVout(a, b);
  var frozen = (a === 'off' || b === 'off');
  var regions = computeTransistorRegions(a, b, vout);

  var mp1Conduction = frozen ? 'partial' : (regions.mp1 !== 'CUTOFF');
  var mp2Conduction = frozen ? 'partial' : (regions.mp2 !== 'CUTOFF');
  var mn1Conduction = frozen ? 'partial' : (regions.mn1 !== 'CUTOFF');
  var mn2Conduction = frozen ? 'partial' : (regions.mn2 !== 'CUTOFF');

  return {
    a: a,
    b: b,
    vout: vout,
    frozen: frozen,
    regions: regions,
    mp1: mp1Conduction,
    mp2: mp2Conduction,
    mn1: mn1Conduction,
    mn2: mn2Conduction
  };
}

function getCircuitStateSnapshot() {
  var s = computeNand2State(currentA, currentB);
  return {
    a: s.a === 'off' ? 'OFF' : (typeof s.a === 'number' ? s.a.toFixed(2) + 'V' : String(s.a)),
    b: s.b === 'off' ? 'OFF' : (typeof s.b === 'number' ? s.b.toFixed(2) + 'V' : String(s.b)),
    mp1: s.regions.mp1,
    mp2: s.regions.mp2,
    mn1: s.regions.mn1,
    mn2: s.regions.mn2,
    out: s.vout === null ? 'FLOATING' : s.vout.toFixed(2) + 'V'
  };
}

function setOnOffTint(meshId, stateVal) {
  if (typeof meshesById === 'undefined') return;
  var arr = meshesById[meshId];
  if (!arr || !arr.length) return;
  var tint = stateVal === true ? TINT_ON : (stateVal === 'partial' ? TINT_PARTIAL : TINT_OFF);

  for (var i = 0; i < arr.length; i++) {
    var m = arr[i];
    if (!m.material || !m.material.emissive) continue;
    m.userData.baseEmissive = tint.color;
    m.userData.baseEmissiveIntensity = tint.intensity;

    if (typeof selectedMeshes !== 'undefined' && selectedMeshes.indexOf(m) !== -1) {
      continue;
    }
    m.material.emissive.setHex(tint.color);
    m.material.emissiveIntensity = tint.intensity;
  }
}

function setMetalPulsing(idsMap) {
  if (typeof allMeshes === 'undefined') return;
  for (var i = 0; i < allMeshes.length; i++) {
    var m = allMeshes[i];
    if (m.userData.layer !== 'metal') continue;
    var active = Boolean(idsMap[m.userData.id]);
    m.userData.pulsing = active;
    if (!active && m.material && m.material.emissive) {
      m.userData.baseEmissive = 0x000000;
      m.userData.baseEmissiveIntensity = 0;
      if (typeof selectedMeshes === 'undefined' || selectedMeshes.indexOf(m) === -1) {
        m.material.emissive.setHex(0x000000);
        m.material.emissiveIntensity = 0;
      }
    }
  }
}

function applyLogicTint() {
  var s = computeNand2State(currentA, currentB);
  isCircuitFrozen = s.frozen;

  /* MP1 diffusions & channel */
  setOnOffTint('pmosASrc', s.mp1);
  setOnOffTint('pmosASrcSde', s.mp1);
  setOnOffTint('pmosADrnSde', s.mp1);
  setOnOffTint('chMP1', s.mp1);

  /* MP2 diffusions & channel */
  setOnOffTint('pmosBSrc', s.mp2);
  setOnOffTint('pmosBDrnSde', s.mp2);
  setOnOffTint('pmosBSrcSde', s.mp2);
  setOnOffTint('chMP2', s.mp2);

  /* Shared PMOS drain */
  var sharedPmosState = (s.mp1 === true || s.mp2 === true)
    ? true
    : ((s.mp1 === 'partial' || s.mp2 === 'partial') ? 'partial' : false);
  setOnOffTint('pmosSharedDrn', sharedPmosState);

  /* MN1 diffusions & channel */
  setOnOffTint('nmosASrc', s.mn1);
  setOnOffTint('nmosASrcSde', s.mn1);
  setOnOffTint('nmosADrnSde', s.mn1);
  setOnOffTint('chMN1', s.mn1);

  /* MN2 diffusions & channel */
  setOnOffTint('nmosBDrn', s.mn2);
  setOnOffTint('nmosBSrcSde', s.mn2);
  setOnOffTint('nmosBDrnSde', s.mn2);
  setOnOffTint('chMN2', s.mn2);

  /* Series N+ Bridge */
  var midState;
  if (s.mn1 === true && s.mn2 === true) {
    midState = true;
  } else if (s.mn1 === 'partial' || s.mn2 === 'partial') {
    midState = 'partial';
  } else {
    midState = false;
  }
  setOnOffTint('nmosMidNode', midState);

  /* Active Metal-1 pulsing routes */
  var pulseIds = {};
  if (!s.frozen) {
    if (s.vout !== null && s.vout >= 0.50) {
      if (s.mp1 === true) {
        pulseIds.vddRail = 1; pulseIds.vddStubPmosA = 1; pulseIds.outPmosBranch = 1; pulseIds.outSpine = 1; pulseIds.outPin = 1;
      }
      if (s.mp2 === true) {
        pulseIds.vddRail = 1; pulseIds.vddStubPmosB = 1; pulseIds.outPmosBranch = 1; pulseIds.outSpine = 1; pulseIds.outPin = 1;
      }
    } else if (s.vout !== null) {
      pulseIds.outPin = 1; pulseIds.outSpine = 1; pulseIds.outNmosBranch = 1; pulseIds.gndStubNmosA = 1; pulseIds.gndRail = 1;
    }
  }
  setMetalPulsing(pulseIds);

  if (s.frozen && typeof hideAllFlowMarkers === 'function') {
    hideAllFlowMarkers();
  }
  if (typeof refreshFlowGuides === 'function') {
    refreshFlowGuides();
  }
}

function updateTelemetryAndUi() {
  var s = computeNand2State(currentA, currentB);

  // Topbar input buttons
  var aBtns = document.querySelectorAll('#input-a-group .seg-btn[data-a]');
  for (var i = 0; i < aBtns.length; i++) {
    var vaAttr = aBtns[i].getAttribute('data-a');
    var isMatchA = (vaAttr === 'off' && currentA === 'off') ||
                   (vaAttr === '0' && currentA === 0) ||
                   (vaAttr === '1' && currentA === 1);
    aBtns[i].classList.toggle('active', isMatchA);
  }

  var bBtns = document.querySelectorAll('#input-b-group .seg-btn[data-b]');
  for (var j = 0; j < bBtns.length; j++) {
    var vbAttr = bBtns[j].getAttribute('data-b');
    var isMatchB = (vbAttr === 'off' && currentB === 'off') ||
                   (vbAttr === '0' && currentB === 0) ||
                   (vbAttr === '1' && currentB === 1);
    bBtns[j].classList.toggle('active', isMatchB);
  }

  // Sliders and values
  var vaSlider = document.getElementById('va-slider');
  var vbSlider = document.getElementById('vb-slider');
  var vaVal = document.getElementById('va-val');
  var vbVal = document.getElementById('vb-val');

  if (vaSlider && currentA !== 'off') vaSlider.value = Number(currentA).toFixed(2);
  if (vbSlider && currentB !== 'off') vbSlider.value = Number(currentB).toFixed(2);

  if (vaVal) vaVal.textContent = currentA === 'off' ? 'OFF' : Number(currentA).toFixed(2) + ' V';
  if (vbVal) vbVal.textContent = currentB === 'off' ? 'OFF' : Number(currentB).toFixed(2) + ' V';

  // Presets
  var presetBtns = document.querySelectorAll('#nand-preset-seg .dp-preset-btn');
  presetBtns.forEach(function(btn) {
    var p = btn.getAttribute('data-preset');
    var active = false;
    if (p === 'off') active = (currentA === 'off' || currentB === 'off');
    else if (p === '00') active = (currentA === 0 && currentB === 0);
    else if (p === '01') active = (currentA === 0 && currentB === 1);
    else if (p === '10') active = (currentA === 1 && currentB === 0);
    else if (p === '11') active = (currentA === 1 && currentB === 1);
    else if (p === 'vm') active = (Math.abs(currentA - 0.50) < 0.03 && Math.abs(currentB - 0.50) < 0.03);
    btn.classList.toggle('active', active);
  });

  // Readouts
  var vaReadout = document.getElementById('iv-va-readout');
  var vbReadout = document.getElementById('iv-vb-readout');
  var voutReadout = document.getElementById('iv-vout-readout');
  var logicReadout = document.getElementById('iv-logic-readout');
  var stateDesc = document.getElementById('iv-state-desc');

  if (vaReadout) vaReadout.textContent = currentA === 'off' ? 'OFF' : Number(currentA).toFixed(2) + ' V';
  if (vbReadout) vbReadout.textContent = currentB === 'off' ? 'OFF' : Number(currentB).toFixed(2) + ' V';

  if (s.frozen) {
    if (voutReadout) voutReadout.textContent = 'FLOATING';
    if (logicReadout) logicReadout.textContent = 'HIGH-Z';
    if (stateDesc) stateDesc.textContent = 'Inputs Floating · High-Z Output (Stationary Flow)';
  } else {
    var voutVal = s.vout;
    if (voutReadout) voutReadout.textContent = voutVal.toFixed(2) + ' V';

    if (voutVal >= 0.70) {
      if (logicReadout) { logicReadout.textContent = '1 (HIGH)'; logicReadout.style.color = 'var(--cyan)'; }
      if (stateDesc) {
        stateDesc.textContent = (currentA <= 0.40 && currentB <= 0.40)
          ? 'Pull-Up Parallel: Both MP1 & MP2 Conduct'
          : (currentA <= 0.40 ? 'Pull-Up MP1 Conducts (VA LOW)' : 'Pull-Up MP2 Conducts (VB LOW)');
      }
    } else if (voutVal <= 0.30) {
      if (logicReadout) { logicReadout.textContent = '0 (LOW)'; logicReadout.style.color = 'var(--gold)'; }
      if (stateDesc) stateDesc.textContent = 'Pull-Down Series: Both MN1 & MN2 Conduct to GND';
    } else {
      if (logicReadout) { logicReadout.textContent = 'TRANSITION'; logicReadout.style.color = 'var(--amber)'; }
      if (stateDesc) stateDesc.textContent = 'Switching Transition Region (High Dynamic Gain)';
    }
  }

  // 4-Transistor Operating Regions
  var rMP1 = document.getElementById('tx-mp1-reg');
  var rMP2 = document.getElementById('tx-mp2-reg');
  var rMN1 = document.getElementById('tx-mn1-reg');
  var rMN2 = document.getElementById('tx-mn2-reg');

  function colorRegion(el, reg) {
    if (!el) return;
    el.textContent = reg;
    if (reg === 'LINEAR') el.style.color = 'var(--cyan)';
    else if (reg === 'SATURATION') el.style.color = 'var(--amber)';
    else if (reg === 'CUTOFF') el.style.color = 'var(--coral)';
    else el.style.color = 'var(--muted)';
  }

  colorRegion(rMP1, s.regions.mp1);
  colorRegion(rMP2, s.regions.mp2);
  colorRegion(rMN1, s.regions.mn1);
  colorRegion(rMN2, s.regions.mn2);

  // Sync modal telemetry readouts if modal is present
  var mVa = document.getElementById('modal-readout-va');
  var mVb = document.getElementById('modal-readout-vb');
  var mVout = document.getElementById('modal-readout-vout');
  var mLog = document.getElementById('modal-readout-logic');
  var mMP1 = document.getElementById('modal-mp1-reg');
  var mMP2 = document.getElementById('modal-mp2-reg');
  var mMN1 = document.getElementById('modal-mn1-reg');
  var mMN2 = document.getElementById('modal-mn2-reg');

  if (mVa) mVa.textContent = currentA === 'off' ? 'OFF' : Number(currentA).toFixed(2) + ' V';
  if (mVb) mVb.textContent = currentB === 'off' ? 'OFF' : Number(currentB).toFixed(2) + ' V';
  if (mVout) mVout.textContent = s.frozen ? 'FLOATING' : s.vout.toFixed(2) + ' V';
  if (mLog) mLog.textContent = s.frozen ? 'HIGH-Z' : (s.vout >= 0.70 ? '1 (HIGH)' : (s.vout <= 0.30 ? '0 (LOW)' : 'TRANSITION'));

  colorRegion(mMP1, s.regions.mp1);
  colorRegion(mMP2, s.regions.mp2);
  colorRegion(mMN1, s.regions.mn1);
  colorRegion(mMN2, s.regions.mn2);

  if (typeof updateSchematicVisuals === 'function') {
    updateSchematicVisuals(s);
  }
  if (typeof updateVoiceContext === 'function') {
    updateVoiceContext();
  }
}

/* =====================================================================
   NAND2 VOLTAGE TRANSFER CHARACTERISTIC CANVAS DRAWING
   ===================================================================== */
function drawTransferOnCanvas(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var w = canvas.width;
  var h = canvas.height;

  // Colors
  var colBg = isLight ? '#f8fafc' : '#0c1017';
  var colGrid = isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.07)';
  var colAxis = isLight ? '#94a3b8' : '#334155';
  var colText = isLight ? '#64748b' : '#94a3b8';
  var colCurve = isLight ? '#0284c7' : '#00f0ff';
  var colPt = isLight ? '#0ea5e9' : '#38bdf8';
  var colShade = isLight ? 'rgba(2, 132, 199, 0.05)' : 'rgba(0, 240, 255, 0.05)';

  ctx.fillStyle = colBg;
  ctx.fillRect(0, 0, w, h);

  // Graph plotting margins
  var padLeft = 40;
  var padRight = 18;
  var padTop = 24;
  var padBottom = 32;
  var plotW = w - padLeft - padRight;
  var plotH = h - padTop - padBottom;

  function toPxX(vin) { return padLeft + (vin / 1.0) * plotW; }
  function toPxY(vout) { return padTop + (1.0 - (vout / 1.0)) * plotH; }

  // Draw 5 Region background bands if sweeping VA or VB with fixed HIGH or BOTH
  var fixedVal = (currentSweep === 'va' ? currentB : currentA);
  var isInvertingCurve = (currentSweep === 'both') || (fixedVal !== 'off' && Number(fixedVal) >= 0.50);

  if (isInvertingCurve) {
    var xVtn = toPxX(0.40);
    var xVm = toPxX(0.52);
    var xVtp = toPxX(0.60);

    // Region 1: Cutoff NMOS, Linear PMOS
    ctx.fillStyle = isLight ? 'rgba(5, 150, 105, 0.04)' : 'rgba(47, 191, 122, 0.04)';
    ctx.fillRect(padLeft, padTop, xVtn - padLeft, plotH);

    // Region 2 & 4: Transition
    ctx.fillStyle = isLight ? 'rgba(217, 119, 6, 0.04)' : 'rgba(245, 158, 11, 0.04)';
    ctx.fillRect(xVtn, padTop, xVtp - xVtn, plotH);

    // Region 5: Cutoff PMOS, Linear NMOS
    ctx.fillStyle = isLight ? 'rgba(37, 99, 235, 0.04)' : 'rgba(79, 134, 201, 0.04)';
    ctx.fillRect(xVtp, padTop, padLeft + plotW - xVtp, plotH);

    // Region text labels along the top
    ctx.font = '9px monospace';
    ctx.fillStyle = colText;
    ctx.textAlign = 'center';
    ctx.fillText('R1', padLeft + (xVtn - padLeft) / 2, padTop - 8);
    ctx.fillText('R2-R4', xVtn + (xVtp - xVtn) / 2, padTop - 8);
    ctx.fillText('R5', xVtp + (padLeft + plotW - xVtp) / 2, padTop - 8);
  }

  // Grid lines
  ctx.strokeStyle = colGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (var v = 0.2; v <= 0.8; v += 0.2) {
    var gx = toPxX(v);
    var gy = toPxY(v);
    ctx.moveTo(gx, padTop); ctx.lineTo(gx, padTop + plotH);
    ctx.moveTo(padLeft, gy); ctx.lineTo(padLeft + plotW, gy);
  }
  ctx.stroke();

  // Axis lines
  ctx.strokeStyle = colAxis;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padLeft, padTop);
  ctx.lineTo(padLeft, padTop + plotH);
  ctx.lineTo(padLeft + plotW, padTop + plotH);
  ctx.stroke();

  // Tick marks and numbers
  ctx.font = '10px monospace';
  ctx.fillStyle = colText;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (var ty = 0.0; ty <= 1.0; ty += 0.5) {
    var yPos = toPxY(ty);
    ctx.fillText(ty.toFixed(1), padLeft - 6, yPos);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (var tx = 0.0; tx <= 1.0; tx += 0.5) {
    var xPos = toPxX(tx);
    ctx.fillText(tx.toFixed(1), xPos, padTop + plotH + 6);
  }

  // Axis Titles
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = colText;
  var xTitle = currentSweep === 'va'
    ? 'V_A (Gate A Input) [V]'
    : (currentSweep === 'vb' ? 'V_B (Gate B Input) [V]' : 'V_IN (V_A = V_B) [V]');
  ctx.fillText(xTitle, padLeft + plotW / 2, padTop + plotH + 18);

  ctx.save();
  ctx.translate(12, padTop + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('V_OUT [V]', 0, 0);
  ctx.restore();

  // Fixed parameter annotation
  if (currentSweep !== 'both') {
    var fixedLabel = currentSweep === 'va' ? 'V_B' : 'V_A';
    var fixedStr = fixedVal === 'off' ? 'OFF (High-Z)' : Number(fixedVal).toFixed(2) + 'V';
    ctx.font = '10px monospace';
    ctx.fillStyle = isLight ? '#b45309' : '#fbbf24';
    ctx.textAlign = 'right';
    ctx.fillText('Fixed ' + fixedLabel + ' = ' + fixedStr, padLeft + plotW - 4, padTop + 14);
  }

  // Draw Transfer Characteristic Curve
  ctx.beginPath();
  ctx.strokeStyle = colCurve;
  ctx.lineWidth = 2.5;

  var steps = 100;
  for (var s = 0; s <= steps; s++) {
    var vin = s / steps;
    var vaEff = currentSweep === 'va' ? vin : (currentSweep === 'both' ? vin : (currentA === 'off' ? 1.0 : currentA));
    var vbEff = currentSweep === 'vb' ? vin : (currentSweep === 'both' ? vin : (currentB === 'off' ? 1.0 : currentB));

    var voutEff = calcNandVout(vaEff, vbEff);
    if (voutEff === null) voutEff = 1.00;

    var px = toPxX(vin);
    var py = toPxY(voutEff);
    if (s === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Draw Current Operating Point Dot
  var currentVin = (currentSweep === 'va')
    ? (currentA === 'off' ? null : currentA)
    : (currentSweep === 'vb'
        ? (currentB === 'off' ? null : currentB)
        : (currentA === 'off' ? null : currentA));

  if (currentVin !== null) {
    var curVout = calcNandVout(currentA === 'off' ? 1.0 : currentA, currentB === 'off' ? 1.0 : currentB);
    if (curVout !== null) {
      var dotX = toPxX(currentVin);
      var dotY = toPxY(curVout);

      // Dashed projection guidelines
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(dotX, padTop + plotH); ctx.lineTo(dotX, dotY);
      ctx.moveTo(padLeft, dotY); ctx.lineTo(dotX, dotY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Glow halo
      ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.25)' : 'rgba(0, 240, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
      ctx.fill();

      // Dot core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colPt;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Coordinate badge
      var coordText = '(' + currentVin.toFixed(2) + 'V, ' + curVout.toFixed(2) + 'V)';
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
      var badgeW = ctx.measureText(coordText).width + 8;
      var badgeH = 16;
      var bx = Math.min(padLeft + plotW - badgeW - 2, Math.max(padLeft + 2, dotX + 8));
      var by = Math.max(padTop + 4, dotY - 18);

      ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(15, 23, 42, 0.90)';
      ctx.fillRect(bx, by, badgeW, badgeH);
      ctx.strokeStyle = colAxis;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, badgeW, badgeH);

      ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(coordText, bx + 4, by + badgeH / 2);
    }
  }
}

function drawTransferGraph() {
  drawTransferOnCanvas('iv-canvas');
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  if (modalBackdrop && !modalBackdrop.classList.contains('hidden')) {
    drawTransferOnCanvas('iv-modal-canvas');
  }
}
window.drawTransferGraph = drawTransferGraph;

/* Set inputs with full state propagation */
function setInputs(a, b) {
  currentA = (a === 'off') ? 'off' : Math.max(0, Math.min(1.0, Number(a)));
  currentB = (b === 'off') ? 'off' : Math.max(0, Math.min(1.0, Number(b)));
  applyLogicTint();
  updateTelemetryAndUi();
  drawTransferGraph();
}
window.setInputs = setInputs;

/* Setup interactive pointer modulation on a canvas */
function setupCanvasDrag(canvasId) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  var isDragging = false;
  function updateFromPointer(e) {
    var rect = canvas.getBoundingClientRect();
    var padLeft = 40;
    var padRight = 18;
    var plotW = canvas.width - padLeft - padRight;
    var scale = canvas.width / rect.width;

    var clickX = (e.clientX - rect.left) * scale;
    var vin = (clickX - padLeft) / plotW;
    vin = Math.max(0, Math.min(1.0, vin));
    vin = Math.round(vin * 100) / 100;

    if (currentSweep === 'va') {
      setInputs(vin, currentB === 'off' ? 1.0 : currentB);
    } else if (currentSweep === 'vb') {
      setInputs(currentA === 'off' ? 1.0 : currentA, vin);
    } else {
      setInputs(vin, vin);
    }
  }

  canvas.addEventListener('pointerdown', function(e) {
    isDragging = true;
    canvas.setPointerCapture(e.pointerId);
    updateFromPointer(e);
  });

  canvas.addEventListener('pointermove', function(e) {
    if (!isDragging) return;
    updateFromPointer(e);
  });

  function stopDrag(e) {
    if (isDragging) {
      isDragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
    }
  }
  canvas.addEventListener('pointerup', stopDrag);
  canvas.addEventListener('pointercancel', stopDrag);
}

/* Initialize all Logic State, Sliders, Sweep, and Modal controls */
function initLogicStateControls() {
  // Topbar Input Buttons
  document.querySelectorAll('#input-a-group .seg-btn[data-a]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var val = btn.getAttribute('data-a');
      setInputs(val === 'off' ? 'off' : Number(val), currentB);
    });
  });

  document.querySelectorAll('#input-b-group .seg-btn[data-b]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var val = btn.getAttribute('data-b');
      setInputs(currentA, val === 'off' ? 'off' : Number(val));
    });
  });

  // Voltage Sliders
  var vaSlider = document.getElementById('va-slider');
  var vbSlider = document.getElementById('vb-slider');

  if (vaSlider) {
    vaSlider.addEventListener('input', function() {
      var val = parseFloat(vaSlider.value);
      setInputs(val, currentB === 'off' ? 1.0 : currentB);
    });
  }

  if (vbSlider) {
    vbSlider.addEventListener('input', function() {
      var val = parseFloat(vbSlider.value);
      setInputs(currentA === 'off' ? 1.0 : currentA, val);
    });
  }

  // Presets
  var presetSeg = document.getElementById('nand-preset-seg');
  if (presetSeg) {
    presetSeg.addEventListener('click', function(e) {
      var btn = e.target.closest('.dp-preset-btn');
      if (!btn) return;
      var p = btn.getAttribute('data-preset');
      if (p === '00') setInputs(0.00, 0.00);
      else if (p === '01') setInputs(0.00, 1.00);
      else if (p === '10') setInputs(1.00, 0.00);
      else if (p === '11') setInputs(1.00, 1.00);
      else if (p === 'vm') setInputs(0.50, 0.50);
      else if (p === 'off') setInputs('off', 'off');
    });
  }

  // Sweep Mode Selector
  var sweepSeg = document.getElementById('vtc-sweep-seg');
  if (sweepSeg) {
    sweepSeg.addEventListener('click', function(e) {
      var btn = e.target.closest('button[data-sweep]');
      if (!btn) return;
      currentSweep = btn.getAttribute('data-sweep');
      sweepSeg.querySelectorAll('button').forEach(function(b) {
        b.classList.toggle('active', b === btn);
      });
      drawTransferGraph();
    });
  }

  // Modal Expand & Close Logic
  var expandBtn = document.getElementById('iv-expand-btn');
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalClose = document.getElementById('iv-modal-close');

  function openModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.remove('hidden');
    drawTransferOnCanvas('iv-modal-canvas');
  }

  function closeModal() {
    if (!modalBackdrop) return;
    modalBackdrop.classList.add('hidden');
  }

  if (expandBtn) expandBtn.addEventListener('click', openModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', function(e) {
      if (e.target === modalBackdrop) closeModal();
    });
  }

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalBackdrop && !modalBackdrop.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Setup interactive pointer modulation on both canvases
  setupCanvasDrag('iv-canvas');
  setupCanvasDrag('iv-modal-canvas');

  // Initial setup: start in 'off' state
  setInputs('off', 'off');
}

initLogicStateControls();
