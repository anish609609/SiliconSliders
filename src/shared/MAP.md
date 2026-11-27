# Shared Modules & Viewer Navigation Map (`src/shared/`)

**Purpose:** Provides unified design tokens, theme sync, 3D material palette, landing hub logic, and the shared CAD viewer shell, highlight, and auto-rotate utilities.

## Files

- `materialPalette.js` -> Single source of truth for dark/light doping, dielectric, metal, carrier colors, and canonical material finishes (`MATERIAL_PALETTE`, `MATERIAL_PROPERTIES`).
- `css/design-tokens.css` -> Global EDA CSS variables, typography (`IBM Plex Mono`, `Inter`), and glassmorphic surface tokens.
- `css/guided-tour.css` -> 4-panel dim backdrop, non-blocking spotlight cutout, tab-pulse animation, glassmorphic popover, and topbar `? Tour` button styles.
- `css/home.css` -> Landing page layout, module card grid, and responsive telemetry strip styles.
- `js/guided-tour.js` -> `SiliconGuidedTour` zero-build 6-step interactive spotlight onboarding engine with multi-target union spotlighting, auto-tab switching, and `localStorage` persistence (`siliconsliders_cad_tour_seen`).
- `js/home.js` -> Homepage theme persistence (`siliconsliders-theme` + time-of-day fallback) and cross-tab `pageshow`/`storage` sync.
- `three/layerHighlight.ts` -> Unified TS layer discovery (`userData.layerId`), raycasting, opaque/low-opacity highlighting, and exact material restoration (`SiliconLayerHighlight`).
- `three/layerHighlight.js` -> Zero-bundler browser global companion (`window.SiliconLayerHighlight`) mirroring `layerHighlight.ts`.
- `viewer/css/viewer-shell.css` -> Shared CAD topbar, drawer, workbench, popover, modal, and mobile `< 768px` tour/scale-note HUD rules.
- `viewer/css/theory.css` -> Shared theory overlay typography, equation blocks, and card formatting.
- `viewer/js/viewer-core.js` -> `SiliconViewer` orchestrator, `SiliconSelectionHighlight` (delegating to `SiliconLayerHighlight`), and `SiliconAutoRotate` 3-state control.
- `viewer/js/viewer-panels.js` -> Shared `ViewerPanels` builders for λ design-rule tables, layer checkboxes, legend badges, and accordions.
- `viewer/js/viewer-theme.js` -> `ViewerTheme` engine with time-of-day auto-init (`06:00–17:59` light, else dark) syncing `data-theme` and callbacks.
- `viewer/js/viewer-topbar.js` -> `ViewerTopbar` handler wiring input groups, view mode, carrier flow, tour, and camera reset buttons.
- `viewer/README.md` -> Configuration schema guide for `SiliconViewer.init(config)`.

## Key Symbols

- **Palette (`materialPalette.js`):** `MATERIAL_PALETTE`, `MATERIAL_PROPERTIES`, `getMaterialPalette`, `getMaterialProperties` (registered on ESM export and `globalThis` / `window`).
- **Viewer Theme (`viewer-theme.js`):** `ViewerTheme.init`, `ViewerTheme.getTheme`, `ViewerTheme.setTheme`, `ViewerTheme.toggleTheme`, `ViewerTheme.onThemeChange`.
- **Homepage Theme (`home.js`):** `applyPlatformTheme`, `getPlatformTheme` (syncs `pageshow` and cross-tab `storage` events).
- **Guided Tour (`guided-tour.js`):** `SiliconGuidedTour.start`, `SiliconGuidedTour.stop`, `SiliconGuidedTour.next`, `SiliconGuidedTour.prev`, `SiliconGuidedTour.goTo`, `SiliconGuidedTour.animateCameraTo`, `SiliconGuidedTour.animateExplodeY`, `SiliconGuidedTour.isActive`, `SiliconGuidedTour.isPeeking`, `SiliconGuidedTour.resetSeen`, `SiliconGuidedTour.DEFAULT_STEPS`.
- **Layer Highlight (`three/layerHighlight.ts` / `.js`):** `discoverClickableMeshes`, `collectLayerMeshes`, `raycastLayer`, `raycastLayers`, `selectLayer`, `clearHighlight`, `applyHighlight`, `updateHighlightColor`, `SiliconLayerHighlight`.
- **Viewer Core (`viewer-core.js`):** `SiliconViewer.init` (binds `#left-toggle`, `#right-toggle`, theme, topbar, and panels).
- **Selection Highlight (`viewer-core.js`):** `SiliconSelectionHighlight.apply`, `SiliconSelectionHighlight.updateColor` (forwards to `SiliconLayerHighlight`).
- **Auto-Rotate (`viewer-core.js`):** `SiliconAutoRotate.init`, `SiliconAutoRotate.setState`, `SiliconAutoRotate.getState`, `AUTO_ROTATE_STATES`, `applyAutoRotateState`, `syncAutoRotateVisibility`.
- **Topbar (`viewer-topbar.js`):** `ViewerTopbar.init` (wires input segments, `#mode-seg`, `#flow-seg`, `#btn-build-anim`, `#btn-reset-cam`).
- **Panels (`viewer-panels.js`):** `ViewerPanels.initDimensions`, `ViewerPanels.initLayersAndLegend`, `ViewerPanels.initCollapsiblePanels`, `ViewerPanels.formatNm`.
- **CSS Theme Tokens (`design-tokens.css`):** `[data-theme="dark"]` / `[data-theme="light"]` root custom properties consumed by modules and shared shell.

## Rules / Gotchas

- **Sync Palette Fallback:** `viewer-core.js` keeps an inline `SHARED_PALETTE` fallback and dynamically imports `materialPalette.js`. Update **both** when adding color tokens so non-module scripts match ESM exports immediately on load.
- **Highlight Non-Destructiveness:** `SiliconLayerHighlight` clones shared `mesh.material` onto `_hlOrigMatRef` before boosting opaque `emissive`/albedo or low-opacity `opacity`/contrast and attaches `_hlEdge` (`_isHighlightPart: true`, `renderOrder: 61`), restoring the exact original material ref and values on deselect.
- **Theme Key Mirroring & Time-of-Day Fallback:** `ViewerTheme` reads `siliconsliders-theme` / legacy keys, defaults to `'light'` (`06:00–17:59`) or `'dark'` (`18:00–05:59`) when unset, and syncs manual toggles across all storage keys.
- **Script Load Order:** Module `index.html` files load `shared/three/layerHighlight.js` before `viewer-core.js` and `selection.js` so `SiliconLayerHighlight` and `SiliconSelectionHighlight` exist when initialized; mobile `@media (max-width: 768px)` in `viewer-shell.css` docks `.scale-note-wrap` and compacts `.tour-banner`.
- **Immediate Theme Execution:** `viewer-theme.js` calls `init()` immediately on script load to set `data-theme` on `document.documentElement` before first paint.
