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

/**
 * Returns the active theme palette object.
 * @param {string} theme - 'dark' or 'light' (defaults to 'dark')
 * @returns {object} Palette color map for active theme
 */
export function getMaterialPalette(theme) {
  var t = (theme === 'light') ? 'light' : 'dark';
  return MATERIAL_PALETTE[t];
}

// Global browser registration for non-module scripts
if (typeof globalThis !== 'undefined') {
  globalThis.MATERIAL_PALETTE = MATERIAL_PALETTE;
  globalThis.getMaterialPalette = getMaterialPalette;
} else if (typeof window !== 'undefined') {
  window.MATERIAL_PALETTE = MATERIAL_PALETTE;
  window.getMaterialPalette = getMaterialPalette;
}

export default getMaterialPalette;
