/**
 * data.js - PMOS CAD Viewer
 * Layer legends and comprehensive physics, fabrication, and electrical role metadata
 * for discrete P-channel MOSFET CAD inspection.
 */

var LEGEND = [
  { key: 'substrate', name: 'P-SUBSTRATE', color: 'var(--c-substrate)', desc: 'Base silicon wafer (P-type bulk). Hosts the deep N-Well tub.' },
  { key: 'well',      name: 'N-WELL TUB', color: 'var(--c-well)', desc: 'Deep retrograde N-type tub diffused into P-substrate (Nd ≈ 1×10¹⁷ cm⁻³). Isolates the PMOS active region.' },
  { key: 'depletion', name: 'DEPLETION REGION', color: 'var(--c-depletion)', desc: 'Ionized space-charge shells wrapping the P+ Source/Drain junctions inside the N-Well and sub-gate bulk depletion pocket. Separate around S/D at |VGS|=0, merges beneath SiO2 in subthreshold/inversion, and bulges around Drain in saturation.' },
  { key: 'active',    name: 'ACTIVE / DIFFUSION (P+)', color: 'var(--c-active-p)', desc: 'Heavily doped P+ regions forming the Source and Drain terminals (Na ≈ 1×10²⁰ cm⁻³).' },
  { key: 'channel',   name: 'HOLE INVERSION CHANNEL (P-TYPE)', color: 'var(--c-sde-p)', desc: 'Conductive surface inversion layer of mobile holes induced beneath gate oxide when VSG > |VTH,p|.' },
  { key: 'sde',       name: 'SOURCE/DRAIN EXTENSION (P-SDE / LDD)', color: 'var(--c-sde-p)', desc: 'Shallow, lightly doped extension regions (Na ≈ 1×10¹⁸ cm⁻³) flanking gate edges to curb Hot Carrier Injection (HCI).' },
  { key: 'oxide',     name: 'GATE OXIDE (INTERFACIAL SiO2)', color: 'var(--c-oxide)', desc: 'Ultra-thin chemical oxide layer (~0.6 nm) passivating silicon surface to minimize Dit interface defect states.' },
  { key: 'highk',     name: 'HIGH-K DIELECTRIC (HfO2)', color: 'var(--c-highk)', desc: 'Hafnium oxide (k ≈ 25 vs SiO2 k = 3.9) providing high gate capacitive coupling without direct tunneling leakage.' },
  { key: 'poly',      name: 'POLYSILICON / METAL GATE', color: 'var(--c-poly)', desc: 'Gate electrode controlling electrostatic potential across the channel to induce hole inversion.' },
  { key: 'spacer',    name: 'GATE SIDEWALL SPACER (Si3N4)', color: '#67e8f9', desc: 'Silicon nitride (Si3N4) sidewall spacers flanking the gate stack. Acts as a self-aligned mask for deep P+ source/drain implants, offsets silicide/contacts from the gate, and passivates gate sidewalls.' },
  { key: 'silicide',  name: 'SILICIDE (NiSi)', color: 'var(--c-silicide)', desc: 'Self-aligned nickel silicide (NiSi) layer formed on exposed Source/Drain silicon to create a low-resistance ohmic contact for Tungsten vias.' },
  { key: 'contact',   name: 'CONTACT (TUNGSTEN W)', color: 'var(--c-contact)', desc: 'Vertical CVD Tungsten via plugs bridging diffusion, well tap, and poly layers to the first metal interconnect.' },
  { key: 'metal',     name: 'METAL-1 INTERCONNECT', color: 'var(--c-metal)', desc: 'First metallization layer routing Source (S/VDD), Drain (D/OUT), Gate (G/VG), and N-Well Tap (B/VDD) terminals.' },
  { key: 'src',       name: 'SOURCE TERMINAL (S / VDD)', color: 'var(--c-active-p)', desc: 'Supplies carrier holes into the channel; tied to positive supply rail VDD (1.0V).' },
  { key: 'drn',       name: 'DRAIN TERMINAL (D / OUT)', color: '#e6a23c', desc: 'Collects holes from the channel; pulls output up to VDD when PMOS conducts.' },
  { key: 'gate',      name: 'GATE TERMINAL (G / VG)', color: '#e6c94a', desc: 'Active-low voltage input terminal. Low VG (0V) turns PMOS ON; High VG (VDD) turns PMOS OFF.' },
  { key: 'welltap',   name: 'N-WELL TAP (B / VDD)', color: '#3f8f6f', desc: 'Ohmic N+ contact biasing N-well tub to VDD to prevent forward-biasing the source-well junction.' }
];

