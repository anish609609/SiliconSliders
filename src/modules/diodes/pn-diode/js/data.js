/**
 * data.js - PN Junction Diode CAD Viewer
 * Component metadata, architectural layer hierarchy, and lambda design rules.
 */

var COMPONENTS = {
  pRegion: {
    id: 'pRegion',
    name: 'P-Type Silicon Body (Anode Side)',
    title: 'P-Type Silicon Bulk (Boron Acceptors)',
    layer: 'Semiconductor Base',
    role: 'Provides mobile hole majority carriers and forms the metallurgical P-N junction.',
    fn: 'Under forward bias, holes diffuse across the narrowed depletion barrier into the N-region. Under reverse bias, the minority electron leakage drift is collected here.',
    doping: 'Boron (NA): 10¹⁵ – 10¹⁹ cm⁻³ (Acceptors)',
    colorVar: '--c-active-p',
    colorHex: '#cf8a4a',
    thickness: '2.50 μm',
    area: '100 μm × 100 μm'
  },
  nRegion: {
    id: 'nRegion',
    name: 'N-Type Silicon Body (Cathode Side)',
    title: 'N-Type Silicon Bulk (Phosphorus Donors)',
    layer: 'Semiconductor Base',
    role: 'Provides mobile electron majority carriers and completes the bilateral diode block.',
    fn: 'Supplies electrons that diffuse into the P-region under forward bias. Serves as the negative cathode terminal.',
    doping: 'Phosphorus / Arsenic (ND): 10¹⁵ – 10¹⁹ cm⁻³ (Donors)',
    colorVar: '--c-active-n',
    colorHex: '#4a92c9',
    thickness: '2.50 μm',
    area: '100 μm × 100 μm'
  },
  depletionRegion: {
    id: 'depletionRegion',
    name: 'Space-Charge Depletion Region',
    title: 'Depletion Layer (Transition Zone)',
    layer: 'Active Junction',
    role: 'Insulating electrostatic barrier zone swept free of mobile carriers.',
    fn: 'Maintains built-in potential Vbi and peak electric field Emax. Expands under reverse bias and contracts under forward bias, setting total junction capacitance.',
    doping: 'Depleted of mobile carriers; populated by fixed uncompensated ionized dopant cores',
    colorVar: '--c-depletion',
    colorHex: '#a855f7',
    thickness: 'W = xp + xn (Dynamic: 0.05 μm to > 3.0 μm)',
    area: '100 μm × 100 μm'
  },
  fixedIonsP: {
    id: 'fixedIonsP',
    name: 'Ionized Acceptor Cores (P-Side Ions)',
    title: 'Fixed Negative Space-Charge (NA⁻)',
    layer: 'Space-Charge Layer',
    role: 'Uncompensated Boron atom cores with net negative charge in the P-depletion slice.',
    fn: 'Terminate electric field lines originating from donor ions, establishing the negative space-charge sheet ρ(x) = -q·NA across -xp ≤ x ≤ 0.',
    doping: 'Uncompensated ionized acceptors NA⁻ (Net charge: -q·NA·xp)',
    colorVar: '--c-danger',
    colorHex: '#e35d5d',
    thickness: 'xp = W · ND / (NA + ND)',
    area: 'Fixed uncompensated ion lattice'
  },
  fixedIonsN: {
    id: 'fixedIonsN',
    name: 'Ionized Donor Cores (N-Side Ions)',
    title: 'Fixed Positive Space-Charge (ND⁺)',
    layer: 'Space-Charge Layer',
    role: 'Uncompensated Phosphorus atom cores with net positive charge in the N-depletion slice.',
    fn: 'Originate electric field lines that terminate on acceptor ions, establishing the positive space-charge sheet ρ(x) = +q·ND across 0 ≤ x ≤ xn.',
    doping: 'Uncompensated ionized donors ND⁺ (Net charge: +q·ND·xn)',
    colorVar: '--c-accent',
    colorHex: '#5fd9c4',
    thickness: 'xn = W · NA / (NA + ND)',
    area: 'Fixed uncompensated ion lattice'
  },
  anodeMetal: {
    id: 'anodeMetal',
    name: 'Anode Terminal Contact Pad',
    title: 'Anode Ohmic Metallization (Metal-1)',
    layer: 'Metallization',
    role: 'Ohmic low-resistance terminal connecting external positive voltage to the P-region.',
    fn: 'Collects conventional forward current (holes entering from external circuit) and applies potential VA to the P-side.',
    doping: 'Tungsten plug / Aluminum-Copper alloy (Ohmic silicide contact)',
    colorVar: '--c-metal',
    colorHex: '#4f86c9',
    thickness: '0.40 μm Metal-1 Ribbon',
    area: '25 μm × 90 μm'
  },
  cathodeMetal: {
    id: 'cathodeMetal',
    name: 'Cathode Terminal Contact Pad',
    title: 'Cathode Ohmic Metallization (Metal-1)',
    layer: 'Metallization',
    role: 'Ohmic low-resistance terminal connecting external negative voltage to the N-region.',
    fn: 'Collects forward electron flow and establishes the negative/ground reference potential on the N-side.',
    doping: 'Tungsten plug / Aluminum-Copper alloy (Ohmic silicide contact)',
    colorVar: '--c-metal',
    colorHex: '#4f86c9',
    thickness: '0.40 μm Metal-1 Ribbon',
    area: '25 μm × 90 μm'
  },
  passivation: {
    id: 'passivation',
    name: 'Surface Passivation Oxide (SiO₂)',
    title: 'Silicon Dioxide Passivation & Isolation',
    layer: 'Dielectric Insulation',
    role: 'Passivates silicon surface dangling bonds to suppress surface leakage and recombination.',
    fn: 'Protects the metallurgical junction from ambient contamination and shorts between anode and cathode metallization.',
    doping: 'Stoichiometric thermal/CVD SiO₂ (Dielectric constant εox ≈ 3.9)',
    colorVar: '--c-oxide',
    colorHex: '#38bdf8',
    thickness: '0.35 μm',
    area: 'Full wafer surface with etched contact cuts'
  },
  breakdownGlow: {
    id: 'breakdownGlow',
    name: 'High-Field Breakdown Zone (Glow)',
    title: 'Electric Field Breakdown Ionization Glow',
    layer: 'High-Field Physical Plasma',
    role: 'Visualizes intense localized electric field exceeding critical field Ecrit during reverse breakdown.',
    fn: 'Emits a volumetric high-energy glow when VA ≤ -VBR, denoting band-to-band tunneling (Zener) or cascading impact ionization (Avalanche).',
    doping: 'Localized critical field threshold: Ecrit ≈ 4×10⁵ to 10⁶ V/cm',
    colorVar: '--c-zener',
    colorHex: '#f43f5e',
    thickness: 'Spans metallurgical junction',
    area: 'Volumetric depletion cross-section'
  }
};

