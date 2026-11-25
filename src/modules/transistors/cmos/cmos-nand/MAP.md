# CMOS 2-Input NAND Navigation Map (`src/modules/transistors/cmos/cmos-nand/`)

**Purpose:** Interactive 3D Standard-Cell CMOS 2-Input NAND (`NAND2`, `VDD = 1.00V`, parallel PMOS pull-ups + series NMOS pull-downs) CAD viewer with dual-input VTC and 9-step tour.

## Files

- `index.html` -> Viewport, `A`/`B` logic + continuous sliders, sweep selector (`va`/`vb`/`both`), expandable VTC modal (`#iv-modal-backdrop`), schematic/theory overlays, and script stack.
- `css/style.css` -> NAND2 EDA theme tokens, dual-input HUD, and modal styles.
- `js/data.js` -> Layer legend (`LEGEND`) and component inspector metadata (`INFO`).
- `js/geometry.js` -> `buildNand2Cell` twin-well standard cell, dynamic `depletion` shells, parallel PMOS + series NMOS diffusions, dual HKMG gates, spacers, NiSi, filleted Metal-1 & vias.
- `js/logic-state.js` -> Analytical `calcNandVout`, `computeTransistorRegions` (`mp1`, `mp2`, `mn1`, `mn2` + intermediate node `vx`), `computeNand2State`, `applyLogicTint`, and dual-canvas transfer plotter (`drawTransferGraph`, `openModal`, `closeModal`).
- `js/flow.js` -> Dual-branch `branchMarkersA`/`branchMarkersB` orthogonal flow pools (`buildFlowPools`, `rebuildFlowCurves`, `updateFlowMarkers`, `setFlowMode`).
- `js/build-anim.js` -> Offline 9-step `FAB_STEPS` drop-down tour (`applyFabStep`, `applyTourPositions`, `updateTourBanner`, `startBuildAnimation`).
- `js/controls-explode-scrub.js` -> Layer Y-explode (`applyExplode`, `computeExplodedPosition`) and X/Y/Z clipping-plane scrub (`setClipSliderPlane`, `resetExplodeAndScrub`).
- `js/selection.js` -> 6px drag-threshold raycasting via `SiliconSelectionHighlight`, synced with Architecture Tree, Inspector, popover, and 2D schematic (`syncTreeAndSchematicSelection`).
- `js/ui-panels.js` -> `TREE`, `VIRTUAL` (`pmosA`, `pmosB`, `nmosA`, `nmosB`, `pmos`, `nmos`), `layerVisibility`, `applyLayerVisibility`, and `buildUiPanels`.
- `js/dimensions.js` -> Mead–Conway λ rules (`LAMBDA_PRESETS`, `DIM_RULES`, `DIM_MAP`, `renderDimensionsPanel`).
- `js/view-mode.js` -> Layout vs. Schematic switching and SVG highlighting (`setViewMode`, `updateSchematicVisuals`, `initViewMode`).
- `js/scene.js` -> Three.js renderer, camera, lights, grid, and resize/theme handlers (`applySceneTheme`, `rebuildGrid`, `resize`).
- `js/render-loop.js` -> Main render tick (`renderTick`), active-pulse loop (`updateActivePulse`), and `layerColorOf`.
- `js/theme.js` -> Theme key sync (`applyTheme`, `toggleTheme`, `THEME_COLOR_FALLBACKS`, `setAllThemeKeys`).
- `js/main.js` -> Workbench drag-resize (`initWorkbenchResize`, `toggleWorkbench`), camera hint, `initMainUi`, and `resetAll`.
- `js/voice-assistant.js` -> Browser client for Sarvam AI voice tutoring and audio playback.
- `api/voice-assistant.js` -> Node/serverless proxy handler for Sarvam AI chat and TTS.

## Key Symbols

- **Geometry & Channels:** `Y`, `LAYER_ORDER`, `allMeshes`, `meshById`, `meshesById`, `resolveNandCanonProp`, `buildNand2Cell`, `buildNandWellShellPerimeter`, `createNandWellShellGeometry`, `updateNandWellShell`, `updateNandDepletion`, `updateNandChannels`, `updateNandChannelThemes`, `updateMaterialsTheme`, `toggleLabels`.
- **Physics & State:** `calcNandVout`, `computeTransistorRegions`, `computeNand2State`, `getCircuitStateSnapshot`, `applyLogicTint`, `setInputs`, `initLogicStateControls`.
- **VTC Graph & Modal:** `drawTransferGraph`, `drawTransferOnCanvas`, `setupCanvasDrag`, `openModal`, `closeModal`.
- **Carrier Flow:** `buildFlowPools`, `rebuildFlowCurves`, `updateFlowMarkers`, `setFlowMode`, `branchMarkersA`, `branchMarkersB`, `updateFlowTheme`.
- **Tour & Selection:** `FAB_STEPS`, `fabState`, `applyFabStep`, `applyTourPositions`, `startBuildAnimation`, `stopTour`, `selectById`, `clearSelection`, `syncTreeAndSchematicSelection`.
- **UI & Controls:** `applyLayerVisibility`, `syncVisibilityCheckboxes`, `VIRTUAL`, `TREE`, `layerVisibility`, `setViewMode`, `applyExplode`, `setClipSliderPlane`, `resetAll`.

## Rules / Gotchas

- **Z-Fighting Y-Stack:** `Y` shares Inverter's planar stack (`subTop: 2.0`, `wellTop: 2.05`, `actTop: 1.95`, `silBot: 1.952`, `oxideBot: 1.95`, `highkBot: 1.985`, `polyBot: 2.02`, `metalBot: 2.95`); translucent meshes set `depthWrite: false` and `polygonOffset`.
- **Spacer-to-LDD Alignment:** 8 Si3N4 spacers (`nandSpacerGap = 0.004`, `nandSpacerW = 0.196`) sit flush with the outer SDE/LDD boundaries at `±4.20` and `±1.80`.
- **Unique Modal, Layer & Tour Patterns:** Graph modal uses `openModal`/`closeModal` (`#iv-modal-backdrop`); `LAYER_ORDER` and `layerVisibility` include `depletion` and `sde`; `startBuildAnimation` forces `setInputs('off', 'off')` and restores `_savedTourInputs` on exit.
- **Series Pull-Down Intermediate Node:** `computeTransistorRegions` computes intermediate node `vx` between `MN1` (gate `A`) and `MN2` (gate `B`); `VOUT` stays `1.00V` unless both `VA > VTN` and `VB > VTN`.
- **Click & Schematic Sync:** `selection.js` uses `SiliconSelectionHighlight` and calls `syncTreeAndSchematicSelection` so 3D clicks highlight the corresponding 2D schematic element.
