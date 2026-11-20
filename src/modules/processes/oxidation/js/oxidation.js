/**
 * Silicon Sliders - Deal-Grove Thermal Oxidation Simulator
 * Accurate physical kinetics, wafer cross-section canvas & Deal-Grove curve plotting
 */

(function () {
  'use strict';

  // Physical Constants
  const kB = 8.617333262e-5; // eV/K

  // Deal-Grove Kinetic Parameters for Silicon <100>
  // Dry O2: B in µm²/hr, B/A in µm/hr
  const KINETICS = {
    dry: {
      B0: 7.72e2,      // µm²/hr
      Ea_B: 1.23,      // eV
      BA0: 3.71e6,     // µm/hr
      Ea_BA: 2.00,     // eV
    },
    wet: {
      B0: 3.86e2,      // µm²/hr
      Ea_B: 0.78,      // eV
      BA0: 1.63e8,     // µm/hr
      Ea_BA: 2.05,     // eV
    }
  };

  // State
  const state = {
    ambient: 'dry',        // 'dry' or 'wet'
    orientation: '100',    // '100' or '111'
    tempC: 1000,           // °C
    timeMin: 60,           // minutes
    pressureAtm: 1.0,      // atm
    xiNm: 2.0              // initial native oxide in nm
  };

  // DOM Elements
  const elTempSlider = document.getElementById('slider-temp');
  const elTempDisplay = document.getElementById('val-temp');
  const elTimeSlider = document.getElementById('slider-time');
  const elTimeDisplay = document.getElementById('val-time');
  const elPressSlider = document.getElementById('slider-press');
  const elPressDisplay = document.getElementById('val-press');
  const elXiSlider = document.getElementById('slider-xi');
  const elXiDisplay = document.getElementById('val-xi');

  const elReadoutTox = document.getElementById('readout-tox');
  const elReadoutSi = document.getElementById('readout-si');
  const elReadoutRegime = document.getElementById('readout-regime');
  const elReadoutRate = document.getElementById('readout-rate');

  const crossCanvas = document.getElementById('canvas-cross-section');
  const curveCanvas = document.getElementById('canvas-curve');
  const crossCtx = crossCanvas ? crossCanvas.getContext('2d') : null;
  const curveCtx = curveCanvas ? curveCanvas.getContext('2d') : null;

  // Gas particle animation for furnace
  const particles = [];
  const NUM_PARTICLES = 40;
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: Math.random() * 600,
      y: 10 + Math.random() * 60,
      vx: 1.2 + Math.random() * 1.5,
      vy: (Math.random() - 0.5) * 0.4,
      size: 2 + Math.random() * 2
    });
  }

  // Calculate Deal-Grove Parameters
  function computeDealGrove() {
    const T_K = state.tempC + 273.15;
    const p = KINETICS[state.ambient];

    // Arrhenius rate constants
    let B = p.B0 * Math.exp(-p.Ea_B / (kB * T_K)) * state.pressureAtm; // µm²/hr
    let BA = p.BA0 * Math.exp(-p.Ea_BA / (kB * T_K)) * state.pressureAtm; // µm/hr

    // Orientation enhancement: <111> has ~1.68x higher linear reaction rate
    if (state.orientation === '111') {
      BA *= 1.68;
    }

    const A = B / BA; // µm
    const xi_um = state.xiNm / 1000; // µm
    const tau = (xi_um * xi_um + A * xi_um) / B; // hr

    // Calculate thickness at given time
    const t_hr = state.timeMin / 60;
    const effective_t = t_hr + tau;
    const tox_um = (-A + Math.sqrt(A * A + 4 * B * effective_t)) / 2; // µm
    const tox_nm = tox_um * 1000; // nm

    // Physical volume partitioning
    const si_consumed_nm = 0.44 * tox_nm;
    const oxide_expanded_nm = 0.56 * tox_nm;

    // Transition thickness between linear and parabolic
    const x_trans_nm = (A / 2) * 1000;
    const isLinear = tox_nm < x_trans_nm;

    return {
      B,
      BA,
      A,
      tau,
      tox_nm,
      tox_um,
      si_consumed_nm,
      oxide_expanded_nm,
      x_trans_nm,
      isLinear
    };
  }

  // Update UI Readouts
  function updateUI() {
    const res = computeDealGrove();

    if (elReadoutTox) elReadoutTox.textContent = `${res.tox_nm.toFixed(1)} nm`;
    if (elReadoutSi) elReadoutSi.textContent = `${res.si_consumed_nm.toFixed(1)} nm`;
    if (elReadoutRegime) {
      elReadoutRegime.textContent = res.isLinear ? 'Linear (Reaction-Ltd)' : 'Parabolic (Diff-Ltd)';
      elReadoutRegime.style.color = res.isLinear ? 'var(--accent-cyan)' : 'var(--accent-gold)';
    }
    if (elReadoutRate) {
      elReadoutRate.textContent = `${(res.BA * 1000).toFixed(1)} nm/hr`;
    }

    // Update Slider Value Badges
    if (elTempDisplay) elTempDisplay.textContent = `${state.tempC} °C`;
    if (elTimeDisplay) elTimeDisplay.textContent = `${state.timeMin} min`;
    if (elPressDisplay) elPressDisplay.textContent = `${state.pressureAtm.toFixed(1)} atm`;
    if (elXiDisplay) elXiDisplay.textContent = `${state.xiNm.toFixed(1)} nm`;

    drawCurve(res);
  }

  // Render Wafer Cross-Section & Furnace Animation
  function renderCrossSection() {
    if (!crossCtx || !crossCanvas) return;
    const w = crossCanvas.width;
    const h = crossCanvas.height;

    crossCtx.clearRect(0, 0, w, h);

    const res = computeDealGrove();

    // Visual scale: map 0-500 nm oxide thickness to 8-60 px
    const maxVisTox = 60;
    const visTox = Math.min(maxVisTox, Math.max(8, (res.tox_nm / 400) * maxVisTox));
    const visSiConsumed = visTox * 0.44;
    const visOxideExp = visTox * 0.56;

    const originalSurfaceY = 120;
    const currentTopY = originalSurfaceY - visOxideExp;
    const currentInterfaceY = originalSurfaceY + visSiConsumed;

    // 1. Quartz Chamber Background
    crossCtx.fillStyle = '#080c14';
    crossCtx.fillRect(0, 0, w, h);

    // 2. Gas Zone (Oxidant Atmosphere)
    const gasGrad = crossCtx.createLinearGradient(0, 0, 0, currentTopY);
    if (state.ambient === 'dry') {
      gasGrad.addColorStop(0, 'rgba(0, 229, 255, 0.12)');
      gasGrad.addColorStop(1, 'rgba(0, 229, 255, 0.02)');
    } else {
      gasGrad.addColorStop(0, 'rgba(255, 207, 77, 0.14)');
      gasGrad.addColorStop(1, 'rgba(255, 207, 77, 0.03)');
    }
    crossCtx.fillStyle = gasGrad;
    crossCtx.fillRect(0, 0, w, currentTopY);

    // 3. Draw Moving Oxidant Molecules (Particles)
    crossCtx.fillStyle = state.ambient === 'dry' ? '#38bdf8' : '#ffcf4d';
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x > w) p.x = 0;
      if (p.y < 8 || p.y > currentTopY - 6) p.vy = -p.vy;

      crossCtx.beginPath();
      crossCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      crossCtx.fill();
    });

    // 4. Grown SiO2 Layer
    const oxideGrad = crossCtx.createLinearGradient(0, currentTopY, 0, currentInterfaceY);
    oxideGrad.addColorStop(0, 'rgba(168, 85, 247, 0.7)');
    oxideGrad.addColorStop(1, 'rgba(0, 229, 255, 0.7)');
    crossCtx.fillStyle = oxideGrad;
    crossCtx.fillRect(40, currentTopY, w - 80, visTox);

    crossCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    crossCtx.lineWidth = 1;
    crossCtx.strokeRect(40, currentTopY, w - 80, visTox);

    // 5. Silicon Substrate (Si <100> / <111>)
    const siGrad = crossCtx.createLinearGradient(0, currentInterfaceY, 0, h);
    siGrad.addColorStop(0, '#1e293b');
    siGrad.addColorStop(1, '#0f172a');
    crossCtx.fillStyle = siGrad;
    crossCtx.fillRect(40, currentInterfaceY, w - 80, h - currentInterfaceY - 10);

    // 6. Original Surface Reference Line (Dashed)
    crossCtx.save();
    crossCtx.setLineDash([4, 4]);
    crossCtx.strokeStyle = 'rgba(255, 207, 77, 0.4)';
    crossCtx.beginPath();
    crossCtx.moveTo(30, originalSurfaceY);
    crossCtx.lineTo(w - 30, originalSurfaceY);
    crossCtx.stroke();
    crossCtx.restore();

    // 7. Dynamic Measurement Callouts
    crossCtx.font = '10px "IBM Plex Mono", monospace';
    crossCtx.fillStyle = '#f0f6fc';

    // Label: Gas Ambient
    crossCtx.fillStyle = state.ambient === 'dry' ? 'var(--accent-cyan)' : 'var(--accent-gold)';
    crossCtx.fillText(
      `FURNACE AMBIENT: ${state.ambient.toUpperCase()} OXYGEN (${state.pressureAtm.toFixed(1)} atm, ${state.tempC}°C)`,
      44, 20
    );

    // Label: SiO2 Layer
    crossCtx.fillStyle = '#ffffff';
    crossCtx.fillText(`THERMAL SiO2 LAYER: ${res.tox_nm.toFixed(1)} nm`, 48, currentTopY + Math.max(12, visTox / 2 + 4));

    // Label: Original Surface
    crossCtx.fillStyle = '#ffcf4d';
    crossCtx.fillText('ORIGINAL Si WAFER SURFACE', w - 210, originalSurfaceY - 4);

    // Label: Consumed Silicon
    crossCtx.fillStyle = '#94a3b8';
    crossCtx.fillText(`BULK SILICON <${state.orientation}> (Consumed: ${res.si_consumed_nm.toFixed(1)} nm)`, 48, currentInterfaceY + 24);

    requestAnimationFrame(renderCrossSection);
  }

  // Draw Deal-Grove Kinetic Growth Curve
  function drawCurve(currentRes) {
    if (!curveCtx || !curveCanvas) return;
    const w = curveCanvas.width;
    const h = curveCanvas.height;

    curveCtx.clearRect(0, 0, w, h);

    const padL = 50;
    const padR = 20;
    const padT = 20;
    const padB = 40;
    const graphW = w - padL - padR;
    const graphH = h - padT - padB;

    // Grid & Axis
    curveCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    curveCtx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = padT + (graphH / 5) * i;
      curveCtx.beginPath();
      curveCtx.moveTo(padL, y);
      curveCtx.lineTo(w - padR, y);
      curveCtx.stroke();
    }

    // Kinetic calculation across 0 to 300 minutes
    const maxT = 300; // minutes
    const maxTox = Math.max(250, currentRes.tox_nm * 1.35); // dynamic scale

    const pts = [];
    for (let m = 0; m <= maxT; m += 5) {
      const t_hr = m / 60;
      const eff_t = t_hr + currentRes.tau;
      const x_um = (-currentRes.A + Math.sqrt(currentRes.A * currentRes.A + 4 * currentRes.B * eff_t)) / 2;
      const x_nm = x_um * 1000;
      pts.push({
        x: padL + (m / maxT) * graphW,
        y: padT + graphH - (x_nm / maxTox) * graphH
      });
    }

    // Draw Curve
    curveCtx.strokeStyle = 'var(--accent-gold)';
    curveCtx.lineWidth = 2.5;
    curveCtx.beginPath();
    pts.forEach((pt, idx) => {
      if (idx === 0) curveCtx.moveTo(pt.x, pt.y);
      else curveCtx.lineTo(pt.x, pt.y);
    });
    curveCtx.stroke();

    // Mark current operating point
    const currX = padL + (state.timeMin / maxT) * graphW;
    const currY = padT + graphH - (currentRes.tox_nm / maxTox) * graphH;

    // Crosshairs
    curveCtx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    curveCtx.setLineDash([3, 3]);
    curveCtx.beginPath();
    curveCtx.moveTo(padL, currY);
    curveCtx.lineTo(currX, currY);
    curveCtx.lineTo(currX, padT + graphH);
    curveCtx.stroke();
    curveCtx.setLineDash([]);

    // Glowing Dot
    curveCtx.fillStyle = 'var(--accent-cyan)';
    curveCtx.beginPath();
    curveCtx.arc(currX, currY, 5, 0, Math.PI * 2);
    curveCtx.fill();

    // Axis Labels
    curveCtx.fillStyle = '#64748b';
    curveCtx.font = '9px "IBM Plex Mono", monospace';
    curveCtx.fillText('0', padL - 10, padT + graphH + 15);
    curveCtx.fillText('150m', padL + graphW / 2 - 10, padT + graphH + 15);
    curveCtx.fillText('300m', padL + graphW - 20, padT + graphH + 15);
    curveCtx.fillText(`${maxTox.toFixed(0)}nm`, 10, padT + 10);
    curveCtx.fillText('0nm', 15, padT + graphH);
  }

  // Setup Event Listeners
  function initListeners() {
    if (elTempSlider) {
      elTempSlider.addEventListener('input', (e) => {
        state.tempC = parseFloat(e.target.value);
        updateUI();
      });
    }
    if (elTimeSlider) {
      elTimeSlider.addEventListener('input', (e) => {
        state.timeMin = parseFloat(e.target.value);
        updateUI();
      });
    }
    if (elPressSlider) {
      elPressSlider.addEventListener('input', (e) => {
        state.pressureAtm = parseFloat(e.target.value);
        updateUI();
      });
    }
    if (elXiSlider) {
      elXiSlider.addEventListener('input', (e) => {
        state.xiNm = parseFloat(e.target.value);
        updateUI();
      });
    }

    // Ambient buttons
    document.querySelectorAll('[data-ambient]').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-ambient]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.ambient = this.getAttribute('data-ambient');
        updateUI();
      });
    });

    // Orientation buttons
    document.querySelectorAll('[data-orient]').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('[data-orient]').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.orientation = this.getAttribute('data-orient');
        updateUI();
      });
    });

    // Expandable Challenge Cards
    document.querySelectorAll('.challenge-card').forEach(card => {
      card.addEventListener('click', function () {
        this.classList.toggle('expanded');
      });
    });

    // Responsive canvas resizing
    function resizeCanvases() {
      if (crossCanvas) {
        crossCanvas.width = crossCanvas.parentElement.clientWidth - 32;
        crossCanvas.height = 240;
      }
      if (curveCanvas) {
        curveCanvas.width = curveCanvas.parentElement.clientWidth - 32;
        curveCanvas.height = 200;
      }
      updateUI();
    }

    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();
  }

  // Initialize
  initListeners();
  updateUI();
  renderCrossSection();
})();
