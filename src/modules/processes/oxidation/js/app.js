/**
 * SiliconSliders - Thermal Oxidation Chamber Simulator
 * Advanced 3-Tab Learning Workspace: Theory | Sliders | Industry
 * Split-screen desktop layout, mobile sticky telemetry ribbon,
 * interactive industry presets, and theory deep-link navigation.
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
    },
    rto: {
      id: 'rto',
      name: 'Rapid Thermal Gate Oxide (RTO)',
      chemistry: 'dry',
      orientation: '100',
      tempPeak: 950,
      soakTime: 2.0,
      pressure: 1.0,
      oxidantConc: 20,
      rampRate: 100,
      initialOxide: 1.0,
      badge: 'SUB-10nm SINGLE WAFER'
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

  // Mapping from infoId to explicit Theory Section Anchor IDs
  var THEORY_SECTION_MAP = {
    chemistry: 'theory-chemistry',
    orientation: 'theory-orientation',
    tempPeak: 'theory-arrhenius',
    soakTime: 'theory-deal-grove',
    pressure: 'theory-pressure-dilution',
    oxidantConc: 'theory-pressure-dilution',
    rampRate: 'theory-thermal-budget',
    kpi_oxide: 'theory-deal-grove',
    kpi_consumed_si: 'theory-volumetric',
    kpi_growth_rate: 'theory-deal-grove',
    kpi_linear_rate: 'theory-deal-grove',
    kpi_parabolic_rate: 'theory-deal-grove',
    kpi_thermal_budget: 'theory-thermal-budget',
    kpi_slip_risk: 'theory-thermal-budget'
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

  // Pure SVG Info Glyph that avoids mobile OS emoji rendering
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

  // Vertical 10px TemperatureColorBar (600 °C – 1200 °C) shared across 3D & 2D viewports
  function TemperatureColorBar(props) {
    var T = (props && typeof props.T === 'number') ? props.T : 600;
    var frac = (typeof window !== 'undefined' && window.OxidationThermal && window.OxidationThermal.heatFraction)
      ? window.OxidationThermal.heatFraction(T)
      : Math.max(0, Math.min(1, (T - 600) / 600));
    var gradCss = (typeof window !== 'undefined' && window.OxidationThermal && window.OxidationThermal.getGradientCss)
      ? window.OxidationThermal.getGradientCss()
      : 'linear-gradient(to top, rgb(35,45,62) 0%, rgb(135,32,32) 25%, rgb(220,85,22) 50%, rgb(248,162,14) 75%, rgb(255,242,145) 100%)';

    return (
      <div
        className="pointer-events-none absolute right-2 top-3 bottom-3 z-20 flex items-stretch gap-1.5 select-none"
        aria-label="Thermal Colorbar 600 to 1200 degrees Celsius"
      >
        <div className="flex flex-col justify-between items-end text-[9px] font-mono font-semibold text-slate-600 dark:text-slate-300 leading-none py-0.5 drop-shadow-sm">
          <span>1200°C</span>
          <span>900°C</span>
          <span>600°C</span>
        </div>
        <div
          className="relative w-[10px] rounded-full border border-slate-400/60 dark:border-slate-600/80 shadow-inner"
          style={{ background: gradCss }}
        >
          <div
            className="absolute -left-1 -right-1 h-[2.5px] rounded-full bg-white ring-1 ring-slate-900/75 shadow-[0_0_6px_rgba(255,255,255,0.95)] transition-[bottom] duration-75"
            style={{ bottom: 'calc(' + (frac * 100).toFixed(1) + '% - 1px)' }}
          />
        </div>
      </div>
    );
  }

  function SimulatorApp() {
    // 0. Top 3-Tab Workspace Navigation ('sliders' | 'theory' | 'industry')
    var [activeTab, setActiveTab] = useState('sliders');
    var [highlightedSection, setHighlightedSection] = useState(null);

    // 1. Simulation Parameters
    var [chemistry, setChemistry] = useState('dry');          // 'dry' | 'wet' | 'issg'
    var [orientation, setOrientation] = useState('100');      // '100' | '111'
    var [tempPeak, setTempPeak] = useState(850);              // 700 - 1150 °C
    var [soakTime, setSoakTime] = useState(15);               // 0.5 - 180 min
    var [pressure, setPressure] = useState(1.0);              // 0.005 - 20.0 atm
    var [oxidantConc, setOxidantConc] = useState(20);         // 10 - 100 %
    var [rampRate, setRampRate] = useState(10);               // 5 - 150 °C/min
    var [initialOxide, setInitialOxide] = useState(1.0);       // 1.0 nm (Native) or 0.0 nm (HF Clean)

    // Unified Light / Dark Theme State (with local time-of-day fallback 06:00-17:59 Light, 18:00-05:59 Dark)
    var [theme, setTheme] = useState(function () {
      try {
        var t = localStorage.getItem('siliconsliders-theme') ||
                localStorage.getItem('silicon_sliders_theme') ||
                localStorage.getItem('cmos_viewer_theme') ||
                localStorage.getItem('cmos_nand_viewer_theme');
        if (t === 'light' || t === 'dark') return t;
      } catch (_) {}
      var hr = new Date().getHours();
      return (hr >= 6 && hr < 18) ? 'light' : 'dark';
    });

    var toggleTheme = useCallback(function () {
      setTheme(function (prev) {
        var next = prev === 'dark' ? 'light' : 'dark';
        try {
          localStorage.setItem('siliconsliders-theme', next);
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

    // Wafer Zoom & Dual-Mode Viewport State ('3d' | '2d', expand toggle, hover prompt)
    var [zoomLevel, setZoomLevel] = useState(1.0);
    var [chamberMode, setChamberMode] = useState('3d');
    var [isViewportExpanded, setIsViewportExpanded] = useState(false);
    var [waferHovered, setWaferHovered] = useState(false);

    // Mobile Telemetry Ribbon Trigger State
    var [showStickyRibbon, setShowStickyRibbon] = useState(false);

    // Modals / Popovers
    var [activeInfoId, setActiveInfoId] = useState(null);     // Open slider/KPI info popup id

    // 3. Canvas & Section References
    var waferSectionRef = useRef(null);
    var chamber3DHostRef = useRef(null);
    var chamber3DRef = useRef(null);
    var waferCanvasRef = useRef(null);
    var chartTopRef = useRef(null);
    var chartBottomRef = useRef(null);
    var waferRendererRef = useRef(null);
    var chartsRef = useRef(null);
    var animFrameRef = useRef(null);
    var lastTickRef = useRef(null);
    var kpiContainerRef = useRef(null);
    var rightColumnRef = useRef(null);

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

      var isMassoud = (chemistry === 'dry' && x_ox < 15.0 && R_massoud > 0.15 * dxdt);
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
          regimeLabel: 'Linear Dominant',
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
        regimeLabel: 'Parabolic Dominant',
        badgeClass: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40',
        subtext: 'B: ' + B.toFixed(2) + ' nm²/min (Ea ≈ ' + chemEa + ' eV)',
        subtextValue: 'B: ' + B.toFixed(2) + ' nm²/min',
        subtextEa: 'Ea ≈ ' + chemEa + ' eV'
      };
    }, [currentState, chemistry]);

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

    // Zoom Handlers
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

    // Toggle Play / Pause
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

    var activeGas = useMemo(function () {
      if (!currentState || (currentState.C_ox || 0) < 0.08) return 'n2';
      return chemistry || 'dry';
    }, [currentState, chemistry]);

    var activeGasLabel = activeGas === 'n2'
      ? 'N₂ Purge'
      : (activeGas === 'wet' ? 'Wet H₂O' : (activeGas === 'issg' ? 'ISSG Radical' : 'Dry O₂'));

    var handleBackTo3D = useCallback(function () {
      setChamberMode('3d');
      setTimeout(function () {
        if (chamber3DRef.current) {
          chamber3DRef.current.resize();
          chamber3DRef.current.resetCamera(true);
        }
      }, 20);
    }, []);

    var handleToggleExpand = useCallback(function () {
      setIsViewportExpanded(function (prev) {
        var next = !prev;
        if (next && rightColumnRef.current) {
          rightColumnRef.current.scrollTop = 0;
        }
        return next;
      });
    }, []);

    // Synchronize Canvas Resolution on Resize (Logical High-DPI Dimensions + 3D Renderer)
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
      if (chamber3DRef.current && chamber3DRef.current.resize) {
        chamber3DRef.current.resize();
      }
    }, []);

    // Tab Switching with canvas redraw preservation
    var switchTab = useCallback(function (tab) {
      setActiveTab(tab);
      if (tab === 'sliders') {
        setTimeout(function () {
          resizeCanvases();
        }, 50);
      }
    }, [resizeCanvases]);

    // Register 3-Stage Process Engineering Guided Tour Configuration
    var switchTabRef = useRef(switchTab);
    switchTabRef.current = switchTab;

    useEffect(function () {
      window.SILICON_TOUR_CONFIG = {
        storageKey: 'siliconsliders_process_tour_seen',
        readySelector: '#btn-guided-tour',
        peekContainerSelector: '#ox-chamber-controls, #ox-playback-bar, #wafer-cross-section, [data-tour-peek-zone]',
        onStop: function () {
          if (switchTabRef.current) switchTabRef.current('sliders');
        },
        steps: [
          {
            id: 'process-theory',
            title: '1. Review Process Theory',
            description: 'Start in Theory to explore the 1965 Deal-Grove origin story, oxidant diffusion vs. interface reaction kinetics, and governing equations before configuring the furnace.',
            selectors: ['#ox-tab-theory'],
            pulseSelector: '#ox-tab-theory',
            beforeEnter: function () {
              if (switchTabRef.current) switchTabRef.current('theory');
            }
          },
          {
            id: 'chamber-controls',
            title: '2. Chamber Controls & Parameters',
            description: 'Drag chamber sliders or click a Recipe Preset. Peek Mode auto-hides this card while dragging sliders so you can watch charts and wafer thickness update live.',
            descriptionHtml:
              'Drag any parameter or preset live (Peek Mode fades this card while dragging):' +
              '<div class="ss-tour-corr-list">' +
                '<div class="ss-tour-corr-row"><span class="ss-tour-corr-key">Temp &amp; Soak Time</span><span class="ss-tour-corr-arrow">&rarr;</span><span class="ss-tour-corr-val">Oxide Thickness (X<sub>ox</sub>) &amp; Thermal Budget</span></div>' +
                '<div class="ss-tour-corr-row"><span class="ss-tour-corr-key">Ramp Rate</span><span class="ss-tour-corr-arrow">&rarr;</span><span class="ss-tour-corr-val">Wafer Slip Risk &amp; Cycle Time</span></div>' +
                '<div class="ss-tour-corr-row"><span class="ss-tour-corr-key">Chemistry &amp; Crystal</span><span class="ss-tour-corr-arrow">&rarr;</span><span class="ss-tour-corr-val">Linear (B/A) &amp; Parabolic (B) Rates</span></div>' +
                '<div class="ss-tour-corr-row"><span class="ss-tour-corr-key">Pressure &amp; Conc.</span><span class="ss-tour-corr-arrow">&rarr;</span><span class="ss-tour-corr-val">Partial Pressure &amp; Flush Kinetics</span></div>' +
              '</div>',
            selectors: ['#ox-chamber-controls'],
            pulseSelector: '#ox-tab-sliders',
            beforeEnter: function () {
              if (switchTabRef.current) switchTabRef.current('sliders');
            }
          },
          {
            id: 'playback-reaction',
            title: '3. Playback & Live Reaction Front',
            description: 'Press ▶ PLAY, switch speed (1x / 10x / 60x), or scrub the timeline to watch 56% upward SiO₂ growth and 44% silicon consumption in real time.',
            targets: [['#ox-playback-bar'], ['#wafer-cross-section']],
            pulseSelector: '#ox-tab-sliders',
            beforeEnter: function () {
              if (switchTabRef.current) switchTabRef.current('sliders');
              var pb = document.getElementById('ox-playback-bar');
              if (pb && pb.scrollIntoView) pb.scrollIntoView({ behavior: 'auto', block: 'nearest' });
            }
          },
          {
            id: 'process-industry',
            title: '4. Commercial Fab Tooling & Industry',
            description: 'Open Industry to compare commercial vertical batch furnaces vs. single-wafer RTP/ISSG chambers, inspect manufacturing challenges, and launch recipes back into Sliders.',
            selectors: ['#ox-tab-industry'],
            pulseSelector: '#ox-tab-industry',
            beforeEnter: function () {
              if (switchTabRef.current) switchTabRef.current('industry');
            }
          }
        ]
      };

      if (window.SiliconGuidedTour && typeof window.SiliconGuidedTour.refresh === 'function') {
        window.SiliconGuidedTour.refresh();
      }
    }, []);

    // Apply Recipe Preset
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

      setTimeout(function () {
        if (waferSectionRef.current) {
          waferSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }, []);

    // Industry Tab: Interactive "Run in Sliders →" handler
    var handleRunInSliders = useCallback(function (recipeParams, presetKey) {
      setActiveTab('sliders');
      if (presetKey && PRESETS[presetKey]) {
        handleApplyPreset(presetKey);
      } else if (recipeParams) {
        setActivePreset(null);
        if (recipeParams.chemistry) setChemistry(recipeParams.chemistry);
        if (recipeParams.orientation) setOrientation(recipeParams.orientation);
        if (recipeParams.tempPeak !== undefined) setTempPeak(recipeParams.tempPeak);
        if (recipeParams.soakTime !== undefined) setSoakTime(recipeParams.soakTime);
        if (recipeParams.pressure !== undefined) setPressure(recipeParams.pressure);
        if (recipeParams.oxidantConc !== undefined) setOxidantConc(recipeParams.oxidantConc);
        if (recipeParams.rampRate !== undefined) setRampRate(recipeParams.rampRate);
        if (recipeParams.initialOxide !== undefined) setInitialOxide(recipeParams.initialOxide);
        setCurrentTime(0.0);
        setIsPlaying(true);
      }

      setTimeout(function () {
        resizeCanvases();
        if (waferSectionRef.current) {
          waferSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    }, [handleApplyPreset, resizeCanvases]);

    // Info Modal: "Dive Deep into Theory" handler
    var handleDiveDeep = useCallback(function (infoId) {
      var sectionId = THEORY_SECTION_MAP[infoId] || 'theory-deal-grove';
      setActiveInfoId(null);
      setActiveTab('theory');
      setHighlightedSection(sectionId);

      setTimeout(function () {
        var el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);

      setTimeout(function () {
        setHighlightedSection(null);
      }, 1600);
    }, []);

    // Seek handler from charts or scrubber
    var handleSeek = useCallback(function (t) {
      setCurrentTime(t);
    }, []);

    // Initialize Renderers on Mount
    useEffect(function () {
      if (chamber3DHostRef.current && !chamber3DRef.current && typeof ThermalChamber3D === 'function') {
        chamber3DRef.current = new ThermalChamber3D(chamber3DHostRef.current, {
          onHoverWafer: function (isHover) {
            setWaferHovered(Boolean(isHover));
          },
          onZoomTransition: function () {
            setChamberMode('2d');
          }
        });
      }
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

    // Synchronize Canvas Resolution on Resize / Expand / Mode Switch
    useEffect(function () {
      resizeCanvases();
      var timer = setTimeout(resizeCanvases, 30);
      window.addEventListener('resize', resizeCanvases);
      return function () {
        clearTimeout(timer);
        window.removeEventListener('resize', resizeCanvases);
      };
    }, [resizeCanvases, isViewportExpanded, chamberMode, activeTab]);

    // Mobile IntersectionObserver for Sticky Telemetry Ribbon
    useEffect(function () {
      if (!kpiContainerRef.current) return;
      var observer = new IntersectionObserver(
        function (entries) {
          var entry = entries[0];
          setShowStickyRibbon(!entry.isIntersecting);
        },
        { threshold: 0.1 }
      );
      observer.observe(kpiContainerRef.current);
      return function () {
        observer.disconnect();
      };
    }, [activeTab]);

    // Continuous Render Loop (3D Furnace + 2D Cross-Section + Dual Charts + Playback)
    useEffect(function () {
      function loop(timestamp) {
        if (lastTickRef.current === null) {
          lastTickRef.current = timestamp;
        }
        var dtRealMs = timestamp - lastTickRef.current;
        lastTickRef.current = timestamp;
        var dtSec = Math.min(0.05, Math.max(0.001, dtRealMs / 1000.0));

        if (isPlaying && trajectory && trajectory.t_total > 0) {
          var dtSimMin = (dtRealMs / 1000.0) * (playbackSpeed / 6.0);
          setCurrentTime(function (prev) {
            var next = prev + dtSimMin;
            if (next >= trajectory.t_total) {
              setIsPlaying(false);
              setTimeout(function () {
                setCurrentTime(0.0);
              }, 450);
              return trajectory.t_total;
            }
            return next;
          });
        }

        // Update 3D Chamber (when visible or running wafer click-to-zoom tween)
        if (chamber3DRef.current && currentState && (chamberMode === '3d' || chamber3DRef.current.activeTween)) {
          chamber3DRef.current.update(currentState, chemistry, activeGas, isPlaying, theme, dtSec);
        }

        // Render 2D Wafer Cross-Section Canvas with dynamic target auto-scaling & C(x) profile
        if (waferRendererRef.current && currentState && chamberMode === '2d') {
          var targetXox = (trajectory && trajectory.final) ? trajectory.final.x_ox : 10.0;
          waferRendererRef.current.render(currentState, chemConfig, orientation, pressure, theme, targetXox, activeGas);
        }

        // Render Dual Stacked Charts
        if (chartsRef.current && trajectory && currentState) {
          chartsRef.current.render(trajectory, currentState, chemConfig, hoverTime, theme);
        }

        animFrameRef.current = requestAnimationFrame(loop);
      }

      animFrameRef.current = requestAnimationFrame(loop);
      return function () {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };
    }, [isPlaying, trajectory, currentState, playbackSpeed, chemConfig, chemistry, activeGas, chamberMode, orientation, hoverTime, theme]);

    // Keyboard Shortcuts (Space to play/pause, Esc to close modal or exit expanded viewport)
    useEffect(function () {
      function handleKeyDown(e) {
        if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
          e.preventDefault();
          handleTogglePlay();
        }
        if (e.code === 'Escape') {
          setActiveInfoId(null);
          setIsViewportExpanded(false);
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

        {/* 1. TOP HEADER WITH 3-TAB BAR (Theory | Sliders | Industry) */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0d121c]/95 backdrop-blur-md sticky top-0 z-40 px-3 sm:px-4 py-2 sm:py-2.5 transition-colors duration-150">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
            
            {/* Left Brand + Module Title */}
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <a
                href="../../../../index.html"
                className="text-xs font-mono text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-cyan-400 px-2 sm:px-2.5 py-1 rounded border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-cyan-500/50 bg-slate-50 dark:bg-transparent transition-colors flex items-center gap-1.5 flex-shrink-0"
                title="Return to SiliconSliders Home"
              >
                <span>← Silicon Sliders</span>
              </a>
              <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 flex-shrink-0" />
              <div className="flex items-center gap-2 min-w-0">
                <h1 className="font-mono font-bold text-xs sm:text-sm tracking-wide text-slate-900 dark:text-slate-100 uppercase truncate">
                  Thermal Oxidation
                </h1>
              </div>
            </div>

            {/* Center: Clean Single-Row 3-Tab Bar with Blue Accent Indicator */}
            <nav className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-900/90 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono shadow-inner order-3 sm:order-2">
              <button
                id="ox-tab-theory"
                type="button"
                onClick={function () { switchTab('theory'); }}
                className={
                  'px-2.5 sm:px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ' +
                  (activeTab === 'theory'
                    ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50')
                }
              >
                <span>Theory</span>
              </button>
              <button
                id="ox-tab-sliders"
                type="button"
                onClick={function () { switchTab('sliders'); }}
                className={
                  'px-2.5 sm:px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ' +
                  (activeTab === 'sliders'
                    ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50')
                }
              >
                <span>Sliders</span>
              </button>
              <button
                id="ox-tab-industry"
                type="button"
                onClick={function () { switchTab('industry'); }}
                className={
                  'px-2.5 sm:px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ' +
                  (activeTab === 'industry'
                    ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/50')
                }
              >
                <span>Industry</span>
              </button>
            </nav>

            {/* Right: Stage Status Badge, Guided Tour & Theme Toggle */}
            <div className="flex items-center space-x-2 flex-shrink-0 order-2 sm:order-3">
              <div className="hidden xl:inline-flex flex-shrink-0">
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

              <button
                type="button"
                id="btn-guided-tour"
                className="tbtn-guided-tour h-8 px-2.5 rounded border text-xs font-mono font-semibold transition-all shadow-sm flex items-center gap-1.5"
                title="Start Interactive Guided Tour"
                aria-label="Start interactive guided tour"
              >
                <span className="tour-q-icon">?</span>
                <span className="tour-btn-text">Tour</span>
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

        {/* 2. TAB 1: SLIDERS WORKSPACE (SPLIT-SCREEN ON DESKTOP, STACKED ON MOBILE) */}
        <div className={'flex-1 ' + (activeTab === 'sliders' ? 'flex flex-col' : 'hidden')}>

          {/* Slim Sticky Telemetry Ribbon (Mobile < 1024px: slides down only when KPI strip scrolls out of view) */}
          <div
            className={
              'lg:hidden sticky top-[49px] z-30 transition-all duration-300 border-b border-sky-400/40 dark:border-cyan-500/40 bg-white/95 dark:bg-[#0d121c]/95 backdrop-blur-md shadow-md ' +
              (showStickyRibbon ? 'opacity-100 translate-y-0 py-1.5 px-3' : 'opacity-0 -translate-y-2 pointer-events-none h-0 overflow-hidden py-0 px-3')
            }
          >
            <div className="flex items-center justify-between text-[11px] font-mono gap-2 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-slate-500 dark:text-slate-400">X_OX:</span>
                <span className="font-bold text-sky-600 dark:text-cyan-400">{currentState ? currentState.x_ox.toFixed(2) : '1.00'} nm</span>
              </div>
              <div className="h-3 w-px bg-slate-300 dark:bg-slate-700 flex-shrink-0" />
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-slate-500 dark:text-slate-400">Rate:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{growthRateInfo.rateStr} nm/m</span>
              </div>
              <div className="h-3 w-px bg-slate-300 dark:bg-slate-700 flex-shrink-0" />
              <div className="flex-shrink-0">
                <span className={'px-1.5 py-0.5 rounded text-[10px] font-semibold border ' + growthRateInfo.badgeClass}>
                  {growthRateInfo.regimeLabel}
                </span>
              </div>
              <div className="h-3 w-px bg-slate-300 dark:bg-slate-700 flex-shrink-0" />
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-slate-500 dark:text-slate-400">Slip:</span>
                <span className={'px-1.5 py-0.2 rounded text-[10px] font-bold border ' + trajectory.final.slipRiskClass}>
                  {trajectory.final.slipRisk}
                </span>
              </div>
            </div>
          </div>

          {/* 2-Column Split-Screen Workspace (Desktop >= 1024px) / Stacked Flow (Mobile < 1024px) */}
          <div className="w-full flex-1 flex flex-col lg:flex-row lg:h-[calc(100vh-53px)] lg:overflow-hidden">

            {/* LEFT COLUMN: Chamber Parameters & Kinetic Controls (340px–360px Fixed Width, Independently Scrollable) */}
            <aside
              id="ox-chamber-controls"
              data-tour-peek-zone="1"
              className="w-full lg:w-[355px] lg:min-w-[340px] lg:max-w-[360px] flex-shrink-0 lg:h-full lg:overflow-y-auto border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-slate-800 p-3 sm:p-4 flex flex-col gap-3.5 bg-slate-50/70 dark:bg-[#090d15] order-2 lg:order-1"
            >
              
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <h2 className="font-mono font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-300 flex items-center gap-2">
                  <span>Chamber Controls</span>
                </h2>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span>Click</span>
                  <span className="inline-flex items-center justify-center w-3 h-3 rounded-full border border-sky-400 dark:border-cyan-500/40 text-sky-600 dark:text-cyan-400">
                    <InfoGlyph className="w-2 h-2" />
                  </span>
                  <span>for theory</span>
                </div>
              </div>

              {/* Chamber Kinetic Sliders Stack */}
              <div className="flex flex-col gap-3">

                {/* Slider 1: Peak Temperature */}
                <div
                  className="kinetic-param-card param-card-temp flex flex-col gap-1 bg-white dark:bg-[#0d121c] p-2.5 rounded-lg shadow-sm"
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
                  className="kinetic-param-card param-card-time flex flex-col gap-1 bg-white dark:bg-[#0d121c] p-2.5 rounded-lg shadow-sm"
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
                  className="kinetic-param-card param-card-pressure flex flex-col gap-1 bg-white dark:bg-[#0d121c] p-2.5 rounded-lg shadow-sm"
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

                {/* Slider 4: Oxidant Conc. / N2 Dilution */}
                <div
                  className="kinetic-param-card param-card-dilution flex flex-col gap-1 bg-white dark:bg-[#0d121c] p-2.5 rounded-lg shadow-sm"
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
                    <span className="param-value text-xs">{oxidantConc}% {chemConfig.shortLabel}</span>
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
                  className="kinetic-param-card param-card-ramprate flex flex-col gap-1 bg-white dark:bg-[#0d121c] p-2.5 rounded-lg shadow-sm"
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
                      {rampRate} °C/min
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
                    <span>25 °C/min</span>
                    <span>150 °C/min (RTO)</span>
                  </div>
                </div>

                {/* Selector 1: Oxidant Chemistry Toggle */}
                <div
                  className="kinetic-param-card param-card-chemistry flex flex-col gap-1 bg-white dark:bg-[#0d121c] p-2.5 rounded-lg shadow-sm"
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
                    <span className="param-value text-xs">{chemistry === 'dry' ? 'Dry O₂' : (chemistry === 'wet' ? 'Wet H₂O' : 'ISSG')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 mt-1">
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
                            'py-1 px-1 text-xs font-mono rounded border transition-all text-center ' +
                            (isAct
                              ? 'shadow-sm text-white dark:text-slate-950 font-bold'
                              : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 font-normal')
                          }
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selector 2: Crystal Orientation Toggle */}
                <div
                  className="kinetic-param-card param-card-orientation flex flex-col gap-1 bg-white dark:bg-[#0d121c] p-2.5 rounded-lg shadow-sm"
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
                            'py-1 px-2 text-xs font-mono rounded border transition-all text-center ' +
                            (isAct
                              ? 'shadow-sm text-white dark:text-slate-950 font-bold'
                              : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-slate-200 font-normal')
                          }
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Recipe Presets at Bottom of Left Column */}
              <div className="mt-auto pt-3 border-t border-slate-200 dark:border-slate-800/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>Recipe Presets</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                    1-Click Auto Load
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {Object.keys(PRESETS).map(function (key) {
                    var p = PRESETS[key];
                    var isSelected = activePreset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={function () { handleApplyPreset(key); }}
                        className={
                          'px-2.5 py-1.5 text-xs font-mono rounded-lg border transition-all text-left flex flex-col justify-between ' +
                          (isSelected
                            ? 'bg-sky-50 dark:bg-cyan-500/20 text-sky-800 dark:text-cyan-300 border-sky-400 dark:border-cyan-400 shadow-[0_0_10px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/50 dark:ring-cyan-400/50'
                            : 'bg-white dark:bg-[#0d121c] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/80')
                        }
                      >
                        <div className="font-bold flex items-center justify-between text-[11px]">
                          <span>{p.name}</span>
                          {isSelected && <span className="text-[9px] text-sky-600 dark:text-cyan-400 font-bold">● ACTIVE</span>}
                        </div>
                        <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">{p.badge}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </aside>

            {/* RIGHT COLUMN: Playback Bar, 5-Card KPI Strip, Dual-Mode Chamber Viewport, Charts (Flex-1, Independently Scrollable) */}
            <main
              ref={rightColumnRef}
              className={'flex-1 lg:h-full p-3 sm:p-4 flex flex-col gap-3 order-1 lg:order-2 relative ' + (isViewportExpanded ? 'lg:overflow-hidden' : 'lg:overflow-y-auto')}
            >
              
              {/* 1. PLAYBACK BAR (Pinned at top of Right Column inside Sliders tab) */}
              <div
                id="ox-playback-bar"
                data-tour-peek-zone="1"
                className="sticky top-0 z-20 bg-white/95 dark:bg-[#0d121c]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl p-2 sm:p-2.5 shadow-sm transition-colors duration-150"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  
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

                  {/* Right Live Timestamp Readout */}
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

                  {/* Middle Scrubber Track */}
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
              </div>

              {/* 2. COMPACT 5-CARD KPI STRIP (Single 5-Column Horizontal Row on Desktop >= 1024px) */}
              <div
                ref={kpiContainerRef}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2"
              >

                {/* KPI 1: Oxide Thickness */}
                <div className="min-w-0 bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-1">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
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
                  <div className="my-0.5 flex items-baseline min-w-0">
                    <span className="text-lg font-bold font-mono text-sky-600 dark:text-cyan-400">
                      {currentState ? currentState.x_ox.toFixed(2) : '1.00'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1 shrink-0">nm</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[9.5px] font-mono text-slate-500 dark:text-slate-400 min-w-0">
                    <span className="truncate">Tgt: <b className="text-slate-700 dark:text-slate-300">{trajectory.final.x_ox.toFixed(2)}nm</b></span>
                    <span className="shrink-0 px-1.5 py-0.2 rounded border border-sky-200 dark:border-cyan-500/30 bg-sky-50/70 dark:bg-cyan-500/10 text-sky-700 dark:text-cyan-300 text-[9px] font-semibold">
                      {growthRateInfo.regimeType === 'idle' ? 'Standby' : (growthRateInfo.regimeType === 'linear' ? 'Linear' : (growthRateInfo.regimeType === 'parabolic' ? 'Parabolic' : 'Massoud'))}
                    </span>
                  </div>
                </div>

                {/* KPI 2: Consumed Silicon */}
                <div className="min-w-0 bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-1">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
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
                  <div className="my-0.5 flex items-baseline min-w-0">
                    <span className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                      {currentState ? currentState.x_si.toFixed(2) : '0.44'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1 truncate">nm (44%)</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[9.5px] font-mono text-slate-500 dark:text-slate-400 min-w-0">
                    <span className="truncate">Tgt: <b className="text-slate-700 dark:text-slate-300">{trajectory.final.x_si.toFixed(2)}nm</b></span>
                    <span className="shrink-0 text-amber-600 dark:text-amber-400/80 text-[9px] font-semibold">+{(currentState ? currentState.x_up : 0.56).toFixed(2)}nm</span>
                  </div>
                </div>

                {/* KPI 3: Instantaneous Growth Rate dx/dt */}
                <div className="min-w-0 bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-2 sm:col-span-1 lg:col-span-1">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                    <span className="truncate">GROWTH RATE (DX/DT)</span>
                    <button
                      type="button"
                      onClick={function () { setActiveInfoId(activeInfoId === 'kpi_growth_rate' ? null : 'kpi_growth_rate'); }}
                      className="w-3.5 h-3.5 rounded-full border border-sky-300 dark:border-cyan-500/40 bg-sky-50 dark:bg-cyan-500/10 text-sky-700 dark:text-cyan-300 flex items-center justify-center text-[9px] font-bold hover:bg-sky-100 dark:hover:bg-cyan-500/30 transition-colors flex-shrink-0"
                      title="Learn about Growth Rate & Kinetic Regimes"
                    >
                      <InfoGlyph className="w-2 h-2" />
                    </button>
                  </div>
                  <div className="my-0.5 flex items-baseline gap-1 min-w-0">
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 shrink-0">
                      {growthRateInfo.rateStr}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">nm/m</span>
                  </div>
                  <div className="flex flex-col gap-0.5 font-mono min-w-0">
                    <div className="flex items-center">
                      <span
                        className={'px-1.5 py-0.2 rounded text-[9px] font-semibold inline-block border leading-tight truncate max-w-full ' + growthRateInfo.badgeClass}
                      >
                        {growthRateInfo.regimeLabel}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                      {growthRateInfo.subtext}
                    </div>
                  </div>
                </div>

                {/* KPI 4: Thermal Budget Index */}
                <div className="min-w-0 bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-1">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
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
                  <div className="my-0.5 flex items-baseline min-w-0">
                    <span className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">
                      {currentState ? currentState.tb.toFixed(2) : '0.00'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 ml-1 shrink-0">idx</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 text-[9.5px] font-mono text-slate-500 dark:text-slate-400 min-w-0">
                    <span className="truncate">Tot: <b className="text-slate-700 dark:text-slate-300">{(trajectory.final.tb || trajectory.final.thermal_budget || 0).toFixed(2)}</b></span>
                    <span className="shrink-0 text-purple-600 dark:text-purple-400/80 text-[9px]">Smear</span>
                  </div>
                </div>

                {/* KPI 5: Wafer Slip Risk */}
                <div className="min-w-0 bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-2 flex flex-col justify-between shadow-sm dark:shadow-md transition-colors duration-150 col-span-1">
                  <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-tight">
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
                  <div className="flex items-center justify-between gap-1 text-[9.5px] font-mono text-slate-500 dark:text-slate-400 min-w-0">
                    <span className="truncate">Ramp: <b className="text-slate-700 dark:text-slate-300">{rampRate}°C/m</b></span>
                    <span className="shrink-0 text-[9px] text-slate-400">{rampRate <= 12 || chemistry === 'issg' ? 'Safe' : (rampRate <= 25 ? 'Elev.' : 'High')}</span>
                  </div>
                </div>

              </div>

              {/* 3. DUAL-MODE VIEWPORT (3D CHAMBER <-> 2D CROSS-SECTION & REACTION FRONT) */}
              <div
                ref={waferSectionRef}
                id="wafer-cross-section"
                data-tour-peek-zone="1"
                className={
                  'flex flex-col bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-md transition-all duration-150 scroll-mt-20 ' +
                  (isViewportExpanded ? 'fixed inset-3 lg:inset-auto lg:absolute lg:top-3 lg:right-3 lg:bottom-3 lg:left-3 z-40 shadow-2xl' : '')
                }
              >
                <div className="px-3.5 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                      {chamberMode === '3d' ? '3D Thermal Chamber' : '2D Wafer Cross-Section'}
                    </span>

                    {/* [3D Chamber | 2D Cross-Section] Segmented Pill */}
                    <div className="inline-flex items-center p-0.5 rounded-md bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[10.5px]">
                      <button
                        type="button"
                        onClick={function () { setChamberMode('3d'); }}
                        className={
                          'px-2 py-0.5 rounded transition-all ' +
                          (chamberMode === '3d'
                            ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200')
                        }
                      >
                        3D Chamber
                      </button>
                      <button
                        type="button"
                        onClick={function () { setChamberMode('2d'); }}
                        className={
                          'px-2 py-0.5 rounded transition-all ' +
                          (chamberMode === '2d'
                            ? 'bg-sky-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200')
                        }
                      >
                        2D Cross-Section
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 ml-auto">
                    {chamberMode === '2d' ? (
                      <div className="flex items-center gap-2.5">
                        <div className="hidden sm:flex items-center gap-1.5">
                          <span>Volumetric:</span>
                          <span className="text-sky-600 dark:text-cyan-400 font-semibold">56% Up</span>
                          <span>/</span>
                          <span className="text-amber-600 dark:text-amber-400 font-semibold">44% Down</span>
                        </div>
                        <div className="flex items-center bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-700/80 rounded-md shadow-sm overflow-hidden text-xs font-mono select-none">
                          <button
                            type="button"
                            onClick={handleZoomOut}
                            title="Zoom Out (−)"
                            className="w-5 h-5 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-bold text-xs"
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
                            className="w-5 h-5 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition font-bold text-xs"
                            aria-label="Zoom in"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[10.5px]">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold" style={{ color: activeGas === 'n2' ? undefined : chemConfig.color }}>
                          {activeGasLabel}
                        </span>
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          {currentState ? Math.round(currentState.T) : 600}°C
                        </span>
                      </div>
                    )}

                    {/* Expand / Collapse Right-Pane Button [⤢] */}
                    <button
                      type="button"
                      onClick={handleToggleExpand}
                      title={isViewportExpanded ? 'Collapse Viewport (Esc)' : 'Expand Viewport across right pane'}
                      aria-label={isViewportExpanded ? 'Collapse viewport' : 'Expand viewport'}
                      className={
                        'w-6 h-6 flex items-center justify-center rounded border text-xs font-bold transition-colors ' +
                        (isViewportExpanded
                          ? 'border-sky-500 bg-sky-500 text-white dark:bg-cyan-500 dark:text-slate-950'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-sky-400 dark:hover:border-cyan-400')
                      }
                    >
                      {isViewportExpanded ? '✕' : '⤢'}
                    </button>
                  </div>
                </div>

                {/* Dual-Mode Viewport Stage (~320px default, flex-1 when expanded) */}
                <div className={'relative bg-slate-100 dark:bg-[#0a0e17] overflow-hidden ' + (isViewportExpanded ? 'flex-1 min-h-[340px]' : 'h-[320px] min-h-[300px]')}>

                  {/* Layer A: 3D Thermal Furnace */}
                  <div
                    className={'absolute inset-0 transition-opacity duration-200 ' + (chamberMode === '3d' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0')}
                  >
                    <div ref={chamber3DHostRef} className="w-full h-full" />
                    <div className="pointer-events-none absolute left-3 bottom-2.5 z-20 flex items-center gap-2">
                      <span className={'px-2.5 py-1 rounded-full text-[10.5px] font-mono border backdrop-blur-sm transition-colors ' + (waferHovered ? 'bg-sky-500/90 text-white border-sky-300 font-bold shadow' : 'bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700')}>
                        Click wafer to inspect reaction front
                      </span>
                    </div>
                  </div>

                  {/* Layer B: 2D Cross-Section Canvas */}
                  <div
                    className={'absolute inset-0 transition-opacity duration-200 cursor-crosshair ' + (chamberMode === '2d' ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0')}
                  >
                    <canvas
                      ref={waferCanvasRef}
                      className="w-full h-full block"
                    />
                    <button
                      type="button"
                      onClick={handleBackTo3D}
                      className="absolute top-2.5 left-14 z-20 px-2.5 py-1 rounded-full text-[10.5px] font-mono font-semibold bg-white/90 dark:bg-slate-900/90 text-sky-700 dark:text-cyan-300 border border-sky-400/60 dark:border-cyan-500/50 hover:bg-sky-50 dark:hover:bg-slate-800 shadow-sm backdrop-blur-sm transition-colors flex items-center gap-1"
                    >
                      <span>← Back to 3D Chamber</span>
                    </button>
                  </div>

                  {/* Shared Right-Edge 10px Temperature Color Bar (Always Visible in 3D & 2D) */}
                  <TemperatureColorBar T={currentState ? currentState.T : 600} />

                </div>

                {/* Canvas Footer Legend with Initial Clean State Toggle */}
                <div className="px-3.5 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 gap-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-[#94a3b8] inline-block" />
                      <span className="text-slate-700 dark:text-slate-300">N₂ Purge</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block transition-colors"
                        style={{
                          backgroundColor: chemistry === 'wet' ? '#3b82f6' : chemConfig.color,
                          boxShadow: '0 0 6px ' + chemConfig.glow
                        }}
                      />
                      <span style={{ color: chemistry === 'wet' ? '#3b82f6' : chemConfig.color }}>
                        {chemConfig.label} {chamberMode === '2d' ? 'C(x)' : 'Stream'}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded bg-sky-500/80 border border-sky-400/60 inline-block" />
                      <span className="text-sky-700 dark:text-sky-300">SiO₂ Oxide</span>
                    </span>
                  </div>

                  {/* Pre-Clean Native Oxide vs HF Clean Dip */}
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

              {/* 4. DUAL CHARTS STACKED VERTICALLY (FULL-WIDTH) */}
              <div className="grid grid-cols-1 gap-3.5" style={{ gridTemplateColumns: '1fr' }}>

                {/* Top Chart: Oxide Thickness x_ox(t) & Temperature T(t) */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-md flex flex-col">
                  <div className="px-3.5 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Thermal Cycle &amp; Growth
                      </span>
                      <div className="flex items-center gap-2 text-[11px]">
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
                  <div className="relative h-[240px] min-h-[220px] bg-white dark:bg-[#0a0d14] cursor-crosshair">
                    <canvas
                      ref={chartTopRef}
                      className="w-full h-full block"
                      style={{ height: '240px' }}
                    />
                  </div>
                </div>

                {/* Bottom Chart: Chamber Gas Kinetics & MFC Flushing */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm dark:shadow-md flex flex-col">
                  <div className="px-3.5 py-1.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0a0e17] flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                        Chamber Gas Kinetics
                      </span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="flex items-center gap-1 font-semibold" style={{ color: chemConfig.color }}>
                          <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: chemConfig.color }} />
                          <span>{chemConfig.shortLabel} (%)</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <span className="w-2 h-0.5 border-b border-dashed border-slate-400 inline-block" />
                          <span>N₂ (%)</span>
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
                  <div className="relative h-[240px] min-h-[220px] bg-white dark:bg-[#0a0d14] cursor-crosshair">
                    <canvas
                      ref={chartBottomRef}
                      className="w-full h-full block"
                      style={{ height: '240px' }}
                    />
                  </div>
                </div>

              </div>

            </main>

          </div>

        </div>

        {/* 3. TAB 2: THEORY & PHYSICAL MODELS (STRUCTURED SECTIONS WITH ANCHOR IDS) */}
        <div className={'flex-1 overflow-y-auto ' + (activeTab === 'theory' ? 'block' : 'hidden')}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

            {/* Theory Header & Scannable Table of Contents Bar */}
            <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>Thermal Oxidation Theory & Physical Models</span>
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Fundamental kinetics, Arrhenius activation, volumetric mechanics, and crystallography governing silicon dioxide growth.
                  </p>
                </div>
              </div>

              {/* Quick Jump Anchor Links */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs font-mono">
                <span className="text-[11px] text-slate-400 mr-1 uppercase font-semibold">Jump to:</span>
                {[
                  { id: 'theory-origin-story', label: '0. Origin Story' },
                  { id: 'theory-deal-grove', label: '1. Deal-Grove Kinetics' },
                  { id: 'theory-volumetric', label: '2. Volumetric Expansion' },
                  { id: 'theory-arrhenius', label: '3. Arrhenius Kinetics' },
                  { id: 'theory-pressure-dilution', label: '4. Pressure & Dilution' },
                  { id: 'theory-chemistry', label: '5. Chemistries' },
                  { id: 'theory-orientation', label: '6. Crystal Orientation' },
                  { id: 'theory-thermal-budget', label: '7. Thermal Budget & Slip' }
                ].map(function (anchor) {
                  return (
                    <a
                      key={anchor.id}
                      href={'#' + anchor.id}
                      onClick={function (e) {
                        e.preventDefault();
                        var el = document.getElementById(anchor.id);
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          setHighlightedSection(anchor.id);
                          setTimeout(function () { setHighlightedSection(null); }, 1600);
                        }
                      }}
                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-cyan-300 hover:bg-sky-50 dark:hover:bg-slate-700 transition border border-slate-200 dark:border-slate-700"
                    >
                      {anchor.label}
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Section 0: The Origin Story: How Deal & Grove Saved the MOSFET */}
            <article
              id="theory-origin-story"
              className={
                'theory-section-anchor bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ' +
                (highlightedSection === 'theory-origin-story' ? 'section-highlight-pulse' : '')
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                <h3 className="font-mono font-bold text-sm sm:text-base text-sky-600 dark:text-cyan-400 flex items-center gap-2">
                  <span>0. The Origin Story: How Deal &amp; Grove Saved the MOSFET</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-cyan-300 border border-sky-300 dark:border-sky-700">
                  Fairchild, 1965
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                In the early 1960s, thermal oxidation was the make-or-break bottleneck of the semiconductor industry. <b>Fairchild Semiconductor</b> had just pioneered the planar process using SiO₂ as a protective mask and was racing to commercialize the <b>MOSFET</b>. Early devices were a nightmare—threshold voltages drifted wildly, wafers failed unpredictably, and engineers baked oxide by trial and error with no unified model explaining why growth looked linear in some tests and parabolic in others.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 my-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-sky-600 dark:text-cyan-400 block mb-1">1. The Odd Couple (1963)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                    <b>Gordon Moore</b> (head of Fairchild R&amp;D) paired <b>Bruce Deal</b>, a meticulous physical chemist obsessed with ultra-clean, repeatable furnace data, with <b>Andy Grove</b> (future Intel CEO), a fresh UC Berkeley chemical engineering PhD specializing in fluid dynamics and mass transport.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-amber-600 dark:text-amber-400 block mb-1">2. The &ldquo;Aha!&rdquo; Moment (1965)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                    Looking at Deal&apos;s exhaustive oxidation curves, Grove saw a classic chemical engineering traffic jam: gas transport, solid diffusion, and interface reaction. Balancing those three fluxes produced one quadratic equation unifying both linear and parabolic regimes (<i>Journal of Applied Physics</i>, Dec 1965).
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-purple-600 dark:text-purple-400 block mb-1">3. The Hidden Second Mystery</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans leading-relaxed">
                    Alongside <b>Ed Snow</b>, they also solved why MOSFET threshold voltages kept drifting: microscopic <b>sodium ions</b> from dirty quartz tubes, chemicals, and even human sweat were migrating through the oxide under electric fields.
                  </p>
                </div>
              </div>
              <div className="bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 p-3 rounded-lg text-xs text-sky-900 dark:text-cyan-300 leading-relaxed">
                <b>Why It Matters:</b> By solving both <i>how to grow SiO₂ predictably</i> (the Deal-Grove model) and <i>how to keep it electrically pure</i>, they turned the MOSFET from a fragile lab curiosity into the foundation of the entire digital age.
              </div>
            </article>

            {/* Section 1: Deal-Grove Linear vs. Parabolic Regimes */}
            <article
              id="theory-deal-grove"
              className={
                'theory-section-anchor bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ' +
                (highlightedSection === 'theory-deal-grove' ? 'section-highlight-pulse' : '')
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                <h3 className="font-mono font-bold text-sm sm:text-base text-sky-600 dark:text-cyan-400 flex items-center gap-2">
                  <span>1. The Deal-Grove Kinetics Model (Linear vs. Parabolic Regimes)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-cyan-300 border border-sky-300 dark:border-sky-700">
                  x_ox, A, B, B/A
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Formulated by Bruce Deal and Andrew Grove at Fairchild Semiconductor in 1965, the Deal-Grove model describes the thermal growth of silicon dioxide as a steady-state balance of three sequential physical fluxes:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 my-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-sky-600 dark:text-cyan-400 block mb-1">1. Gas Transport (F₁)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                    Flux of oxidant across the stagnant gas boundary layer to the outer SiO₂ surface: F₁ = h_g · (C_g - C_s).
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-amber-600 dark:text-amber-400 block mb-1">2. Solid Diffusion (F₂)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                    Fickian diffusion through the existing solid amorphous SiO₂ barrier: F₂ = D_eff · (C* - C_i) / x_ox.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-purple-600 dark:text-purple-400 block mb-1">3. Interface Reaction (F₃)</span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                    Chemical oxidation reaction at the Si/SiO₂ crystalline interface: F₃ = k_s · C_i.
                  </p>
                </div>
              </div>
              <div className="my-3 p-3 bg-slate-100 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-center text-xs text-sky-700 dark:text-cyan-300">
                <div className="font-bold text-sm">x_ox² + A · x_ox = B · (t + τ)</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Differential Growth Rate: dx_ox / dt = B / (2 · x_ox + A)
                </div>
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  • <b>Reaction-Limited Linear Regime (2 · x_ox &lt;&lt; A):</b> When the oxide is thin, oxidant diffusion through the film is fast. The overall rate is bottlenecked by the surface chemical reaction at the Si/SiO₂ interface: <code>x_ox ≈ (B/A) · (t + τ)</code>. The linear rate constant <code>B/A = k_s · (C* / N₁)</code> has an activation energy of <code>E_a ≈ 2.00 eV</code>, which matches the energy required to break crystalline Si–Si bonds.
                </p>
                <p>
                  • <b>Diffusion-Limited Parabolic Regime (2 · x_ox &gt;&gt; A):</b> As the oxide thickens beyond ~30 nm, oxidants must diffuse through the solid SiO₂ network to reach unoxidized silicon. Solid-state diffusion becomes the rate-limiting bottleneck: <code>x_ox² ≈ B · t</code> (or <code>x_ox ≈ √(B · t)</code>). The parabolic rate constant <code>B = 2 · D_eff · (C* / N₁)</code> has an activation energy of <code>1.24 eV</code> (dry O₂) or <code>0.78 eV</code> (wet H₂O).
                </p>
                <p>
                  • <b>Massoud Thin-Oxide Enhancement (Dry O₂):</b> Below 20 nm, dry O₂ oxidation proceeds substantially faster than classical Deal-Grove kinetics. Massoud (1985) modeled this using dual exponential decay terms:
                </p>
                <div className="p-2 bg-slate-50 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  R_massoud = P_ox^0.75 · [C₁ · exp(-E₁/kT) · exp(-x/L₁) + C₂ · exp(-E₂/kT) · exp(-x/L₂)]
                </div>
              </div>
            </article>

            {/* Section 2: Volumetric Expansion & Silicon Consumption */}
            <article
              id="theory-volumetric"
              className={
                'theory-section-anchor bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ' +
                (highlightedSection === 'theory-volumetric' ? 'section-highlight-pulse' : '')
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                <h3 className="font-mono font-bold text-sm sm:text-base text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <span>2. Silicon Consumption & Volumetric Expansion (44% Down / 56% Up)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  V_ox / V_si = 2.27
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Oxidation is not a deposition; it is a solid-state chemical transformation where incoming oxidant atoms bond directly with substrate silicon atoms:
              </p>
              <div className="p-3 bg-slate-100 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-center text-xs text-amber-700 dark:text-amber-300 my-2">
                Si (solid) + O₂ (gas) → SiO₂ (solid)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block mb-1">Atomic Density Constants</span>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    <li>• N_si = 5.0 × 10²² atoms/cm³ (V_m = 12.06 cm³/mol)</li>
                    <li>• N_ox = 2.2 × 10²² molec/cm³ (V_m = 27.18 cm³/mol)</li>
                    <li>• Volume Ratio: 27.18 / 12.06 ≈ <b>2.27× expansion</b></li>
                  </ul>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block mb-1">Datum Surface Partitioning</span>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    <li>• Consumed Substrate: <b>x_si = 0.44 · x_ox (44% down)</b></li>
                    <li>• Upward Expansion: <b>x_up = 0.56 · x_ox (56% up)</b></li>
                    <li>• Si/SiO₂ interface moves deeper into wafer</li>
                  </ul>
                </div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3 rounded-lg text-xs text-amber-900 dark:text-amber-300 leading-relaxed">
                <b>Fab Trade-Off:</b> The 56% upward expansion generates severe compressive stress in 3D structures such as Shallow Trench Isolation (STI) corners, FinFET fin edges, and Gate-All-Around (GAA) nanosheets. If not stress-relieved via viscous oxide reflow at &gt;950 °C, this stress punches crystallographic dislocations and induces gate leakage.
              </div>
            </article>

            {/* Section 3: Arrhenius Kinetics & Activation Energy */}
            <article
              id="theory-arrhenius"
              className={
                'theory-section-anchor bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ' +
                (highlightedSection === 'theory-arrhenius' ? 'section-highlight-pulse' : '')
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                <h3 className="font-mono font-bold text-sm sm:text-base text-orange-600 dark:text-orange-400 flex items-center gap-2">
                  <span>3. Temperature & Activation Energy (Arrhenius Kinetics)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300 border border-orange-300 dark:border-orange-700">
                  k = k_0 · exp(-E_a / kT)
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Both the linear rate constant (B/A) and parabolic rate constant (B) adhere strictly to Arrhenius thermal activation. Raising temperature increases both atomic thermal vibration and oxidant diffusivity through the amorphous silica matrix:
              </p>
              <div className="overflow-x-auto my-3">
                <table className="w-full text-xs font-mono border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                  <thead className="bg-slate-100 dark:bg-[#080b11] text-slate-700 dark:text-slate-300 text-left">
                    <tr>
                      <th className="p-2.5">Kinetic Parameter</th>
                      <th className="p-2.5">Dry O₂ (Activation Energy)</th>
                      <th className="p-2.5">Wet H₂O Steam (Activation Energy)</th>
                      <th className="p-2.5">Limiting Physical Process</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-600 dark:text-slate-400">
                    <tr>
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">Linear Rate (B/A)</td>
                      <td className="p-2.5 text-sky-600 dark:text-cyan-400">E_a ≈ 2.00 eV</td>
                      <td className="p-2.5 text-emerald-600 dark:text-emerald-400">E_a ≈ 2.05 eV</td>
                      <td className="p-2.5">Si–Si covalent bond dissociation at surface</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">Parabolic Rate (B)</td>
                      <td className="p-2.5 text-sky-600 dark:text-cyan-400">E_a ≈ 1.24 eV</td>
                      <td className="p-2.5 text-emerald-600 dark:text-emerald-400">E_a ≈ 0.78 eV</td>
                      <td className="p-2.5">Oxidant diffusion through solid SiO₂ matrix</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <b>Fab Rule of Thumb:</b> A 50 °C increase roughly doubles the oxidation rate. However, dopant diffusion (smear) scales with an even higher activation energy of <code>3.5–4.5 eV</code>. High furnace temperatures rapidly devour the critical thermal budget of ultra-shallow source/drain junctions.
              </p>
            </article>

            {/* Section 4: Chamber Pressure & Partial Pressure Dilution */}
            <article
              id="theory-pressure-dilution"
              className={
                'theory-section-anchor bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ' +
                (highlightedSection === 'theory-pressure-dilution' ? 'section-highlight-pulse' : '')
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                <h3 className="font-mono font-bold text-sm sm:text-base text-purple-600 dark:text-purple-400 flex items-center gap-2">
                  <span>4. Chamber Pressure, Partial Pressure & Henry's Law</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-700">
                  C* = H · P_ox
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                According to <b>Henry's Law</b>, the equilibrium concentration of oxidant dissolved into the outermost layer of SiO₂ (<code>C*</code>) is directly proportional to the partial pressure of the oxidant gas in the chamber:
              </p>
              <div className="my-2 p-3 bg-slate-100 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-center text-xs text-purple-700 dark:text-purple-300">
                P_ox = P_total · (C_ox / 100)  →  C* = H · P_ox
              </div>
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  • <b>High-Pressure Oxidation (HiPOx at 10–20 atm):</b> Elevating chamber pressure scales <code>C*</code> linearly, accelerating both linear and parabolic rate constants by 10× to 20×. This enables thick field oxides to be grown at lower temperatures (e.g. 800 °C instead of 1050 °C), conserving the thermal budget.
                </p>
                <p>
                  • <b>Dilute Oxidation (N₂ / Ar Carrier):</b> In ultra-thin gate oxide growth (sub-2 nm), 100% pure oxidant leads to rapid, uncontrollable early-stage growth. Diluting oxygen to 10%–20% in an inert nitrogen carrier throttles <code>P_ox</code>, providing sub-Ångstrom kinetic repeatability.
                </p>
                <p>
                  • <b>Low-Pressure Radical Oxidation (ISSG at 1–20 Torr):</b> Single-wafer chambers operate at low pressure to maintain laminar flow and prevent gas-phase recombination of energetic radicals before reaching the wafer surface.
                </p>
              </div>
            </article>

            {/* Section 5: Oxidant Chemistries (Dry vs Wet vs ISSG) */}
            <article
              id="theory-chemistry"
              className={
                'theory-section-anchor bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ' +
                (highlightedSection === 'theory-chemistry' ? 'section-highlight-pulse' : '')
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                <h3 className="font-mono font-bold text-sm sm:text-base text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <span>5. Oxidant Chemistry Species (Dry O₂ vs. Wet H₂O vs. ISSG Radical)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                  Solubility &amp; Interface Quality
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-xl border border-cyan-200 dark:border-cyan-900/50 flex flex-col justify-between">
                  <div>
                    <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400 block mb-1">Dry O₂ (Molecular)</span>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      Si + O₂ → SiO₂. Low solid solubility (C* ≈ 5×10¹⁶ cm⁻³), but creates the highest dielectric breakdown strength (&gt;10 MV/cm) and lowest interface trap density (D_it ~ 10¹⁰ cm⁻² eV⁻¹).
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-cyan-700 dark:text-cyan-400 font-mono">
                    MOSFET Gate Dielectric
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-xl border border-emerald-200 dark:border-emerald-900/50 flex flex-col justify-between">
                  <div>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Wet H₂O (Pyrogenic Steam)</span>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      Si + 2H₂O → SiO₂ + 2H₂. Hydroxyl radicals diffuse rapidly with 500–1000× higher solubility (C* ≈ 3×10¹⁹ cm⁻³). Parabolic rate is 5–10× faster than dry O₂.
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                    Thick STI / LOCOS Isolation
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-xl border border-purple-200 dark:border-purple-900/50 flex flex-col justify-between">
                  <div>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400 block mb-1">ISSG Radical Oxidation</span>
                    <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                      In-situ catalytic combustion of H₂ + O₂ at 1–20 Torr generating energetic atomic oxygen (O·) and hydroxyl (OH·) radicals. Oxidation rate is orientation-independent.
                    </p>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-purple-700 dark:text-purple-400 font-mono">
                    HKMG Interfacial &amp; GAA 3D
                  </div>
                </div>
              </div>
            </article>

            {/* Section 6: Crystal Orientation & Interface Trap Density */}
            <article
              id="theory-orientation"
              className={
                'theory-section-anchor bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ' +
                (highlightedSection === 'theory-orientation' ? 'section-highlight-pulse' : '')
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                <h3 className="font-mono font-bold text-sm sm:text-base text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                  <span>6. Crystal Orientation (&lt;100&gt; vs. &lt;111&gt;) &amp; Interface Trap Density (D_it)</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700">
                  (B/A)_111 ≈ 1.68 × (B/A)_100
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Silicon crystallizes in the diamond cubic lattice. Cutting wafers along different planes exposes differing densities of available surface silicon bonds:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3 text-xs font-mono">
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">&lt;100&gt; Crystal Cut (Standard CMOS)</span>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                    <li>• Surface Atom Density: 6.78 × 10¹⁴ atoms/cm²</li>
                    <li>• Interface Trap Density: D_it ~ 1 × 10¹⁰ cm⁻² eV⁻¹</li>
                    <li>• Lowest surface defect state for MOSFETs</li>
                  </ul>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-900 dark:text-slate-100 block mb-1">&lt;111&gt; Crystal Cut (+68% Linear Rate)</span>
                  <ul className="space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                    <li>• Surface Atom Density: 11.8 × 10¹⁴ atoms/cm² (+68%)</li>
                    <li>• Interface Trap Density: D_it ~ 3 × 10¹¹ cm⁻² eV⁻¹</li>
                    <li>• Higher trap density degrades carrier mobility</li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                In the reaction-limited linear regime, &lt;111&gt; oxidizes 68% faster because more silicon surface bonds are available to react per unit area. In the diffusion-limited parabolic regime, however, growth is governed strictly by transport through amorphous SiO₂ and becomes independent of substrate crystal orientation.
              </p>
            </article>

            {/* Section 7: Thermal Budget, Dopant Smear & Wafer Slip */}
            <article
              id="theory-thermal-budget"
              className={
                'theory-section-anchor bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all ' +
                (highlightedSection === 'theory-thermal-budget' ? 'section-highlight-pulse' : '')
              }
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-3">
                <h3 className="font-mono font-bold text-sm sm:text-base text-red-600 dark:text-red-400 flex items-center gap-2">
                  <span>7. Thermal Budget, Dopant Smear &amp; Wafer Slip Risk</span>
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-700">
                  σ_thermal &gt; CRSS
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                Modern nanoscale devices enforce strict thermal budget ceilings to preserve abrupt implant profiles:
              </p>
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block mb-1">
                    Cumulative Thermal Budget (Dopant Smear Integral)
                  </span>
                  <div className="p-2 bg-slate-100 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded font-mono text-center text-purple-700 dark:text-purple-300 my-1 text-[11px]">
                    TB = ∫₀ᵗ [ exp(-E_dopant / k_B T(t)) / exp(-E_dopant / k_B T_ref) ] dt
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    High thermal budgets cause sharp source/drain implants and halo dopants to diffuse laterally into the transistor channel, exacerbating drain-induced barrier lowering (DIBL) and threshold voltage shifts.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-[#090d15] rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 block mb-1">
                    Radial Thermal Stress &amp; Crystallographic Wafer Slip
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    When 300 mm wafers ramp up or down rapidly (&gt;25 °C/min), wafer edges radiate heat much faster than the center, creating a steep radial thermal gradient (ΔT_radial). Thermal stress scales as:
                  </p>
                  <div className="p-2 bg-slate-100 dark:bg-[#080b11] border border-slate-200 dark:border-slate-800 rounded font-mono text-center text-red-700 dark:text-red-300 my-1 text-[11px]">
                    σ_thermal ≈ [E · α · ΔT_radial] / [1 - ν]
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    When σ_thermal exceeds the Critical Resolved Shear Stress (CRSS) of silicon above 800 °C, crystalline planes slip along {'{111}'} glide lines, causing irreversible plastic wafer warpage, lithography overlay failures, and junction shorts.
                  </p>
                </div>
              </div>
            </article>

          </div>
        </div>

        {/* 4. TAB 3: INDUSTRY (STATE-OF-THE-ART EQUIPMENT, PROCESSES & DEEP-LINKS) */}
        <div className={'flex-1 overflow-y-auto ' + (activeTab === 'industry' ? 'block' : 'hidden')}>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

            {/* Industry Header */}
            <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>State-of-the-Art Fab Equipment, Processes & Research</span>
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Real-world 300 mm manufacturing tools, cutting-edge Gate-All-Around (GAA) nanosheets, HKMG interfacial layers, and SiC power device research.
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-Section 1: State-of-the-Art Fab Equipment */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
                <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  1. Production Fab Oxidation Tooling Architecture
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Tool 1: Vertical Batch Furnace */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-400 dark:hover:border-slate-700 transition">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                      <span>BATCH FURNACE</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">100–150 WAFERS</span>
                    </div>
                    <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                      Vertical Batch Furnaces
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-2 font-mono">
                      e.g., Tokyo Electron (TEL) Alpha-8SE / Kokusai Electric Vertron
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      Closed vertical quartz or silicon carbide (SiC) process tube with multi-zone resistive heating coils. Processes 100–150 300mm wafers simultaneously with slow paddle insertion (&lt;50 mm/min) to avoid thermal shock. Delivers unmatched cost-per-wafer for thick field oxides, STI liners, and pad dielectrics.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">Thick Wet Oxidation</span>
                    <button
                      type="button"
                      onClick={function () {
                        handleRunInSliders({
                          chemistry: 'wet',
                          orientation: '100',
                          tempPeak: 1050,
                          soakTime: 90,
                          pressure: 1.0,
                          oxidantConc: 100,
                          rampRate: 10,
                          initialOxide: 1.0
                        }, 'field');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-cyan-500/10 hover:bg-sky-100 dark:hover:bg-cyan-500/20 text-sky-700 dark:text-cyan-300 border border-sky-300 dark:border-cyan-500/40 font-mono text-xs font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      <span>Run in Sliders</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Tool 2: RTO / RTP Chamber */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-400 dark:hover:border-slate-700 transition">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                      <span>SINGLE-WAFER RTO</span>
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">50–150 °C/s RAMP</span>
                    </div>
                    <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                      Rapid Thermal Oxidation (RTO)
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-2 font-mono">
                      e.g., Applied Materials Radiance / Vantage RTP
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      Single-wafer lamp-heated chamber with upper/lower tungsten-halogen arrays delivering &gt;100 kW optical power. Features rotating wafer chuck (90 RPM), dynamic edge-guard heating rings, and multi-point pyrometry to eliminate radial temperature gradients and slip dislocations while freezing dopant profiles.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">RTO Gate Stack</span>
                    <button
                      type="button"
                      onClick={function () {
                        handleRunInSliders({
                          chemistry: 'dry',
                          orientation: '100',
                          tempPeak: 950,
                          soakTime: 2.0,
                          pressure: 1.0,
                          oxidantConc: 20,
                          rampRate: 100,
                          initialOxide: 1.0
                        }, 'rto');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-cyan-500/10 hover:bg-sky-100 dark:hover:bg-cyan-500/20 text-sky-700 dark:text-cyan-300 border border-sky-300 dark:border-cyan-500/40 font-mono text-xs font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      <span>Run in Sliders</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Tool 3: ISSG Radical Oxidation */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm hover:border-slate-400 dark:hover:border-slate-700 transition">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                      <span>RADICAL OXIDATION</span>
                      <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">1–20 TORR LOW-P</span>
                    </div>
                    <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                      In-Situ Steam Generation (ISSG)
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-2 font-mono">
                      e.g., Applied Materials Radiance ISSG / TEL PrexTron
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      Sub-atmospheric chamber with direct non-pyrogenic injection of H₂ and O₂ (&lt;33% H₂). Surface catalytic reaction generates energetic atomic oxygen (O·) and hydroxyl (OH·) radicals. Provides orientation-independent oxidation that eliminates corner thinning on 3D FinFET and GAA nanosheets.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">Atomic Interfacial Layer</span>
                    <button
                      type="button"
                      onClick={function () {
                        handleRunInSliders({
                          chemistry: 'issg',
                          orientation: '100',
                          tempPeak: 800,
                          soakTime: 0.5,
                          pressure: 0.01,
                          oxidantConc: 100,
                          rampRate: 100,
                          initialOxide: 1.0
                        }, 'issg');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-cyan-500/10 hover:bg-sky-100 dark:hover:bg-cyan-500/20 text-sky-700 dark:text-cyan-300 border border-sky-300 dark:border-cyan-500/40 font-mono text-xs font-bold transition flex items-center gap-1 shadow-sm"
                    >
                      <span>Run in Sliders</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>

            {/* Sub-Section 2: Cutting-Edge Processes & Active Research */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                <h3 className="font-mono font-bold text-sm uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  2. Cutting-Edge Processes &amp; Advanced Research Frontiers
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Research 1: HKMG Interfacial Layer */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                      <span>45nm → 2nm LOGIC</span>
                      <span className="text-[10px] font-bold text-sky-600 dark:text-cyan-400">0.5–0.8 nm SiO₂ IL</span>
                    </div>
                    <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                      High-κ / Metal Gate (HKMG) Interfacial Layer (IL)
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      Depositing high-κ dielectrics (HfO₂, ZrO₂) directly onto bare silicon causes severe Fermi-level pinning and cuts carrier channel mobility by &gt;50%. Fabs grow an atomically uniform <b>0.5–0.8 nm SiO₂ interfacial layer</b> via ISSG or ozone before HfO₂ ALD. This preserves carrier mobility while maintaining sub-0.8 nm Equivalent Oxide Thickness (EOT).
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">HKMG Sub-1nm Gate</span>
                    <button
                      type="button"
                      onClick={function () {
                        handleRunInSliders({
                          chemistry: 'issg',
                          orientation: '100',
                          tempPeak: 800,
                          soakTime: 0.5,
                          pressure: 0.01,
                          oxidantConc: 100,
                          rampRate: 100,
                          initialOxide: 1.0
                        }, 'issg');
                      }}
                      className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-sky-700 dark:text-cyan-300 border border-slate-300 dark:border-slate-700 font-mono text-[11px] font-semibold transition flex items-center gap-1"
                    >
                      <span>Run in Sliders</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>

                {/* Research 2: GAA Nanosheet Conformal Oxidation */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                      <span>2nm / A16 NODES</span>
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">CONFORMAL 3D</span>
                    </div>
                    <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                      Gate-All-Around (GAA) Nanosheet Oxidation
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      In horizontally stacked silicon nanosheet ribbons (MBCFET), oxidation must wrap around 3D nanostructures uniformly. Classical Deal-Grove kinetics retard at sharp concave corners due to compressive stress. Radical-based low-pressure oxidation ensures uniform corner rounding without sheet pinch-off or threshold voltage asymmetry.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">Nanosheet Corner Passivation</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">Active R&amp;D</span>
                  </div>
                </div>

                {/* Research 3: Low-Temp Plasma & Radical Oxidation */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                      <span>3D NAND &amp; BEOL</span>
                      <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">&lt; 500 °C THERMAL CEILING</span>
                    </div>
                    <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                      Low-Temperature Plasma / Radical Oxidation
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      Back-End-of-Line (BEOL) interconnects with copper metallization and 3D NAND flash memory (300+ wordline tiers) cannot tolerate temperatures exceeding 450–500 °C without copper migration and interlayer dielectric breakdown. Decoupled Plasma Oxidation (DPO) and microwave slot-plane antenna (SPA) plasma enable high-purity SiO₂ growth at 300–450 °C with negligible thermal budget penalty.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">BEOL Monolithic 3D</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">Plasma Radical</span>
                  </div>
                </div>

                {/* Research 4: SiC Power MOSFET Oxidation */}
                <div className="bg-white dark:bg-[#0d121c] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 mb-1">
                      <span>POWER ELECTRONICS</span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">&gt; 1200 °C + NO ANNEAL</span>
                    </div>
                    <h4 className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100 mb-1">
                      Silicon Carbide (SiC) Power MOSFET Oxidation
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                      Unlike silicon, oxidising 4H-SiC (SiC + 1.5 O₂ → SiO₂ + CO↑) produces carbon byproducts. Residual carbon clusters accumulate at the SiC/SiO₂ interface, creating high interface trap densities (D_it &gt; 10¹² cm⁻² eV⁻¹) that degrade electron mobility to &lt;20 cm²/V·s. Advanced power fabs follow high-temperature oxidation with Nitric Oxide (NO) or N₂O nitridation at 1200 °C to passivate carbon traps, raising channel mobility by 3–5×.
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400">1200V / 800V EV Inverters</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">Wide Bandgap</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>

        {/* 5. SLIDER & KPI INFO EXPLANATORY MODAL (WITH "DIVE DEEP INTO THEORY" ACTION) */}
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
                    Physical Mechanism &amp; Effect:
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

              {/* Fixed Footer: Secondary "Dive Deep into Theory" button to the LEFT of "Got It" */}
              <div className="flex-shrink-0 px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#0a0e17]/90 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={function () { handleDiveDeep(activeInfoId); }}
                  className="px-3.5 py-1.5 rounded-lg border border-sky-400 dark:border-cyan-500/50 bg-sky-50 dark:bg-cyan-500/10 text-sky-700 dark:text-cyan-300 hover:bg-sky-100 dark:hover:bg-cyan-500/25 font-mono font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm"
                  title="Jump directly to detailed physical theory section"
                >
                  <span>Dive Deep into Theory</span>
                </button>

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
