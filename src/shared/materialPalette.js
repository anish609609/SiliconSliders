/**
 * materialPalette.js - Unified 3D Material Palette for Silicon Sliders
 * Single source of truth for Dark & Light Mode 3D material colors and dielectrics.
 */

export const MATERIAL_PALETTE = {
  dark: {
    // Silicon Regions
    pSubstrate: '#2B3442',
    nWell: '#2D5A4C',
    nSubstrate: '#2D5A4C',
    pWell: '#2E4366',
    nPlusDiffusion: '#2563EB',
    pPlusDiffusion: '#EA580C',
    implantedNChannel: '#38BDF8',
    implantedPChannel: '#FB923C',

    // Dielectrics, Gate & Interconnects
    gateOxide: '#67E8F9',
    gateOxideOpacity: 0.35,
    fieldOxide: '#475569',
    fieldOxideOpacity: 0.45,
    polysilicon: '#DC2626',
    metal: '#94A3B8',
    via: '#CBD5E1',

    // Dynamic Physics (Channels, Depletion & Carriers)
    electronFlow: '#F59E0B',
    electronChannel: '#F59E0B',
    holeFlow: '#F43F5E',
    holeChannel: '#F43F5E',
    depletion: '#64748B',
    depletionOpacity: 0.26
  },
  light: {
    // Silicon Regions
    pSubstrate: '#64748B',
    nWell: '#52B788',
    nSubstrate: '#52B788',
    pWell: '#93C5FD',
    nPlusDiffusion: '#1D4ED8',
    pPlusDiffusion: '#C2410C',
    implantedNChannel: '#0284C7',
    implantedPChannel: '#D97706',

    // Dielectrics, Gate & Interconnects
    gateOxide: '#0891B2',
    gateOxideOpacity: 0.28,
    fieldOxide: '#64748B',
    fieldOxideOpacity: 0.35,
    polysilicon: '#B91C1C',
    metal: '#475569',
    via: '#334155',

    // Dynamic Physics (Channels, Depletion & Carriers)
    electronFlow: '#D97706',
    electronChannel: '#D97706',
    holeFlow: '#BE123C',
    holeChannel: '#BE123C',
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
