/**
 * logic-state.js - Depletion-Mode NMOS CAD Viewer
 * Interactive Device Scaling Physics & Telemetry + Live ID-VDS Curves:
 * - Continuous geometry-dependent equations for C_ox, W/L, V_TH roll-off, DIBL,
 *   velocity saturation (V_Dsat), and channel-length modulation (lambda proportional to 1/L).
 * - Preserves D-NMOS negative threshold behavior (normally ON at V_GS = 0V),
 *   depletion mode (V_TH < V_GS < 0V), and enhancement mode (V_GS > 0V).
 */

var currentVgs = 0.00; // Normally ON at 0.00V
var currentVds = 0.80; // Active bias
var geomL = 28;        // nm (20..200)
var geomW = 120;       // nm (40..400)
var geomTox = 2.0;     // nm (1.2..10.0)
var lockYAxis = false;
var lockedYMax = null;

// Physical constants (SiO2 gate dielectric & electron velocity saturation)
var EPS_0 = 8.854187817e-12; // F/m
var K_OX = 3.9;
var EPS_OX = K_OX * EPS_0;
var MU_N = 0.030;            // Effective low-field electron mobility (m^2 / V*s)
var E_SAT = 5.0e6;           // Critical field for velocity saturation (V/m)
var LC_ROLLOFF_NM = 25.0;    // Characteristic SCE roll-off decay length (nm)

function computeThresholdDetails(vds, L_nm, tox_nm) {
  var L = Math.max(20, Math.min(200, Number(L_nm) || 28));
  var tox = Math.max(1.2, Math.min(10.0, Number(tox_nm) || 2.0));
  var vd = Math.max(0, Number(vds) || 0);

  // D-NMOS has negative V_TH due to built-in donor channel implant (~ -0.80V baseline at tox = 2.0 nm).
  // Thicker gate oxide weakens vertical gate depletion authority -> slightly more negative V_TH0.
  var vth0 = -0.76 - 0.02 * tox;

  // Short-channel V_TH roll-off & DIBL both shift V_TH more negative (harder to pinch off channel),
  // clamped at -1.12V so V_GS = -1.20V reliably reaches full Cutoff across all supported geometries.
  var rollOff = 0.14 * Math.exp(-L / LC_ROLLOFF_NM) * Math.sqrt(tox / 2.0);
  var diblEta = 0.085 * Math.pow(28.0 / L, 2.0) * Math.sqrt(tox / 2.0);
  var diblShift = diblEta * vd;

  var vth = Math.max(-1.12, vth0 - rollOff - diblShift);
  return {
    vth: vth,
    vth0: vth0,
    rollOff: rollOff,
    diblEta: diblEta
  };
}

function computeDnmosPoint(vgs, vds, L_nm, W_nm, tox_nm) {
  var L = Math.max(20, Math.min(200, Number(L_nm) || 28));
  var W = Math.max(40, Math.min(400, Number(W_nm) || 120));
  var tox = Math.max(1.2, Math.min(10.0, Number(tox_nm) || 2.0));
  var vd = Math.max(0, Number(vds) || 0);

  var L_m = L * 1e-9;
  var tox_m = tox * 1e-9;
  var cox = EPS_OX / tox_m;
  var wlRatio = W / L;
  var kp = MU_N * cox * wlRatio * 1000.0; // mA/V^2
  var lambda = 0.06 * (28.0 / L);         // 1/V, scales as 1/L

  var th = computeThresholdDetails(vd, L, tox);
  var vth = th.vth;
  var vov = Math.max(0, vgs - vth);
  var esatL = E_SAT * L_m;
  var vdsSat = vov > 0.0001 ? (vov * esatL) / (vov + esatL) : 0.0;

  var region = 'CUTOFF';
  var ids = 0.0;
  var deltaL_nm = 0.0;

  if (vov <= 0.001) {
    region = 'CUTOFF';
    ids = 0.0;
  } else if (vd < vdsSat) {
    region = 'LINEAR';
    ids = (kp / (1.0 + vd / esatL)) * (vov * vd - 0.5 * vd * vd);
  } else {
    region = 'SATURATION';
    var vdsDiff = vd - vdsSat;
    ids = 0.5 * kp * vov * vdsSat * (1.0 + lambda * vdsDiff);
    deltaL_nm = Math.min(0.8 * L, 5.5 * Math.sqrt(Math.max(0, vdsDiff)));
  }

  var mode = 'CUTOFF';
  if (vgs <= vth) {
    mode = 'CUTOFF';
  } else if (vgs < -0.02) {
    mode = 'DEPLETION';
  } else if (vgs <= 0.02) {
    mode = 'ZERO BIAS';
  } else {
    mode = 'ENHANCE';
  }

  var leff = Math.max(0.2 * L, L - deltaL_nm);
  var gState = (typeof window.getDeviceGeomState === 'function') ? window.getDeviceGeomState() : null;
  var modelL = gState ? gState.gateL : 2.0;
  var deltaL_scene = modelL * ((L - leff) / L);

  return {
    vgs: vgs,
    vds: vd,
    vth: vth,
    vov: vov,
    vdsSat: vdsSat,
    esatL: esatL,
    ids: Math.max(0, ids),
    region: region,
    mode: mode,
    deltaL: deltaL_scene,
    deltaL_nm: L - leff,
    leff: leff,
    L: L,
    W: W,
    tox: tox,
    wlRatio: wlRatio,
    kp: kp,
    cox: cox,
    lambda: lambda,
    diblEta: th.diblEta
  };
}

