/**
 * plots.js - Dual High-DPI 2D <canvas> Plots for LVDT Simulator
 *
 * 1. Real-Time AC Oscilloscope: Vin(t) reference vs Vout(t) clearly showing
 *    the live 180 deg phase flip across x = 0 (or Signed DC level in demod mode).
 * 2. Transfer Curve (Vout vs x): Plots [-10, +10] mm with shaded +/-5 mm
 *    linear stroke zone, ideal dashed line, actual tanh-saturated curve,
 *    and live glowing tracking dot.
 */
(function (root) {
  'use strict';

  var oscCanvas = null;
  var transferCanvas = null;
  var scopePhase = 0;

  function isLightTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light';
  }

  function getPalette() {
    var light = isLightTheme();
    return {
      bg: light ? '#f8fafc' : '#090d16',
      grid: light ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.12)',
      axis: light ? 'rgba(15, 23, 42, 0.28)' : 'rgba(148, 163, 184, 0.35)',
      text: light ? '#475569' : '#94a3b8',
      textStrong: light ? '#0f172a' : '#f1f5f9',
      vin: light ? '#d97706' : '#f59e0b',
      voutInPhase: light ? '#0284c7' : '#38bdf8',
      voutInverted: light ? '#059669' : '#10b981',
      voutSat: light ? '#dc2626' : '#f87171',
      linearBand: light ? 'rgba(2, 132, 199, 0.08)' : 'rgba(56, 189, 248, 0.09)',
      linearBorder: light ? 'rgba(2, 132, 199, 0.32)' : 'rgba(56, 189, 248, 0.32)',
      idealLine: light ? 'rgba(100, 116, 139, 0.55)' : 'rgba(148, 163, 184, 0.45)'
    };
  }

  function sizeCanvas(canvas) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var lw = Math.round(rect.width);
    var lh = Math.round(rect.height);
    if (canvas.width !== Math.round(lw * dpr) || canvas.height !== Math.round(lh * dpr)) {
      canvas.width = Math.round(lw * dpr);
      canvas.height = Math.round(lh * dpr);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: lw, h: lh };
  }

  function renderOscilloscope(state, dtSec) {
    var info = sizeCanvas(oscCanvas);
    if (!info || !root.LVDTPhysics) return;
    var ctx = info.ctx;
    var w = info.w;
    var h = info.h;
    var pal = getPalette();

    // Gentle scrolling carrier phase scaled visually with frequency
    var speed = 1.6 + 3.2 * Math.min(1, state.freqHz / 5000.0);
    scopePhase = (scopePhase + (dtSec || 0.016) * speed) % (Math.PI * 200);

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);

    var pad = { left: 56, right: 14, top: 22, bottom: 28 };
    var pw = w - pad.left - pad.right;
    var ph = h - pad.top - pad.bottom;
    var midY = pad.top + ph * 0.5;

    // Gridlines
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    for (var gx = 0; gx <= 4; gx++) {
      var xPos = pad.left + (gx / 4) * pw;
      ctx.beginPath();
      ctx.moveTo(xPos, pad.top);
      ctx.lineTo(xPos, pad.top + ph);
      ctx.stroke();
    }
    for (var gy = 0; gy <= 4; gy++) {
      var yPos = pad.top + (gy / 4) * ph;
      ctx.beginPath();
      ctx.moveTo(pad.left, yPos);
      ctx.lineTo(pad.left + pw, yPos);
      ctx.stroke();
    }

    // Zero axis
    ctx.strokeStyle = pal.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(pad.left, midY);
    ctx.lineTo(pad.left + pw, midY);
    ctx.stroke();

    var wf = root.LVDTPhysics.sampleOscilloscope(state, scopePhase, 2.5, 200);
    var vinScale = (ph * 0.40) / Math.max(wf.vpPeak, 1.0);
    var voutScale = (ph * 0.42) / Math.max(wf.voutPeak, 1.0);

    // Draw Vin(t) dashed reference
    ctx.save();
    ctx.strokeStyle = pal.vin;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (var i = 0; i < wf.vin.length; i++) {
      var px = pad.left + (i / (wf.vin.length - 1)) * pw;
      var py = midY - wf.vin[i] * vinScale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // Draw Vout(t) solid waveform
    var outColor = state.xMm > 0 ? pal.voutInverted : pal.voutInPhase;
    ctx.save();
    ctx.strokeStyle = outColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (var j = 0; j < wf.vout.length; j++) {
      var ox = pad.left + (j / (wf.vout.length - 1)) * pw;
      var oy = midY - wf.vout[j] * voutScale;
      if (j === 0) ctx.moveTo(ox, oy);
      else ctx.lineTo(ox, oy);
    }
    ctx.stroke();
    ctx.restore();

    // Y-axis tick labels (kept clear of left rotated axis title)
    ctx.fillStyle = pal.text;
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('+' + wf.voutPeak.toFixed(1) + 'V', pad.left - 6, pad.top + 8);
    ctx.fillText('0', pad.left - 6, midY + 3);
    ctx.fillText('-' + wf.voutPeak.toFixed(1) + 'V', pad.left - 6, pad.top + ph);

    // Rotated left Y-axis title: Voltage (V)
    ctx.save();
    ctx.translate(13, pad.top + ph * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = pal.text;
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Voltage (V)', 0, 0);
    ctx.restore();

    // Top waveform legend
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.vin;
    ctx.fillText('--- Vin (' + state.vpVrms.toFixed(1) + ' Vrms)', pad.left + 2, 13);

    ctx.fillStyle = outColor;
    var modeText = state.demodulatorMode === 'demod'
      ? '— Vout DC (' + (state.vOutDemodDc >= 0 ? '+' : '') + state.vOutDemodDc.toFixed(2) + ' V)'
      : '— Vout (' + state.phaseDeg.toFixed(0) + '°)';
    ctx.textAlign = 'right';
    ctx.fillText(modeText, w - pad.right, 13);

    // Centered bottom X-axis title: Time (t)
    ctx.fillStyle = pal.text;
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Time (t)', pad.left + pw * 0.5, h - 8);
  }

  function renderTransferCurve(state) {
    var info = sizeCanvas(transferCanvas);
    if (!info || !root.LVDTPhysics) return;
    var ctx = info.ctx;
    var w = info.w;
    var h = info.h;
    var pal = getPalette();

    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);

    var pad = { left: 56, right: 16, top: 20, bottom: 38 };
    var pw = w - pad.left - pad.right;
    var ph = h - pad.top - pad.bottom;

    function xToPx(xMm) {
      return pad.left + ((xMm + 10.0) / 20.0) * pw;
    }

    var isDemod = state.demodulatorMode === 'demod';
    var yMax = Math.max(state.vFullScale * 1.85, 1.0);
    var yMin = isDemod ? -yMax : 0;

    function yToPx(v) {
      var frac = (v - yMin) / (yMax - yMin);
      return pad.top + ph - frac * ph;
    }

    // Shaded +/-5 mm linear zone
    var xLeftLin = xToPx(-5.0);
    var xRightLin = xToPx(5.0);
    ctx.fillStyle = pal.linearBand;
    ctx.fillRect(xLeftLin, pad.top, xRightLin - xLeftLin, ph);

    ctx.save();
    ctx.strokeStyle = pal.linearBorder;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xLeftLin, pad.top);
    ctx.lineTo(xLeftLin, pad.top + ph);
    ctx.moveTo(xRightLin, pad.top);
    ctx.lineTo(xRightLin, pad.top + ph);
    ctx.stroke();
    ctx.restore();

    // Grid & axes
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    [-10, -5, 0, 5, 10].forEach(function (xt) {
      var px = xToPx(xt);
      ctx.beginPath();
      ctx.moveTo(px, pad.top);
      ctx.lineTo(px, pad.top + ph);
      ctx.stroke();
    });

    ctx.strokeStyle = pal.axis;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(pad.left, yToPx(0));
    ctx.lineTo(pad.left + pw, yToPx(0));
    ctx.moveTo(xToPx(0), pad.top);
    ctx.lineTo(xToPx(0), pad.top + ph);
    ctx.stroke();

    var samples = root.LVDTPhysics.sampleTransferCurve(state, 161);

    // Ideal linear dashed line
    ctx.save();
    ctx.strokeStyle = pal.idealLine;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (var i = 0; i < samples.length; i++) {
      var pxI = xToPx(samples[i].x);
      var pyI = yToPx(samples[i].yIdeal);
      if (i === 0) ctx.moveTo(pxI, pyI);
      else ctx.lineTo(pxI, pyI);
    }
    ctx.stroke();
    ctx.restore();

    // Actual LVDT transfer curve (split color: 0 deg blue for x<0, 180 deg emerald for x>0)
    ctx.lineWidth = 2.3;
    for (var k = 1; k < samples.length; k++) {
      var p0 = samples[k - 1];
      var p1 = samples[k];
      ctx.strokeStyle = p1.x > 0 ? pal.voutInverted : pal.voutInPhase;
      ctx.beginPath();
      ctx.moveTo(xToPx(p0.x), yToPx(p0.y));
      ctx.lineTo(xToPx(p1.x), yToPx(p1.y));
      ctx.stroke();
    }

    // Live operating point dot
    var liveY = isDemod ? state.vOutDemodDc : state.vOutRms;
    var dotX = xToPx(state.xMm);
    var dotY = yToPx(liveY);
    var dotColor = state.zoneStatus === 'saturated'
      ? pal.voutSat
      : (state.xMm > 0 ? pal.voutInverted : pal.voutInPhase);

    ctx.save();
    ctx.fillStyle = dotColor;
    ctx.shadowColor = dotColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = isLightTheme() ? '#ffffff' : '#080b11';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4.8, 0, Math.PI * 2);
    ctx.stroke();

    // Axis ticks & annotations
    ctx.fillStyle = pal.text;
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    [-10, -5, 0, 5, 10].forEach(function (xt) {
      ctx.fillText((xt > 0 ? '+' : '') + xt, xToPx(xt), pad.top + ph + 13);
    });

    // Centered bottom X-axis title
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.fillText('Core Displacement x (mm)', pad.left + pw * 0.5, h - 7);

    // Y-axis tick labels
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(yMax.toFixed(1) + 'V', pad.left - 6, pad.top + 9);
    if (isDemod) {
      ctx.fillText('0', pad.left - 6, yToPx(0) + 3);
      ctx.fillText(yMin.toFixed(1) + 'V', pad.left - 6, pad.top + ph);
    } else {
      ctx.fillText('0V', pad.left - 6, pad.top + ph);
    }

    // Rotated left Y-axis title: Vout (V) or Vout DC (V)
    ctx.save();
    ctx.translate(13, pad.top + ph * 0.5);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = pal.text;
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isDemod ? 'Vout DC (V)' : 'Vout (V)', 0, 0);
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = pal.voutInPhase;
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.fillText('±5 mm LINEAR', xToPx(0), pad.top + 11);
  }

  function init(oscEl, transferEl) {
    oscCanvas = oscEl;
    transferCanvas = transferEl;
    resize();
  }

  function resize() {
    sizeCanvas(oscCanvas);
    sizeCanvas(transferCanvas);
  }

  function render(state, dtSec) {
    renderOscilloscope(state, dtSec);
    renderTransferCurve(state);
  }

  root.LVDTPlots = {
    init: init,
    resize: resize,
    render: render,
    renderOscilloscope: renderOscilloscope,
    renderTransferCurve: renderTransferCurve
  };
})(typeof window !== 'undefined' ? window : globalThis);