function idToInfo(id) {
  return COMPONENTS[id] || null;
}

var LAYERS_LIST = [
  { id: 'semiconductor', name: 'Semiconductor Bulk (P & N)', color: '#cf8a4a', visible: true },
  { id: 'depletion', name: 'Depletion Layer (Space Charge)', color: '#a855f7', visible: true },
  { id: 'ions', name: 'Fixed Space-Charge Ions (±)', color: '#5fd9c4', visible: true },
  { id: 'contacts', name: 'Metal Contacts (Anode & Cathode)', color: '#4f86c9', visible: true },
  { id: 'passivation', name: 'Passivation Dielectric (SiO₂)', color: '#38bdf8', visible: true },
  { id: 'field', name: 'High-Field Breakdown Glow', color: '#f43f5e', visible: true }
];

var ARCHITECTURE_TREE = [
  {
    name: 'PN Junction Diode Assembly',
    id: 'root',
    children: [
      {
        name: 'Semiconductor Bodies',
        children: [
          { name: 'P-Type Silicon (Anode side)', id: 'pRegion' },
          { name: 'N-Type Silicon (Cathode side)', id: 'nRegion' }
        ]
      },
      {
        name: 'Metallurgical Junction & Space Charge',
        children: [
          { name: 'Depletion Zone (W = xp + xn)', id: 'depletionRegion' },
          { name: 'Ionized Acceptor Cores (NA⁻)', id: 'fixedIonsP' },
          { name: 'Ionized Donor Cores (ND⁺)', id: 'fixedIonsN' },
          { name: 'Critical Field Breakdown Zone', id: 'breakdownGlow' }
        ]
      },
      {
        name: 'Ohmic Metallization & Dielectric',
        children: [
          { name: 'Anode Contact Pad (Metal-1)', id: 'anodeMetal' },
          { name: 'Cathode Contact Pad (Metal-1)', id: 'cathodeMetal' },
          { name: 'Surface Passivation Oxide (SiO₂)', id: 'passivation' }
        ]
      }
    ]
  }
];

var LAMBDA_RULES = [
  { rule: 'Semi Length (L_total)', lambda: '24 λ', desc: 'Total semiconductor physical block length' },
  { rule: 'Semi Width (W_block)', lambda: '12 λ', desc: 'Cross-sectional lateral block width' },
  { rule: 'Semi Height (H_block)', lambda: '5 λ', desc: 'Substrate vertical thickness' },
  { rule: 'Contact Width', lambda: '4 λ', desc: 'Anode and Cathode contact pad width' },
  { rule: 'Contact Inset', lambda: '1.5 λ', desc: 'Minimum clearance to wafer edge' },
  { rule: 'Oxide Overlap', lambda: '2 λ', desc: 'Dielectric passivation overlap around contacts' }
];