function calculateIds(testVgs, testVds) {
  var pt = computeDnmosPoint(testVgs, testVds, geomL, geomW, geomTox);
  return { ids: pt.ids, region: pt.region };
}
window.calculateIds = calculateIds;

window.getMosfetPhysicsState = function() {
  return computeDnmosPoint(currentVgs, currentVds, geomL, geomW, geomTox);
};

window.setMosfetGeometry = function(L_nm, W_nm, tox_nm) {
  if (typeof L_nm === 'number' && Number.isFinite(L_nm)) geomL = Math.max(20, Math.min(200, L_nm));
  if (typeof W_nm === 'number' && Number.isFinite(W_nm)) geomW = Math.max(40, Math.min(400, W_nm));
  if (typeof tox_nm === 'number' && Number.isFinite(tox_nm)) geomTox = Math.max(1.2, Math.min(10.0, tox_nm));
  applyLogicState();
};

function formatIdsText(ids) {
  if (ids < 0.0005) return '≈ 0 mA';
  if (ids < 0.1) return ids.toFixed(3) + ' mA';
  return ids.toFixed(2) + ' mA';
}

function syncGeometryControlsUI() {
  var lSlider = document.getElementById('geom-l-slider');
  var lVal = document.getElementById('geom-l-val');
  if (lSlider && Math.abs(parseFloat(lSlider.value) - geomL) > 0.1) lSlider.value = String(geomL);
  if (lVal) lVal.textContent = Math.round(geomL) + ' nm';

  var wSlider = document.getElementById('geom-w-slider');
  var wVal = document.getElementById('geom-w-val');
  if (wSlider && Math.abs(parseFloat(wSlider.value) - geomW) > 0.1) wSlider.value = String(geomW);
  if (wVal) wVal.textContent = Math.round(geomW) + ' nm';

  var toxSlider = document.getElementById('geom-tox-slider');
  var toxVal = document.getElementById('geom-tox-val');
  if (toxSlider && Math.abs(parseFloat(toxSlider.value) - geomTox) > 0.02) toxSlider.value = geomTox.toFixed(1);
  if (toxVal) toxVal.textContent = geomTox.toFixed(1) + ' nm';

  var presets = document.getElementById('geom-presets');
  if (presets) {
    presets.querySelectorAll('.geom-preset-btn').forEach(function(btn) {
      var pL = parseFloat(btn.dataset.l);
      var pW = parseFloat(btn.dataset.w);
      var pTox = parseFloat(btn.dataset.tox);
      var match = (Math.abs(pL - geomL) < 0.5 && Math.abs(pW - geomW) < 0.5 && Math.abs(pTox - geomTox) < 0.05);
      btn.classList.toggle('active', match);
    });
  }
}

function getNiceYMax(rawMax) {
  var m = Math.max(0.2, rawMax * 1.15);
  var exp = Math.pow(10, Math.floor(Math.log10(m)));
  var frac = m / exp;
  var nice;
  if (frac <= 1.2) nice = 1.2;
  else if (frac <= 1.5) nice = 1.5;
  else if (frac <= 2.0) nice = 2.0;
  else if (frac <= 2.5) nice = 2.5;
  else if (frac <= 3.0) nice = 3.0;
  else if (frac <= 4.0) nice = 4.0;
  else if (frac <= 5.0) nice = 5.0;
  else if (frac <= 6.0) nice = 6.0;
  else if (frac <= 8.0) nice = 8.0;
  else nice = 10.0;
  return nice * exp;
}

function getGraphYMax(vgsFamily) {
  var peak = 0.0;
  vgsFamily.forEach(function(vg) {
    var pt = computeDnmosPoint(vg, 1.8, geomL, geomW, geomTox);
    if (pt.ids > peak) peak = pt.ids;
  });
  var curMax = computeDnmosPoint(currentVgs, 1.8, geomL, geomW, geomTox).ids;
  if (curMax > peak) peak = curMax;
  var autoMax = getNiceYMax(peak);
  if (lockYAxis) {
    if (lockedYMax === null) lockedYMax = autoMax;
    return lockedYMax;
  }
  return autoMax;
}

