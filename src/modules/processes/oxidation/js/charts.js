/**
 * SiliconSliders - Time-Aligned Dual Charts for Thermal Oxidation
 * Top Chart: Oxide Thickness x_ox(t) (nm) & Chamber Temperature T(t) (°C)
 * Bottom Chart: Chamber Gas Concentrations (N₂ & Active Oxidant) & MFC Sequencing
 * Precision DPR auto-sync, integer monospace typography, zero text collisions.
 */

(function (global) {
  'use strict';

  var FONT_FAMILY = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  var FONT_BOLD = '600 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

  function getChemConfig(chem) {
    if (global.OxidationPhysics && global.OxidationPhysics.getChemConfig) {
      return global.OxidationPhysics.getChemConfig(chem);
    }
    if (chem && typeof chem === 'object' && chem.color) return chem;
    var key = (chem || '').toLowerCase();
    if (key.indexOf('wet') !== -1 || key.indexOf('steam') !== -1 || key.indexOf('h2o') !== -1) {
      return {
        id: 'wet',
        name: 'Wet H₂O',
        label: 'H₂O Vapor',
        shortLabel: 'H₂O',
        color: '#10b981',
        glow: 'rgba(16, 185, 129, 0.45)',
        chartFillTop: 'rgba(16, 185, 129, 0.28)',
        chartFillBottom: 'rgba(16, 185, 129, 0.02)'
      };
    }
    if (key.indexOf('issg') !== -1 || key.indexOf('radical') !== -1) {
      return {
        id: 'issg',
        name: 'ISSG Radical',
        label: 'O* / OH* Radicals',
        shortLabel: 'O* / OH*',
        color: '#c084fc',
        glow: 'rgba(192, 132, 252, 0.50)',
        chartFillTop: 'rgba(192, 132, 252, 0.28)',
        chartFillBottom: 'rgba(192, 132, 252, 0.02)'
      };
    }
    return {
      id: 'dry',
      name: 'Dry O₂',
      label: 'O₂ Oxidant',
      shortLabel: 'O₂',
      color: '#22d3ee',
      glow: 'rgba(34, 211, 238, 0.45)',
      chartFillTop: 'rgba(34, 211, 238, 0.28)',
      chartFillBottom: 'rgba(34, 211, 238, 0.02)'
    };
  }

  function OxidationCharts(canvasTop, canvasBottom, callbacks) {
    this.canvasTop = canvasTop;
    this.canvasBottom = canvasBottom;
    this.ctxTop = canvasTop.getContext('2d');
    this.ctxBottom = canvasBottom.getContext('2d');
    this.callbacks = callbacks || {};

    this.margins = {
      left: 56,
      right: 56,
      top: 18,
      bottom: 22
    };

    this.hoverTime = null;
    this.hoverChart = null;

    this.initEvents();
  }

  OxidationCharts.prototype.initEvents = function () {
    var self = this;

    function handleMove(canvas, chartType, e) {
      if (!self.trajectory) return;
      var rect = canvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var m = self.margins;
      var plotW = rect.width - m.left - m.right;

      if (mouseX >= m.left && mouseX <= m.left + plotW) {
        var frac = (mouseX - m.left) / plotW;
        var tHover = frac * self.trajectory.t_total;
        self.hoverTime = Math.max(0, Math.min(self.trajectory.t_total, tHover));
        self.hoverChart = chartType;

        if (self.callbacks.onHover) {
          self.callbacks.onHover(self.hoverTime);
        }
      } else {
        self.clearHover();
      }
      self.renderCurrent();
    }

    function handleClick(canvas, e) {
      if (!self.trajectory) return;
      var rect = canvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var m = self.margins;
      var plotW = rect.width - m.left - m.right;

      if (mouseX >= m.left && mouseX <= m.left + plotW) {
        var frac = (mouseX - m.left) / plotW;
        var tClick = frac * self.trajectory.t_total;
        if (self.callbacks.onSeek) {
          self.callbacks.onSeek(Math.max(0, Math.min(self.trajectory.t_total, tClick)));
        }
      }
    }

    function handleLeave() {
      self.clearHover();
      self.renderCurrent();
    }

    this.canvasTop.addEventListener('mousemove', function (e) { handleMove(self.canvasTop, 'top', e); });
    this.canvasTop.addEventListener('mouseleave', handleLeave);
    this.canvasTop.addEventListener('click', function (e) { handleClick(self.canvasTop, e); });

    this.canvasBottom.addEventListener('mousemove', function (e) { handleMove(self.canvasBottom, 'bottom', e); });
    this.canvasBottom.addEventListener('mouseleave', handleLeave);
    this.canvasBottom.addEventListener('click', function (e) { handleClick(self.canvasBottom, e); });
  };

  OxidationCharts.prototype.clearHover = function () {
    this.hoverTime = null;
    this.hoverChart = null;
    if (this.callbacks.onHover) {
      this.callbacks.onHover(null);
    }
  };

  OxidationCharts.prototype.setHoverTime = function (t) {
    this.hoverTime = t;
    this.renderCurrent();
  };

  OxidationCharts.prototype.renderCurrent = function () {
    if (this.trajectory && this.state) {
      this.render(this.trajectory, this.state, this.chemistryName, this.hoverTime, this.theme);
    }
  };

  OxidationCharts.prototype.render = function (trajectory, state, chemistryName, externalHoverTime, theme) {
    if (!trajectory || !trajectory.steps || !trajectory.steps.length) return;

    this.trajectory = trajectory;
    this.state = state;
    this.chemistryName = chemistryName;
    this.theme = theme || (typeof document !== 'undefined' && document.documentElement.classList.contains('light') ? 'light' : 'dark');

    var effectiveHoverTime = (typeof externalHoverTime === 'number') ? externalHoverTime : this.hoverTime;
    var chemCfg = getChemConfig(chemistryName);

    this.renderTopChart(trajectory, state, chemCfg.shortLabel, effectiveHoverTime, this.theme);
    this.renderBottomChart(trajectory, state, chemCfg, effectiveHoverTime, this.theme);
  };

  // Helper for drawing stage backgrounds & grid
  OxidationCharts.prototype.drawChartGridAndStages = function (ctx, w, h, m, trajectory, theme) {
    var plotW = w - m.left - m.right;
    var plotH = h - m.top - m.bottom;
    var t_total = trajectory.t_total || 1.0;
    var t_ramp_up = trajectory.t_ramp_up;
    var t_soak_end = trajectory.t_soak_end;
    var isLight = theme === 'light';

    function getX(t) {
      return m.left + (t / t_total) * plotW;
    }

    var xRamp = getX(t_ramp_up);
    var xSoakEnd = getX(t_soak_end);

    // Stage shaded regions
    if (isLight) {
      ctx.fillStyle = 'rgba(241, 245, 249, 0.70)';
      ctx.fillRect(m.left, m.top, xRamp - m.left, plotH);

      ctx.fillStyle = 'rgba(254, 243, 199, 0.35)';
      ctx.fillRect(xRamp, m.top, xSoakEnd - xRamp, plotH);

      ctx.fillStyle = 'rgba(243, 232, 255, 0.35)';
      ctx.fillRect(xSoakEnd, m.top, (m.left + plotW) - xSoakEnd, plotH);

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRamp, m.top); ctx.lineTo(xRamp, m.top + plotH);
      ctx.moveTo(xSoakEnd, m.top); ctx.lineTo(xSoakEnd, m.top + plotH);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(56, 189, 248, 0.04)';
      ctx.fillRect(m.left, m.top, xRamp - m.left, plotH);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.05)';
      ctx.fillRect(xRamp, m.top, xSoakEnd - xRamp, plotH);

      ctx.fillStyle = 'rgba(168, 85, 247, 0.04)';
      ctx.fillRect(xSoakEnd, m.top, (m.left + plotW) - xSoakEnd, plotH);

      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRamp, m.top); ctx.lineTo(xRamp, m.top + plotH);
      ctx.moveTo(xSoakEnd, m.top); ctx.lineTo(xSoakEnd, m.top + plotH);
      ctx.stroke();
      ctx.restore();
    }

    // Stage Names at top of regions (Crisp & non-colliding)
    ctx.font = FONT_BOLD;
    ctx.fillStyle = isLight ? '#475569' : 'rgba(148, 163, 184, 0.50)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N₂ RAMP', (m.left + xRamp) / 2, m.top + 4);
    ctx.fillText('OXIDATION SOAK', (xRamp + xSoakEnd) / 2, m.top + 4);
    ctx.fillText('N₂ COOL-DOWN', (xSoakEnd + m.left + plotW) / 2, m.top + 4);

    // Horizontal Grid Lines
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var g = 0; g <= 4; g++) {
      var gy = m.top + (g / 4) * plotH;
      ctx.moveTo(m.left, gy);
      ctx.lineTo(m.left + plotW, gy);
    }
    ctx.stroke();

    // X-Axis Time Ticks and Numerical Labels along bottom
    ctx.font = FONT_FAMILY;
    ctx.fillStyle = isLight ? '#475569' : '#64748b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    var numTicks = 6;
    for (var tx = 0; tx <= numTicks; tx++) {
      var timeVal = (tx / numTicks) * t_total;
      var tickX = m.left + (tx / numTicks) * plotW;

      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tickX, m.top + plotH);
      ctx.lineTo(tickX, m.top + plotH + 3);
      ctx.stroke();

      ctx.fillText(timeVal.toFixed(timeVal >= 10 ? 0 : 1) + 'm', tickX, m.top + plotH + 5);
    }
  };

  OxidationCharts.prototype.renderTopChart = function (trajectory, state, oxidantLabel, hoverTime, theme) {
    var canvas = this.canvasTop;
    var ctx = this.ctxTop;
    var rect = canvas.getBoundingClientRect();
    var w = Math.round(rect.width) || 600;
    var h = Math.round(rect.height) || 145;
    var dpr = window.devicePixelRatio || 1;
    var isLight = theme === 'light';

    // Auto-sync backing resolution with bounding box to eliminate any blur or pixelation
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = isLight ? '#ffffff' : '#0a0d14';
    ctx.fillRect(0, 0, w, h);

    var m = this.margins;
    var plotW = w - m.left - m.right;
    var plotH = h - m.top - m.bottom;
    var t_total = trajectory.t_total || 1.0;
    var steps = trajectory.steps;

    // Scales
    var maxTox = Math.max(5.0, trajectory.final.x_ox * 1.15);
    var minTemp = 500;
    var maxTemp = Math.max(1200, (trajectory.params.tempPeak || 850) + 50);

    function getX(t) {
      return m.left + (t / t_total) * plotW;
    }
    function getYOx(x_ox) {
      return m.top + plotH - (x_ox / maxTox) * plotH;
    }
    function getYTemp(temp) {
      return m.top + plotH - ((temp - minTemp) / (maxTemp - minTemp)) * plotH;
    }

    // 1. Grid & Stage Backgrounds
    this.drawChartGridAndStages(ctx, w, h, m, trajectory, theme);

    // 2. Curves
    // A. Temperature Curve (Amber/Orange)
    ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (var i = 0; i < steps.length; i++) {
      var ptX = getX(steps[i].t);
      var ptYTemp = getYTemp(steps[i].T);
      if (i === 0) ctx.moveTo(ptX, ptYTemp);
      else ctx.lineTo(ptX, ptYTemp);
    }
    ctx.stroke();

    // B. Oxide Thickness Curve (Cyan Glowing with Fill)
    var gradOx = ctx.createLinearGradient(0, m.top, 0, m.top + plotH);
    if (isLight) {
      gradOx.addColorStop(0, 'rgba(2, 132, 199, 0.20)');
      gradOx.addColorStop(1, 'rgba(2, 132, 199, 0.01)');
    } else {
      gradOx.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
      gradOx.addColorStop(1, 'rgba(56, 189, 248, 0.01)');
    }

    ctx.beginPath();
    for (var j = 0; j < steps.length; j++) {
      var px = getX(steps[j].t);
      var py = getYOx(steps[j].x_ox);
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.lineTo(getX(steps[steps.length - 1].t), m.top + plotH);
    ctx.lineTo(m.left, m.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradOx;
    ctx.fill();

    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (var k = 0; k < steps.length; k++) {
      var kx = getX(steps[k].t);
      var ky = getYOx(steps[k].x_ox);
      if (k === 0) ctx.moveTo(kx, ky);
      else ctx.lineTo(kx, ky);
    }
    ctx.stroke();

    // 3. Current Live Simulation Time Cursor
    if (state && typeof state.t === 'number') {
      var curX = getX(state.t);
      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(248, 250, 252, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(curX, m.top);
      ctx.lineTo(curX, m.top + plotH);
      ctx.stroke();

      var curYOx = getYOx(state.x_ox);
      var curYTemp = getYTemp(state.T);

      ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.beginPath(); ctx.arc(curX, curYOx, 3.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = isLight ? '#d97706' : '#f59e0b';
      ctx.beginPath(); ctx.arc(curX, curYTemp, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // 4. Synchronized Interactive Hover Cursor & Refined Tooltip
    if (typeof hoverTime === 'number' && global.OxidationPhysics) {
      var hovState = global.OxidationPhysics.interpolateState(trajectory, hoverTime);
      if (hovState) {
        var hovX = getX(hoverTime);
        var hovYOx = getYOx(hovState.x_ox);
        var hovYTemp = getYTemp(hovState.T);

        // Vertical Hover Hairline
        ctx.save();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hovX, m.top);
        ctx.lineTo(hovX, m.top + plotH);
        ctx.stroke();
        ctx.restore();

        // Glowing Highlight Points
        ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.shadowColor = isLight ? 'rgba(2, 132, 199, 0.4)' : '#38bdf8';
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(hovX, hovYOx, 4.5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = isLight ? '#d97706' : '#f59e0b';
        ctx.shadowColor = isLight ? 'rgba(217, 119, 6, 0.4)' : '#f59e0b';
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(hovX, hovYTemp, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Tooltip Box with clean vertical rows
        var tipW = 148;
        var tipH = 54;
        var tipX = (hovX + tipW + 10 > w - m.right) ? (hovX - tipW - 10) : (hovX + 10);
        var tipY = Math.max(m.top + 2, Math.min(m.top + plotH - tipH - 2, (hovYOx + hovYTemp) / 2 - tipH / 2));

        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(10, 14, 23, 0.95)';
        ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(tipX, tipY, tipW, tipH, 4) : ctx.rect(tipX, tipY, tipW, tipH);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.font = FONT_BOLD;
        ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
        var stageLabel = hovState.stage === 'ramp_up' ? 'N₂ Ramp' : (hovState.stage === 'soak' ? 'Active Soak' : 'Cool-Down');
        ctx.fillText('t = ' + hoverTime.toFixed(1) + ' min (' + stageLabel + ')', tipX + 6, tipY + 5);

        ctx.font = FONT_FAMILY;
        ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
        ctx.fillText('Oxide: ' + hovState.x_ox.toFixed(2) + ' nm', tipX + 6, tipY + 17);

        ctx.fillStyle = isLight ? '#d97706' : '#f59e0b';
        ctx.fillText('Temp:  ' + Math.round(hovState.T) + ' °C', tipX + 6, tipY + 29);

        ctx.fillStyle = isLight ? '#0f172a' : '#cbd5e1';
        ctx.fillText('Rate:  ' + (hovState.dxdt || 0).toFixed(3) + ' nm/min', tipX + 6, tipY + 41);
      }
    }

    // 5. Y-Axis Numbers
    // Left: Oxide Thickness (nm) in Cyan
    ctx.font = FONT_FAMILY;
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var ti = 0; ti <= 4; ti++) {
      var toxVal = ((4 - ti) / 4) * maxTox;
      var ty = m.top + (ti / 4) * plotH;
      ctx.fillText(toxVal.toFixed(toxVal >= 10 ? 0 : 1) + 'nm', m.left - 5, ty);
    }

    // Right: Temperature (°C) in Amber
    ctx.fillStyle = isLight ? '#d97706' : '#f59e0b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (var tti = 0; tti <= 4; tti++) {
      var tempVal = minTemp + ((4 - tti) / 4) * (maxTemp - minTemp);
      var tty = m.top + (tti / 4) * plotH;
      ctx.fillText(Math.round(tempVal) + '°C', m.left + plotW + 5, tty);
    }

    ctx.restore();
  };

  OxidationCharts.prototype.renderBottomChart = function (trajectory, state, chemCfg, hoverTime, theme) {
    var canvas = this.canvasBottom;
    var ctx = this.ctxBottom;
    var rect = canvas.getBoundingClientRect();
    var w = Math.round(rect.width) || 600;
    var h = Math.round(rect.height) || 145;
    var dpr = window.devicePixelRatio || 1;
    var isLight = theme === 'light';

    // Resolve chemistry configuration (color, label, glow)
    if (!chemCfg || typeof chemCfg !== 'object') {
      chemCfg = getChemConfig(chemCfg);
    }
    var oxColor = chemCfg.color || '#22d3ee';
    var oxPlotColor = isLight ? (chemCfg.id === 'dry' ? '#0284c7' : (chemCfg.id === 'wet' ? '#059669' : '#7c3aed')) : oxColor;
    var oxGlow = chemCfg.glow || 'rgba(34, 211, 238, 0.45)';
    var oxFillTop = isLight ? 'rgba(2, 132, 199, 0.18)' : (chemCfg.chartFillTop || 'rgba(34, 211, 238, 0.28)');
    var oxFillBottom = isLight ? 'rgba(2, 132, 199, 0.01)' : (chemCfg.chartFillBottom || 'rgba(34, 211, 238, 0.02)');
    var oxLabel = chemCfg.label || 'O₂ Oxidant';
    var oxShort = chemCfg.shortLabel || 'O₂';

    // Auto-sync backing resolution with bounding box to eliminate any blur or pixelation
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = isLight ? '#ffffff' : '#0a0d14';
    ctx.fillRect(0, 0, w, h);

    var m = this.margins;
    var plotW = w - m.left - m.right;
    var plotH = h - m.top - m.bottom;
    var t_total = trajectory.t_total || 1.0;
    var steps = trajectory.steps;

    function getX(t) {
      return m.left + (t / t_total) * plotW;
    }
    function getYConc(pct) {
      return m.top + plotH - (pct / 100.0) * plotH;
    }

    // 1. Grid & Stage Backgrounds
    this.drawChartGridAndStages(ctx, w, h, m, trajectory, theme);

    // 2. Curves
    // A. N2 Purge/Carrier (Dashed Slate)
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = isLight ? '#64748b' : '#94a3b8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (var i = 0; i < steps.length; i++) {
      var pxN2 = getX(steps[i].t);
      var pyN2 = getYConc(steps[i].C_n2 * 100.0);
      if (i === 0) ctx.moveTo(pxN2, pyN2);
      else ctx.lineTo(pxN2, pyN2);
    }
    ctx.stroke();
    ctx.restore();

    // B. Active Oxidant Curve (Dynamic Chemistry Color with Glow)
    var gradOx = ctx.createLinearGradient(0, m.top, 0, m.top + plotH);
    gradOx.addColorStop(0, oxFillTop);
    gradOx.addColorStop(1, oxFillBottom);

    ctx.beginPath();
    for (var j = 0; j < steps.length; j++) {
      var pxOx = getX(steps[j].t);
      var pyOx = getYConc(steps[j].C_ox * 100.0);
      if (j === 0) ctx.moveTo(pxOx, pyOx);
      else ctx.lineTo(pxOx, pyOx);
    }
    ctx.lineTo(getX(steps[steps.length - 1].t), m.top + plotH);
    ctx.lineTo(m.left, m.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradOx;
    ctx.fill();

    ctx.strokeStyle = oxPlotColor;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (var k = 0; k < steps.length; k++) {
      var kxOx = getX(steps[k].t);
      var kyOx = getYConc(steps[k].C_ox * 100.0);
      if (k === 0) ctx.moveTo(kxOx, kyOx);
      else ctx.lineTo(kxOx, kyOx);
    }
    ctx.stroke();

    // 3. Current Live Simulation Time Cursor
    if (state && typeof state.t === 'number') {
      var curX = getX(state.t);
      ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.65)' : 'rgba(248, 250, 252, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(curX, m.top);
      ctx.lineTo(curX, m.top + plotH);
      ctx.stroke();

      var curYN2 = getYConc(state.C_n2 * 100.0);
      var curYOx = getYConc(state.C_ox * 100.0);

      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.beginPath(); ctx.arc(curX, curYN2, 3.5, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = oxPlotColor;
      ctx.beginPath(); ctx.arc(curX, curYOx, 3.5, 0, Math.PI * 2); ctx.fill();
    }

    // 4. Synchronized Interactive Hover Cursor & Refined Tooltip
    if (typeof hoverTime === 'number' && global.OxidationPhysics) {
      var hovState = global.OxidationPhysics.interpolateState(trajectory, hoverTime);
      if (hovState) {
        var hovX = getX(hoverTime);
        var hovYN2 = getYConc(hovState.C_n2 * 100.0);
        var hovYOx = getYConc(hovState.C_ox * 100.0);

        // Vertical Hover Hairline
        ctx.save();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = oxPlotColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hovX, m.top);
        ctx.lineTo(hovX, m.top + plotH);
        ctx.stroke();
        ctx.restore();

        // Glowing Dots
        ctx.fillStyle = oxPlotColor;
        ctx.shadowColor = oxGlow;
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(hovX, hovYOx, 4.5, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
        ctx.shadowColor = isLight ? 'rgba(0,0,0,0.1)' : '#94a3b8';
        ctx.shadowBlur = 5;
        ctx.beginPath(); ctx.arc(hovX, hovYN2, 4.0, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Clean Tooltip with separate vertical lines
        var tipW = 156;
        var tipH = 54;
        var tipX = (hovX + tipW + 10 > w - m.right) ? (hovX - tipW - 10) : (hovX + 10);
        var tipY = Math.max(m.top + 2, Math.min(m.top + plotH - tipH - 2, (hovYN2 + hovYOx) / 2 - tipH / 2));

        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(10, 14, 23, 0.95)';
        ctx.strokeStyle = isLight ? '#cbd5e1' : '#334155';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(tipX, tipY, tipW, tipH, 4) : ctx.rect(tipX, tipY, tipW, tipH);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        ctx.font = FONT_BOLD;
        ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
        var stageLabel = hovState.stage === 'ramp_up' ? 'N₂ Ramp' : (hovState.stage === 'soak' ? 'Active Soak' : 'Cool-Down');
        ctx.fillText('t = ' + hoverTime.toFixed(1) + ' min (' + stageLabel + ')', tipX + 6, tipY + 5);

        ctx.font = FONT_FAMILY;
        ctx.fillStyle = oxPlotColor;
        ctx.fillText(oxLabel + ': ' + (hovState.C_ox * 100).toFixed(1) + '%', tipX + 6, tipY + 17);

        ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
        ctx.fillText('N₂ Purge: ' + (hovState.C_n2 * 100).toFixed(1) + '%', tipX + 6, tipY + 29);

        ctx.fillStyle = isLight ? '#0f172a' : '#cbd5e1';
        var pText = hovState.P_ox < 0.02 ? (hovState.P_ox * 760).toFixed(1) + ' Torr' : hovState.P_ox.toFixed(3) + ' atm';
        ctx.fillText('P_ox: ' + pText + ' | MFC: ' + (hovState.C_ox > 0.02 ? 'ON' : 'OFF'), tipX + 6, tipY + 41);
      }
    }

    // 5. Y-Axis Numbers
    ctx.font = FONT_FAMILY;
    ctx.fillStyle = isLight ? '#475569' : '#64748b';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var c = 0; c <= 4; c++) {
      var pct = (4 - c) * 25;
      var cy = m.top + (c / 4) * plotH;
      ctx.fillText(pct + '%', m.left - 5, cy);
    }

    ctx.restore();
  };

  global.OxidationCharts = OxidationCharts;

})(typeof window !== 'undefined' ? window : this);
