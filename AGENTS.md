# SiliconSliders — Agent Navigation Guide

> **Navigation Rule:** Before grepping or scanning directories, read the `MAP.md` inside the target module folder. If you add, rename, or move files or key functions, update the relevant `MAP.md`. Always run `npm run verify` after code changes and fix all failures before completing a task.

## Repository Structure (`src/`)

```text
SiliconSliders/
├── index.html                  # Landing hub
├── dev-server.js               # Static server + /api/voice-assistant proxy
├── package.json                # npm run verify -> node scripts/verify-devices.ts
├── scripts/verify-devices.ts   # Automated 7-device audit (tree, highlight, tour, physics)
├── api/                        # Serverless handlers (explain.js, voice-assistant.js)
└── src/
    ├── shared/                 # MAP.md — tokens, materialPalette.js, home, shared viewer
    │   ├── three/              # layerHighlight.ts (+ .js): userData.layerId highlight engine
    │   └── viewer/             # SiliconViewer, SiliconSelectionHighlight, SiliconAutoRotate
    └── modules/
        ├── diodes/pn-diode/    # MAP.md — 3D PN Junction Diode + 2D junction & I-V/E(x)
        ├── processes/oxidation/# MAP.md — Deal-Grove Thermal Oxidation (React 18 + Canvas)
        ├── mems/cantilever-beam/ # Spec README only (no JS implementation yet)
        ├── transducers/lvdt/   # MAP.md — 3D Cutaway LVDT Simulator (Three.js + 2D Plots)
        └── transistors/
            ├── mosfet/
            │   ├── nmos/       # MAP.md — Enhancement-mode NMOS (VTH = +0.40V)
            │   ├── pmos/       # MAP.md — Enhancement-mode PMOS (|VTH,p| = 0.40V)
            │   ├── d-nmos/     # MAP.md — Depletion-mode NMOS (VTH = -0.80V, normally ON)
            │   └── d-pmos/     # MAP.md — Depletion-mode PMOS (VTH,p = +0.80V, normally ON)
            └── cmos/
                ├── cmos-inverter/ # MAP.md — Standard CMOS Inverter + VTC curve
                └── cmos-nand/     # MAP.md — 2-Input CMOS NAND2 + dual-input VTC
```

## Global Conventions

- **Verification Gate:** Always run `npm run verify` (`scripts/verify-devices.ts`) after code changes and fix all failures before completing a task.
- **License & Stack:** Apache-2.0 (`LICENSE`). Zero-bundler browser globals (`THREE` r128, `OrbitControls`, `window.*`), except `oxidation/` (React 18 + Babel standalone + Tailwind CDN) and `materialPalette.js` / `layerHighlight.ts` (ESM + `globalThis` registration).
- **Three.js Materials & `depthWrite`:** Doping color convention is strict: **Blue = P-Type**, **Green = N-Type**, with intensity scaling Substrate < Well < SDE < Implant (`src/shared/materialPalette.js`). Translucent volumes (depletion shells, channels, oxides, highlight overlays, sprites) MUST set `transparent: true, depthWrite: false` and explicit `renderOrder`. Coplanar stacked slabs require progressive Y micro-offsets (`+0.002` to `+0.009`) and `polygonOffset` to prevent Z-fighting.
- **Spacer-to-LDD Alignment:** Gate sidewall spacers (`Si3N4`) sit flush over the SDE/LDD extensions (typical inner gap `0.004` from gate edge, outer edge aligned with LDD outer boundary) so deep S/D implants align cleanly without clipping.
- **Click-Highlight & Selection:** `src/shared/three/layerHighlight.ts` (`layerHighlight.js` in browser scripts) auto-discovers clickable meshes by traversing for `userData.layerId`, isolates shared materials by cloning on select and restoring exact original references on deselect, and applies opaque emissive/albedo boost or low-opacity contrast/opacity boost + `_hlEdge` outlines. Canvas raycasting enforces a `6px` drag threshold (`pointerDownPos`) and syncs 3D meshes, Architecture Tree, Property Inspector, and popover.
- **3-State Auto-Rotate Control:** `SiliconAutoRotate` (`viewer-core.js`) mounts `#btn-auto-rotate` inside `#viewport-wrap` cycling `off` -> `cw` -> `ccw` -> `off` (`controls.autoRotateSpeed` `-2.0` / `+2.0`), auto-hidden via `MutationObserver` when `#theory-overlay`, `#schematic-overlay`, or `#junction-2d-overlay` is visible.
- **Expandable Graph Modal:** Every 3D device module pairs its inline workbench graph canvas with `#iv-modal-backdrop` / `#iv-modal-canvas` (`openIvModal`/`closeIvModal` or `openModal`/`closeModal`), `ResizeObserver` DPI rescaling, interactive pointer scrubbing, and `Escape`/backdrop dismissal.
- **Offline Process Tour:** `build-anim.js` drives `FAB_STEPS` drop-down fabrication playback (`dropOffsets` Y-animation, smooth camera lerp, `#tour-banner` step badge/progress) completely offline, forces Cutoff/Equilibrium and suppresses carrier particles during playback, and restores prior bias on exit/reset.
- **Theme Sync:** When no user preference is stored, `ViewerTheme` / `theme.js` picks `'light'` for `06:00–17:59` and `'dark'` for `18:00–05:59`, mirroring manual overrides across storage keys and invoking `applySceneTheme` + `updateMaterialsTheme`.
- **3-Stage Process Guided Tour:** All Process Engineering Lab modules integrate `shared/css/guided-tour.css` + `shared/js/guided-tour.js` with a top-right `#btn-guided-tour` (`? Tour`) button, `siliconsliders_process_tour_seen` storage key, and the 4-step `Theory → Sliders (with .ss-tour-corr-list Parameter Correspondence & Peek Mode) → Playback/Wafer Cross-Section → Industry` sequence (`src/modules/processes/README.md`).