var IV_GRAPH_PAD = { L: 48, R: 38, T: 22, B: 24 };

function renderIdsVdsOnCanvas(canvas, isLarge) {
  if (!canvas) return;
  var rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  var dpr = window.devicePixelRatio || 1;
  var targetW = Math.round(rect.width * dpr);
  var targetH = Math.round(rect.height * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var w = rect.width;
  var h = rect.height;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  var isLight = document.documentElement.getAttribute('data-theme') === 'light';
  var bgCol = isLight ? '#f8fafc' : '#090d14';
  var gridCol = isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)';
  var axisCol = isLight ? 'rgba(15, 23, 42, 0.25)' : 'rgba(255, 255, 255, 0.22)';
  var textCol = isLight ? '#64748b' : '#7d8ba0';
  var satLocusCol = isLight ? 'rgba(217, 119, 6, 0.65)' : 'rgba(230, 162, 60, 0.55)';
  var activeCurveCol = isLight ? '#b45309' : '#e6c94a';
  var famCol = isLight ? '#64748b' : '#8b9ab0';
  var zeroBiasCol = isLight ? '#0d9488' : '#5fd9c4';

  ctx.fillStyle = bgCol;
  ctx.fillRect(0, 0, w, h);

  var pad = isLarge ? { L: 56, R: 46, T: 26, B: 32 } : IV_GRAPH_PAD;
  var gw = w - pad.L - pad.R;
  var gh = h - pad.T - pad.B;
  if (gw <= 10 || gh <= 10) { ctx.restore(); return; }

  var maxV = 1.8;
  var vgsFamily = [-0.6, -0.2, 0.0, 0.4, 0.8];
  var maxI = getGraphYMax(vgsFamily);

  function mapX(v) { return pad.L + (v / maxV) * gw; }
  function mapY(ids) { return pad.T + gh - Math.min(1.06, Math.max(0, ids / maxI)) * gh; }

  ctx.strokeStyle = gridCol;
  ctx.lineWidth = 1;
  ctx.beginPath();
  [0.0, 0.6, 1.2, 1.8].forEach(function(vx) {
    var gx = mapX(vx);
    ctx.moveTo(gx, pad.T);
    ctx.lineTo(gx, pad.T + gh);
  });
  var yTicks = [0, maxI * 0.25, maxI * 0.5, maxI * 0.75, maxI];
  yTicks.forEach(function(iy) {
    var gy = mapY(iy);
    ctx.moveTo(pad.L, gy);
    ctx.lineTo(pad.L + gw, gy);
  });
  ctx.stroke();

  ctx.strokeStyle = axisCol;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pad.L, pad.T);
  ctx.lineTo(pad.L, pad.T + gh);
  ctx.lineTo(pad.L + gw, pad.T + gh);
  ctx.stroke();

  ctx.fillStyle = textCol;
  ctx.font = (isLarge ? '11px' : '9px') + ' "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  [0.0, 0.6, 1.2, 1.8].forEach(function(vx) {
    ctx.fillText(vx.toFixed(1) + 'V', mapX(vx), pad.T + gh + (isLarge ? 7 : 5));
  });
  ctx.fillStyle = isLight ? '#475569' : '#9aa6b6';
  ctx.font = 'bold ' + (isLarge ? '11px' : '9px') + ' "IBM Plex Mono", monospace';
  ctx.fillText('VDS (V)', pad.L + gw / 2, pad.T + gh + (isLarge ? 19 : 13));

  ctx.fillStyle = textCol;
  ctx.font = (isLarge ? '11px' : '9px') + ' "IBM Plex Mono", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  [0, maxI * 0.5, maxI].forEach(function(iy) {
    var lbl = iy < 0.01 ? '0' : (iy >= 10 ? iy.toFixed(0) : (iy >= 1 ? iy.toFixed(1) : iy.toFixed(2)));
    ctx.fillText(lbl, pad.L - (isLarge ? 8 : 5), mapY(iy));
  });
  ctx.save();
  ctx.translate(isLarge ? 13 : 10, pad.T + gh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = isLight ? '#475569' : '#9aa6b6';
  ctx.font = 'bold ' + (isLarge ? '11px' : '9px') + ' "IBM Plex Mono", monospace';
  ctx.fillText('ID (mA)', 0, 0);
  ctx.restore();

  // Clip curve drawing to the interior plot frame so zoomed/locked Y curves never overflow axes
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.L, pad.T - 2, gw + 1, gh + 4);
  ctx.clip();

  // Dashed Pinch-Off Locus (VDS = VDS,sat)
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = satLocusCol;
  ctx.lineWidth = isLarge ? 1.8 : 1.3;
  ctx.beginPath();
  var startedLocus = false;
  for (var lxVgs = -1.1; lxVgs <= 1.05; lxVgs += 0.025) {
    var ptSatGuess = computeDnmosPoint(lxVgs, 0.8, geomL, geomW, geomTox);
    var vSat = ptSatGuess.vdsSat;
    if (vSat > 0.005 && vSat <= maxV) {
      var ptSat = computeDnmosPoint(lxVgs, vSat, geomL, geomW, geomTox);
      var lx = mapX(vSat);
      var ly = mapY(ptSat.ids);
      if (!startedLocus) {
        ctx.moveTo(lx, ly);
        startedLocus = true;
      } else {
        ctx.lineTo(lx, ly);
      }
    }
  }
  ctx.stroke();
  ctx.restore();

  var labelCandidates = [];
  vgsFamily.forEach(function(vg) {
    var isZero = Math.abs(vg) < 0.01;
    ctx.strokeStyle = isZero
      ? (isLight ? 'rgba(13, 148, 136, 0.55)' : 'rgba(95, 217, 196, 0.45)')
      : (isLight ? 'rgba(100, 116, 139, 0.40)' : 'rgba(148, 163, 184, 0.34)');
    ctx.lineWidth = isZero ? (isLarge ? 2.0 : 1.5) : (isLarge ? 1.5 : 1.1);
    ctx.beginPath();
    var lastY = pad.T + gh;
    for (var s = 0; s <= 40; s++) {
      var v = (s / 40) * maxV;
      var iVal = computeDnmosPoint(vg, v, geomL, geomW, geomTox).ids;
      var px = mapX(v);
      var py = mapY(iVal);
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
      if (s === 40) lastY = py;
    }
    ctx.stroke();
    labelCandidates.push({
      vg: vg,
      text: (vg > 0 ? '+' : '') + vg.toFixed(1) + 'V',
      y: lastY,
      color: isZero ? zeroBiasCol : famCol,
      bold: isZero
    });
  });

  // Active VGS Curve Highlighted
  var activeState = computeDnmosPoint(currentVgs, currentVds, geomL, geomW, geomTox);
  var activeRg = activeState.region;
  var dotCol = activeRg === 'CUTOFF' ? '#e35d5d' : (activeRg === 'LINEAR' ? '#4a92c9' : '#57cf8f');

  ctx.strokeStyle = activeCurveCol;
  ctx.lineWidth = isLarge ? 2.8 : 2.1;
  ctx.beginPath();
  for (var a = 0; a <= 48; a++) {
    var av = (a / 48) * maxV;
    var aiVal = computeDnmosPoint(currentVgs, av, geomL, geomW, geomTox).ids;
    var apx = mapX(av);
    var apy = mapY(aiVal);
    if (a === 0) ctx.moveTo(apx, apy);
    else ctx.lineTo(apx, apy);
  }
  ctx.stroke();

  if (activeState.vdsSat > 0.02 && activeState.vdsSat < maxV && activeRg !== 'CUTOFF') {
    var vxPin = mapX(activeState.vdsSat);
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = satLocusCol;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vxPin, pad.T);
    ctx.lineTo(vxPin, pad.T + gh);
    ctx.stroke();
    ctx.restore();
  }

  var dotX = mapX(currentVds);
  var dotY = mapY(activeState.ids);

  ctx.fillStyle = dotCol;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(dotX, dotY, isLarge ? 10 : 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  ctx.fillStyle = dotCol;
  ctx.strokeStyle = isLight ? '#ffffff' : '#090d14';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(dotX, dotY, isLarge ? 5.2 : 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore(); // end clip

  // Non-overlapping VGS curve labels on the right edge with column header
  ctx.font = 'bold ' + (isLarge ? '10px' : '8.5px') + ' "IBM Plex Mono", monospace';
  ctx.fillStyle = textCol;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('VGS', pad.L + gw + 4, pad.T - (isLarge ? 10 : 8));

  ctx.font = (isLarge ? '10px' : '8px') + ' "IBM Plex Mono", monospace';
  var minGap = isLarge ? 13 : 10;
  labelCandidates.sort(function(a, b) { return a.y - b.y; });
  var prevY = pad.T - minGap;
  for (var cIdx = 0; cIdx < labelCandidates.length; cIdx++) {
    var item = labelCandidates[cIdx];
    var placedY = Math.max(pad.T + 4, Math.max(item.y, prevY + minGap));
    if (placedY <= pad.T + gh - 2) {
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, pad.L + gw + 4, placedY);
      prevY = placedY;
    }
  }

  if (isLarge) {
    ctx.fillStyle = textCol;
    ctx.font = '10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      'L=' + activeState.L + 'nm · W=' + activeState.W + 'nm · tox=' + activeState.tox.toFixed(1) + 'nm',
      pad.L + 8,
      pad.T + 6
    );
  }

  ctx.restore();
}