var INFO = {
  psub: {
    title: 'P-SUBSTRATE (BULK SILICON)',
    fn: 'Base single-crystal p-type silicon wafer (Na ≈ 1×10¹⁵ cm⁻³).',
    role: 'Hosts the deep N-Well tub and provides mechanical die stability.',
    conn: 'Tied to GND across the die substrate grid.',
    rel: 'Encloses the N-Well tub with a reverse-biased PN junction isolation.',
    doping: 'P-type bulk silicon — lightly doped with Boron (Na ≈ 1×10¹⁵ cm⁻³)'
  },
  nwell: {
    title: 'N-WELL TUB (RETROGRADE IMPLANT)',
    fn: 'Deep N-type doped tub inside the p-substrate formed by Phosphorus implantation and thermal drive-in.',
    role: 'Acts as the Body/Bulk terminal of the PMOS transistor; biased at VDD via the N-well tap.',
    conn: 'N+ Well Tap → Tungsten Contact → Metal-1 (VDD / +1.0V)',
    rel: 'Contains the PMOS active region and isolates it from the p-substrate bulk.',
    doping: 'N-type, retrograde Gaussian — Nd ≈ 1×10¹⁷ cm⁻³'
  },
  pmosSrc: {
    title: 'SOURCE REGION (P+ DIFFUSION)',
    fn: 'Heavily doped P+ diffusion region engineered to inject mobile holes into the channel.',
    role: 'Source terminal (S) — tied to positive rail VDD (+1.0V). Supplies holes during conduction.',
    conn: 'Tungsten Via → Metal-1 Source Pad (VDD / 1.0V)',
    rel: 'Bordered laterally by shallow P-SDE / LDD extension facing the gate.',
    doping: 'P+, heavily doped — Na ≈ 1×10²⁰ cm⁻³ (Boron / BF2 dopant)'
  },
  pmosDrn: {
    title: 'DRAIN REGION (P+ DIFFUSION)',
    fn: 'Heavily doped P+ diffusion region collecting conduction holes from the channel.',
    role: 'Drain terminal (D) — pulls output node OUT up towards VDD when gate is low (VG = 0V).',
    conn: 'Tungsten Via → Metal-1 Drain Pad (OUT)',
    rel: 'Separated from Source by channel length L (gate footprint).',
    doping: 'P+, heavily doped — Na ≈ 1×10²⁰ cm⁻³ (Boron / BF2 dopant)'
  },
  sdeSrc: {
    title: 'SOURCE EXTENSION (P-SDE / LDD)',
    fn: 'Shallow, lightly doped P-type extension under the source-side gate spacer.',
    role: 'Reduces peak electric field near channel edge, suppressing hot carrier degradation and short-channel effects.',
    conn: 'Bridges heavily doped P+ Source to the inversion channel under gate edge.',
    rel: 'Ultra-shallow junction (xj < 15 nm) to control punchthrough.',
    doping: 'P-type, lightly doped — Na ≈ 1×10¹⁸ cm⁻³'
  },
  sdeDrn: {
    title: 'DRAIN EXTENSION (P-SDE / LDD)',
    fn: 'Shallow, lightly doped P-type extension under the drain-side gate spacer.',
    role: 'Mitigates Drain-Induced Barrier Lowering (DIBL) and lateral straggle effects.',
    conn: 'Bridges inversion channel to heavily doped P+ Drain.',
    rel: 'Formed self-aligned to gate prior to spacer deposition.',
    doping: 'P-type, lightly doped — Na ≈ 1×10¹⁸ cm⁻³'
  },
  channel: {
    title: 'HOLE INVERSION CHANNEL REGION',
    fn: 'Sub-gate silicon interface inside the N-Well where electrostatic band bending and hole transport occur.',
    role: 'When VSG > |VTH,p| (0.40V), negative gate-to-channel potential induces an accumulation of mobile holes (p-channel inversion). In Linear/Triode (VSD < VSG - |VTH,p|), channel is continuous from Source to Drain. In Saturation (VSD ≥ VSG - |VTH,p|), channel pinches off near the drain (effective length Leff = L - ΔL) and mobile holes accelerate across the space-charge depletion field.',
    conn: 'Conductive p-type bridge between P+ Source and P+ Drain.',
    rel: 'Modulated dynamically by gate overdrive (VOV = VSG - |VTH,p|) and drain bias (VSD).',
    doping: 'Induced mobile holes — p-channel active inversion layer'
  },
  depletion: {
    title: 'DEPLETION REGION (SPACE-CHARGE ENVELOPE)',
    fn: 'Built-in PN-junction depletion shells around P+ Source/S-LDD and P+ Drain/D-LDD inside the N-Well plus the gate-induced bulk depletion cradle beneath SiO2.',
    role: 'At equilibrium (|VGS|=0, |VDS|=0), two separate shells wrap Source and Drain independently. For 0 < |VGS| < |VTH,p| (subthreshold), a bulk depletion pocket grows under SiO2 and merges them. Above |VTH,p|, the depletion cradle sits beneath the hole inversion channel; in saturation (|VDS| ≥ |VGS| - |VTH,p|), the Drain-side depletion bulb expands asymmetrically as Leff shifts toward Source.',
    conn: 'Wraps P+ Source/P-SDE and P+ Drain/P-SDE junctions inside the N-Well and underlies the hole inversion channel.',
    rel: 'Isolates active P+ diffusions from the N-Well body and governs threshold band bending and channel-length modulation.',
    doping: 'Ionized fixed donor space-charge region (depleted of mobile carriers)'
  },
  oxide: {
    title: 'GATE OXIDE (INTERFACIAL SiO2)',
    fn: 'Atomically thin chemical silicon dioxide (SiO2) layer (~0.6 nm).',
    role: 'Passivates the silicon channel interface, ensuring low Dit interface trap density and high hole mobility.',
    conn: 'Sandwiched directly between N-Well silicon surface and High-k HfO2.',
    rel: 'Thermally grown or ozone-oxidized before high-k deposition.',
    doping: 'Stoichiometric dielectric — SiO2 (k = 3.9)'
  },
  highk: {
    title: 'HIGH-K DIELECTRIC (HfO2)',
    fn: 'Hafnium dioxide dielectric layer with high relative permittivity (k ≈ 25).',
    role: 'Provides high gate capacitance (Cox) for robust channel inversion without quantum tunneling gate leakage.',
    conn: 'Couples gate electrode electrostatic potential to the channel.',
    rel: 'Deposited via Atomic Layer Deposition (ALD).',
    doping: 'High-k metal oxide — HfO2 (EOT ≈ 0.8 nm)'
  },
  poly: {
    title: 'GATE ELECTRODE (POLYSILICON / METAL GATE)',
    fn: 'Gate electrode stripe crossing over the N-Well active area.',
    role: 'Gate terminal (G) — active-low input voltage VG controls channel conduction.',
    conn: 'Tungsten Via → Metal-1 Gate Pad (VG Input)',
    rel: 'Workfunction tuned specifically for PMOS band alignment near valence band edge (Ev).',
    doping: 'P+ doped polysilicon or workfunction metal (e.g. TiN/Pt)'
  },
  spacer: {
    title: 'GATE SIDEWALL SPACERS (Si3N4)',
    fn: 'Silicon nitride (Si3N4) dielectric spacers formed on the vertical sidewalls of the gate stack.',
    role: 'Acts as a self-aligned offset hardmask for the heavy P+ source/drain deep ion implants, protecting the shallow P-SDE / LDD extensions underneath. Prevents source/drain silicide from shorting to the gate electrode and reduces gate-to-drain parasitic overlap capacitance (Cgd).',
    conn: 'Dielectric insulator flanking gate electrode and gate dielectric.',
    rel: 'Deposited conformally by LPCVD/PECVD and anisotropically reactive-ion etched (RIE) back with zero lateral mask.',
    doping: 'Dielectric insulator — Silicon Nitride (Si3N4, k ≈ 7.5)'
  },
  silicide: {
    title: 'SELF-ALIGNED SILICIDE (SALICIDE / NiSi)',
    fn: 'Low-resistivity nickel monosilicide (NiSi) ohmic contact pads selectively formed atop exposed Source/Drain and N-Well Tap silicon.',
    role: 'Reduces parasitic sheet and contact resistance (Rc) between heavily doped silicon and vertical Tungsten vias while blocked from the gate sidewalls by the Si3N4 spacers.',
    conn: 'P+ Source / P+ Drain / N+ Well Tap ↔ NiSi Silicide Pad ↔ Tungsten Contact Via',
    rel: 'Self-aligned thermally annealed Ni/Si reaction strictly bounded by the outer edges of the Si3N4 sidewall spacers.',
    doping: 'Metallic silicide compound — Nickel Monosilicide (NiSi)'
  },
  srcSil: {
    title: 'SOURCE SILICIDE PAD (NiSi)',
    fn: 'Self-aligned nickel silicide (NiSi) layer formed directly on the exposed top surface of the P+ Source diffusion.',
    role: 'Provides an ultra-low-resistance ohmic landing pad for the Source Tungsten contact via while isolated from the gate by the left Si3N4 spacer.',
    conn: 'P+ Source Diffusion ↔ Source NiSi Pad ↔ Source Tungsten Via (W)',
    rel: 'Starts flush outside the left Si3N4 spacer outer edge and spans across the exposed Source top surface matching active width Wp.',
    doping: 'Metallic silicide compound — Nickel Monosilicide (NiSi)'
  },
  drnSil: {
    title: 'DRAIN SILICIDE PAD (NiSi)',
    fn: 'Self-aligned nickel silicide (NiSi) layer formed directly on the exposed top surface of the P+ Drain diffusion.',
    role: 'Provides an ultra-low-resistance ohmic landing pad for the Drain Tungsten contact via while isolated from the gate by the right Si3N4 spacer.',
    conn: 'P+ Drain Diffusion ↔ Drain NiSi Pad ↔ Drain Tungsten Via (W)',
    rel: 'Starts flush outside the right Si3N4 spacer outer edge and spans across the exposed Drain top surface matching active width Wp.',
    doping: 'Metallic silicide compound — Nickel Monosilicide (NiSi)'
  },
  welltapSil: {
    title: 'N-WELL TAP SILICIDE PAD (NiSi)',
    fn: 'Self-aligned nickel silicide (NiSi) contact pad formed atop the N+ Well Tap.',
    role: 'Lowers ohmic contact resistance beneath the Well Tap Tungsten via holding the N-Well at VDD.',
    conn: 'N+ Well Tap ↔ Well Tap NiSi Pad ↔ Well Tap Tungsten Via (W)',
    rel: 'Seated flush between the N+ Well Tap surface and the Well Tap Tungsten plug.',
    doping: 'Metallic silicide compound — Nickel Monosilicide (NiSi)'
  },
  contact: {
    title: 'TUNGSTEN CONTACT PLUG (W-VIA)',
    fn: 'Chemical Vapor Deposition (CVD) Tungsten via plug with Ti/TiN barrier liner.',
    role: 'Low-resistance vertical interconnect bridging diffusion, poly, or well tap to Metal-1.',
    conn: 'Active / Poly / Tap ↔ Metal-1',
    rel: 'Passes through interlayer dielectric (ILD).',
    doping: 'Metallic conductor — pure Tungsten (W)'
  },
  metal: {
    title: 'METAL-1 INTERCONNECT (Cu / Al)',
    fn: 'First level copper/aluminum metallization layer.',
    role: 'Routes electrical power and signals to device terminals (Source, Drain, Gate, Well Tap).',
    conn: 'Connects to contacts below and higher metal layers above.',
    rel: 'Planarized using Chemical Mechanical Polishing (CMP).',
    doping: 'Metallic conductor (Copper / Aluminum runner)'
  },
  welltap: {
    title: 'N-WELL TAP (N+ OHMIC CONTACT)',
    fn: 'Heavily doped N+ diffusion region into the N-Well.',
    role: 'Provides an ohmic contact biasing the N-well to VDD (+1.0V), preventing latch-up and forward-biased well diodes.',
    conn: 'N+ Tap → Tungsten Contact → Metal-1 (VDD)',
    rel: 'Located adjacent to the PMOS active area inside the N-Well.',
    doping: 'N+, heavily doped — Nd ≈ 1×10²⁰ cm⁻³ (Phosphorus dopant)'
  },
  srcRail: {
    title: 'SOURCE RAIL / PAD (VDD)',
    fn: 'Metal-1 terminal pad providing positive supply potential (+1.0V) to the PMOS Source.',
    role: 'Maintains PMOS Source at VDD.',
    conn: 'Tied to circuit supply rail VDD (+1.0V).',
    rel: 'Source node of the pull-up network.'
  },
  drnRail: {
    title: 'DRAIN RAIL / PAD (OUT)',
    fn: 'Metal-1 terminal pad biased at output node potential OUT.',
    role: 'Delivers pulled-up current to load when PMOS conducts.',
    conn: 'Tied to output node OUT.',
    rel: 'Current flows from Source to Drain when channel is active.'
  },
  gateRail: {
    title: 'GATE INPUT PAD (G / VG / VSG)',
    fn: 'Metal-1 terminal pad supplying continuous input gate bias VSG (0.00V to 1.80V) where VG = VDD - VSG.',
    role: 'Controls channel inversion: Cutoff when VSG < |VTH,p| (0.40V), Linear/Triode when VSD < VSG - |VTH,p|, and Saturation when VSD ≥ VSG - |VTH,p|.',
    conn: 'Drives gate electrode via tungsten contact plug.',
    rel: 'Purely capacitive terminal — draws near-zero DC steady-state current.'
  },
  wellRail: {
    title: 'N-WELL BODY TERMINAL (B / VDD)',
    fn: 'Metal-1 terminal pad biasing the N-well body tap to VDD.',
    role: 'Ensures VBS = 0V to maintain standard PMOS threshold voltage |VTP|.',
    conn: 'Tied to supply rail VDD.',
    rel: 'Prevents body effect.'
  }
};
