/**
 * data.js - PN Junction Diode CAD Viewer
 * Component metadata, architectural layer hierarchy, and lambda design rules
 * for a planar diffused silicon IC PN junction diode.
 */

var COMPONENTS = {
  substrate: {
    id: 'substrate',
    name: 'P-Type Silicon Substrate (Bulk Wafer)',
    title: 'P-Substrate Wafer (Mechanical & Bulk Body)',
    layer: 'Substrate',
    role: 'Provides mechanical wafer integrity and electrical isolation for integrated IC components.',
    fn: 'Single-crystal P-type silicon wafer (Na ≈ 1×10¹⁵ cm⁻³) lightly doped with Boron. Hosts the implanted N-Well tub.',
    doping: 'Boron (NA): ~10¹⁵ cm⁻³ (Lightly doped P-type bulk)',
    colorVar: '--c-substrate',
    colorHex: '#1E3A5F',
    thickness: '4.0 μm (CAD normalized)',
    area: '26 μm × 15 μm'
  },
  nwell: {
    id: 'nwell',
    name: 'N-Well (Cathode Body Region)',
    title: 'N-Well Tub (Implanted Cathode Body)',
    layer: 'Well Implantation',
    role: 'Acts as the n-type cathode semiconductor body hosting the metallurgical junction and ohmic tap.',
    fn: 'Formed by high-energy Phosphorus/Arsenic ion implantation and high-temperature thermal drive-in diffusion. Encapsulates the P+ anode tub and N+ cathode tap.',
    doping: 'Phosphorus (ND): 10¹⁵ – 10¹⁹ cm⁻³ (Adjustable via ND slider)',
    colorVar: '--c-well',
    colorHex: '#166534',
    thickness: '3.0 μm depth into silicon',
    area: '21 μm × 12 μm'
  },
  pRegion: {
    id: 'pRegion',
    name: 'P+ Anode Diffusion Tub',
    title: 'P+ Anode Tub (Heavily Doped Active Diffusion)',
    layer: 'Active Diffusion',
    role: 'Forms the primary metallurgical P+/N junction with the surrounding N-Well.',
    fn: 'Heavily doped with Boron (NA ≈ 10¹⁵–10¹⁹ cm⁻³). In forward bias (VA > 0), injects majority holes across the lowered depletion barrier into the N-Well.',
    doping: 'Boron (NA): 10¹⁵ – 10¹⁹ cm⁻³ (Adjustable via NA slider)',
    colorVar: '--c-active-p',
    colorHex: '#2563EB',
    thickness: '1.6 μm junction depth (xj)',
    area: '6.4 μm × 9.0 μm'
  },
  nRegion: {
    id: 'nRegion',
    name: 'N+ Cathode Ohmic Contact Tap',
    title: 'N+ Cathode Tap (Heavy Ohmic Contact Diffusion)',
    layer: 'Active Diffusion',
    role: 'Provides a degenerate low-resistance ohmic contact interface from the cathode metal via into the N-Well.',
    fn: 'Heavily doped with Arsenic (N+ ≈ 1×10²⁰ cm⁻³) to suppress Schottky barrier formation, ensuring ideal ohmic contact to the Cathode Tungsten plug.',
    doping: 'Arsenic/Phosphorus (N+): ~1×10²⁰ cm⁻³ (Degenerate N+)',
    colorVar: '--c-active-n',
    colorHex: '#15803D',
    thickness: '1.3 μm junction depth',
    area: '5.6 μm × 9.0 μm'
  },
  depletionRegion: {
    id: 'depletionRegion',
    name: 'DEPLETION REGION',
    title: 'Space-Charge Depletion Region (PN Junction)',
    layer: 'Space Charge',
    role: 'Electrostatic insulating barrier layer swept free of mobile majority carriers.',
    fn: 'Continuous charcoal space-charge envelope straddling the metallurgical P+/N junction (penetrating xp into P+ Anode and xn into N-Well). Expands under reverse bias and narrows smoothly under forward bias.',
    doping: 'Swept free of mobile carriers; contains uncompensated fixed ionized cores NA⁻ and ND⁺',
    colorVar: '--c-depletion',
    colorHex: '#94A3B8',
    thickness: 'W = xp + xn (Dynamic: 0.05 μm to > 3.0 μm)',
    area: 'Conformal straddling junction perimeter & bottom'
  },
  fixedIonsP: {
    id: 'fixedIonsP',
    name: 'Ionized Acceptor Cores (P-Side Ions)',
    title: 'Fixed Negative Space-Charge (NA⁻)',
    layer: 'Space Charge',
    role: 'Uncompensated Boron atom cores with net negative charge in the P-depletion slice.',
    fn: 'Terminate electric field lines originating from donor ions, establishing the negative space-charge sheet ρ(x) = -q·NA across -xp ≤ x ≤ 0.',
    doping: 'Uncompensated ionized acceptors NA⁻ (Net charge: -q·NA·xp)',
    colorVar: '--c-danger',
    colorHex: '#e11d48',
    thickness: 'xp = W · ND / (NA + ND)',
    area: 'Sub-surface depletion perimeter'
  },
  fixedIonsN: {
    id: 'fixedIonsN',
    name: 'Ionized Donor Cores (N-Side Ions)',
    title: 'Fixed Positive Space-Charge (ND⁺)',
    layer: 'Space Charge',
    role: 'Uncompensated Phosphorus atom cores with net positive charge in the N-depletion slice.',
    fn: 'Originate electric field lines that terminate on acceptor ions, establishing the positive space-charge sheet ρ(x) = +q·ND across 0 ≤ x ≤ xn.',
    doping: 'Uncompensated ionized donors ND⁺ (Net charge: +q·ND·xn)',
    colorVar: '--c-accent',
    colorHex: '#5fd9c4',
    thickness: 'xn = W · NA / (NA + ND)',
    area: 'N-Well surrounding depletion shell'
  },
  breakdownGlow: {
    id: 'breakdownGlow',
    name: 'High-Field Breakdown Zone (Glow)',
    title: 'Electric Field Breakdown Ionization Glow',
    layer: 'High-Field Plasma',
    role: 'Visualizes intense localized electric field exceeding critical field Ecrit during reverse breakdown.',
    fn: 'Concentrated along high-curvature junction sidewalls and corners when VA ≤ -VBR. Visualizes band-to-band tunneling (Zener) or avalanche impact ionization multiplication.',
    doping: 'Critical electric field threshold: Ecrit ≈ 4×10⁵ to 10⁶ V/cm',
    colorVar: '--c-zener',
    colorHex: '#f43f5e',
    thickness: 'Spans metallurgical junction boundary',
    area: 'High-curvature junction perimeter'
  },
  sti: {
    id: 'sti',
    name: 'Shallow Trench Isolation (STI SiO₂)',
    title: 'STI Oxide (Dielectric Field Isolation)',
    layer: 'Dielectric',
    role: 'Provides lateral dielectric isolation between active diffusion regions.',
    fn: 'High-density plasma SiO₂ filled trenches (0.8 μm depth) separating the P+ Anode tub from the N+ Cathode tap to prevent surface punch-through and leakage.',
    doping: 'CVD / Thermal SiO₂ (k ≈ 3.9)',
    colorVar: '--c-oxide',
    colorHex: '#e2e8f0',
    thickness: '0.80 μm trench depth',
    area: 'Isolation moat between active regions'
  },
  passivation: {
    id: 'passivation',
    name: 'Surface Passivation / ILD (SiO₂)',
    title: 'Interlayer Dielectric & Passivation (SiO₂)',
    layer: 'Dielectric',
    role: 'Passivates the silicon surface and isolates silicon from interconnect metallization.',
    fn: 'Thick dielectric oxide (1.6 μm) covering the silicon wafer surface with etched vertical contact windows over the P+ Anode tub and N+ Cathode tap.',
    doping: 'Stoichiometric TEOS / CVD SiO₂ (k ≈ 3.9)',
    colorVar: '--c-oxide',
    colorHex: '#e2e8f0',
    thickness: '1.60 μm ILD oxide height',
    area: 'Wafer surface with etched via cuts'
  },
  tungstenVias: {
    id: 'tungstenVias',
    name: 'Tungsten Contact Vias (W Plugs)',
    title: 'Vertical Tungsten Contact Plugs (W)',
    layer: 'Contact Vias',
    role: 'Provides low-resistance vertical electrical paths through the ILD down to active silicon.',
    fn: 'CVD Tungsten plugs with Ti/TiN barrier/adhesion liners punching through the ILD oxide to contact the P+ Anode tub and N+ Cathode tap.',
    doping: 'Pure CVD Tungsten (W) with Ti/TiN silicide liner',
    colorVar: '--c-contact',
    colorHex: '#94a3b8',
    thickness: '1.80 μm vertical via height',
    area: 'Standard 0.44 μm diameter plugs'
  },
  anodeMetal: {
    id: 'anodeMetal',
    name: 'Anode Terminal Pad (Metal-1)',
    title: 'Anode Metal-1 Interconnect (VA)',
    layer: 'Metallization',
    role: 'First metallization layer routing external applied voltage VA to the P+ Anode tub.',
    fn: 'Copper / Aluminum alloy ribbon pad resting atop the Anode Tungsten vias, connected to the external circuit anode lead.',
    doping: 'Al-Cu / Damascene Copper (0.04 Ω/□ sheet resistance)',
    colorVar: '--c-metal',
    colorHex: '#4f86c9',
    thickness: '0.40 μm Metal-1 ribbon',
    area: '6.0 μm × 7.0 μm'
  },
  cathodeMetal: {
    id: 'cathodeMetal',
    name: 'Cathode Terminal Pad (Metal-1)',
    title: 'Cathode Metal-1 Interconnect (GND / 0V)',
    layer: 'Metallization',
    role: 'First metallization layer routing the cathode reference voltage (GND) to the N+ Cathode tap.',
    fn: 'Copper / Aluminum alloy ribbon pad resting atop the Cathode Tungsten vias, completing the circuit current return path.',
    doping: 'Al-Cu / Damascene Copper (0.04 Ω/□ sheet resistance)',
    colorVar: '--c-metal',
    colorHex: '#4f86c9',
    thickness: '0.40 μm Metal-1 ribbon',
    area: '6.0 μm × 7.0 μm'
  }
};

