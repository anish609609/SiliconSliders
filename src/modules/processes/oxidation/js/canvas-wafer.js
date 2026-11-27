/**
 * SiliconSliders - Animated 2D Wafer Cross-Section & Reaction Front Renderer
 * Uses shared OxidationThermal colormap (600-1200 °C), subtle activeGas ambient tint,
 * Deal-Grove 1D oxidant concentration profile C(x) across SiO2, dynamic recipe auto-scaling
 * (56% Up / 44% Down around fixed Orig. Si Datum), and interactive cursor inspection.
 */

(function (global) {
  'use strict';

  var FONT_FAMILY = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  var FONT_BOLD = '600 10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  var FONT_SMALL = '9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

  function getChemConfig(chem) {
    if (chem && typeof chem === 'object' && chem.color) return chem;
    var key = (chem || '').toLowerCase();
    if (key.indexOf('wet') !== -1 || key.indexOf('steam') !== -1 || key.indexOf('h2o') !== -1) {
      return {
        id: 'wet',
        name: 'Wet H₂O',
        label: 'H₂O Vapor',
        shortLabel: 'H₂O',
        color: '#3b82f6',
        glow: 'rgba(59, 130, 246, 0.45)',
        diffSpeed: 0.85,
        jitter: 1.05
      };
    }
    if (key.indexOf('issg') !== -1 || key.indexOf('radical') !== -1) {
      return {
        id: 'issg',
        name: 'ISSG Radical',
        label: 'O* / OH* Radicals',
        shortLabel: 'Radicals',
        color: '#c084fc',
        glow: 'rgba(192, 132, 252, 0.50)',
        diffSpeed: 1.15,
        jitter: 1.35
      };
    }
    return {
      id: 'dry',
      name: 'Dry O₂',
      label: 'O₂ Oxidant',
      shortLabel: 'O₂',
      color: '#22d3ee',
      glow: 'rgba(34, 211, 238, 0.45)',
      diffSpeed: 0.55,
      jitter: 0.70
    };
  }

  function hexToRgba(hex, alpha) {
    if (!hex || hex.charAt(0) !== '#' || hex.length < 7) {
      return 'rgba(56, 189, 248, ' + alpha + ')';
    }
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function WaferCanvasRenderer(canvasEl, options) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.mousePos = null;
    this.isHovering = false;
    this.flowPhase = 0;
    options = options || {};
    this.onZoomChange = options.onZoomChange || null;

    this.zoomLevel = 1.0;
    this.zoomLevels = [1.0, 2.0, 5.0, 10.0, 25.0, 50.0];

    this.initEvents();
  }

  WaferCanvasRenderer.prototype.initEvents = function () {
    var self = this;

    this.canvas.addEventListener('mousemove', function (e) {
      var rect = self.canvas.getBoundingClientRect();
      self.mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      self.isHovering = true;
    });

    this.canvas.addEventListener('mouseleave', function () {
      self.mousePos = null;
      self.isHovering = false;
    });

    this.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      if (e.deltaY < 0) {
        self.zoomIn();
      } else {
        self.zoomOut();
      }
      if (self.onZoomChange) {
        self.onZoomChange(self.zoomLevel);
      }
    }, { passive: false });
  };

  WaferCanvasRenderer.prototype.setZoomLevel = function (lvl) {
    this.zoomLevel = Math.max(1.0, Math.min(50.0, Number(lvl) || 1.0));
  };

  WaferCanvasRenderer.prototype.zoomIn = function () {
    for (var i = 0; i < this.zoomLevels.length; i++) {
      if (this.zoomLevels[i] > this.zoomLevel + 0.05) {
        this.zoomLevel = this.zoomLevels[i];
        if (this.onZoomChange) this.onZoomChange(this.zoomLevel);
        return;
      }
    }
    this.zoomLevel = 50.0;
    if (this.onZoomChange) this.onZoomChange(this.zoomLevel);
  };

  WaferCanvasRenderer.prototype.zoomOut = function () {
    for (var i = this.zoomLevels.length - 1; i >= 0; i--) {
      if (this.zoomLevels[i] < this.zoomLevel - 0.05) {
        this.zoomLevel = this.zoomLevels[i];
        if (this.onZoomChange) this.onZoomChange(this.zoomLevel);
        return;
      }
    }
    this.zoomLevel = 1.0;
    if (this.onZoomChange) this.onZoomChange(this.zoomLevel);
  };

  WaferCanvasRenderer.prototype.resetZoom = function () {
    this.zoomLevel = 1.0;
    if (this.onZoomChange) this.onZoomChange(this.zoomLevel);
  };

  WaferCanvasRenderer.prototype.getWaferColor = function (T) {
    if (global.OxidationThermal && global.OxidationThermal.temperatureToRgb) {
      return global.OxidationThermal.temperatureToRgb(T);
    }
    if (T <= 600) return { r: 35, g: 45, b: 62 };
    var f = Math.min(1.0, Math.max(0.0, (T - 600) / 600));
    return {
      r: Math.round(35 + f * 220),
      g: Math.round(45 + f * 197),
      b: Math.round(62 + f * 83)
    };
  };

  /**
   * Computes dynamic Y-axis scale (px per nm) from active recipe target thickness
   * so both ultra-thin (1.0 -> 1.34 nm) and thick field oxides clearly animate
   * their 56% Up / 44% Down expansion around Orig. Si Datum (0 nm).
   */
  WaferCanvasRenderer.prototype.getAutoScalePxPerNm = function (targetXox, canvasH) {
    var availableSpan = Math.max(80, (canvasH || 320) - 96);
    var maxDisplayH = Math.min(180, availableSpan * 0.72);
    var refTarget = Math.max(1.25, (Number(targetXox) || 10.0) * 1.12);
    var basePxPerNm = maxDisplayH / refTarget;
    return basePxPerNm * this.zoomLevel;
  };

  WaferCanvasRenderer.prototype.getVisualHeight = function (x_ox, targetXox, canvasH) {
    if (x_ox <= 0.01) return 0.0;
    var pxPerNm = this.getAutoScalePxPerNm(targetXox, canvasH);
    return x_ox * pxPerNm;
  };

  WaferCanvasRenderer.prototype.render = function (state, chemistry, orientation, P_total, theme, targetXox, activeGas) {
    var canvas = this.canvas;
    var ctx = this.ctx;
    var rect = canvas.getBoundingClientRect();
    var lw = Math.round(rect.width) || 640;
    var lh = Math.round(rect.height) || 320;
    var dpr = window.devicePixelRatio || 1;

    var isLight = theme === 'light' || (!theme && typeof document !== 'undefined' && document.documentElement.classList.contains('light'));

    if (canvas.width !== Math.round(lw * dpr) || canvas.height !== Math.round(lh * dpr)) {
      canvas.width = Math.round(lw * dpr);
      canvas.height = Math.round(lh * dpr);
    }

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lw, lh);

    if (!state) {
      ctx.restore();
      return;
    }

    var T = state.T || 600;
    var x_ox = (typeof state.x_ox === 'number') ? state.x_ox : 1.0;
    var C_ox = state.C_ox || 0.0;
    var C_n2 = state.C_n2 !== undefined ? state.C_n2 : 1.0;
    var orientStr = orientation || '100';
    var P_chamber = (typeof P_total === 'number') ? P_total : 1.0;
    var chemCfg = getChemConfig(chemistry);
    var gasKey = activeGas || (C_ox >= 0.08 ? chemCfg.id : 'n2');

    // Reserve 58px on right edge for the vertical TemperatureColorBar
    var chamberTop = 26;
    var chamberLeft = 52;
    var chamberRight = lw - 58;
    var chamberWidth = Math.max(120, chamberRight - chamberLeft);
    var datumY = Math.round(lh * 0.56);

    var finalTarget = (typeof targetXox === 'number' && targetXox > 0) ? targetXox : Math.max(1.5, x_ox);
    var pxPerNm = this.getAutoScalePxPerNm(finalTarget, lh);
    var h_disp = this.getVisualHeight(x_ox, finalTarget, lh);
    var maxUpRoom = datumY - (chamberTop + 14);
    var maxDownRoom = (lh - 16) - datumY;
    var y_up = Math.max(chamberTop + 10, datumY - 0.56 * h_disp);
    var y_down = Math.min(lh - 14, datumY + 0.44 * h_disp);
    var clampedH = y_down - y_up;

    var waferRgb = this.getWaferColor(T);
    if (isLight && T <= 600) {
      waferRgb = { r: 51, g: 65, b: 85 };
    }
    var waferColor = 'rgb(' + waferRgb.r + ',' + waferRgb.g + ',' + waferRgb.b + ')';

    // 1. Furnace Background
    var bgGrad = ctx.createLinearGradient(0, 0, 0, lh);
    if (isLight) {
      bgGrad.addColorStop(0, '#f8fafc');
      bgGrad.addColorStop(0.65, '#f1f5f9');
      bgGrad.addColorStop(1, '#e2e8f0');
    } else {
      bgGrad.addColorStop(0, '#0a0e17');
      bgGrad.addColorStop(0.65, '#0f172a');
      bgGrad.addColorStop(1, '#080b11');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, lw, lh);

    // 1a. Subtle activeGas ambient tint in gas space (replaces bouncing dots)
    var gasTintHex = gasKey === 'n2' ? '#94a3b8' : (gasKey === 'wet' ? '#3b82f6' : (gasKey === 'issg' ? '#c084fc' : '#22d3ee'));
    var gasTintAlpha = gasKey === 'n2' ? 0.06 : Math.min(0.24, 0.06 + 0.16 * C_ox);
    var gasGrad = ctx.createLinearGradient(0, chamberTop, 0, y_up);
    gasGrad.addColorStop(0, hexToRgba(gasTintHex, gasTintAlpha * 0.45));
    gasGrad.addColorStop(1, hexToRgba(gasTintHex, gasTintAlpha * 1.2));
    ctx.fillStyle = gasGrad;
    ctx.fillRect(chamberLeft, chamberTop, chamberWidth, Math.max(0, y_up - chamberTop));

    // Gentle continuum laminar drift lines (NO bouncing dots)
    this.flowPhase = (this.flowPhase + (gasKey === 'n2' ? 0.55 : (0.9 + C_ox * 1.2))) % 120;
    ctx.save();
    ctx.strokeStyle = hexToRgba(gasTintHex, gasKey === 'n2' ? 0.18 : (0.22 + 0.20 * C_ox));
    ctx.lineWidth = 1.2;
    ctx.setLineDash([28, 32]);
    ctx.lineDashOffset = -this.flowPhase;
    for (var fi = 0; fi < 3; fi++) {
      var fy = chamberTop + 18 + fi * Math.max(14, (y_up - chamberTop - 26) / 3);
      if (fy < y_up - 6) {
        ctx.beginPath();
        ctx.moveTo(chamberLeft + 8, fy);
        ctx.lineTo(chamberRight - 8, fy);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Chamber Outline
    ctx.strokeStyle = isLight ? '#cbd5e1' : '#1e293b';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(chamberLeft, chamberTop, chamberWidth, lh - chamberTop - 8);

    // 1b. Dynamic Vertical Y-Axis Scale / Metrology Ruler (Calibrated to recipe scale)
    var rulerAxisX = 46;
    ctx.strokeStyle = isLight ? '#94a3b8' : '#334155';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(rulerAxisX, chamberTop);
    ctx.lineTo(rulerAxisX, lh - 8);
    ctx.stroke();

    ctx.font = FONT_BOLD;
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Y (nm)', rulerAxisX - 4, chamberTop - 4);

    var visibleSpanNm = (lh - 8 - chamberTop) / Math.max(0.001, pxPerNm);
    var targetStep = visibleSpanNm / 6;
    var niceSteps = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    var stepNm = niceSteps[niceSteps.length - 1];
    for (var s = 0; s < niceSteps.length; s++) {
      if (niceSteps[s] >= targetStep * 0.70) {
        stepNm = niceSteps[s];
        break;
      }
    }

    var minZ = Math.floor(((datumY - (lh - 8)) / pxPerNm) / stepNm) * stepNm;
    var maxZ = Math.ceil(((datumY - chamberTop) / pxPerNm) / stepNm) * stepNm;

    ctx.font = FONT_SMALL;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (var z = minZ; z <= maxZ; z += stepNm) {
      var roundedZ = Math.round(z * 1000) / 1000;
      var ty = Math.round(datumY - roundedZ * pxPerNm);
      if (ty < chamberTop + 4 || ty > lh - 12) continue;

      var isDatum = Math.abs(roundedZ) < 0.001;
      ctx.strokeStyle = isDatum
        ? (isLight ? '#0284c7' : '#38bdf8')
        : (isLight ? '#cbd5e1' : '#475569');
      ctx.lineWidth = isDatum ? 1.5 : 1.0;
      ctx.beginPath();
      ctx.moveTo(isDatum ? rulerAxisX - 6 : rulerAxisX - 4, ty);
      ctx.lineTo(rulerAxisX, ty);
      ctx.stroke();

      ctx.fillStyle = isDatum
        ? (isLight ? '#0284c7' : '#38bdf8')
        : (isLight ? '#64748b' : '#94a3b8');

      var lbl;
      if (isDatum) {
        lbl = '0';
      } else if (Math.abs(roundedZ) >= 1000) {
        lbl = (roundedZ / 1000).toFixed(1) + 'µ';
      } else if (stepNm < 0.2) {
        lbl = (roundedZ > 0 ? '+' : '') + roundedZ.toFixed(2);
      } else if (stepNm < 1) {
        lbl = (roundedZ > 0 ? '+' : '') + roundedZ.toFixed(1);
      } else {
        lbl = (roundedZ > 0 ? '+' : '') + Math.round(roundedZ);
      }
      ctx.fillText(lbl, rulerAxisX - 6, ty);

      if (!isDatum) {
        ctx.save();
        ctx.setLineDash([2, 4]);
        ctx.strokeStyle = isLight ? 'rgba(203, 213, 225, 0.45)' : 'rgba(30, 41, 59, 0.45)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(chamberLeft, ty);
        ctx.lineTo(chamberRight, ty);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 2. Render Silicon Substrate (Below y_down)
    var siGrad = ctx.createLinearGradient(0, y_down, 0, lh);
    siGrad.addColorStop(0, waferColor);
    siGrad.addColorStop(0.35, waferColor);
    siGrad.addColorStop(1, isLight ? '#1e293b' : 'rgb(' + Math.round(waferRgb.r * 0.55) + ',' + Math.round(waferRgb.g * 0.55) + ',' + Math.round(waferRgb.b * 0.65) + ')');
    ctx.fillStyle = siGrad;
    ctx.fillRect(chamberLeft, y_down, chamberWidth, Math.max(0, (lh - 8) - y_down));

    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
    var stepLattice = Math.max(14, Math.round(24 / Math.sqrt(this.zoomLevel)));
    for (var lx = chamberLeft + 12; lx < chamberRight - 12; lx += stepLattice) {
      ctx.fillRect(lx, y_down + 4, 1.0, Math.max(0, (lh - 16) - y_down));
    }

    ctx.font = FONT_SMALL;
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.78)' : 'rgba(255, 255, 255, 0.45)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SILICON SUBSTRATE <' + orientStr + '> (Monocrystalline Si)', chamberLeft + 10, lh - 15);

    // 3. Render Growing SiO2 Dielectric Layer
    if (clampedH > 0.5) {
      var oxGrad = ctx.createLinearGradient(0, y_up, 0, y_down);
      if (isLight) {
        oxGrad.addColorStop(0, 'rgba(14, 165, 233, 0.72)');
        oxGrad.addColorStop(0.5, 'rgba(2, 132, 199, 0.55)');
        oxGrad.addColorStop(1, 'rgba(3, 105, 161, 0.75)');
      } else {
        oxGrad.addColorStop(0, 'rgba(56, 189, 248, 0.72)');
        oxGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.58)');
        oxGrad.addColorStop(1, 'rgba(3, 105, 161, 0.72)');
      }
      ctx.fillStyle = oxGrad;
      ctx.fillRect(chamberLeft, y_up, chamberWidth, clampedH);

      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(chamberLeft, y_up);
      ctx.lineTo(chamberRight, y_up);
      ctx.stroke();

      ctx.strokeStyle = isLight ? '#b45309' : '#f59e0b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(chamberLeft, y_down);
      ctx.lineTo(chamberRight, y_down);
      ctx.stroke();

      if (this.zoomLevel >= 5.0) {
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 0.5;
        var numPlanes = Math.min(8, Math.floor(clampedH / 10));
        for (var pl = 1; pl < numPlanes; pl++) {
          var pyPlane = y_up + (pl / numPlanes) * clampedH;
          ctx.beginPath();
          ctx.moveTo(chamberLeft + 20, pyPlane);
          ctx.lineTo(chamberRight - 20, pyPlane);
          ctx.stroke();
        }
      }

      // 3b. 1D Deal-Grove Oxidant Concentration Profile C(x) across SiO2 during active oxidation
      if (C_ox > 0.02 && clampedH >= 12) {
        var A_dg = (state.B > 0 && state.B_over_A > 0) ? (state.B / state.B_over_A) : 80.0;
        var ciRatio = Math.max(0.05, Math.min(0.98, 1.0 / (1.0 + (2.0 * x_ox) / Math.max(1e-4, A_dg))));
        var profLeft = chamberLeft + Math.min(130, chamberWidth * 0.24);
        var profW = Math.min(150, chamberWidth * 0.30);
        var cStarX = profLeft + profW * Math.min(1.0, Math.max(0.18, C_ox));
        var cIntX = profLeft + (cStarX - profLeft) * ciRatio;

        // Shaded concentration area inside SiO2
        ctx.save();
        ctx.fillStyle = hexToRgba(gasTintHex, 0.22);
        ctx.beginPath();
        ctx.moveTo(profLeft, y_up);
        ctx.lineTo(cStarX, y_up);
        ctx.lineTo(cIntX, y_down);
        ctx.lineTo(profLeft, y_down);
        ctx.closePath();
        ctx.fill();

        // Zero-axis baseline of C(x) overlay
        ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.35)' : 'rgba(248, 250, 252, 0.35)';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(profLeft, y_up);
        ctx.lineTo(profLeft, y_down);
        ctx.stroke();
        ctx.setLineDash([]);

        // Glowing C(x) linear diffusion profile slope C* -> C_i
        ctx.strokeStyle = gasTintHex;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cStarX, y_up + 1);
        ctx.lineTo(cIntX, y_down - 1);
        ctx.stroke();

        // Surface C* and Interface C_i endpoints
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cStarX, y_up + 1, 3.0, 0, Math.PI * 2);
        ctx.arc(cIntX, y_down - 1, 3.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = gasTintHex;
        ctx.lineWidth = 1.4;
        ctx.stroke();

        ctx.font = FONT_BOLD;
        ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('C*', cStarX + 5, y_up - 2);
        ctx.textBaseline = 'top';
        ctx.fillStyle = isLight ? '#b45309' : '#fbbf24';
        ctx.fillText('Cᵢ (' + Math.round(ciRatio * 100) + '%)', cIntX + 5, y_down + 2);
        ctx.font = FONT_SMALL;
        ctx.fillStyle = isLight ? '#0f172a' : '#e2e8f0';
        ctx.textBaseline = 'middle';
        ctx.fillText('C(x)', profLeft + 4, (y_up + y_down) * 0.5);
        ctx.restore();
      }
    }

    // 4. Reference Datum Line (Original Silicon Surface)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(248, 250, 252, 0.55)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(chamberLeft, datumY);
    ctx.lineTo(chamberRight, datumY);
    ctx.stroke();
    ctx.restore();

    // 5. Staggered Leader Lines (spaced clear of ColorBar and ← Back pill)
    ctx.font = FONT_FAMILY;
    var datumText = 'Orig. Si Datum (0 nm)';
    ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(datumText, chamberLeft + 8, datumY - 4);

    // 56% Up Expansion
    var upText = '56% Up (+' + (0.56 * x_ox).toFixed(2) + ' nm)';
    var upBadgeY = Math.max(chamberTop + 26, y_up - 10);
    var badgeRightX = chamberRight - 8;

    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(chamberRight - 58, y_up);
    ctx.lineTo(chamberRight - 38, upBadgeY + 3);
    ctx.lineTo(chamberRight - 8, upBadgeY + 3);
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.fillText(upText, badgeRightX, upBadgeY - 1);

    // 44% Down Consumed Si
    var downText = '44% Down (-' + (0.44 * x_ox).toFixed(2) + ' nm)';
    var downBadgeY = Math.min(lh - 28, Math.max(datumY + 22, y_down + 12));

    ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(chamberRight - 58, y_down);
    ctx.lineTo(chamberRight - 38, downBadgeY - 3);
    ctx.lineTo(chamberRight - 8, downBadgeY - 3);
    ctx.stroke();

    ctx.fillStyle = isLight ? '#d97706' : '#f59e0b';
    ctx.textBaseline = 'top';
    ctx.fillText(downText, badgeRightX, downBadgeY + 4);

    // Pressure & Gas Regime Pill (top-right inside chamber to avoid top-left ← Back pill)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_BOLD;
    var pRegime = (P_chamber < 0.05) ? 'MOLECULAR' : ((P_chamber <= 2.0) ? 'CONTINUUM' : 'HiPOx');
    ctx.fillStyle = gasKey === 'n2' ? (isLight ? '#64748b' : '#94a3b8') : gasTintHex;
    ctx.fillText(
      (gasKey === 'n2' ? 'N₂ PURGE' : chemCfg.label.toUpperCase()) + ' · ' +
      (P_chamber < 0.02 ? (P_chamber * 760).toFixed(1) + ' Torr' : P_chamber.toFixed(2) + ' atm') +
      ' (' + pRegime + ')',
      chamberRight - 6,
      12
    );

    // Nanoscale Physical Scale Bar
    var rulerNm = (pxPerNm >= 35) ? 0.5 : ((pxPerNm >= 12) ? 2 : ((pxPerNm >= 3) ? 10 : 50));
    var rulerPx = Math.round(rulerNm * pxPerNm);
    if (rulerPx > 14 && rulerPx < 130) {
      var rX = chamberRight - rulerPx - 12;
      var rY = lh - 12;
      ctx.strokeStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(rX, rY - 3); ctx.lineTo(rX, rY);
      ctx.lineTo(rX + rulerPx, rY);
      ctx.lineTo(rX + rulerPx, rY - 3);
      ctx.stroke();

      ctx.font = FONT_SMALL;
      ctx.fillStyle = isLight ? '#64748b' : '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(rulerNm + ' nm', rX + rulerPx / 2, rY - 4);
    }

    // Interactive Cursor Hover Point & Concentration Inspector
    if (this.isHovering && this.mousePos) {
      var mx = this.mousePos.x;
      var my = this.mousePos.y;

      if (mx >= chamberLeft && mx <= chamberRight && my >= chamberTop && my <= lh - 8) {
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(mx, my - 8); ctx.lineTo(mx, my + 8);
        ctx.moveTo(mx - 8, my); ctx.lineTo(mx + 8, my);
        ctx.stroke();
        ctx.setLineDash([]);

        var tipW = 192;
        var tipH = 54;
        var tipX = (mx + tipW + 10 > chamberRight) ? (mx - tipW - 10) : (mx + 10);
        var tipY = Math.max(chamberTop + 2, Math.min(lh - tipH - 10, my - tipH / 2));

        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(10, 14, 23, 0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(tipX, tipY, tipW, tipH, 4) : ctx.rect(tipX, tipY, tipW, tipH);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        var titleOx = gasKey === 'n2' ? (isLight ? '#475569' : '#94a3b8') : gasTintHex;
        var textMain = isLight ? '#0f172a' : '#e2e8f0';
        var textMuted = isLight ? '#64748b' : '#94a3b8';

        if (my < y_up) {
          ctx.strokeStyle = isLight ? '#cbd5e1' : gasTintHex;
          ctx.fill();
          ctx.stroke();

          ctx.font = FONT_BOLD;
          ctx.fillStyle = titleOx;
          ctx.fillText('● CHAMBER GAS AMBIENT', tipX + 6, tipY + 5);

          ctx.font = FONT_FAMILY;
          ctx.fillStyle = textMain;
          ctx.fillText('N₂: ' + (C_n2 * 100).toFixed(1) + '% | ' + chemCfg.shortLabel + ': ' + (C_ox * 100).toFixed(1) + '%', tipX + 6, tipY + 17);

          ctx.fillStyle = titleOx;
          var pText = P_chamber < 0.02 ? (P_chamber * 760).toFixed(1) + ' Torr' : P_chamber.toFixed(2) + ' atm';
          ctx.fillText('Pressure: ' + pText + ' (' + chemCfg.label + ')', tipX + 6, tipY + 29);

          ctx.fillStyle = textMuted;
          ctx.fillText('Regime: Continuum Laminar Supply', tipX + 6, tipY + 41);

        } else if (my <= y_down) {
          var fracDepth = (clampedH > 0) ? Math.max(0, Math.min(1, (my - y_up) / clampedH)) : 0;
          var localDepthNm = fracDepth * x_ox;
          var A_loc = (state.B > 0 && state.B_over_A > 0) ? (state.B / state.B_over_A) : 80.0;
          var cIntLoc = 1.0 / (1.0 + (2.0 * x_ox) / Math.max(1e-4, A_loc));
          var localConcRel = (1.0 - (1.0 - cIntLoc) * fracDepth) * C_ox * 100.0;

          ctx.strokeStyle = isLight ? '#cbd5e1' : gasTintHex;
          ctx.fill();
          ctx.stroke();

          ctx.font = FONT_BOLD;
          ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
          ctx.fillText('■ SiO₂ LAYER · C(x) PROFILE', tipX + 6, tipY + 5);

          ctx.font = FONT_FAMILY;
          ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
          ctx.fillText('Depth: ' + localDepthNm.toFixed(2) + ' / ' + x_ox.toFixed(2) + ' nm (' + (fracDepth * 100).toFixed(0) + '%)', tipX + 6, tipY + 17);

          ctx.fillStyle = textMain;
          ctx.fillText(chemCfg.shortLabel + ' C(x): ' + localConcRel.toFixed(1) + '% of C*', tipX + 6, tipY + 29);

          ctx.fillStyle = textMuted;
          ctx.fillText('Deal-Grove Fickian Diffusion', tipX + 6, tipY + 41);

        } else {
          var subColor = isLight ? '#d97706' : '#f59e0b';
          ctx.strokeStyle = isLight ? '#cbd5e1' : subColor;
          ctx.fill();
          ctx.stroke();

          ctx.font = FONT_BOLD;
          ctx.fillStyle = subColor;
          ctx.fillText('▲ SILICON SUBSTRATE <' + orientStr + '>', tipX + 6, tipY + 5);

          ctx.font = FONT_FAMILY;
          ctx.fillStyle = textMain;
          ctx.fillText('Temp: ' + Math.round(T) + ' °C | Consumed: ' + (0.44 * x_ox).toFixed(2) + ' nm', tipX + 6, tipY + 17);

          ctx.fillStyle = subColor;
          ctx.fillText('Upward Exp: +' + (0.56 * x_ox).toFixed(2) + ' nm (56%)', tipX + 6, tipY + 29);

          ctx.fillStyle = textMuted;
          ctx.fillText('Reaction Front at Si / SiO₂ Interface', tipX + 6, tipY + 41);
        }
      }
    }

    ctx.restore();
  };

  global.WaferCanvasRenderer = WaferCanvasRenderer;

})(typeof window !== 'undefined' ? window : this);

