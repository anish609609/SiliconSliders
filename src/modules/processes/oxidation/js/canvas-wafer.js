/**
 * Silicon Sliders - Animated Wafer Cross-Section Canvas Renderer
 * Physically Accurate Deal-Grove Particle Kinetics (Elastic N₂ Bounce vs. Fickian Oxidant Diffusion),
 * Dynamic Color Coding by Chemistry (Dry Cyan, Wet Emerald, ISSG Violet/Amber),
 * Interface Consumption Sparks, Pressure Dynamics, and Interactive Zoom & Inspection.
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
        color: '#10b981',       // Emerald / Teal-Green
        glow: 'rgba(16, 185, 129, 0.45)',
        diffSpeed: 0.85,        // Higher diffusivity in SiO2
        jitter: 1.05
      };
    }
    if (key.indexOf('issg') !== -1 || key.indexOf('radical') !== -1) {
      return {
        id: 'issg',
        name: 'ISSG Radical',
        label: 'O* / OH* Radicals',
        shortLabel: 'Radicals',
        color: '#c084fc',       // Vibrant Violet / Amber
        glow: 'rgba(192, 132, 252, 0.50)',
        diffSpeed: 1.15,        // Fast atomic radical mobility
        jitter: 1.35
      };
    }
    return {
      id: 'dry',
      name: 'Dry O₂',
      label: 'O₂ Oxidant',
      shortLabel: 'O₂',
      color: '#22d3ee',         // Bright Cyan
      glow: 'rgba(34, 211, 238, 0.45)',
      diffSpeed: 0.55,          // Slower molecular O2 diffusion
      jitter: 0.70
    };
  }

  function WaferCanvasRenderer(canvasEl, options) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.particles = [];
    this.sparks = [];
    this.maxParticles = 200;
    this.mousePos = null;
    this.isHovering = false;
    options = options || {};
    this.onZoomChange = options.onZoomChange || null;

    // Zoom state
    this.zoomLevel = 1.0;
    this.zoomLevels = [1.0, 2.0, 5.0, 10.0, 25.0, 50.0];

    this.initParticles();
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

  WaferCanvasRenderer.prototype.initParticles = function () {
    this.particles = [];
    var w = 600;
    var h = 230;
    for (var i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random() * w,
        y: 25 + Math.random() * (h * 0.45),
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        radius: 2.5,
        type: 'n2',
        inOxide: false
      });
    }
  };

  WaferCanvasRenderer.prototype.getWaferColor = function (T) {
    if (T <= 600) return { r: 35, g: 45, b: 62 };
    if (T <= 750) {
      var r = (T - 600) / 150;
      return {
        r: Math.round(35 + r * (135 - 35)),
        g: Math.round(45 + r * (32 - 45)),
        b: Math.round(62 + r * (32 - 62))
      };
    }
    if (T <= 900) {
      var r2 = (T - 750) / 150;
      return {
        r: Math.round(135 + r2 * (220 - 135)),
        g: Math.round(32 + r2 * (85 - 32)),
        b: Math.round(32 + r2 * (22 - 32))
      };
    }
    if (T <= 1050) {
      var r3 = (T - 900) / 150;
      return {
        r: Math.round(220 + r3 * (248 - 220)),
        g: Math.round(85 + r3 * (162 - 85)),
        b: Math.round(22 + r3 * (14 - 22))
      };
    }
    var r4 = Math.min(1.0, (T - 1050) / 100);
    return {
      r: Math.round(248 + r4 * (255 - 248)),
      g: Math.round(162 + r4 * (242 - 162)),
      b: Math.round(14 + r4 * (145 - 14))
    };
  };

  WaferCanvasRenderer.prototype.getVisualHeight = function (x_ox) {
    if (x_ox <= 0.05) return 0.0;
    var baseH = 0;
    if (x_ox <= 10) {
      baseH = 8.0 + (x_ox - 1.0) * 1.2;
    } else if (x_ox <= 50) {
      baseH = 18.8 + (x_ox - 10.0) * 0.5;
    } else {
      baseH = 38.8 + Math.min(42.0, Math.sqrt(x_ox - 50.0) * 1.8);
    }
    return Math.min(120.0, baseH * this.zoomLevel);
  };

  WaferCanvasRenderer.prototype.render = function (state, chemistry, orientation, P_total, theme) {
    var canvas = this.canvas;
    var ctx = this.ctx;
    var rect = canvas.getBoundingClientRect();
    var lw = Math.round(rect.width) || 600;
    var lh = Math.round(rect.height) || 225;
    var dpr = window.devicePixelRatio || 1;

    var isLight = theme === 'light' || (!theme && typeof document !== 'undefined' && document.documentElement.classList.contains('light'));

    // Auto-sync backing resolution
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
    var C_n2 = state.C_n2 || 1.0;
    var orientStr = orientation || '100';
    var P_chamber = (typeof P_total === 'number') ? P_total : 1.0;

    var chemCfg = getChemConfig(chemistry);

    // Chamber Dimensions
    var chamberTop = 24;
    var chamberLeft = 48;
    var chamberRight = lw - 14;
    var chamberWidth = chamberRight - chamberLeft;
    var datumY = Math.round(lh * 0.62);

    var h_disp = this.getVisualHeight(x_ox);
    var y_up = datumY - 0.56 * h_disp;
    var y_down = datumY + 0.44 * h_disp;

    var waferRgb = this.getWaferColor(T);
    if (isLight && T <= 600) {
      waferRgb = { r: 51, g: 65, b: 85 };
    }
    var waferColor = 'rgb(' + waferRgb.r + ',' + waferRgb.g + ',' + waferRgb.b + ')';

    // 1. Draw Furnace Chamber Background
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

    // Chamber Quartz tube outline
    ctx.strokeStyle = isLight ? '#cbd5e1' : '#1e293b';
    ctx.lineWidth = 1.0;
    ctx.strokeRect(chamberLeft, chamberTop, chamberWidth, lh - chamberTop - 8);

    // 1b. Dynamic Vertical Y-Axis Scale / Metrology Ruler (Calibrated in nm / µm)
    var rulerAxisX = 42;
    var pxPerNm = (x_ox > 0.05) ? (h_disp / x_ox) : (8.0 * this.zoomLevel);

    // Draw vertical ruler axis line
    ctx.strokeStyle = isLight ? '#94a3b8' : '#334155';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(rulerAxisX, chamberTop);
    ctx.lineTo(rulerAxisX, lh - 8);
    ctx.stroke();

    // Ruler Axis Title
    ctx.font = FONT_BOLD;
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Y (nm)', rulerAxisX - 4, chamberTop - 4);

    // Calculate dynamic tick intervals based on visible nm range
    var visibleSpanNm = (lh - 8 - chamberTop) / Math.max(0.001, pxPerNm);
    var targetStep = visibleSpanNm / 6;
    var niceSteps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
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
      var roundedZ = Math.round(z * 100) / 100;
      var ty = Math.round(datumY - roundedZ * pxPerNm);
      if (ty < chamberTop + 4 || ty > lh - 12) continue;

      var isDatum = Math.abs(roundedZ) < 0.001;

      // Tick mark
      ctx.strokeStyle = isDatum
        ? (isLight ? '#0284c7' : '#38bdf8')
        : (isLight ? '#cbd5e1' : '#475569');
      ctx.lineWidth = isDatum ? 1.5 : 1.0;
      ctx.beginPath();
      ctx.moveTo(isDatum ? rulerAxisX - 6 : rulerAxisX - 4, ty);
      ctx.lineTo(rulerAxisX, ty);
      ctx.stroke();

      // Tick label
      ctx.fillStyle = isDatum
        ? (isLight ? '#0284c7' : '#38bdf8')
        : (isLight ? '#64748b' : '#94a3b8');

      var lbl;
      if (isDatum) {
        lbl = '0';
      } else if (Math.abs(roundedZ) >= 1000) {
        lbl = (roundedZ / 1000).toFixed(1) + 'µ';
      } else if (stepNm < 1) {
        lbl = (roundedZ > 0 ? '+' : '') + roundedZ.toFixed(1);
      } else {
        lbl = (roundedZ > 0 ? '+' : '') + Math.round(roundedZ);
      }
      ctx.fillText(lbl, rulerAxisX - 6, ty);

      // Subtle horizontal reference line across the chamber background
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

    // Thermal radiation glow from wafer heating
    if (T > 650) {
      var glowIntensity = Math.min(0.35, (T - 650) / 1200);
      var glowGrad = ctx.createRadialGradient(
        lw / 2, datumY, 15,
        lw / 2, datumY, lw * 0.6
      );
      glowGrad.addColorStop(0, 'rgba(' + waferRgb.r + ',' + waferRgb.g + ',' + waferRgb.b + ',' + glowIntensity + ')');
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(chamberLeft, chamberTop, chamberWidth, lh - chamberTop - 8);
    }

    // 2. Render Silicon Substrate (Consuming below y_down)
    var siGrad = ctx.createLinearGradient(0, y_down, 0, lh);
    siGrad.addColorStop(0, waferColor);
    siGrad.addColorStop(0.3, waferColor);
    siGrad.addColorStop(1, isLight ? '#1e293b' : 'rgb(' + Math.round(waferRgb.r * 0.55) + ',' + Math.round(waferRgb.g * 0.55) + ',' + Math.round(waferRgb.b * 0.65) + ')');
    ctx.fillStyle = siGrad;
    ctx.fillRect(chamberLeft, y_down, chamberWidth, (lh - 8) - y_down);

    // Silicon crystal lattice lines (scaled with zoom)
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)';
    var stepLattice = Math.max(14, Math.round(24 / Math.sqrt(this.zoomLevel)));
    for (var lx = chamberLeft + 12; lx < chamberRight - 12; lx += stepLattice) {
      ctx.fillRect(lx, y_down + 4, 1.0, (lh - 16) - y_down);
    }

    // Substrate Label inside Si
    ctx.font = FONT_SMALL;
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.40)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('SILICON SUBSTRATE <' + orientStr + '> (Monocrystalline Si)', chamberLeft + 10, lh - 14);

    // 3. Render Growing SiO2 Dielectric Layer (Glassy Blue Gradient)
    if (h_disp > 0.5) {
      var oxGrad = ctx.createLinearGradient(0, y_up, 0, y_down);
      if (isLight) {
        oxGrad.addColorStop(0, 'rgba(14, 165, 233, 0.75)');
        oxGrad.addColorStop(0.5, 'rgba(2, 132, 199, 0.55)');
        oxGrad.addColorStop(1, 'rgba(3, 105, 161, 0.75)');
      } else {
        oxGrad.addColorStop(0, 'rgba(56, 189, 248, 0.75)');
        oxGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.60)');
        oxGrad.addColorStop(1, 'rgba(3, 105, 161, 0.70)');
      }
      ctx.fillStyle = oxGrad;
      ctx.fillRect(chamberLeft, y_up, chamberWidth, y_down - y_up);

      // SiO2 Top Surface & Interface Lines
      ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(chamberLeft, y_up);
      ctx.lineTo(chamberRight, y_up);
      ctx.stroke();

      ctx.strokeStyle = isLight ? '#b45309' : '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(chamberLeft, y_down);
      ctx.lineTo(chamberRight, y_down);
      ctx.stroke();

      // If zoomed in, show atomic step planes
      if (this.zoomLevel >= 5.0) {
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 0.5;
        var numPlanes = Math.min(8, Math.floor(h_disp / 10));
        for (var pl = 1; pl < numPlanes; pl++) {
          var pyPlane = y_up + (pl / numPlanes) * (y_down - y_up);
          ctx.beginPath();
          ctx.moveTo(chamberLeft + 20, pyPlane);
          ctx.lineTo(chamberRight - 20, pyPlane);
          ctx.stroke();
        }
      }
    }

    // 4. Reference Datum Line (Original Silicon Surface)
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.50)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(chamberLeft, datumY);
    ctx.lineTo(chamberRight, datumY);
    ctx.stroke();
    ctx.restore();

    // 5. Physically Accurate Particle Physics (Elastic N₂ Bounce vs. Fickian Oxidant Diffusion)
    var logP = Math.log10(Math.max(0.005, Math.min(20.0, P_chamber)));
    var pNorm = (logP - (-2.3)) / (1.3 - (-2.3));
    var activeCount = Math.round(20 + pNorm * 130);
    var speedMultiplier = 0.5 + pNorm * 1.8;

    var targetOxPct = C_ox;
    var oxColor = chemCfg.color;
    var oxGlow = chemCfg.glow;
    var diffSpeed = chemCfg.diffSpeed;
    var jitter = chemCfg.jitter;

    for (var pi = 0; pi < activeCount; pi++) {
      var p = this.particles[pi];
      if (!p) continue;

      var targetType = (pi / activeCount) < targetOxPct ? 'ox' : 'n2';
      p.type = targetType;

      if (p.type === 'n2') {
        // --- N₂ INERT PURGE GAS ---
        // 100% strictly stays in the gas phase. Never enters the oxide!
        p.inOxide = false;

        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        // Chamber boundary reflections
        if (p.x < chamberLeft + 4) { p.x = chamberLeft + 4; p.vx *= -1; }
        if (p.x > chamberRight - 4) { p.x = chamberRight - 4; p.vx *= -1; }
        if (p.y < chamberTop + 4) { p.y = chamberTop + 4; p.vy *= -1; }

        // 100% Elastic bounce off top surface of SiO2 layer (or Si surface)
        if (p.y >= y_up - 2) {
          p.y = y_up - 2;
          p.vy = -Math.abs(p.vy);
        }

      } else {
        // --- OXIDANT PARTICLES (Dry O₂, Wet H₂O, ISSG Radical) ---
        if (!p.inOxide) {
          // In Gas Phase
          p.x += p.vx * speedMultiplier;
          p.y += p.vy * speedMultiplier;

          if (p.x < chamberLeft + 4) { p.x = chamberLeft + 4; p.vx *= -1; }
          if (p.x > chamberRight - 4) { p.x = chamberRight - 4; p.vx *= -1; }
          if (p.y < chamberTop + 4) { p.y = chamberTop + 4; p.vy *= -1; }

          // Surface collision with top of SiO2 layer (or bare Si surface at t=0)
          if (p.y >= y_up - 2) {
            // ~25-30% probability of solid-state penetration into SiO2 layer instead of bouncing
            if (C_ox > 0.01 && Math.random() < 0.28) {
              if (h_disp > 0.8) {
                p.inOxide = true;
                // Downward penetration speed based on chemistry diffusivity (20-30% of gas speed)
                p.vy = (0.28 + Math.random() * 0.22) * diffSpeed;
                p.vx = (Math.random() - 0.5) * 0.35;
              } else {
                // Direct surface oxidation spark at bare Si interface when oxide is zero
                if (this.sparks.length < 16) {
                  this.sparks.push({
                    x: p.x,
                    y: y_down,
                    life: 1.0,
                    color: oxColor,
                    glow: oxGlow
                  });
                }
                p.inOxide = false;
                p.x = chamberLeft + Math.random() * chamberWidth;
                p.y = chamberTop + 6 + Math.random() * 15;
                p.vx = (Math.random() - 0.5) * 1.5;
                p.vy = Math.random() * 1.0 + 0.3;
              }
            } else {
              // Elastic bounce back into the chamber
              p.y = y_up - 2;
              p.vy = -Math.abs(p.vy);
            }
          }

        } else {
          // In Solid-State SiO2 Oxide Layer (Diffusion)
          // Downward drift + horizontal random-walk Brownian jitter
          p.y += p.vy;
          p.x += (Math.random() - 0.5) * jitter + p.vx * 0.15;

          if (p.x < chamberLeft + 4) { p.x = chamberLeft + 4; p.vx *= -1; }
          if (p.x > chamberRight - 4) { p.x = chamberRight - 4; p.vx *= -1; }

          // Chemical Reaction Front at Si / SiO2 Interface (y_down)
          if (p.y >= y_down - 1) {
            // Trigger brief glowing chemical reaction spark
            if (this.sparks.length < 16) {
              this.sparks.push({
                x: p.x,
                y: y_down,
                life: 1.0,
                color: oxColor,
                glow: oxGlow
              });
            }
            // Particle is consumed by the Si + Oxidant -> SiO2 reaction, respawns in chamber
            p.inOxide = false;
            p.x = chamberLeft + Math.random() * chamberWidth;
            p.y = chamberTop + 6 + Math.random() * 15;
            p.vx = (Math.random() - 0.5) * 1.5;
            p.vy = Math.random() * 1.0 + 0.3;
          }
        }
      }

      // Render particle with distinct chemistry color
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.inOxide ? 1.8 : 2.4, 0, Math.PI * 2);
      if (p.type === 'ox') {
        ctx.fillStyle = isLight ? (chemCfg.id === 'dry' ? '#0284c7' : (chemCfg.id === 'wet' ? '#059669' : '#7c3aed')) : oxColor;
        ctx.shadowColor = isLight ? 'rgba(0, 0, 0, 0.15)' : oxGlow;
        ctx.shadowBlur = p.inOxide ? 2 : 5;
      } else {
        ctx.fillStyle = isLight ? '#64748b' : '#94a3b8'; // Muted slate/grey N2 Inert
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Render Reaction Sparks
    for (var si = this.sparks.length - 1; si >= 0; si--) {
      var sp = this.sparks[si];
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2.2 * sp.life, 0, Math.PI * 2);
      ctx.fillStyle = sp.color;
      ctx.shadowColor = sp.glow || sp.color;
      ctx.shadowBlur = 6 * sp.life;
      ctx.globalAlpha = sp.life;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.shadowBlur = 0;
      sp.life -= 0.10;
      if (sp.life <= 0) this.sparks.splice(si, 1);
    }

    // 6. Staggered Leader Lines
    ctx.font = FONT_FAMILY;

    // A. Datum Leader
    var datumText = 'Orig. Si Datum (0 nm)';
    ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(datumText, chamberLeft + 8, datumY - 4);

    // B. 56% Up Expansion
    var upText = '56% Up (+' + (0.56 * x_ox).toFixed(2) + ' nm)';
    var upBadgeY = Math.max(chamberTop + 24, y_up - 10);
    var badgeRightX = chamberRight - 8;

    ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(chamberRight - 60, y_up);
    ctx.lineTo(chamberRight - 40, upBadgeY + 3);
    ctx.lineTo(chamberRight - 8, upBadgeY + 3);
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
    ctx.fillText(upText, badgeRightX, upBadgeY - 1);

    // C. 44% Down Consumed Si
    var downText = '44% Down (-' + (0.44 * x_ox).toFixed(2) + ' nm)';
    var downBadgeY = Math.min(lh - 24, Math.max(datumY + 22, y_down + 12));

    ctx.strokeStyle = isLight ? '#d97706' : '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(chamberRight - 60, y_down);
    ctx.lineTo(chamberRight - 40, downBadgeY - 3);
    ctx.lineTo(chamberRight - 8, downBadgeY - 3);
    ctx.stroke();

    ctx.fillStyle = isLight ? '#d97706' : '#f59e0b';
    ctx.textBaseline = 'top';
    ctx.fillText(downText, badgeRightX, downBadgeY + 5);

    // 7. Pressure Physical Regime Badge (Top Left of Chamber)
    var btnY = 5;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = FONT_BOLD;
    var pRegime = (P_chamber < 0.05) ? 'MOLECULAR FLOW (Knudsen)' : ((P_chamber <= 2.0) ? 'CONTINUUM VISCOUS' : 'HIGH-PRESSURE HiPOx');
    ctx.fillStyle = isLight
      ? (P_chamber < 0.05 ? '#7c3aed' : ((P_chamber <= 2.0) ? '#0284c7' : '#d97706'))
      : (P_chamber < 0.05 ? '#c084fc' : ((P_chamber <= 2.0) ? '#38bdf8' : '#f59e0b'));
    ctx.fillText('P: ' + (P_chamber < 0.02 ? (P_chamber * 760).toFixed(1) + ' Torr' : P_chamber.toFixed(2) + ' atm') + ' · ' + pRegime, chamberLeft + 6, btnY + 7.5);

    // Nanoscale Physical Scale Bar (Bottom Right, cleanly separated from Substrate label)
    var rulerNm = (this.zoomLevel >= 25) ? 1 : ((this.zoomLevel >= 5) ? 5 : 20);
    var rulerPx = Math.round(rulerNm * (h_disp / Math.max(1, x_ox)));
    if (rulerPx > 10 && rulerPx < 120) {
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

    // 8. Interactive Cursor Hover Point & Concentration Inspector
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

        var tipW = 186;
        var tipH = 54;
        var tipX = (mx + tipW + 10 > chamberRight) ? (mx - tipW - 10) : (mx + 10);
        var tipY = Math.max(chamberTop + 2, Math.min(lh - tipH - 10, my - tipH / 2));

        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.96)' : 'rgba(10, 14, 23, 0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(tipX, tipY, tipW, tipH, 4) : ctx.rect(tipX, tipY, tipW, tipH);

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        var titleOx = isLight ? (chemCfg.id === 'dry' ? '#0284c7' : (chemCfg.id === 'wet' ? '#059669' : '#7c3aed')) : oxColor;
        var textMain = isLight ? '#0f172a' : '#e2e8f0';
        var textMuted = isLight ? '#64748b' : '#94a3b8';

        if (my < y_up) {
          ctx.strokeStyle = isLight ? '#cbd5e1' : oxColor;
          ctx.fill();
          ctx.stroke();

          ctx.font = FONT_BOLD;
          ctx.fillStyle = titleOx;
          ctx.fillText('● POINT: CHAMBER GAS SPACE', tipX + 6, tipY + 5);

          ctx.font = FONT_FAMILY;
          ctx.fillStyle = textMain;
          ctx.fillText('N₂: ' + (C_n2 * 100).toFixed(1) + '% | ' + chemCfg.shortLabel + ': ' + (C_ox * 100).toFixed(1) + '%', tipX + 6, tipY + 17);

          ctx.fillStyle = titleOx;
          var pText = P_chamber < 0.02 ? (P_chamber * 760).toFixed(1) + ' Torr' : P_chamber.toFixed(2) + ' atm';
          ctx.fillText('Pressure: ' + pText + ' (' + chemCfg.label + ')', tipX + 6, tipY + 29);

          ctx.fillStyle = textMuted;
          ctx.fillText('Transport: Boundary-Layer Gas Flux', tipX + 6, tipY + 41);

        } else if (my <= y_down) {
          var fracDepth = (h_disp > 0) ? Math.max(0, Math.min(1, (my - y_up) / h_disp)) : 0;
          var localDepthNm = fracDepth * x_ox;
          var cInterfaceRel = 1.0 / (1.0 + 0.05 * x_ox);
          var localConcRel = (1.0 - (1.0 - cInterfaceRel) * fracDepth) * C_ox * 100.0;

          ctx.strokeStyle = isLight ? '#cbd5e1' : oxColor;
          ctx.fill();
          ctx.stroke();

          ctx.font = FONT_BOLD;
          ctx.fillStyle = titleOx;
          var isNative = (state.t === 0 || x_ox <= 1.05);
          ctx.fillText('■ POINT: SiO₂ DIELECTRIC' + (isNative ? ' (Native)' : ''), tipX + 6, tipY + 5);

          ctx.font = FONT_FAMILY;
          ctx.fillStyle = isLight ? '#0284c7' : '#38bdf8';
          ctx.fillText('Depth: ' + localDepthNm.toFixed(2) + ' / ' + x_ox.toFixed(2) + ' nm (' + (fracDepth * 100).toFixed(0) + '%)', tipX + 6, tipY + 17);

          ctx.fillStyle = textMain;
          ctx.fillText(chemCfg.shortLabel + ' Conc: ' + localConcRel.toFixed(1) + '% of C*', tipX + 6, tipY + 29);

          ctx.fillStyle = textMuted;
          ctx.fillText('Kinetics: Fickian Solid Diffusion', tipX + 6, tipY + 41);

        } else {
          var subColor = isLight ? '#d97706' : '#f59e0b';
          ctx.strokeStyle = isLight ? '#cbd5e1' : subColor;
          ctx.fill();
          ctx.stroke();

          ctx.font = FONT_BOLD;
          ctx.fillStyle = subColor;
          ctx.fillText('▲ POINT: SILICON SUBSTRATE', tipX + 6, tipY + 5);

          ctx.font = FONT_FAMILY;
          ctx.fillStyle = textMain;
          ctx.fillText('Lattice: <' + orientStr + '> Monocrystalline Si', tipX + 6, tipY + 17);

          ctx.fillStyle = subColor;
          ctx.fillText('Temp: ' + Math.round(T) + ' °C | Consumed: ' + (0.44 * x_ox).toFixed(2) + ' nm', tipX + 6, tipY + 29);

          ctx.fillStyle = textMuted;
          ctx.fillText('Reaction: Si + ' + chemCfg.shortLabel + ' → SiO₂ Front', tipX + 6, tipY + 41);
        }
      }
    }

    ctx.restore();
  };

  global.WaferCanvasRenderer = WaferCanvasRenderer;

})(typeof window !== 'undefined' ? window : this);