function drawIdsVdsGraph() {
  renderIdsVdsOnCanvas(document.getElementById('iv-canvas'), false);
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  if (modalBackdrop && modalBackdrop.style.display !== 'none') {
    renderIdsVdsOnCanvas(document.getElementById('iv-modal-canvas'), true);
  }
}

window.updateLogicGraphTheme = function() {
  drawIdsVdsGraph();
};

function applyLogicState() {
  if (typeof window.updateDeviceGeometry3D === 'function') {
    window.updateDeviceGeometry3D(geomL, geomW, geomTox);
  }

  var state = computeDnmosPoint(currentVgs, currentVds, geomL, geomW, geomTox);
  var ids = state.ids;
  var region = state.region;
  var mode = state.mode;

  var vgsStr = (currentVgs >= 0 ? '+' : '') + currentVgs.toFixed(2) + ' V';
  var vdsStr = currentVds.toFixed(2) + ' V';
  var idsStr = formatIdsText(ids);

  var vgsSlider = document.getElementById('vgs-slider');
  var vgsVal = document.getElementById('vgs-val');
  if (vgsSlider) vgsSlider.value = currentVgs.toFixed(2);
  if (vgsVal) vgsVal.textContent = vgsStr;

  var vdsSlider = document.getElementById('vds-slider');
  var vdsVal = document.getElementById('vds-val');
  if (vdsSlider) vdsSlider.value = currentVds.toFixed(2);
  if (vdsVal) vdsVal.textContent = vdsStr;

  syncGeometryControlsUI();

  var seg = document.getElementById('region-preset-seg');
  if (seg) {
    seg.querySelectorAll('.seg-btn').forEach(function(btn) {
      var p = btn.dataset.preset;
      var active = (
        (p === 'cutoff' && region === 'CUTOFF') ||
        (p === 'depletion' && mode === 'DEPLETION') ||
        (p === 'zero' && mode === 'ZERO BIAS') ||
        (p === 'enhancement' && mode === 'ENHANCE')
      );
      btn.classList.toggle('active', active);
    });
  }

  var setText = function(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setText('iv-vgs-readout', vgsStr);
  setText('iv-vds-readout', vdsStr);
  setText('iv-vth-readout', state.vth.toFixed(2) + ' V');
  setText('iv-vov-readout', state.vov.toFixed(2) + ' V');
  setText('iv-wl-readout', state.wlRatio.toFixed(2));
  setText('iv-ids-readout', idsStr);
  setText('iv-leff-readout', state.leff.toFixed(1) + ' nm');
  setText('iv-vdsat-readout', state.vdsSat.toFixed(2) + ' V');
  setText('iv-dl-readout', state.deltaL_nm.toFixed(1) + ' nm');

  var stateDesc = document.getElementById('iv-state-desc');
  if (stateDesc) {
    if (region === 'CUTOFF') {
      stateDesc.textContent = 'CUTOFF · VGS <= VTH (' + state.vth.toFixed(2) + ' V) · Channel pinched off';
      stateDesc.style.color = '#e35d5d';
    } else if (region === 'LINEAR') {
      stateDesc.textContent = mode + ' · LINEAR (VDS < ' + state.vdsSat.toFixed(2) + ' V)';
      stateDesc.style.color = '#4a92c9';
    } else {
      stateDesc.textContent = mode + ' · SATURATION (CLM + DIBL)';
      stateDesc.style.color = '#57cf8f';
    }
  }

  var mVgs = document.getElementById('iv-modal-ro-vgs');
  var mVds = document.getElementById('iv-modal-ro-vds');
  var mIds = document.getElementById('iv-modal-ro-ids');
  var mReg = document.getElementById('iv-modal-ro-region');
  var mVth = document.getElementById('iv-modal-ro-vth');
  var mWl = document.getElementById('iv-modal-ro-wl');
  var mLeff = document.getElementById('iv-modal-ro-leff');
  if (mVgs) mVgs.textContent = vgsStr;
  if (mVds) mVds.textContent = vdsStr;
  if (mIds) mIds.textContent = idsStr;
  if (mReg) {
    mReg.textContent = region + ' (' + mode + ')';
    mReg.className = 'iv-modal-ro-val ' + (region === 'CUTOFF' ? 'cutoff' : (region === 'LINEAR' ? 'linear' : 'sat'));
  }
  if (mVth) mVth.textContent = state.vth.toFixed(2) + ' V';
  if (mWl) mWl.textContent = state.wlRatio.toFixed(2);
  if (mLeff) mLeff.textContent = state.leff.toFixed(1) + ' nm';

  var vaCtx = document.getElementById('va-ctx-state');
  if (vaCtx) vaCtx.textContent = 'VGS=' + vgsStr + ' · VDS=' + vdsStr + ' (' + region + ' · L=' + state.L + 'nm)';

  var schVgs = document.getElementById('sch-vgs-val');
  if (schVgs) schVgs.textContent = vgsStr;

  var schChan = document.getElementById('sch-channel-state');
  if (schChan) {
    if (region === 'CUTOFF') {
      schChan.textContent = 'CHANNEL PINCHED OFF (CUTOFF)';
      schChan.setAttribute('fill', '#e35d5d');
    } else if (mode === 'ZERO BIAS') {
      schChan.textContent = 'NORMALLY ON (BUILT-IN CHANNEL)';
      schChan.setAttribute('fill', '#5fd9c4');
    } else if (mode === 'DEPLETION') {
      schChan.textContent = 'DEPLETION MODE (' + region + ')';
      schChan.setAttribute('fill', '#e6a23c');
    } else {
      schChan.textContent = 'ENHANCEMENT ACCUMULATION (' + region + ')';
      schChan.setAttribute('fill', '#57cf8f');
    }
  }

  var flowCap = document.getElementById('flow-caption');
  if (flowCap) {
    if (region === 'CUTOFF') {
      flowCap.textContent = 'CUTOFF: Negative VGS <= VTH (' + state.vth.toFixed(2) + ' V) fully depletes the implanted N-channel.';
    } else if (currentVds <= 0.005) {
      flowCap.textContent = mode + ' (VDS = 0V): Built-in channel contains mobile electrons with zero net horizontal drift.';
    } else if (region === 'LINEAR') {
      flowCap.textContent = mode + ' LINEAR: Continuous N-channel conducts ' + idsStr + ' (L=' + state.L + 'nm, W=' + state.W + 'nm).';
    } else {
      flowCap.textContent = mode + ' SATURATION: Pinched off (Leff=' + state.leff.toFixed(1) + 'nm, ΔL=' + state.deltaL_nm.toFixed(1) + 'nm); saturated ID=' + idsStr + '.';
    }
  }

  if (typeof window.updateChannelGeometry === 'function') {
    window.updateChannelGeometry(currentVgs, currentVds, ids, region, state.deltaL);
  }

  if (typeof rebuildFlowCurves === 'function') {
    rebuildFlowCurves(ids, region, state.deltaL);
  }

  if (typeof window.updateSubGateCarriers === 'function') {
    window.updateSubGateCarriers(typeof performance !== 'undefined' ? performance.now() * 0.001 : 0);
  }

  drawIdsVdsGraph();
}
window.applyLogicState = applyLogicState;

function applyRegionPreset(preset) {
  if (preset === 'cutoff') {
    currentVgs = -1.20;
    currentVds = 0.80;
  } else if (preset === 'depletion') {
    currentVgs = -0.40;
    currentVds = 0.80;
  } else if (preset === 'zero') {
    currentVgs = 0.00;
    currentVds = 0.80;
  } else if (preset === 'enhancement') {
    currentVgs = 0.80;
    currentVds = 0.80;
  }
  applyLogicState();
}

function registerDnmosParamModals() {
  var modalHelper = (typeof window.SiliconParamInfoModal !== 'undefined') ? window.SiliconParamInfoModal : window.SiliconInfoPopover;
  if (!modalHelper) return;
  modalHelper.register({
    vgs: {
      title: 'Gate-to-Source Voltage (V<sub>GS</sub>)',
      param: 'Dual-Mode Control: −1.20 V (Cutoff/Depletion) to +1.00 V (Enhancement)',
      formula: 'V<sub>OV</sub> = V<sub>GS</sub> − V<sub>TH</sub> (V<sub>TH</sub> &lt; 0)   |   I<sub>D</sub> ∝ V<sub>OV</sub> · V<sub>Dsat</sub>',
      increase: 'From −V<sub>GS</sub> toward 0 V, restores the implanted N-channel (Zero Bias I<sub>DSS</sub>); for V<sub>GS</sub> &gt; 0 V, adds a surface accumulation layer boosting I<sub>D</sub> &gt; I<sub>DSS</sub>.',
      decrease: 'Repels mobile channel electrons downward into the P-substrate (Depletion Mode); when V<sub>GS</sub> ≤ V<sub>TH</sub>, the built-in channel pinches off completely (Cutoff, I<sub>D</sub> = 0).',
      tradeoff: 'Normally ON conduction at V<sub>GS</sub> = 0 V makes D-NMOS ideal for depletion-load pull-ups and startup switches, at the cost of standby current if left unbiased.',
      theorySection: 'dnmos-dualmode'
    },
    vds: {
      title: 'Drain-to-Source Voltage (V<sub>DS</sub>)',
      param: 'Lateral Source-to-Drain Drift Bias: 0.00 V to 1.80 V',
      formula: 'Linear (V<sub>DS</sub> &lt; V<sub>Dsat</sub>)  →  Saturation (V<sub>DS</sub> ≥ V<sub>Dsat</sub>)',
      increase: 'Drives electrons from Source to Drain; past V<sub>Dsat</sub>, expands drain pinch-off gap <code>ΔL</code> and induces negative DIBL threshold shift in short channels.',
      decrease: 'Relaxes lateral electric field and drain depletion wedge back into linear conduction; at V<sub>DS</sub> = 0 V, channel electrons oscillate with zero net drift.',
      tradeoff: 'Higher V<sub>DS</sub> provides saturation current plateaus but increases DIBL sensitivity and channel-length modulation slope <code>λ</code> at short gate lengths.',
      theorySection: 'dnmos-pinchoff'
    },
    geomL: {
      title: 'Channel Length (L)',
      param: 'Physical Metallurgical Gate Length: 20 nm to 200 nm',
      formula: 'I<sub>D</sub> ∝ 1/L   |   λ ∝ 1/L   |   V<sub>Dsat</sub> = V<sub>OV</sub>·E<sub>sat</sub>·L / (V<sub>OV</sub> + E<sub>sat</sub>·L)',
      increase: 'Restores long-channel Shockley plateaus (small <code>λ</code>), eliminates DIBL and roll-off, and yields crisp cutoff right near V<sub>TH0</sub>.',
      decrease: 'Boosts drive current ∝ 1/L until velocity saturation, increases <code>λ</code>, and shifts V<sub>TH</sub> further negative via charge-sharing &amp; DIBL (harder to shut OFF).',
      tradeoff: 'Short L improves pull-up current density but makes complete Cutoff harder to maintain at elevated V<sub>DS</sub>.',
      theorySection: 'dnmos-equations'
    },
    geomW: {
      title: 'Channel Width (W)',
      param: 'Active Transverse Gate Width: 40 nm to 400 nm',
      formula: 'I<sub>D</sub> ∝ W   |   k<sub>n</sub> = μ<sub>n</sub> · C<sub>ox</sub> · (W / L)',
      increase: 'Scales the 3D N+ active/channel width along Z and multiplies current carrying capacity proportionally without altering V<sub>TH</sub>.',
      decrease: 'Narrows transverse conduction area and lowers I<sub>D</sub> (often sized narrower for depletion-load ratioed logic).',
      tradeoff: 'Larger W directly scales current drive and parasitic gate/diffusion capacitance C<sub>g</sub> ∝ W·L without shifting pinch-off voltage.',
      theorySection: 'dnmos-equations'
    },
    geomTox: {
      title: 'Gate Oxide Thickness (t<sub>ox</sub>)',
      param: 'Effective Equivalent Oxide Thickness (EOT): 1.2 nm to 10.0 nm',
      formula: 'C<sub>ox</sub> = ε<sub>ox</sub> / t<sub>ox</sub> (ε<sub>ox</sub> = 3.9 ε<sub>0</sub>)   |   k<sub>n</sub> ∝ 1 / t<sub>ox</sub>',
      increase: 'Weakens vertical capacitive coupling over the implanted N-channel, lowering k<sub>n</sub> and pushing V<sub>TH</sub> further negative.',
      decrease: 'Maximizes C<sub>ox</sub> and transconductance k<sub>n</sub> while strengthening vertical gate depletion authority for cleaner cutoff.',
      tradeoff: 'Ultra-thin gate oxides strengthen electrostatic pinch-off control while requiring High-k HfO₂ stacks to prevent excessive gate leakage.',
      theorySection: 'dnmos-structure'
    }
  });
}

function initLogicStateControls() {
  var vgsSlider = document.getElementById('vgs-slider');
  if (vgsSlider) {
    vgsSlider.addEventListener('input', function() {
      currentVgs = parseFloat(vgsSlider.value);
      applyLogicState();
    });
  }

  var vdsSlider = document.getElementById('vds-slider');
  if (vdsSlider) {
    vdsSlider.addEventListener('input', function() {
      currentVds = parseFloat(vdsSlider.value);
      applyLogicState();
    });
  }

  var lSlider = document.getElementById('geom-l-slider');
  if (lSlider) {
    lSlider.addEventListener('input', function() {
      geomL = parseFloat(lSlider.value);
      applyLogicState();
    });
  }

  var wSlider = document.getElementById('geom-w-slider');
  if (wSlider) {
    wSlider.addEventListener('input', function() {
      geomW = parseFloat(wSlider.value);
      applyLogicState();
    });
  }

  var toxSlider = document.getElementById('geom-tox-slider');
  if (toxSlider) {
    toxSlider.addEventListener('input', function() {
      geomTox = parseFloat(toxSlider.value);
      applyLogicState();
    });
  }

  var geomPresets = document.getElementById('geom-presets');
  if (geomPresets) {
    geomPresets.addEventListener('click', function(e) {
      var btn = e.target.closest('.geom-preset-btn');
      if (!btn) return;
      geomL = parseFloat(btn.dataset.l) || 28;
      geomW = parseFloat(btn.dataset.w) || 120;
      geomTox = parseFloat(btn.dataset.tox) || 2.0;
      applyLogicState();
    });
  }

  var lockBtn = document.getElementById('iv-lock-y');
  if (lockBtn) {
    lockBtn.addEventListener('click', function() {
      lockYAxis = !lockYAxis;
      if (lockYAxis) {
        lockedYMax = null;
        lockedYMax = getGraphYMax([-0.6, -0.2, 0.0, 0.4, 0.8]);
      } else {
        lockedYMax = null;
      }
      lockBtn.classList.toggle('active', lockYAxis);
      lockBtn.setAttribute('aria-pressed', lockYAxis ? 'true' : 'false');
      drawIdsVdsGraph();
    });
  }

  var seg = document.getElementById('region-preset-seg');
  if (seg) {
    seg.addEventListener('click', function(e) {
      var btn = e.target.closest('.seg-btn');
      if (!btn || !btn.dataset.preset) return;
      applyRegionPreset(btn.dataset.preset);
    });
  }

  registerDnmosParamModals();

  applyLogicState();
  requestAnimationFrame(drawIdsVdsGraph);

  window.addEventListener('resize', drawIdsVdsGraph);
  var wb = document.getElementById('workbench');
  if (wb && typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function() { drawIdsVdsGraph(); });
    ro.observe(wb);
  }

  function bindCanvasPointer(canvas, isLarge) {
    var dragging = false;
    function scrubFromEvent(e) {
      var rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return;
      var pad = isLarge ? { L: 56, R: 46 } : { L: IV_GRAPH_PAD.L, R: IV_GRAPH_PAD.R };
      var gw = rect.width - pad.L - pad.R;
      if (gw <= 5) return;
      var x = (e.clientX - rect.left) - pad.L;
      var frac = Math.max(0, Math.min(1, x / gw));
      currentVds = Math.round(frac * 1.8 * 20) / 20;
      applyLogicState();
    }
    canvas.addEventListener('pointerdown', function(e) {
      dragging = true;
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      scrubFromEvent(e);
    });
    canvas.addEventListener('pointermove', function(e) {
      if (dragging) scrubFromEvent(e);
    });
    canvas.addEventListener('pointerup', function(e) {
      dragging = false;
      if (canvas.releasePointerCapture) canvas.releasePointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointercancel', function() { dragging = false; });
  }

  var inlineCanvas = document.getElementById('iv-canvas');
  if (inlineCanvas) bindCanvasPointer(inlineCanvas, false);

  var modalCanvas = document.getElementById('iv-modal-canvas');
  if (modalCanvas) bindCanvasPointer(modalCanvas, true);

  var expandBtn = document.getElementById('iv-expand-btn');
  var modalBackdrop = document.getElementById('iv-modal-backdrop');
  var modalCloseBtn = document.getElementById('iv-modal-close');
  var modalResizeObserver = null;

  function openIvModal() {
    if (!modalBackdrop) return;
    modalBackdrop.style.display = 'flex';
    if (!modalResizeObserver && typeof ResizeObserver !== 'undefined' && modalCanvas) {
      modalResizeObserver = new ResizeObserver(function() {
        if (modalBackdrop.style.display !== 'none') drawIdsVdsGraph();
      });
      modalResizeObserver.observe(modalCanvas.parentElement || modalCanvas);
    }
    drawIdsVdsGraph();
    requestAnimationFrame(drawIdsVdsGraph);
  }
  function closeIvModal() {
    if (!modalBackdrop) return;
    modalBackdrop.style.display = 'none';
  }

  if (expandBtn) expandBtn.addEventListener('click', openIvModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeIvModal);
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', function(e) {
      if (e.target === modalBackdrop) closeIvModal();
    });
  }
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modalBackdrop && modalBackdrop.style.display !== 'none') {
      closeIvModal();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogicStateControls);
} else {
  initLogicStateControls();
}
