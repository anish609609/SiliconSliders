/**
 * SiliconSliders - Thermal Oxidation Chamber Simulator
 * Main React Application Component with Interactive Hover Point Concentration,
 * Slider Explanatory Info Modals/Popovers, and Next Process Steps Navigation.
 */

(function () {
  'use strict';

  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useCallback = React.useCallback;
  var useMemo = React.useMemo;

  // Recipe Presets
  var PRESETS = {
    gate: {
      id: 'gate',
      name: 'Gate Oxide (Thin & Dense)',
      chemistry: 'dry',
      orientation: '100',
      tempPeak: 850,
      soakTime: 15,
      pressure: 1.0,
      oxidantConc: 20,
      rampRate: 10,
      initialOxide: 1.0,
      badge: 'MOSFET GATE DIELECTRIC'
    },
    field: {
      id: 'field',
      name: 'Field Isolation (Thick & Fast)',
      chemistry: 'wet',
      orientation: '100',
      tempPeak: 1050,
      soakTime: 90,
      pressure: 1.0,
      oxidantConc: 100,
      rampRate: 10,
      initialOxide: 1.0,
      badge: 'STI / LOCOS ISOLATION'
    },
    issg: {
      id: 'issg',
      name: 'High-κ Interfacial Layer (ISSG)',
      chemistry: 'issg',
      orientation: '100',
      tempPeak: 800,
      soakTime: 0.5,
      pressure: 0.01,
      oxidantConc: 100,
      rampRate: 100,
      initialOxide: 1.0,
      badge: 'ATOMIC RADICAL OXIDE'
    }
  };

  // Comprehensive Slider Explanations for the "(i)" info symbols
  var SLIDER_INFOS = {
    chemistry: {
      title: 'Oxidant Chemistry Species',
      param: 'Oxidant Reactant (Dry O₂ vs Wet H₂O vs ISSG Radical)',
      effect: 'Dictates solid solubility in SiO₂ (C*) and reaction activation energy.',
      formula: 'B = 2 D (C* / N_1)  |  B/A = k_s (C* / N_1)',
      explanation: 'Wet oxidation (pyrogenic H₂O steam) has 5–10× higher solid solubility in SiO₂ than dry O₂ (C* ≈ 3×10¹⁹ cm⁻³ vs 5×10¹⁶ cm⁻³), yielding dramatically faster parabolic growth rates (B_wet >> B_dry). Dry O₂ produces a denser oxide film with higher dielectric breakdown (>10 MV/cm) and lower interface trap density (D_it), making it ideal for MOSFET gate dielectrics. ISSG utilizes in-situ atomic radicals (O· and OH·) at low pressure for ultra-uniform thin interfacial oxide growth.',
      fabTradeoff: 'Dry O₂: slow growth, exceptional dielectric breakdown, pristine interface. Wet H₂O: rapid growth, higher pinhole density, ideal for thick field/LOCOS isolation. ISSG: atomic precision, excellent conformal step coverage, low thermal budget.'
    },
    orientation: {
      title: 'Silicon Substrate Crystal Orientation',
      param: 'Wafer Cut: <100> vs <111>',
      effect: 'Directly impacts the linear rate constant (B/A) via surface available silicon bond density.',
      formula: '(B/A)_<111> ≈ 1.68 × (B/A)_<100>',
      explanation: '<111> crystal planes possess an available silicon atom density of 11.8 × 10¹⁴ atoms/cm², compared to 6.78 × 10¹⁴ atoms/cm² for <100> planes (+68% higher). In the reaction-limited linear regime (short times / thin oxides), <111> oxidizes 68% faster. However, in the diffusion-limited parabolic regime (thick oxides), growth is governed by oxidant diffusion through the amorphous SiO₂ network and becomes independent of substrate crystal orientation.',
      fabTradeoff: '<100> wafers have the lowest interface trap density (D_it ~ 10¹⁰ cm⁻² eV⁻¹) and are universal for planar MOSFETs and FinFETs. <111> wafers are occasionally used for bipolar junctions or vertical trench sidewalls.'
    },
    tempPeak: {
      title: 'Peak Chamber Temperature (T_peak)',
      param: 'Furnace Soak Temperature: 700 °C to 1150 °C',
      effect: 'Exponentially accelerates oxidation rate via Arrhenius thermal activation.',
      formula: 'k = k_0 · exp(-E_a / k_B T)',
      explanation: 'Both the linear rate constant B/A (E_a ≈ 2.00 eV) and parabolic rate constant B (E_a ≈ 1.24 eV for dry O₂, 0.78 eV for wet H₂O) scale exponentially with absolute temperature. Raising temperature by just 50 °C nearly doubles growth rate. However, high temperatures exponentially deplete the cumulative thermal budget (D_dopant ∝ exp(-E_diff / k_B T)), causing severe dopant redistribution in source/drain junctions and well profiles.',
      fabTradeoff: 'Higher temperatures drastically shorten furnace cycle time and improve fab throughput, but at the cost of junction smearing, wafer thermal warpage, and elevated defect generation.'
    },
    soakTime: {
      title: 'Oxidation Soak Time (t_soak)',
      param: 'Active Oxidant Exposure Duration: 0.5 min to 180 min',
      effect: 'Controls the transition from the reaction-limited regime to the diffusion-limited regime.',
      formula: 'x_ox² + A · x_ox = B(t + τ)',
      explanation: 'At short soak times (t << A²/4B), oxidation is reaction-rate limited: oxide thickness grows linearly with time (x_ox ≈ (B/A) · t). As the oxide thickens beyond ~30 nm, incoming oxidant molecules must diffuse through the existing solid SiO₂ layer to reach the unoxidized Si interface. The growth rate steadily throttles, entering the diffusion-limited parabolic regime (x_ox ≈ √(B · t)).',
      fabTradeoff: 'Diminishing returns occur in thick oxide growth: doubling the soak time only yields a ~41% increase in oxide thickness once deep in the parabolic regime.'
    },
    pressure: {
      title: 'Chamber Total Pressure',
      param: 'Total Atmospheric / Partial Pressure: 5 mTorr to 20.0 atm',
      effect: 'Controls solid equilibrium oxidant concentration (C*) at the outer SiO₂ surface via Henry\'s Law.',
      formula: 'C* = H · P_ox',
      explanation: 'According to Henry\'s Law, the concentration of oxidant dissolved in the outer SiO₂ surface is directly proportional to the partial pressure of the oxidant gas in the furnace chamber. High-Pressure Oxidation (HiPOx at 10–20 atm) boosts the growth rate by 10× to 20×, permitting the growth of thick field oxides at lower temperatures (e.g. 800 °C instead of 1050 °C), conserving the thermal budget.',
      fabTradeoff: 'Atmospheric pressure (1.0 atm) is standard in batch horizontal/vertical furnaces. Sub-atmospheric low pressure (1–20 Torr) is required for single-wafer ISSG and LPCVD to maintain laminar gas flow and uniform radical flux.'
    },
    oxidantConc: {
      title: 'Oxidant Concentration / N₂ Carrier Dilution',
      param: 'Active Oxidant Percentage in Chamber Gas: 10% to 100%',
      effect: 'Linearly scales oxidant partial pressure (P_ox = P_total × %_Oxidant / 100).',
      formula: 'P_ox = P_total · (C_ox / 100)',
      explanation: 'Diluting pure oxygen with an inert carrier gas such as Nitrogen (N₂) or Argon (Ar) suppresses the incoming oxidant partial pressure without reducing total chamber pressure. This is essential in advanced nodes for growing ultra-thin gate dielectric interfacial layers (sub-1.5 nm) with sub-Angstrom precision, preventing rapid uncontrollable initial oxide growth.',
      fabTradeoff: 'Dilute oxidation (e.g. 10%–20% O₂ in N₂) provides high kinetic controllability for thin films. 100% pure oxidant maximizes deposition speed for thick protective capping layers and LOCOS/STI isolation.'
    },
    rampRate: {
      title: 'Temperature Ramp Rate (dT/dt)',
      param: 'Chamber Heating & Cooling Rate: 5 °C/min to 150 °C/min',
      effect: 'Induces radial thermal gradients across 300 mm wafers, generating thermal stress and slip risk.',
      formula: 'σ_thermal ≈ [E · α · ΔT_radial] / [1 - ν]',
      explanation: 'Silicon has finite thermal conductivity. Fast temperature ramping heats wafer edges significantly faster than the center, creating severe radial thermal gradients (ΔT_radial). When thermal shear stress exceeds the Critical Resolved Shear Stress (CRSS) of silicon at high temperatures (>800 °C), irreversible crystallographic slip dislocations are punched along {111} planes, destroying IC yield and causing photolithographic focus/overlay errors.',
      fabTradeoff: 'Conservative furnace ramps (5–10 °C/min) guarantee zero slip dislocations and pristine wafers. Rapid Thermal Oxidation (RTO/RTP at 50–150 °C/min) requires specialized edge-ring pyrometry and dynamic multi-zone lamp heating to mitigate slip risk.'
    },
    kpi_oxide: {
      title: 'Oxide Thickness (x_ox)',
      param: 'Total Grown SiO₂ Dielectric Film Thickness',
      effect: 'Instantaneous dielectric thickness calculated using the Deal-Grove model with early-stage Massoud enhancement.',
      formula: 'x_ox² + A · x_ox = B(t + τ)  [+ Massoud: dx/dt = (B / (2x+A)) + C₁·exp(-x/L₁) + C₂·exp(-x/L₂)]',
      explanation: 'Total grown SiO₂ thickness calculated via the Deal-Grove model (including Massoud thin-oxide enhancement at early stages). In the thin-oxide regime (<30 nm for dry O₂), oxidation proceeds faster than classical Deal-Grove kinetics due to elevated surface reaction rate channels. The target value shows the final thickness upon recipe cycle completion.',
      fabTradeoff: 'Sub-2 nm gate dielectrics require dilute, low-temperature oxidation with sub-Ångstrom repeatability to prevent gate leakage tunneling. Thick oxides (300–800 nm) for LOCOS or STI isolation rely on high-temperature steam.'
    },
    kpi_consumed_si: {
      title: 'Consumed Silicon (0.44 · x_ox)',
      param: 'Substrate Silicon Consumption & Volumetric Expansion Ratio',
      effect: 'Converts single-crystal substrate silicon into amorphous SiO₂ with 2.27× volumetric expansion.',
      formula: 'x_consumed = (N_ox / N_si) · x_ox = (2.2×10²² / 5.0×10²²) · x_ox ≈ 0.44 · x_ox  (56% expands upward)',
      explanation: 'Because SiO₂ has a larger molecular volume than Si, growing a thickness x_ox consumes 44% of that thickness from the underlying silicon substrate (0.44 × x_ox), while 56% expands upward above the original silicon datum. When Si atoms bond with incoming oxygen/steam molecules, each mole of Si (12.06 cm³/mol) converts into one mole of SiO₂ (27.18 cm³/mol), yielding a 2.27× volume expansion ratio.',
      fabTradeoff: 'The 44% substrate consumption sinks the critical Si/SiO₂ interface deeper into the wafer. In trench isolation (STI) and 3D FinFET corners, the 56% upward expansion induces intense compressive stress that can trigger dislocations if not stress-relieved.'
    },
    kpi_growth_rate: {
      title: 'Instantaneous Growth Rate (dx/dt)',
      param: 'Instantaneous Deal-Grove Reaction & Diffusion Growth Rate: dx/dt (nm/min)',
      effect: 'Dynamically transitions from surface reaction-limited linear growth (B/A) to diffusion-limited parabolic growth (B / 2x_ox) as oxide thickens.',
      formula: 'dx/dt = B / (2 · x_ox + A)  [+ Massoud thin-oxide enhancement R_massoud]',
      explanation: 'The Deal-Grove model unifies both surface reaction and oxidant diffusion kinetics into a single differential rate:\n\n• Linear-Dominant Regime (2 · x_ox < A): When the oxide is thin, oxidant diffusion through the oxide layer is rapid. Growth is governed by the chemical reaction rate at the Si-SiO₂ interface: dx/dt ≈ B/A with activation energy Ea ≈ 2.00 eV. In dry O₂, early-stage growth (<15 nm) also exhibits rapid Massoud thin-oxide enhancement.\n\n• Parabolic-Dominant Regime (2 · x_ox ≥ A): As the oxide thickens, incoming oxidants must diffuse through the existing solid SiO₂ layer. Solid-state diffusion becomes the rate-limiting bottleneck: dx/dt ≈ B / (2 · x_ox) with activation energy Ea ≈ 1.24 eV (Dry O₂) or 0.78 eV (Wet H₂O).\n\n• Standby / N₂ Purge: During furnace ramp-up and cool-down in pure N₂, oxidant partial pressure is 0 atm, yielding dx/dt = 0.000 nm/min.',
      fabTradeoff: 'Thin gate oxides operate almost entirely in the reaction-limited (linear) and Massoud regimes where precise temperature and oxidant concentration are critical. Thick isolation field oxides (LOCOS/STI) operate deep in the diffusion-limited parabolic regime, where switching from dry O₂ to wet pyrogenic steam provides an orders-of-magnitude faster growth rate due to higher H₂O solubility.'
    },
    kpi_linear_rate: {
      title: 'Linear Rate Constant (B/A)',
      param: 'Surface Reaction-Rate Limited Regime (Thin Oxides)',
      effect: 'Governs reaction-rate-limited growth when the oxide is thin (dx/dt ≈ B/A).',
      formula: 'B/A = k_s · (C* / N_1) = (B/A)_0 · exp(-E_a / k_B T),  E_a ≈ 2.00 eV',
      explanation: 'Governs reaction-rate-limited growth when the oxide is thin. Controlled by the chemical reaction speed at the Si / SiO₂ interface (E_a ≈ 2.00 eV), crystal orientation (<111> is ~68% faster than <100>), and oxidant concentration.',
      fabTradeoff: 'Because E_a is high (2.00 eV), linear growth is extremely temperature-sensitive.'
    },
    kpi_parabolic_rate: {
      title: 'Parabolic Rate Constant (B)',
      param: 'Oxidant Diffusion-Limited Regime (Thick Oxides)',
      effect: 'Governs diffusion-limited growth as the oxide gets thicker (x_ox ≈ √(B · t)).',
      formula: 'B = 2 · D_eff · (C* / N_1) = B_0 · exp(-E_a / k_B T),  E_a ≈ 1.24 eV (Dry) / 0.78 eV (Wet)',
      explanation: 'Governs diffusion-limited growth as the oxide gets thicker. Controlled by how fast oxidant molecules can diffuse through the existing SiO₂ barrier to reach the silicon.',
      fabTradeoff: 'Wet pyrogenic steam has 5–10× higher solid solubility in SiO₂ and lower activation energy (0.78 eV) than dry O₂.'
    },
    kpi_thermal_budget: {
      title: 'Cumulative Thermal Budget Index',
      param: 'Cumulative Thermal Exposure Integral: ∫ exp(-E_diff / k_B T(t)) dt',
      effect: 'Quantifies cumulative high-temperature exposure and unwanted dopant redistribution.',
      formula: 'Thermal Budget Index = ∫₀ᵗ [ exp(-E_dopant / k_B T(t)) / exp(-E_dopant / k_B T_ref) ] dt',
      explanation: 'Measures the cumulative thermal exposure (∫ exp(-E_a / kT) dt) of the wafer. Higher values indicate greater unwanted dopant diffusion (junction broadening) in previously implanted regions. High temperatures cause sharp source/drain implants and well dopants to smear out, eroding short-channel margins in nanoscale transistors.',
      fabTradeoff: 'Advanced nodes enforce stringent thermal budget limits. Fabs replace long high-temperature furnace soaks with rapid thermal oxidation (RTO) or in-situ steam generation (ISSG) at sub-minute soak times to freeze dopant profiles.'
    },
    kpi_slip_risk: {
      title: 'Wafer Slip Risk & Thermal Stress',
      param: 'Radial Temperature Gradient & Crystallographic Slip Dislocation Vulnerability',
      effect: 'Predicts whether thermal shear stress across 300 mm wafers exceeds silicon yield strength.',
      formula: 'σ_thermal ≈ [E · α · ΔT_radial] / [1 - ν]  >  CRSS (Critical Resolved Shear Stress)',
      explanation: 'What it means: During rapid heating or cooling, wafer edges heat and cool significantly faster than the center, creating a severe radial temperature gradient (ΔT_radial). The resulting thermal stress can exceed silicon yield strength at elevated temperatures (>800 °C), causing atomic planes to slide past each other (crystalline slip / dislocations), which irreversibly destroys device yield and warps wafers.\n\nRisk Thresholds (Ramp Rate dT/dt):\n• Low / Safe (≤ 12 °C/min, or ISSG mode): Negligible radial gradient; ideal for batch horizontal/vertical furnaces.\n• Moderate / Elevated (12–25 °C/min): Noticeable edge-to-center ΔT; acceptable only with optimized furnace gas flow and slow paddle insertion.\n• High Slip Risk (> 25 °C/min): Severe thermal stress; punches slip lines along {111} glide planes unless using single-wafer chambers with dynamic edge-guard lamp heating rings.',
      fabTradeoff: 'Conservative 5–10 °C/min ramps guarantee pristine, slip-free wafers but take hours. Rapid thermal systems (50–150 °C/min) achieve high throughput and low thermal budgets, but require expensive closed-loop multi-zone pyrometry to prevent catastrophic slip.'
    }
  };

  // Logarithmic pressure mapping helpers (0.005 atm to 20.0 atm)
  var LOG_MIN = Math.log10(0.005);
  var LOG_MAX = Math.log10(20.0);

  function pressureToSliderVal(p) {
    var val = Math.max(0.005, Math.min(20.0, p));
    var frac = (Math.log10(val) - LOG_MIN) / (LOG_MAX - LOG_MIN);
    return Math.round(frac * 1000);
  }

  function sliderValToPressure(v) {
    var frac = Number(v) / 1000.0;
    var logP = LOG_MIN + frac * (LOG_MAX - LOG_MIN);
    return Math.pow(10, logP);
  }

  function formatPressure(p) {
    if (p < 0.015) {
      return (p * 760).toFixed(1) + ' Torr (' + p.toFixed(3) + ' atm)';
    }
    if (p < 0.2) {
      return p.toFixed(2) + ' atm (' + Math.round(p * 760) + ' Torr)';
    }
    return p.toFixed(1) + ' atm';
  }

  // Pure SVG Info Glyph that avoids mobile OS emoji rendering (e.g. iOS blue emoji box)
  function InfoGlyph(props) {
    var cls = (props && props.className) || 'w-2.5 h-2.5';
    return (
      <svg
        className={cls}
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ pointerEvents: 'none' }}
      >
        <line x1="7" y1="6.2" x2="7" y2="11" />
        <circle cx="7" cy="3.2" r="1.1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  function SimulatorApp() {
    // 1. Simulation Parameters
    var [chemistry, setChemistry] = useState('dry');          // 'dry' | 'wet' | 'issg'
    var [orientation, setOrientation] = useState('100');      // '100' | '111'
    var [tempPeak, setTempPeak] = useState(850);              // 700 - 1150 °C
    var [soakTime, setSoakTime] = useState(15);               // 0.5 - 180 min
    var [pressure, setPressure] = useState(1.0);              // 0.005 - 20.0 atm
    var [oxidantConc, setOxidantConc] = useState(20);         // 10 - 100 %
    var [rampRate, setRampRate] = useState(10);               // 5 - 150 °C/min
    var [initialOxide, setInitialOxide] = useState(1.0);       // 1.0 nm (Native) or 0.0 nm (HF Clean)

    // Unified Light / Dark Theme State
    var [theme, setTheme] = useState(function () {
      try {
        var t = localStorage.getItem('silicon_sliders_theme') ||
                localStorage.getItem('cmos_viewer_theme') ||
                localStorage.getItem('cmos_nand_viewer_theme');
        return t === 'light' ? 'light' : 'dark';
      } catch (_) {
        return 'dark';
      }
    });

    var toggleTheme = useCallback(function () {
      setTheme(function (prev) {
        var next = prev === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem('silicon_sliders_theme', next);
          localStorage.setItem('cmos_viewer_theme', next);
          localStorage.setItem('cmos_nand_viewer_theme', next);
        } catch (_) {}
        if (next === 'light') {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
          document.documentElement.setAttribute('data-theme', 'light');
        } else {
          document.documentElement.classList.remove('light');
          document.documentElement.classList.add('dark');
          document.documentElement.setAttribute('data-theme', 'dark');
        }
        return next;
      });
    }, []);

    // Sync theme across browser tabs
    useEffect(function () {
      function onStorage(e) {
        if (e.key === 'silicon_sliders_theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
          setTheme(e.newValue);
          if (e.newValue === 'light') {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
            document.documentElement.setAttribute('data-theme', 'light');
          } else {
            document.documentElement.classList.remove('light');
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          }
        }
      }
      window.addEventListener('storage', onStorage);
      return function () { window.removeEventListener('storage', onStorage); };
    }, []);

    // 2. Playback State
    var [currentTime, setCurrentTime] = useState(0.0);
    var [isPlaying, setIsPlaying] = useState(false);
    var [playbackSpeed, setPlaybackSpeed] = useState(10);     // 1, 10, 60
    var [activePreset, setActivePreset] = useState('gate');
    var [hoverTime, setHoverTime] = useState(null);           // Synchronized chart inspection

    // Wafer Zoom Level State (synced with WaferCanvasRenderer)
    var [zoomLevel, setZoomLevel] = useState(1.0);

    var handleZoomIn = useCallback(function () {
      if (waferRendererRef.current) {
        waferRendererRef.current.zoomIn();
        setZoomLevel(waferRendererRef.current.zoomLevel);
      }
    }, []);

    var handleZoomOut = useCallback(function () {
      if (waferRendererRef.current) {
        waferRendererRef.current.zoomOut();
        setZoomLevel(waferRendererRef.current.zoomLevel);
      }
    }, []);

    var handleResetZoom = useCallback(function () {
      if (waferRendererRef.current) {
        waferRendererRef.current.resetZoom();
        setZoomLevel(1.0);
      }
    }, []);

    // Modals / Popovers
    var [activeInfoId, setActiveInfoId] = useState(null);     // Open slider/KPI info popup id
    var [isTheoryOpen, setIsTheoryOpen] = useState(false);

    // 3. Canvas & Section References
    var waferSectionRef = useRef(null);
    var waferCanvasRef = useRef(null);
    var chartTopRef = useRef(null);
    var chartBottomRef = useRef(null);
    var waferRendererRef = useRef(null);
    var chartsRef = useRef(null);
    var animFrameRef = useRef(null);
    var lastTickRef = useRef(null);

    // 4. Precompute Trajectory (300 Steps)
    var trajectory = useMemo(function () {
      return OxidationPhysics.solveOxidationTrajectory({
        chemistry: chemistry,
        orientation: orientation,
        tempPeak: tempPeak,
        soakTime: soakTime,
        pressure: pressure,
        oxidantConc: oxidantConc,
        rampRate: rampRate,
        initialOxide: initialOxide
      });
    }, [chemistry, orientation, tempPeak, soakTime, pressure, oxidantConc, rampRate, initialOxide]);

    // Current State at currentTime
    var currentState = useMemo(function () {
      return OxidationPhysics.interpolateState(trajectory, currentTime);
    }, [trajectory, currentTime]);

    // Dynamic Instantaneous Deal-Grove Growth Rate and Dominant Kinetic Regime
    var growthRateInfo = useMemo(function () {
      if (!currentState || currentState.stage !== 'soak' || currentState.P_ox <= 1e-5 || (currentState.dxdt || 0) <= 1e-6) {
        return {
          rate: 0.0,
          rateStr: '0.000',
          ratePerHourStr: '0.0',
          regimeType: 'idle',
          regimeLabel: 'Standby (N₂ Purge)',
          badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
          subtext: '0.000 nm/min (No Growth)',
          subtextValue: 'dx/dt = 0.000 nm/min',
          subtextEa: 'No Growth'
        };
      }

      var dxdt = Math.max(0, currentState.dxdt || 0);
      var x_ox = currentState.x_ox || 0;
      var B = Math.max(0, currentState.B || 0);
      var B_over_A = Math.max(0, currentState.B_over_A || 0);
      var A = (B > 0 && B_over_A > 0) ? (B / B_over_A) : 100.0;
      var R_massoud = currentState.R_massoud || 0;

      var chemEa = chemistry === 'wet' ? '0.78' : (chemistry === 'issg' ? '1.20' : '1.24');

      // Check Massoud Thin-Oxide regime (Dry O2, early growth where Massoud enhancement is dominant)
      var isMassoud = (chemistry === 'dry' && x_ox < 15.0 && R_massoud > 0.15 * dxdt);

      // Deal-Grove regime criterion:
      // Linear-Dominant: 2 * x_ox < A (reaction-limited at Si/SiO2 interface)
      // Parabolic-Dominant: 2 * x_ox >= A (diffusion-limited through bulk SiO2)
      var isLinear = (2.0 * x_ox) < A;

      if (isMassoud) {
        return {
          rate: dxdt,
          rateStr: dxdt.toFixed(3),
          ratePerHourStr: (dxdt * 60).toFixed(1),
          regimeType: 'massoud',
          regimeLabel: 'Massoud Thin-Oxide',
          badgeClass: 'bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40',
          subtext: 'B/A: ' + B_over_A.toFixed(3) + ' nm/min (Ea ≈ 2.00 eV)',
          subtextValue: 'B/A: ' + B_over_A.toFixed(3) + ' nm/min',
          subtextEa: 'Ea ≈ 2.00 eV'
        };
      }

      if (isLinear) {
        return {
          rate: dxdt,
          rateStr: dxdt.toFixed(3),
          ratePerHourStr: (dxdt * 60).toFixed(1),
          regimeType: 'linear',
          regimeLabel: 'Linear Dominant (Reaction-Limited)',
          badgeClass: 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-cyan-300 border-sky-300 dark:border-sky-500/40',
          subtext: 'B/A: ' + B_over_A.toFixed(3) + ' nm/min (Ea ≈ 2.00 eV)',
          subtextValue: 'B/A: ' + B_over_A.toFixed(3) + ' nm/min',
          subtextEa: 'Ea ≈ 2.00 eV'
        };
      }

      // Parabolic-Dominant (Diffusion-Limited)
      return {
        rate: dxdt,
        rateStr: dxdt.toFixed(3),
        ratePerHourStr: (dxdt * 60).toFixed(1),
        regimeType: 'parabolic',
        regimeLabel: 'Parabolic Dominant (Diffusion-Limited)',
        badgeClass: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
        subtext: 'B: ' + B.toFixed(2) + ' nm²/min (Ea ≈ ' + chemEa + ' eV)',
        subtextValue: 'B: ' + B.toFixed(2) + ' nm²/min',
        subtextEa: 'Ea ≈ ' + chemEa + ' eV'
      };
    }, [currentState, chemistry]);

    // Toggle Play / Pause with automatic restart from 0 if at or near completion
    var handleTogglePlay = useCallback(function () {
      setIsPlaying(function (playing) {
        if (!playing) {
          setCurrentTime(function (t) {
            if (trajectory && t >= trajectory.t_total - 0.05) {
              return 0.0;
            }
            return t;
          });
          return true;
        }
        return false;
      });
    }, [trajectory]);

    // Apply Recipe Preset & Auto-Scroll to Wafer Cross-Section Animation
    var handleApplyPreset = useCallback(function (presetKey) {
      var p = PRESETS[presetKey];
      if (!p) return;
      setActivePreset(presetKey);
      setChemistry(p.chemistry);
      setOrientation(p.orientation);
      setTempPeak(p.tempPeak);
      setSoakTime(p.soakTime);
      setPressure(p.pressure);
      setOxidantConc(p.oxidantConc);
      setRampRate(p.rampRate);
      setInitialOxide(p.initialOxide !== undefined ? p.initialOxide : 1.0);
      setCurrentTime(0.0);
      setIsPlaying(true);

      // Smoothly navigate the user view to the Wafer Cross-Section animation
      setTimeout(function () {
        if (waferSectionRef.current) {
          waferSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }, []);

    // Active Chemistry Configuration (colors, glows, labels, diffusivity)
    var chemConfig = useMemo(function () {
      if (typeof OxidationPhysics !== 'undefined' && OxidationPhysics.getChemConfig) {
        return OxidationPhysics.getChemConfig(chemistry);
      }
      var phys = typeof window !== 'undefined' ? window.OxidationPhysics : null;
      if (phys && phys.getChemConfig) {
        return phys.getChemConfig(chemistry);
      }
      if (chemistry === 'wet') {
        return {
          id: 'wet',
          name: 'Wet H₂O',
          label: 'H₂O Vapor',
          shortLabel: 'H₂O',
          color: '#10b981',
          glow: 'rgba(16, 185, 129, 0.45)'
        };
      }
      if (chemistry === 'issg') {
        return {
          id: 'issg',
          name: 'ISSG Radical',
          label: 'O* / OH* Radicals',
          shortLabel: 'O* / OH*',
          color: '#c084fc',
          glow: 'rgba(192, 132, 252, 0.50)'
        };
      }
      return {
        id: 'dry',
        name: 'Dry O₂',
        label: 'O₂ Oxidant',
        shortLabel: 'O₂',
        color: '#22d3ee',
        glow: 'rgba(34, 211, 238, 0.45)'
      };
    }, [chemistry]);

    var oxidantName = chemConfig.label;

    // Seek handler from charts or scrubber
    var handleSeek = useCallback(function (t) {
      setCurrentTime(t);
    }, []);

    // Initialize Renderers on Mount
    useEffect(function () {
      if (waferCanvasRef.current && !waferRendererRef.current) {
        waferRendererRef.current = new WaferCanvasRenderer(waferCanvasRef.current, {
          onZoomChange: function (lvl) {
            setZoomLevel(lvl);
          }
        });
      }
      if (chartTopRef.current && chartBottomRef.current && !chartsRef.current) {
        chartsRef.current = new OxidationCharts(chartTopRef.current, chartBottomRef.current, {
          onHover: function (t) {
            setHoverTime(t);
          },
          onSeek: function (t) {
            handleSeek(t);
          }
        });
      }
    }, [handleSeek]);

    // Synchronize Canvas Resolution on Resize (Logical High-DPI Dimensions)
    var resizeCanvases = useCallback(function () {
      var dpr = window.devicePixelRatio || 1;
      [waferCanvasRef.current, chartTopRef.current, chartBottomRef.current].forEach(function (c) {
        if (!c) return;
        var rect = c.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          var lw = Math.round(rect.width);
          var lh = Math.round(rect.height);
          c.width = Math.round(lw * dpr);
          c.height = Math.round(lh * dpr);
          c.logicalWidth = lw;
          c.logicalHeight = lh;
          c.dpr = dpr;
        }
      });
    }, []);

    useEffect(function () {
      resizeCanvases();
      window.addEventListener('resize', resizeCanvases);
      return function () {
        window.removeEventListener('resize', resizeCanvases);
      };
    }, [resizeCanvases]);

    // Continuous Render Loop (Runs always for fluid gas particles + playback)
    useEffect(function () {
      function loop(timestamp) {
        if (lastTickRef.current === null) {
          lastTickRef.current = timestamp;
        }
        var dtRealMs = timestamp - lastTickRef.current;
        lastTickRef.current = timestamp;

        if (isPlaying && trajectory && trajectory.t_total > 0) {
          var dtSimMin = (dtRealMs / 1000.0) * (playbackSpeed / 6.0);
          setCurrentTime(function (prev) {
            var next = prev + dtSimMin;
            if (next >= trajectory.t_total) {
              setIsPlaying(false);
              // Briefly display completed final state, then auto-rewind to start so user can replay immediately
              setTimeout(function () {
                setCurrentTime(0.0);
              }, 450);
              return trajectory.t_total;
            }
            return next;
          });
        }

        // Render Wafer Cross-Section Canvas with Dynamic Pressure Physics & Accurate Deal-Grove Kinetics
        if (waferRendererRef.current && currentState) {
          waferRendererRef.current.render(currentState, chemConfig, orientation, pressure, theme);
        }

        // Render Dual Stacked Charts with active hover sync & dynamic chemistry styling
        if (chartsRef.current && trajectory && currentState) {
          chartsRef.current.render(trajectory, currentState, chemConfig, hoverTime, theme);
        }

        animFrameRef.current = requestAnimationFrame(loop);
      }

      animFrameRef.current = requestAnimationFrame(loop);
      return function () {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }, [isPlaying, trajectory, currentState, playbackSpeed, chemConfig, orientation, hoverTime, theme]);

    // Keyboard Shortcuts (Space to play/pause, Esc to close modal)
    useEffect(function () {
      function handleKeyDown(e) {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
          e.preventDefault();
          handleTogglePlay();
        }
        if (e.code === 'Escape') {
          setActiveInfoId(null);
          setIsTheoryOpen(false);
        }
      }
      window.addEventListener('keydown', handleKeyDown);
      return function () { window.removeEventListener('keydown', handleKeyDown); };
    }, [handleTogglePlay]);

    // Stage Status Badge Content
    var stageBadge = useMemo(function () {
      if (!currentState) return { label: 'Idle', color: 'slate' };
      if (currentState.stage === 'ramp_up') {
        return { label: 'Stage 1: N₂ Ramp-Up', color: 'cyan', pulse: true };
      }
      if (currentState.stage === 'soak') {
        return { label: 'Stage 2: Active Oxidation Soak', color: 'amber', pulse: true };
      }
      return { label: 'Stage 3: N₂ Anneal & Cool-Down', color: 'purple', pulse: false };
    }, [currentState]);

    var isLight = theme === 'light';
    var paramColors = {
      temp: isLight ? '#EA580C' : '#FB923C',
      time: isLight ? '#059669' : '#34D399',
      pressure: isLight ? '#7C3AED' : '#A78BFA',
      dilution: isLight ? '#0284C7' : '#38BDF8',
      ramprate: isLight ? '#E11D48' : '#FB7185',
      chemistry: isLight ? '#2563EB' : '#60A5FA',
      orientation: isLight ? '#CA8A04' : '#FACC15'
    };

    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#080b11] text-slate-800 dark:text-slate-200 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-800 dark:selection:text-cyan-200 transition-colors duration-150">

        {/* 1. HEADER BAR */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0d121c]/95 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-4 py-2 sm:py-2.5 transition-colors duration-150">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
            
            {/* Left Brand + Title */}
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <a
                href="../../../../index.html"
                className="text-xs font-mono text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-cyan-400 px-2 sm:px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-cyan-500/50 bg-slate-50 dark:bg-transparent transition-colors flex items-center gap-1.5 flex-shrink-0"
                title="Return to SiliconSliders Home"
              >
                <span>←</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">Silicon</span><span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-cyan-500">Sliders</span>
              </a>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="font-mono font-bold text-xs sm:text-sm tracking-wide text-slate-900 dark:text-slate-100 uppercase truncate">
                  Thermal Oxidation Chamber Simulator
                </h1>
              </div>
              <div className="hidden md:inline-flex flex-shrink-0">
                <span
                  className={
                    'px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold tracking-wide border ' +
                    (stageBadge.color === 'cyan'
                      ? 'bg-sky-50 dark:bg-cyan-500/10 text-sky-700 dark:text-cyan-400 border-sky-300 dark:border-cyan-500/40 animate-pulse'
                      : stageBadge.color === 'amber'
                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-300 dark:border-amber-500/40 animate-pulse'
                      : 'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-500/40')
                  }
                >
                  {stageBadge.label}
                </span>
              </div>
            </div>

            {/* Right Actions: Theory Modal & Theme Toggle */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={function () { setIsTheoryOpen(true); }}
                className="px-2.5 sm:px-3 py-1.5 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-sky-700 dark:hover:text-cyan-300 hover:border-sky-400 dark:hover:border-cyan-500/50 transition-all flex items-center gap-1.5 shadow-sm"
                title="Theory & Industry Reference"
              >
                <span>📐</span>
                <span className="hidden sm:inline">Theory & Physical Models</span>
                <span className="sm:hidden">Theory</span>
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                className="w-8 h-8 flex items-center justify-center text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-sky-700 dark:hover:text-cyan-300 hover:border-sky-400 dark:hover:border-cyan-500/50 transition-all shadow-sm"
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                )}
              </button>
            </div>

          </div>
        </header>

        {/* 2. PLAYBACK TRANSPORT BAR */}
        <section className="border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0a0e17] px-3 sm:px-4 py-2 sm:py-2.5 transition-colors duration-150">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 text-xs font-mono">
            
            {/* Left Controls: Play/Pause, Reset, Speed Multipliers */}
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <button
                type="button"
                onClick={handleTogglePlay}
                className={
                  'px-3 sm:px-3.5 py-1.5 rounded font-bold tracking-wider flex items-center gap-1.5 transition-all text-xs ' +
                  (isPlaying
                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    : 'bg-sky-500 dark:bg-cyan-500 text-white dark:text-slate-950 hover:bg-sky-400 dark:hover:bg-cyan-400 shadow-sm dark:shadow-[0_0_12px_rgba(56,189,248,0.35)]')
                }
              >
                <span>{isPlaying ? '⏸ PAUSE' : '▶ PLAY'}</span>
              </button>

              <button
                type="button"
                onClick={function () {
                  setIsPlaying(false);
                  setCurrentTime(0.0);
                }}
                className="px-2 sm:px-2.5 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent transition-colors text-xs"
                title="Reset simulation to t = 0 min"
              >
                ↺ Reset
              </button>

              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 sm:mx-1" />

              <span className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:inline">SPEED:</span>
              {[1, 10, 60].map(function (spd) {
                var isActive = playbackSpeed === spd;
                return (
                  <button
                    key={spd}
                    type="button"
                    onClick={function () { setPlaybackSpeed(spd); }}
                    className={
                      'px-1.5 sm:px-2 py-1 rounded text-xs transition-colors ' +
                      (isActive
                        ? 'bg-sky-100 dark:bg-slate-700 text-sky-800 dark:text-cyan-300 font-bold border border-sky-300 dark:border-cyan-500/50'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')
                    }
                  >
                    {spd}x
                  </button>
                );
              })}
            </div>

            {/* Right Live Timestamp Readout (Inline with controls on mobile) */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 text-slate-700 dark:text-slate-300 ml-auto sm:ml-0 order-2 sm:order-3">
              <span className="text-sky-600 dark:text-cyan-400 font-bold text-sm">
                {currentTime.toFixed(1)}
              </span>
              <span className="text-slate-400">/</span>
              <span>{trajectory.t_total.toFixed(1)} min</span>
              <span className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:inline">
                ({Math.round((currentTime / (trajectory.t_total || 1)) * 100)}%)
              </span>
            </div>

            {/* Middle Scrubber Track (Full width row on mobile, inline on desktop) */}
            <div className="w-full sm:flex-1 order-3 sm:order-2 flex items-center space-x-2 sm:space-x-3 px-1 sm:px-2">
              <span className="text-slate-500 dark:text-slate-400 text-[11px] flex-shrink-0">0 min</span>
              <input
                type="range"
                min="0"
                max={trajectory.t_total || 1.0}
                step="0.05"
                value={currentTime}
                onChange={function (e) {
                  setCurrentTime(Number(e.target.value));
                  setActivePreset(null);
                }}
                className="flex-1 cursor-pointer scrub-slider"
              />
              <span className="text-slate-500 dark:text-slate-400 text-[11px] flex-shrink-0">
                {trajectory.t_total ? trajectory.t_total.toFixed(0) : 0} min
              </span>
            </div>

          </div>
        </section>

        {/* 3. MAIN WORKSPACE */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col gap-4">
          
          {/* LIVE TELEMETRY KPI STRIP (5 DYNAMIC DEAL-GROVE CARDS WITH INFO TOOLTIPS) */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">

            {/* KPI 1: Oxide Thickness */}
            <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-1 lg:col-span-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                <span className="truncate">OXIDE (X_OX)</span>
                <button
                  type="button"
                  onClick={function () { setActiveInfoId(activeInfoId === 'kpi_oxide' ? null : 'kpi_oxide'); }}
                  className="w-3.5 h-3.5 rounded-full border border-sky-300 dark:border-cyan-500/40 bg-sky-50 dark:bg-cyan-500/10 text-sky-700 dark:text-cyan-300 flex items-center justify-center text-[9px] font-bold hover:bg-sky-100 dark:hover:bg-cyan-500/30 transition-colors flex-shrink-0"
                  title="Learn about Oxide Thickness"
                >
                  <InfoGlyph className="w-2 h-2" />
                </button>
              </div>
              <div className="my-0.5 flex items-baseline">
                <span className="text-lg font-bold font-mono text-sky-600 dark:text-cyan-400">
                  {currentState ? currentState.x_ox.toFixed(2) : '1.00'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">nm</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <span>Target: <b className="text-slate-700 dark:text-slate-300">{trajectory.final.x_ox.toFixed(2)}nm</b></span>
                <span className="text-sky-600 dark:text-cyan-400/80 truncate text-[9px]">
                  {growthRateInfo.regimeType === 'idle' ? 'Standby' : (growthRateInfo.regimeType === 'linear' ? 'Linear' : (growthRateInfo.regimeType === 'parabolic' ? 'Parabolic' : 'Massoud'))}
                </span>
              </div>
            </div>

            {/* KPI 2: Consumed Silicon */}
            <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-1 lg:col-span-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                <span className="truncate">CONSUMED SI</span>
                <button
                  type="button"
                  onClick={function () { setActiveInfoId(activeInfoId === 'kpi_consumed_si' ? null : 'kpi_consumed_si'); }}
                  className="w-3.5 h-3.5 rounded-full border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-center justify-center text-[9px] font-bold hover:bg-amber-100 dark:hover:bg-amber-500/30 transition-colors flex-shrink-0"
                  title="Learn about Consumed Silicon"
                >
                  <InfoGlyph className="w-2 h-2" />
                </button>
              </div>
              <div className="my-0.5 flex items-baseline">
                <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                  {currentState ? currentState.x_si.toFixed(2) : '0.44'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">nm (44%)</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <span>Target: <b className="text-slate-700 dark:text-slate-300">{trajectory.final.x_si.toFixed(2)}nm</b></span>
                <span className="text-amber-600 dark:text-amber-400/80 text-[9px]">+{(currentState ? currentState.x_up : 0.56).toFixed(2)}nm</span>
              </div>
            </div>

            {/* KPI 3: Instantaneous Growth Rate dx/dt (Unified Deal-Grove Dynamic Regime) */}
            <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                <span className="truncate">GROWTH RATE (dx/dt)</span>
                <button
                  type="button"
                  onClick={function () { setActiveInfoId(activeInfoId === 'kpi_growth_rate' ? null : 'kpi_growth_rate'); }}
                  className="w-3.5 h-3.5 rounded-full border border-sky-300 dark:border-cyan-500/40 bg-sky-50 dark:bg-cyan-500/10 text-sky-700 dark:text-cyan-300 flex items-center justify-center text-[9px] font-bold hover:bg-sky-100 dark:hover:bg-cyan-500/30 transition-colors flex-shrink-0"
                  title="Learn about Growth Rate & Kinetic Regimes"
                >
                  <InfoGlyph className="w-2 h-2" />
                </button>
              </div>
              <div className="my-0.5 flex items-baseline justify-between">
                <div className="flex items-baseline">
                  <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100">
                    {growthRateInfo.rateStr}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">nm/min</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  {growthRateInfo.ratePerHourStr} nm/h
                </span>
              </div>
              <div className="flex flex-col gap-1 mt-1 font-mono">
                <div>
                  <span
                    className={'px-2 py-0.5 rounded text-[10px] font-semibold inline-block border leading-tight ' + growthRateInfo.badgeClass}
                  >
                    {growthRateInfo.regimeLabel}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  {growthRateInfo.subtext}
                </div>
              </div>
            </div>

            {/* KPI 4: Thermal Budget Index */}
            <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-1 lg:col-span-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                <span className="truncate">THERMAL BUDGET</span>
                <button
                  type="button"
                  onClick={function () { setActiveInfoId(activeInfoId === 'kpi_thermal_budget' ? null : 'kpi_thermal_budget'); }}
                  className="w-3.5 h-3.5 rounded-full border border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 flex items-center justify-center text-[9px] font-bold hover:bg-purple-100 dark:hover:bg-purple-500/30 transition-colors flex-shrink-0"
                  title="Learn about Thermal Budget Index"
                >
                  <InfoGlyph className="w-2 h-2" />
                </button>
              </div>
              <div className="my-0.5 flex items-baseline">
                <span className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">
                  {currentState ? currentState.tb.toFixed(2) : '0.00'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1">idx</span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <span>Total: <b className="text-slate-700 dark:text-slate-300">{(trajectory.final.tb || trajectory.final.thermal_budget || 0).toFixed(2)}</b></span>
                <span className="text-purple-600 dark:text-purple-400/80 text-[9px]">Dopant Smear</span>
              </div>
            </div>

            {/* KPI 5: Wafer Slip Risk */}
            <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-1 lg:col-span-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                <span className="truncate">WAFER SLIP</span>
                <button
                  type="button"
                  onClick={function () { setActiveInfoId(activeInfoId === 'kpi_slip_risk' ? null : 'kpi_slip_risk'); }}
                  className="w-3.5 h-3.5 rounded-full border border-red-300 dark:border-red-500/40 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 flex items-center justify-center text-[9px] font-bold hover:bg-red-100 dark:hover:bg-red-500/30 transition-colors flex-shrink-0"
                  title="Learn about Wafer Slip Risk"
                >
                  <InfoGlyph className="w-2 h-2" />
                </button>
              </div>
              <div className="my-0.5">
                <span className={'px-1.5 py-0.2 rounded text-[11px] font-mono font-bold inline-block border ' + trajectory.final.slipRiskClass}>
                  {trajectory.final.slipRisk}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <span>Ramp: <b className="text-slate-700 dark:text-slate-300">{rampRate} °C/min</b></span>
                <span className="text-[9px] text-slate-400">{rampRate <= 12 || chemistry === 'issg' ? 'Safe' : (rampRate <= 25 ? 'Elevated' : 'High Risk')}</span>
              </div>
            </div>

          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

            {/* Left Column (5 Cols) — Animated Wafer Cross-Section Canvas */}
            <div
              ref={waferSectionRef}
              id="wafer-cross-section"
              className="lg:col-span-5 flex flex-col bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-lg transition-colors duration-150 scroll-mt-20"
            >
              
              <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                    Wafer Cross-Section &amp; Reaction Front
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>Volumetric:</span>
                    <span className="text-sky-600 dark:text-cyan-400 font-semibold">56% Up</span>
                    <span>/</span>
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">44% Down</span>
                  </div>

                  {/* Interactive Zoom Controls (Moved beside Volumetric instead of overlaying canvas) */}
                  <div className="flex items-center bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700/80 rounded-md shadow-sm overflow-hidden text-xs font-mono select-none">
                    <button
                      type="button"
                      onClick={handleZoomOut}
                      title="Zoom Out (−)"
                      className="w-5 h-5 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 transition font-bold text-xs"
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      title="Click to reset zoom to 100%"
                      className="px-1.5 h-5 flex items-center justify-center text-[10px] font-bold border-x border-slate-200 dark:border-slate-700 text-sky-600 dark:text-cyan-400 bg-slate-50 dark:bg-slate-900/60 hover:text-sky-700 dark:hover:text-cyan-300 transition"
                    >
                      {Math.round(zoomLevel * 100)}%
                    </button>
                    <button
                      type="button"
                      onClick={handleZoomIn}
                      title="Zoom In (+)"
                      className="w-5 h-5 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-200 dark:active:bg-slate-700 transition font-bold text-xs"
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Wafer Canvas - Compact, Sleek Height without Overlays */}
              <div className="relative flex-1 h-[225px] min-h-[220px] bg-slate-100 dark:bg-[#0a0e17] overflow-hidden cursor-crosshair">
                <canvas
                  ref={waferCanvasRef}
                  className="w-full h-full block"
                  style={{ height: '225px' }}
                />
              </div>

              {/* Canvas Footer Legend with Initial Clean State Toggle */}
              <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-[#94a3b8] inline-block" />
                    <span className="text-slate-700 dark:text-slate-300">N₂ Inert</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block transition-colors"
                      style={{
                        backgroundColor: chemConfig.color,
                        boxShadow: '0 0 6px ' + chemConfig.glow
                      }}
                    />
                    <span style={{ color: chemConfig.color }}>{chemConfig.label}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-sky-500/80 border border-sky-400/60 inline-block" />
                    <span className="text-sky-700 dark:text-sky-300">SiO₂ Oxide</span>
                  </span>
                </div>

                {/* Substrate Pre-Clean Option (Addresses why SiO2 is present at t=0) */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 text-[10px]">t=0 Clean:</span>
                  <button
                    type="button"
                    onClick={function () {
                      setInitialOxide(function (v) { return v > 0 ? 0.0 : 1.0; });
                    }}
                    className={
                      'px-2 py-0.5 rounded text-[10px] border transition-colors ' +
                      (initialOxide > 0
                        ? 'border-sky-400 dark:border-cyan-500/50 bg-sky-50 dark:bg-cyan-500/10 text-sky-700 dark:text-cyan-300 font-semibold'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400')
                    }
                    title="Toggle between standard 1.0 nm Native Oxide (air exposed) vs HF-dipped 0.0 nm Bare Silicon"
                  >
                    {initialOxide > 0 ? 'Native (1.0 nm)' : 'HF Dip (0.0 nm)'}
                  </button>
                </div>
              </div>

            </div>

            {/* Right Column (7 Cols) — Dual Time-Aligned Charts with Hover Inspection */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              
              {/* Top Chart: Oxide Thickness x_ox(t) & Temperature T(t) */}
              <div className="flex-1 bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-lg flex flex-col">
                <div className="px-3.5 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Thermal Cycle & Growth
                    </span>
                    <div className="flex items-center gap-2.5 text-[11px]">
                      <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-semibold">
                        <span className="w-2 h-2 rounded-sm bg-cyan-500 inline-block" />
                        <span>Oxide (nm)</span>
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                        <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" />
                        <span>Temp (°C)</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-cyan-600 dark:text-cyan-400">
                      x_ox: <b>{currentState ? currentState.x_ox.toFixed(2) : '1.00'} nm</b>
                    </span>
                    <span className="text-amber-600 dark:text-amber-400">
                      T: <b>{currentState ? Math.round(currentState.T) : '600'} °C</b>
                    </span>
                  </div>
                </div>
                <div className="relative flex-1 h-[145px] min-h-[140px] bg-white dark:bg-[#0a0d14] cursor-crosshair">
                  <canvas
                    ref={chartTopRef}
                    className="w-full h-full block"
                    style={{ height: '145px' }}
                  />
                </div>
              </div>

              {/* Bottom Chart: Chamber Gas Kinetics & MFC Flushing */}
              <div className="flex-1 min-h-fit bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-lg flex flex-col">
                <div className="px-3.5 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      Chamber Gas Kinetics
                    </span>
                    <div className="flex items-center gap-2.5 text-[11px]">
                      <span className="flex items-center gap-1 transition-colors font-semibold" style={{ color: chemConfig.color }}>
                        <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: chemConfig.color }} />
                        <span>{chemConfig.label} (%)</span>
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <span className="w-2 h-0.5 border-b border-dashed border-slate-400 inline-block" />
                        <span>N₂ Purge (%)</span>
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span style={{ color: chemConfig.color }} className="font-semibold">
                      {chemConfig.shortLabel}: <b>{currentState ? (currentState.C_ox * 100).toFixed(0) : '0'}%</b>
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      N₂: <b>{currentState ? (currentState.C_n2 * 100).toFixed(0) : '100'}%</b>
                    </span>
                  </div>
                </div>
                <div className="relative h-[145px] min-h-[140px] bg-white dark:bg-[#0a0d14] cursor-crosshair">
                  <canvas
                    ref={chartBottomRef}
                    className="w-full h-full block"
                    style={{ height: '145px' }}
                  />
                </div>
                {/* Active MFC Indicators with Comfortable Breathing Room */}
                <div className="mt-1 px-4 py-3 sm:py-3.5 pb-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-wrap items-center justify-between text-[11px] font-mono gap-3">
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-slate-500 dark:text-slate-400">MFC-1 (N₂ Purge):</span>
                      <span className={'px-2 py-0.5 rounded text-[10px] font-bold tracking-wider inline-flex items-center ' + (currentState && currentState.C_n2 > 0.05 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400')}>
                        {currentState && currentState.C_n2 > 0.05 ? 'ACTIVE' : 'IDLE'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-slate-500 dark:text-slate-400">MFC-2 ({chemConfig.shortLabel}):</span>
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider inline-flex items-center transition-all"
                        style={
                          currentState && currentState.C_ox > 0.02
                            ? { backgroundColor: theme === 'light' ? '#e0f2fe' : chemConfig.color + '26', color: chemConfig.color, border: '1px solid ' + chemConfig.color + '4d' }
                            : { backgroundColor: theme === 'light' ? '#e2e8f0' : '#1e293b', color: theme === 'light' ? '#64748b' : '#94a3b8', border: '1px solid transparent' }
                        }
                      >
                        {currentState && currentState.C_ox > 0.02 ? 'FLOWING' : 'CLOSED'}
                      </span>
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    P_ox: <span className="font-mono font-semibold" style={{ color: chemConfig.color }}>{currentState ? (currentState.P_ox < 0.02 ? (currentState.P_ox * 760).toFixed(1) + ' Torr' : currentState.P_ox.toFixed(3) + ' atm') : '0.000 atm'}</span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* 4. KINETIC CONTROL DECK (SLIDERS FIRST, SELECTORS SECOND) */}
          <section className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm dark:shadow-lg">
            
            <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-800/80 pb-2">
              <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
                <span>Chamber Parameters & Kinetic Controls</span>
              </h2>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <span>Click any</span>
                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-sky-400 dark:border-cyan-500/40 text-sky-600 dark:text-cyan-400">
                  <InfoGlyph className="w-2 h-2" />
                </span>
                <span>for physical mechanisms &amp; fab trade-offs</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3.5">
              
              {/* TOP ROW: SLIDERS 1, 2, 3 */}

              {/* Slider 1: Peak Temperature */}
              <div
                className="kinetic-param-card param-card-temp flex flex-col gap-1 bg-slate-50 dark:bg-[#0a0e17] p-2.5 rounded-lg lg:col-span-2"
                style={{ '--param-color': paramColors.temp }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="param-title">PEAK TEMP (T_peak)</span>
                    <button
                      type="button"
                      onClick={function () { setActiveInfoId(activeInfoId === 'tempPeak' ? null : 'tempPeak'); }}
                      className="param-info-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      title="Peak Temperature info"
                    >
                      <InfoGlyph className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="param-value text-xs">{tempPeak} °C</span>
                </div>
                <input
                  type="range"
                  min="700"
                  max="1150"
                  step="5"
                  value={tempPeak}
                  onChange={function (e) {
                    setTempPeak(Number(e.target.value));
                    setActivePreset(null);
                  }}
                  className="kinetic-slider"
                  style={{ '--param-color': paramColors.temp, '--val-pct': (((tempPeak - 700) / 450) * 100).toFixed(1) + '%' }}
                />
                <div className="flex justify-between text-[10px] font-mono param-ticks mt-0.5">
                  <span>700 °C</span>
                  <span>850 °C</span>
                  <span>1000 °C</span>
                  <span>1150 °C</span>
                </div>
              </div>

              {/* Slider 2: Soak Time */}
              <div
                className="kinetic-param-card param-card-time flex flex-col gap-1 bg-slate-50 dark:bg-[#0a0e17] p-2.5 rounded-lg lg:col-span-2"
                style={{ '--param-color': paramColors.time }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="param-title">SOAK TIME (t_soak)</span>
                    <button
                      type="button"
                      onClick={function () { setActiveInfoId(activeInfoId === 'soakTime' ? null : 'soakTime'); }}
                      className="param-info-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      title="Soak Time info"
                    >
                      <InfoGlyph className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="param-value text-xs">{soakTime} min</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="180"
                  step="0.5"
                  value={soakTime}
                  onChange={function (e) {
                    setSoakTime(Number(e.target.value));
                    setActivePreset(null);
                  }}
                  className="kinetic-slider"
                  style={{ '--param-color': paramColors.time, '--val-pct': (((soakTime - 0.5) / 179.5) * 100).toFixed(1) + '%' }}
                />
                <div className="flex justify-between text-[10px] font-mono param-ticks mt-0.5">
                  <span>0.5 min</span>
                  <span>45 min</span>
                  <span>90 min</span>
                  <span>180 min</span>
                </div>
              </div>

              {/* Slider 3: Chamber Pressure (Logarithmic) */}
              <div
                className="kinetic-param-card param-card-pressure flex flex-col gap-1 bg-slate-50 dark:bg-[#0a0e17] p-2.5 rounded-lg lg:col-span-2"
                style={{ '--param-color': paramColors.pressure }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="param-title">CHAMBER PRESSURE</span>
                    <button
                      type="button"
                      onClick={function () { setActiveInfoId(activeInfoId === 'pressure' ? null : 'pressure'); }}
                      className="param-info-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      title="Pressure info"
                    >
                      <InfoGlyph className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="param-value text-xs">{formatPressure(pressure)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="1"
                  value={pressureToSliderVal(pressure)}
                  onChange={function (e) {
                    setPressure(sliderValToPressure(e.target.value));
                    setActivePreset(null);
                  }}
                  className="kinetic-slider"
                  style={{ '--param-color': paramColors.pressure, '--val-pct': ((pressureToSliderVal(pressure) / 1000) * 100).toFixed(1) + '%' }}
                />
                <div className="flex justify-between text-[10px] font-mono param-ticks mt-0.5">
                  <span>5 mTorr</span>
                  <span>0.01 atm</span>
                  <span>1.0 atm</span>
                  <span>20.0 atm</span>
                </div>
              </div>

              {/* SECOND ROW: SLIDERS 4 & 5 */}

              {/* Slider 4: Oxidant Conc. / N2 Dilution */}
              <div
                className="kinetic-param-card param-card-dilution flex flex-col gap-1 bg-slate-50 dark:bg-[#0a0e17] p-2.5 rounded-lg lg:col-span-3"
                style={{ '--param-color': paramColors.dilution }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="param-title">OXIDANT CONC / DILUTION</span>
                    <button
                      type="button"
                      onClick={function () { setActiveInfoId(activeInfoId === 'oxidantConc' ? null : 'oxidantConc'); }}
                      className="param-info-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      title="Oxidant concentration info"
                    >
                      <InfoGlyph className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="param-value text-xs">{oxidantConc}% {chemConfig.shortLabel} / {100 - oxidantConc}% N₂</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="5"
                  value={oxidantConc}
                  onChange={function (e) {
                    setOxidantConc(Number(e.target.value));
                    setActivePreset(null);
                  }}
                  className="kinetic-slider"
                  style={{ '--param-color': paramColors.dilution, '--val-pct': (((oxidantConc - 10) / 90) * 100).toFixed(1) + '%' }}
                />
                <div className="flex justify-between text-[10px] font-mono param-ticks mt-0.5">
                  <span>10% (Dilute)</span>
                  <span>50%</span>
                  <span>100% (Pure)</span>
                </div>
              </div>

              {/* Slider 5: Temperature Ramp Rate */}
              <div
                className="kinetic-param-card param-card-ramprate flex flex-col gap-1 bg-slate-50 dark:bg-[#0a0e17] p-2.5 rounded-lg lg:col-span-3"
                style={{ '--param-color': paramColors.ramprate }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="param-title">TEMPERATURE RAMP RATE</span>
                    <button
                      type="button"
                      onClick={function () { setActiveInfoId(activeInfoId === 'rampRate' ? null : 'rampRate'); }}
                      className="param-info-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      title="Ramp Rate info"
                    >
                      <InfoGlyph className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="param-value text-xs">
                    {rampRate} °C/min {rampRate > 50 ? '(RTP Mode)' : ''}
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  step="5"
                  value={rampRate}
                  onChange={function (e) {
                    setRampRate(Number(e.target.value));
                    setActivePreset(null);
                  }}
                  className="kinetic-slider"
                  style={{ '--param-color': paramColors.ramprate, '--val-pct': (((rampRate - 5) / 145) * 100).toFixed(1) + '%' }}
                />
                <div className="flex justify-between text-[10px] font-mono param-ticks mt-0.5">
                  <span>5 °C/min (Safe)</span>
                  <span>25 °C/min (Elevated)</span>
                  <span>100 °C/min (RTO)</span>
                  <span>150 °C/min (Max)</span>
                </div>
              </div>

              {/* BOTTOM ROW: SELECTORS (Chemistry & Crystal Orientation) */}

              {/* Selector 1: Oxidant Chemistry Toggle */}
              <div
                className="kinetic-param-card param-card-chemistry flex flex-col gap-1.5 bg-slate-50 dark:bg-[#0a0e17] p-2.5 rounded-lg lg:col-span-3"
                style={{ '--param-color': paramColors.chemistry }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="param-title">OXIDANT CHEMISTRY</span>
                    <button
                      type="button"
                      onClick={function () { setActiveInfoId(activeInfoId === 'chemistry' ? null : 'chemistry'); }}
                      className="param-info-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      title="Chemistry physical details"
                    >
                      <InfoGlyph className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="param-value text-xs">{chemistry === 'dry' ? 'Dry O₂' : (chemistry === 'wet' ? 'Wet H₂O' : 'ISSG Radical')}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {[
                    { id: 'dry', label: 'Dry O₂' },
                    { id: 'wet', label: 'Wet H₂O' },
                    { id: 'issg', label: 'ISSG Radical' }
                  ].map(function (item) {
                    var isAct = chemistry === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={function () {
                          setChemistry(item.id);
                          setActivePreset(null);
                        }}
                        style={
                          isAct
                            ? { backgroundColor: 'var(--param-color)', borderColor: 'var(--param-color)' }
                            : {}
                        }
                        className={
                          'py-1.5 px-1.5 text-xs font-mono rounded-md border transition-all text-center ' +
                          (isAct
                            ? 'shadow-sm text-white dark:text-slate-950 font-bold'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-700 font-normal')
                        }
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] font-mono param-helper-text mt-0.5">
                  {chemistry === 'dry' ? 'High breakdown field, slow growth for gate oxides' : (chemistry === 'wet' ? 'Rapid pyrogenic growth for field/LOCOS isolation' : 'Low-P radical oxidation for atomic thin layers')}
                </span>
              </div>

              {/* Selector 2: Crystal Orientation Toggle */}
              <div
                className="kinetic-param-card param-card-orientation flex flex-col gap-1.5 bg-slate-50 dark:bg-[#0a0e17] p-2.5 rounded-lg lg:col-span-3"
                style={{ '--param-color': paramColors.orientation }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="param-title">CRYSTAL ORIENTATION</span>
                    <button
                      type="button"
                      onClick={function () { setActiveInfoId(activeInfoId === 'orientation' ? null : 'orientation'); }}
                      className="param-info-btn w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
                      title="Orientation details"
                    >
                      <InfoGlyph className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <span className="param-value text-xs">&lt;{orientation}&gt;</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  {[
                    { id: '100', label: '<100> (Standard)' },
                    { id: '111', label: '<111> (+68% B/A)' }
                  ].map(function (item) {
                    var isAct = orientation === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={function () {
                          setOrientation(item.id);
                          setActivePreset(null);
                        }}
                        style={
                          isAct
                            ? { backgroundColor: 'var(--param-color)', borderColor: 'var(--param-color)' }
                            : {}
                        }
                        className={
                          'py-1.5 px-2 text-xs font-mono rounded-md border transition-all text-center ' +
                          (isAct
                            ? 'shadow-sm text-white dark:text-slate-950 font-bold'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-700 font-normal')
                        }
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[10px] font-mono param-helper-text mt-0.5">
                  {orientation === '100' ? 'Minimum interface trap density (D_it ~ 10¹⁰ cm⁻²)' : 'Higher surface atomic density (11.8 × 10¹⁴ atoms/cm²)'}
                </span>
              </div>

            </div>

          </section>

          {/* 5. INDUSTRY STANDARD RECIPE PRESETS (AT THE VERY BOTTOM) */}
          <section className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm dark:shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="text-amber-500 dark:text-amber-400">⚡</span>
                  <span>Recipe Presets:</span>
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 hidden md:inline">
                  (1-Click auto-load & auto-play standard fab process recipes)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 max-w-2xl">
                {Object.keys(PRESETS).map(function (key) {
                  var p = PRESETS[key];
                  var isSelected = activePreset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={function () { handleApplyPreset(key); }}
                      className={
                        'px-3 py-1.5 text-xs font-mono rounded-lg border transition-all text-left flex flex-col justify-between ' +
                        (isSelected
                          ? 'bg-sky-50 dark:bg-cyan-500/20 text-sky-800 dark:text-cyan-300 border-sky-400 dark:border-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/50 dark:ring-cyan-400/50'
                          : 'bg-slate-50 dark:bg-[#0a0e17] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800/80')
                      }
                    >
                      <div className="font-bold flex items-center justify-between">
                        <span>{p.name}</span>
                        {isSelected && <span className="text-[9px] text-sky-600 dark:text-cyan-400 font-bold">● ACTIVE</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{p.badge}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

        </main>

        {/* 6. SLIDER INFO EXPLANATORY POPOVER / MODAL */}
        {activeInfoId && SLIDER_INFOS[activeInfoId] && (
          <div
            className="modal-backdrop"
            onClick={function () { setActiveInfoId(null); }}
          >
            <div
              className="modal-dialog bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-cyan-500/40 rounded-2xl max-w-lg w-full max-h-[88vh] flex flex-col shadow-2xl relative font-sans text-xs text-slate-800 dark:text-slate-200 overflow-hidden"
              onClick={function (e) { e.stopPropagation(); }}
            >
              
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0a0e17]/90 backdrop-blur-md">
                <div className="flex items-center gap-2.5 font-mono">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-sky-400 dark:border-cyan-400/50 bg-sky-50 dark:bg-cyan-500/10 text-sky-600 dark:text-cyan-400 flex-shrink-0">
                    <InfoGlyph className="w-3 h-3" />
                  </span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    {SLIDER_INFOS[activeInfoId].title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={function () { setActiveInfoId(null); }}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-base w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <span className="text-[11px] font-mono text-sky-600 dark:text-cyan-400 font-semibold block uppercase tracking-wider">
                    Parameter / Telemetry Metric:
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-0.5">
                    {SLIDER_INFOS[activeInfoId].param}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold block uppercase tracking-wider">
                    Governing Kinetic Equation:
                  </span>
                  <div className="bg-slate-100 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-sky-700 dark:text-cyan-300 font-mono text-xs mt-1 shadow-inner overflow-x-auto">
                    {SLIDER_INFOS[activeInfoId].formula}
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-semibold block uppercase tracking-wider">
                    Physical Mechanism & Effect:
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1 whitespace-pre-line">
                    {SLIDER_INFOS[activeInfoId].explanation}
                  </p>
                </div>

                <div>
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold block uppercase tracking-wider">
                    Fab Engineering Trade-Offs:
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-1 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    {SLIDER_INFOS[activeInfoId].fabTradeoff}
                  </p>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0a0e17]/90 flex justify-end">
                <button
                  type="button"
                  onClick={function () { setActiveInfoId(null); }}
                  className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-mono font-bold text-xs shadow-sm transition-colors"
                >
                  Got It
                </button>
              </div>

            </div>
          </div>
        )}

        {/* 7. THEORY & INDUSTRY MODAL */}
        {isTheoryOpen && (
          <div
            className="modal-backdrop"
            onClick={function () { setIsTheoryOpen(false); }}
          >
            <div
              className="modal-dialog bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-cyan-500/30 rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl relative font-sans text-xs text-slate-800 dark:text-slate-200 overflow-hidden"
              onClick={function (e) { e.stopPropagation(); }}
            >
              
              {/* Fixed Header */}
              <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0a0e17]/90 backdrop-blur-md">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-sky-600 dark:text-cyan-400 text-lg">📐</span>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    Thermal Oxidation Theory & Equipment Architecture
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={function () { setIsTheoryOpen(false); }}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-base w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
                  aria-label="Close dialog"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-slate-600 dark:text-slate-300">
                <div>
                  <h4 className="font-mono font-bold text-sky-600 dark:text-cyan-400 text-xs mb-1">1. The Deal-Grove Kinetics Model (1965)</h4>
                  <p className="leading-relaxed">
                    Thermal oxidation balances oxidant gas transport across the boundary layer (F₁), Fickian diffusion through the existing SiO₂ layer (F₂ = -D · dC/dx), and chemical reaction at the Si/SiO₂ interface (F₃ = k_s · C_i):
                  </p>
                  <div className="my-2 p-2.5 bg-slate-100 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded font-mono text-sky-700 dark:text-cyan-300 text-center text-xs">
                    x_ox² + A · x_ox = B(t + τ)
                  </div>
                  <p className="leading-relaxed">
                    Where B is the parabolic rate constant (diffusion limited), B/A is the linear rate constant (reaction limited), and τ accounts for any initial native oxide (x_i = 1.0 nm).
                  </p>
                </div>

                <div>
                  <h4 className="font-mono font-bold text-sky-600 dark:text-cyan-400 text-xs mb-1">2. Massoud Thin-Oxide Enhancement (Dry O₂)</h4>
                  <p className="leading-relaxed">
                    In dry O₂, oxides below 20 nm grow substantially faster than classic Deal-Grove predicts. The Massoud empirical enhancement model captures this via dual exponential decay terms:
                  </p>
                  <div className="my-2 p-2.5 bg-slate-100 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded font-mono text-sky-700 dark:text-cyan-300 text-xs">
                    R_massoud = P_ox^0.75 · [C₁ · exp(-E₁/kT) · exp(-x/L₁) + C₂ · exp(-E₂/kT) · exp(-x/L₂)]
                  </div>
                </div>

                <div>
                  <h4 className="font-mono font-bold text-sky-600 dark:text-cyan-400 text-xs mb-1">3. Real Fab Tooling & Manufacturers</h4>
                  <ul className="list-disc pl-5 my-1 space-y-1 text-slate-700 dark:text-slate-300">
                    <li><b>TEL Alpha-8SE / Formula:</b> 300mm vertical batch furnace with 100-150 wafer boat capacity.</li>
                    <li><b>ASM A400 / A412:</b> Dual-reactor vertical furnace with precision CSTR gas delivery.</li>
                    <li><b>Applied Materials Radiance / Vantage ISSG:</b> Single-wafer rapid thermal oxidation utilizing in-situ H₂/O₂ radical generation at sub-atmospheric pressure (1-20 Torr).</li>
                  </ul>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="flex-shrink-0 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0a0e17]/90 flex justify-end">
                <button
                  type="button"
                  onClick={function () { setIsTheoryOpen(false); }}
                  className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-mono font-bold text-xs shadow-sm transition-colors"
                >
                  Close Reference
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    );
  }

  // Mount React App
  var rootEl = document.getElementById('root');
  if (rootEl) {
    var root = ReactDOM.createRoot(rootEl);
    root.render(React.createElement(SimulatorApp));
  }

})(typeof window !== 'undefined' ? window : this);