function idToInfo(id) {
  return COMPONENTS[id] || null;
}

var LAYERS_LIST = [
  { id: 'substrate',   name: 'P-Substrate (Bulk Wafer)',      color: '#2B3442', visible: true },
  { id: 'nwell',       name: 'N-Well (Cathode Body Tub)',     color: '#2D5A4C', visible: true },
  { id: 'active',      name: 'Active Diffusions (P+ / N+)',   color: '#EA580C', visible: true },
  { id: 'depletion',   name: 'DEPLETION REGION',              color: '#94A3B8', visible: true },
  { id: 'ions',        name: 'Fixed Space-Charge Ions (±)',   color: '#14B8A6', visible: true },
  { id: 'field',       name: 'High-Field Breakdown Glow',     color: '#F43F5E', visible: true },
  { id: 'passivation', name: 'Dielectric Stack (STI & ILD)',  color: '#475569', visible: true },
  { id: 'contact',     name: 'Contacts (Tungsten W Vias)',    color: '#CBD5E1', visible: true },
  { id: 'metal',       name: 'Metal-1 Interconnects (A & K)', color: '#94A3B8', visible: true }
];

var ARCHITECTURE_TREE = [
  {
    name: 'Planar Silicon PN Diode Assembly',
    id: 'root',
    children: [
      {
        name: 'Silicon Body & Well Structure',
        children: [
          { name: 'P-Type Silicon Substrate (Bulk)', id: 'substrate' },
          { name: 'N-Well Cathode Body Tub', id: 'nwell' }
        ]
      },
      {
        name: 'Active Implanted Regions',
        children: [
          { name: 'P+ Anode Diffusion Tub', id: 'pRegion' },
          { name: 'N+ Cathode Ohmic Contact Tap', id: 'nRegion' }
        ]
      },
      {
        name: 'Junction Space-Charge & Field',
        children: [
          { name: 'Depletion Region (W = xp + xn)', id: 'depletionRegion' },
          { name: 'Ionized Acceptor Cores (NA⁻)', id: 'fixedIonsP' },
          { name: 'Ionized Donor Cores (ND⁺)', id: 'fixedIonsN' },
          { name: 'High-Field Breakdown Zone (Ecrit)', id: 'breakdownGlow' }
        ]
      },
      {
        name: 'Dielectric Isolation & Surface Passivation',
        children: [
          { name: 'Shallow Trench Isolation (STI SiO₂)', id: 'sti' },
          { name: 'Interlayer Dielectric Passivation (ILD)', id: 'passivation' }
        ]
      },
      {
        name: 'Contacts & Metallization',
        children: [
          { name: 'Tungsten Contact Vias (W Plugs)', id: 'tungstenVias' },
          { name: 'Anode Terminal Pad (Metal-1 · VA)', id: 'anodeMetal' },
          { name: 'Cathode Terminal Pad (Metal-1 · GND)', id: 'cathodeMetal' }
        ]
      }
    ]
  }
];

var LAMBDA_RULES = [
  { rule: 'Substrate Length (L_sub)', lambda: '26 λ', desc: 'Total silicon substrate physical block length' },
  { rule: 'Substrate Width (W_sub)', lambda: '15 λ', desc: 'Cross-sectional lateral substrate width' },
  { rule: 'N-Well Enclosure', lambda: '3 λ', desc: 'N-Well enclosure clearance around active P+ tub' },
  { rule: 'P+ Anode Tub Width', lambda: '6.4 λ', desc: 'Active P+ anode diffusion window' },
  { rule: 'N+ Cathode Tap Width', lambda: '5.6 λ', desc: 'Active N+ cathode ohmic tap window' },
  { rule: 'Active Spacing (STI)', lambda: '3.6 λ', desc: 'STI isolation spacing between P+ tub and N+ tap' },
  { rule: 'Via Dimension (W_ct)', lambda: '1.5 λ', desc: 'Tungsten contact via plug square size' },
  { rule: 'Metal-1 Overlap of Via', lambda: '1.0 λ', desc: 'Metal-1 enclosure margin over contact vias' }
];
