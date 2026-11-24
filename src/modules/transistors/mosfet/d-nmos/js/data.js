/**
 * data.js - NMOS CAD Viewer
 * Layer legends and comprehensive physics, fabrication, and electrical role metadata
 * for discrete N-channel MOSFET CAD inspection.
 */

var LEGEND = [
  { key: 'substrate', name: 'P-SUBSTRATE', color: 'var(--c-substrate)', desc: 'Base silicon wafer (P-type bulk). Hosts the D-NMOS transistor channel and depletion region.' },
  { key: 'active',    name: 'ACTIVE / DIFFUSION (N+)', color: 'var(--c-active-n)', desc: 'Heavily doped N+ regions forming the Source and Drain terminals (Nd ≈ 1×10²⁰ cm⁻³).' },
  { key: 'dchannel',  name: 'IMPLANTED N-CHANNEL (DEPLETION)', color: 'var(--c-sde-n)', desc: 'Permanently implanted shallow N-type donor layer bridging Source and Drain beneath the gate oxide. Provides a conductive electron path at zero gate bias (VGS = 0V, Normally ON).' },
  { key: 'sde',       name: 'SOURCE/DRAIN EXTENSION (N-SDE / LDD)', color: 'var(--c-sde-n)', desc: 'Shallow, lightly doped extension regions (Nd ≈ 1×10¹⁸ cm⁻³) flanking gate edges to curb Hot Carrier Injection (HCI) and short-channel effects.' },
  { key: 'oxide',     name: 'GATE OXIDE (INTERFACIAL SiO2)', color: 'var(--c-oxide)', desc: 'Ultra-thin chemical oxide layer (~0.6 nm) passivating the silicon interface to minimize interface trap states (Dit).' },
  { key: 'highk',     name: 'HIGH-K DIELECTRIC (HfO2)', color: 'var(--c-highk)', desc: 'Hafnium oxide (k ≈ 25 vs SiO2 k = 3.9) providing high gate capacitive coupling while eliminating quantum mechanical direct-tunneling leakage.' },
  { key: 'poly',      name: 'POLYSILICON / METAL GATE', color: 'var(--c-poly)', desc: 'Gate electrode controlling electrostatic potential across the channel to induce electron inversion or channel depletion.' },
  { key: 'spacer',    name: 'GATE SIDEWALL SPACER (Si3N4)', color: '#67e8f9', desc: 'Silicon nitride (Si3N4) sidewall spacers flanking the gate stack. Acts as a self-aligned mask for deep N+ source/drain implants, offsets silicide/contacts from the gate, and passivates gate sidewalls.' },
  { key: 'contact',   name: 'CONTACT (TUNGSTEN W)', color: 'var(--c-contact)', desc: 'Vertical CVD Tungsten via plugs bridging diffusion and poly layers to the first metal interconnect.' },
  { key: 'metal',     name: 'METAL-1 INTERCONNECT', color: 'var(--c-metal)', desc: 'First metallization layer routing Source (S/GND), Drain (D/VDS), Gate (G/VGS), and Body Tap (B/GND) terminals.' },
  { key: 'src',       name: 'SOURCE TERMINAL (S)', color: 'var(--c-active-n)', desc: 'Supplies carrier electrons into the channel; typically tied to circuit ground (0V).' },
  { key: 'drn',       name: 'DRAIN TERMINAL (D)', color: '#57cf8f', desc: 'Collects electrons from the channel; biased at VDS > 0V.' },
  { key: 'gate',      name: 'GATE TERMINAL (G)', color: '#e6c94a', desc: 'Voltage input terminal (VGS). Electrostatic field depletes or enhances the implanted N-channel.' },
  { key: 'body',      name: 'BODY / SUBSTRATE TAP (B)', color: '#9aa6b6', desc: 'Ohmic P+ contact biasing bulk substrate to GND to avoid forward-biasing the source-body junction.' }
];

