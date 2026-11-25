/**
 * materialPalette.js - Unified 3D Material Palette for Silicon Sliders
 * Single source of truth for Dark & Light Mode 3D material colors and dielectrics.
 * Follows strict doping rule: Blue = P-Type, Green = N-Type.
 * Doping hierarchy (Lighter -> Darker = Lower -> Higher Doping): Substrate < Well < SDE < Implant.
 */

export const MATERIAL_PALETTE = {
  dark: {
    // P-Type Silicon (Blue Family)
    pSubstrate: '#1E3A5F',
    pWell: '#1D4ED8',
    pSDE: '#60A5FA',
    pPlusDiffusion: '#3B82F6',
    implantedPChannel: '#60A5FA',

    // N-Type Silicon (Green Family)
    nSubstrate: '#14532D',
    nWell: '#166534',
    nSDE: '#4ADE80',
    nPlusDiffusion: '#22C55E',
    implantedNChannel: '#4ADE80',

    // Dielectrics, Gate & Interconnects
    gateOxide: '#67E8F9',
    gateOxideOpacity: 0.35,
    fieldOxide: '#475569',
    fieldOxideOpacity: 0.45,
    polysilicon: '#DC2626',
    metal: '#94A3B8',
    via: '#CBD5E1',

    // Dynamic Physics (Carriers & Depletion)
    electronFlow: '#F59E0B',
    electronChannel: '#34D399',
    holeFlow: '#F43F5E',
    holeChannel: '#38BDF8',
    depletion: '#64748B',
    depletionOpacity: 0.26
  },
  light: {
    // P-Type Silicon (Blue Family)
    pSubstrate: '#7BA7E1',
    pWell: '#4A86E8',
    pSDE: '#3B82F6',
    pPlusDiffusion: '#2563EB',
    implantedPChannel: '#2563EB',

    // N-Type Silicon (Green Family)
    nSubstrate: '#86EFAC',
    nWell: '#4ADE80',
    nSDE: '#22C55E',
    nPlusDiffusion: '#16A34A',
    implantedNChannel: '#16A34A',

    // Dielectrics, Gate & Interconnects
    gateOxide: '#0891B2',
    gateOxideOpacity: 0.28,
    fieldOxide: '#64748B',
    fieldOxideOpacity: 0.35,
    polysilicon: '#B91C1C',
    metal: '#475569',
    via: '#334155',

    // Dynamic Physics (Carriers & Depletion)
    electronFlow: '#D97706',
    electronChannel: '#4ADE80',
    holeFlow: '#BE123C',
    holeChannel: '#60A5FA',
    depletion: '#475569',
    depletionOpacity: 0.26
  }
};

export const MATERIAL_PROPERTIES = {
  dark: {
    substrate:    { color: '#1E3A5F', roughness: 0.85, metalness: 0.05, opacity: 1.0, emissive: 0x000000, emissiveIntensity: 0 },
    nWell:        { color: '#166534', roughness: 0.60, metalness: 0.15, opacity: 0.85, outlineColor: '#5fd9c4', emissive: 0x000000, emissiveIntensity: 0 },
    pWell:        { color: '#1D4ED8', roughness: 0.60, metalness: 0.15, opacity: 0.80, outlineColor: '#5a7799', emissive: 0x000000, emissiveIntensity: 0 },
    nPlusImplant: { color: '#22C55E', roughness: 0.50, metalness: 0.15, opacity: 0.88, outlineColor: '#4ade80', emissive: 0x000000, emissiveIntensity: 0 },
    pPlusImplant: { color: '#3B82F6', roughness: 0.50, metalness: 0.15, opacity: 0.88, outlineColor: '#60a5fa', emissive: 0x000000, emissiveIntensity: 0 },
    nSDE:         { color: '#4ADE80', roughness: 0.50, metalness: 0.15, opacity: 0.72, outlineColor: '#86efac', emissive: 0x000000, emissiveIntensity: 0 },
    pSDE:         { color: '#60A5FA', roughness: 0.50, metalness: 0.15, opacity: 0.72, outlineColor: '#93c5fd', emissive: 0x000000, emissiveIntensity: 0 },
    depletion:    { colorHex: 0x94a3b8, emissiveHex: 0x475569, emissiveIntensity: 0.14, opacity: 0.38, roughness: 0.55, metalness: 0.08, edgeOpacity: 0.55 }
  },
  light: {
    substrate:    { color: '#7BA7E1', roughness: 0.85, metalness: 0.05, opacity: 1.0, emissive: 0x000000, emissiveIntensity: 0 },
    nWell:        { color: '#4ADE80', roughness: 0.75, metalness: 0.15, opacity: 0.85, outlineColor: '#5fd9c4', emissive: 0x000000, emissiveIntensity: 0 },
    pWell:        { color: '#4A86E8', roughness: 0.75, metalness: 0.15, opacity: 0.80, outlineColor: '#5a7799', emissive: 0x000000, emissiveIntensity: 0 },
    nPlusImplant: { color: '#16A34A', roughness: 0.50, metalness: 0.15, opacity: 0.88, outlineColor: '#22c55e', emissive: 0x000000, emissiveIntensity: 0 },
    pPlusImplant: { color: '#2563EB', roughness: 0.50, metalness: 0.15, opacity: 0.88, outlineColor: '#3b82f6', emissive: 0x000000, emissiveIntensity: 0 },
    nSDE:         { color: '#22C55E', roughness: 0.50, metalness: 0.15, opacity: 0.72, outlineColor: '#4ade80', emissive: 0x000000, emissiveIntensity: 0 },
    pSDE:         { color: '#3B82F6', roughness: 0.50, metalness: 0.15, opacity: 0.72, outlineColor: '#60a5fa', emissive: 0x000000, emissiveIntensity: 0 },
    depletion:    { colorHex: 0x64748b, emissiveHex: 0x334155, emissiveIntensity: 0.14, opacity: 0.38, roughness: 0.55, metalness: 0.08, edgeOpacity: 0.55 }
  }
};

/**
 * Returns the active theme palette object.
 * @param {string} theme - 'dark' or 'light' (defaults to 'dark')
 * @returns {object} Palette color map for active theme
 */
export function getMaterialPalette(theme) {
  var t = (theme === 'light') ? 'light' : 'dark';
  return MATERIAL_PALETTE[t];
}

export function getMaterialProperties(theme) {
  var t = (theme === 'light') ? 'light' : 'dark';
  return MATERIAL_PROPERTIES[t];
}

// Global browser registration for non-module scripts
if (typeof globalThis !== 'undefined') {
  globalThis.MATERIAL_PALETTE = MATERIAL_PALETTE;
  globalThis.getMaterialPalette = getMaterialPalette;
  globalThis.MATERIAL_PROPERTIES = MATERIAL_PROPERTIES;
  globalThis.getMaterialProperties = getMaterialProperties;
} else if (typeof window !== 'undefined') {
  window.MATERIAL_PALETTE = MATERIAL_PALETTE;
  window.getMaterialPalette = getMaterialPalette;
  window.MATERIAL_PROPERTIES = MATERIAL_PROPERTIES;
  window.getMaterialProperties = getMaterialProperties;
}

export default getMaterialPalette;