var INFO = {
  psub: {
    title: 'P-SUBSTRATE (BULK SILICON)',
    fn: 'Base single-crystal p-type silicon wafer (Na ≈ 1×10¹⁵ cm⁻³).',
    role: 'Acts as the Body/Bulk terminal (B) of the NMOS transistor; normally tied to GND via the substrate tap.',
    conn: 'P+ Substrate Tap → Tungsten Contact → Metal-1 (GND / 0V)',
    rel: 'Contains the inverted electron channel between Source and Drain when VGS > VTH.',
    doping: 'P-type bulk, lightly doped — Na ≈ 1×10¹⁵ cm⁻³ (Boron acceptor dopant)'
  },
  nmosSrc: {
    title: 'SOURCE REGION (N+ DIFFUSION)',
    fn: 'Heavily doped N+ diffusion region engineered to inject conduction electrons into the channel.',
    role: 'Source terminal (S) — supplies electrons when the channel is inverted.',
    conn: 'Tungsten Via → Metal-1 Source Pad (Tied to GND / 0V)',
    rel: 'Bordered laterally by the shallow N-SDE / LDD extension facing the gate.',
    doping: 'N+, heavily doped — Nd ≈ 1×10²⁰ cm⁻³ (Arsenic/Phosphorus donor dopant)'
  },
  nmosDrn: {
    title: 'DRAIN REGION (N+ DIFFUSION)',
    fn: 'Heavily doped N+ diffusion region collecting conduction electrons from the channel.',
    role: 'Drain terminal (D) — receives electrons; output / load terminal biased at VDS.',
    conn: 'Tungsten Via → Metal-1 Drain Pad (Biased at VDS / OUT)',
    rel: 'Separated from Source by channel length L (gate footprint).',
    doping: 'N+, heavily doped — Nd ≈ 1×10²⁰ cm⁻³ (Arsenic/Phosphorus donor dopant)'
  },
  sdeSrc: {
    title: 'SOURCE EXTENSION (N-SDE / LDD)',
    fn: 'Shallow, lightly doped extension (LDD) under the source-side gate spacer.',
    role: 'Reduces the peak lateral electric field near the channel edge, mitigating Hot Carrier Injection (HCI) and short-channel effects.',
    conn: 'Bridges heavily doped N+ Source to the inversion channel under gate edge.',
    rel: 'Formed prior to gate spacer deposition using low-energy, self-aligned ion implantation.',
    doping: 'N-type, lightly doped — Nd ≈ 1×10¹⁸ cm⁻³'
  },
  sdeDrn: {
    title: 'DRAIN EXTENSION (N-SDE / LDD)',
    fn: 'Shallow, lightly doped extension (LDD) under the drain-side gate spacer.',
    role: 'Absorbs peak voltage drop near the drain to curb Drain-Induced Barrier Lowering (DIBL) and impact ionization.',
    conn: 'Bridges inversion channel to heavily doped N+ Drain.',
    rel: 'Shallow junction depth (xj < 15 nm in modern nodes) to prevent subsurface punchthrough.',
    doping: 'N-type, lightly doped — Nd ≈ 1×10¹⁸ cm⁻³'
  },
  channel: {
    title: 'IMPLANTED N-CHANNEL (DEPLETION)',
    fn: 'Permanently implanted shallow N-type donor layer (Arsenic/Phosphorus dopant, Nd ≈ 2×10¹⁷ cm⁻³) connecting Source and Drain beneath the gate dielectric.',
    role: 'Provides built-in electron conduction at zero gate bias (VGS = 0V, Normally ON). Applying a negative gate bias (VGS < 0) depletes conduction electrons until the channel completely pinches off / quenches at threshold VTH = -0.80V (Cutoff). Applying a positive gate bias (VGS > 0) operates in Enhancement mode, attracting extra electrons and boosting current.',
    conn: 'Permanently bridges N+ Source (S) and N+ Drain (D) across channel length L.',
    rel: 'Modulated by gate potential: depleted for -0.80V < VGS < 0V, fully quenched in Cutoff (VGS ≤ -0.80V), and enhanced for VGS > 0V.',
    doping: 'N-type implanted layer — Nd ≈ 2×10¹⁷ cm⁻³ (Arsenic/Phosphorus ion implant)'
  },
  depletion: {
    title: 'SATURATION PINCH-OFF DEPLETION REGION',
    fn: 'Space-charge depletion region formed near the drain edge when VDS ≥ VGS - VTH.',
    role: 'At pinch-off, the channel inversion layer ends at Leff = L - ΔL. The remaining gap ΔL is depleted of mobile carriers; a high lateral electric field sweeps velocity-saturated electrons across this space-charge zone into the Drain.',
    conn: 'High-field space-charge region bridging pinched channel edge to N+ Drain.',
    rel: 'Expands monotonically with drain overdrive (VDS - VOV) toward the source, causing channel length modulation (CLM).',
    doping: 'High-field ionized space-charge region (depleted of mobile electrons)'
  },
  oxide: {
    title: 'GATE OXIDE (INTERFACIAL SiO2)',
    fn: 'Atomically thin chemical silicon dioxide (SiO2) layer (~0.6 nm).',
    role: 'Passivates the silicon channel interface, ensuring low interface trap density (Dit < 1×10¹¹ cm⁻²·eV⁻¹) and high carrier mobility.',
    conn: 'Sandwiched directly between silicon channel and High-k HfO2.',
    rel: 'Thermally grown or ozone-oxidized before high-k deposition.',
    doping: 'Stoichiometric dielectric — SiO2 (k = 3.9)'
  },
  highk: {
    title: 'HIGH-K DIELECTRIC (HfO2)',
    fn: 'Hafnium dioxide dielectric layer with high relative permittivity (k ≈ 25).',
    role: 'Provides high gate capacitance (Cox) for robust channel inversion without quantum mechanical tunneling gate leakage.',
    conn: 'Couples gate electrode electrostatic potential to the channel.',
    rel: 'Deposited via Atomic Layer Deposition (ALD) with sub-angstrom thickness control.',
    doping: 'High-k metal oxide — HfO2 (EOT ≈ 0.8 nm)'
  },
  poly: {
    title: 'GATE ELECTRODE (POLYSILICON / METAL GATE)',
    fn: 'Gate electrode stripe crossing over the active area.',
    role: 'Gate terminal (G) — applied voltage VGS controls the vertical electric field in the channel.',
    conn: 'Tungsten Via → Metal-1 Gate Pad (VGS Input)',
    rel: 'Defines the physical gate length L; masks the self-aligned S/D implants.',
    doping: 'Heavily N+ doped polysilicon or workfunction-tuned TiN/TaN metal gate'
  },
  spacer: {
    title: 'GATE SIDEWALL SPACERS (Si3N4)',
    fn: 'Silicon nitride (Si3N4) dielectric spacers formed on the vertical sidewalls of the gate stack.',
    role: 'Acts as a self-aligned offset hardmask for the heavy N+ source/drain deep ion implants, protecting the shallow N-SDE / LDD extensions underneath. Prevents source/drain silicide from shorting to the gate electrode and reduces gate-to-drain parasitic overlap capacitance (Cgd).',
    conn: 'Dielectric insulator flanking gate electrode and gate dielectric.',
    rel: 'Deposited conformally by LPCVD/PECVD and anisotropically reactive-ion etched (RIE) back with zero lateral mask.',
    doping: 'Dielectric insulator — Silicon Nitride (Si3N4, k ≈ 7.5)'
  },
  contact: {
    title: 'TUNGSTEN CONTACT PLUGS (W-VIA)',
    fn: 'Chemical Vapor Deposition (CVD) Tungsten via plugs with Ti/TiN barrier liners.',
    role: 'Low-resistance vertical interconnects bridging silicon/poly to Metal-1.',
    conn: 'Active Diffusion / Poly / Tap ↔ Metal-1',
    rel: 'Surrounded by dielectric interlayer (ILD SiO2 / low-k).',
    doping: 'Metallic conductor — pure Tungsten (W)'
  },
  nmosSrcCt: {
    title: 'SOURCE CONTACT (W)',
    fn: 'Tungsten via plug contacting the N+ Source diffusion.',
    role: 'Provides low-resistance vertical connection between the Source diffusion and Metal-1 Source pad (GND).',
    conn: 'N+ Source ↔ Metal-1 Source Pad',
    rel: 'Filled with CVD Tungsten over Ti/TiN barrier liner and polished via CMP.',
    doping: 'Metallic conductor — pure Tungsten (W)'
  },
  nmosDrnCt: {
    title: 'DRAIN CONTACT (W)',
    fn: 'Tungsten via plug contacting the N+ Drain diffusion.',
    role: 'Provides low-resistance vertical connection between the Drain diffusion and Metal-1 Drain pad (VDS).',
    conn: 'N+ Drain ↔ Metal-1 Drain Pad',
    rel: 'Filled with CVD Tungsten over Ti/TiN barrier liner and polished via CMP.',
    doping: 'Metallic conductor — pure Tungsten (W)'
  },
  polyCt: {
    title: 'GATE CONTACT (W)',
    fn: 'Tungsten via plug contacting the Polysilicon/Metal Gate runner.',
    role: 'Transmits gate input voltage (VGS) from Metal-1 Gate pad down to the gate electrode.',
    conn: 'Poly Gate Runner ↔ Metal-1 Gate Pad',
    rel: 'Terminates on the gate extension outside the active channel area.',
    doping: 'Metallic conductor — pure Tungsten (W)'
  },
  subtapCt: {
    title: 'BODY TAP CONTACT (W)',
    fn: 'Tungsten via plug contacting the P+ Substrate tap.',
    role: 'Biases the P-substrate to 0V reference ground, eliminating body bias and preventing latch-up.',
    conn: 'P+ Substrate Tap ↔ Metal-1 Body Pad',
    rel: 'Surrounded by ILD dielectric on the bulk wafer body.',
    doping: 'Metallic conductor — pure Tungsten (W)'
  },
  metal: {
    title: 'METAL-1 INTERCONNECT (Cu / Al)',
    fn: 'First level copper/aluminum metallization layer.',
    role: 'Routes electrical signals and power to the device terminals (Source, Drain, Gate, Body).',
    conn: 'Connects to contacts below and higher metal layers above.',
    rel: 'Planarized using Chemical Mechanical Polishing (CMP).',
    doping: 'Metallic conductor (Copper / Aluminum runner)'
  },
  subtap: {
    title: 'SUBSTRATE / BODY TAP (P+ OHMIC CONTACT)',
    fn: 'Heavily doped P+ diffusion region into the P-substrate.',
    role: 'Provides an ohmic contact to the body, holding the substrate at 0V (GND) to prevent body effect and parasitic latch-up.',
    conn: 'P+ Tap → Tungsten Contact → Metal-1 (GND)',
    rel: 'Located adjacent to the NMOS active area on the bulk wafer.',
    doping: 'P+, heavily doped — Na ≈ 1×10²⁰ cm⁻³ (Boron dopant)'
  },
  srcRail: {
    title: 'SOURCE RAIL / PAD (GND)',
    fn: 'Metal-1 terminal pad providing ground potential to the Source.',
    role: 'Maintains Source at reference ground (0V).',
    conn: 'Tied to circuit GND / 0V.',
    rel: 'Forms the reference terminal for VGS and VDS voltages.'
  },
  drnRail: {
    title: 'DRAIN RAIL / PAD (VDS / OUT)',
    fn: 'Metal-1 terminal pad biased at positive drain potential VDS.',
    role: 'Collects drain current ID from the conducting channel.',
    conn: 'Tied to VDS / external load.',
    rel: 'Current flows from Drain to Source when channel is active.'
  },
  gateRail: {
    title: 'GATE INPUT PAD (VGS)',
    fn: 'Metal-1 terminal pad supplying continuous input gate bias VGS (0.00V to 1.80V).',
    role: 'Controls channel inversion: Cutoff when VGS < VTH (0.40V), Linear/Triode when VDS < VGS - VTH, and Saturation when VDS ≥ VGS - VTH.',
    conn: 'Drives gate electrode via tungsten contact plug.',
    rel: 'Purely capacitive terminal — draws near-zero DC steady-state current.'
  },
  bodyRail: {
    title: 'BODY / BULK TERMINAL (B / GND)',
    fn: 'Metal-1 terminal pad grounding the substrate body tap.',
    role: 'Ensures VBS = 0V to maintain standard threshold voltage VTH.',
    conn: 'Tied to circuit GND.',
    rel: 'Prevents floating body charge accumulation.'
  }
};
