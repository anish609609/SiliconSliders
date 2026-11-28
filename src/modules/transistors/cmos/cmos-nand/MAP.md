# CMOS 2-Input NAND Navigation Map (`src/modules/transistors/cmos/cmos-nand/`)

**Purpose:** Interactive 3D Standard-Cell CMOS 2-Input NAND (`NAND2`, `VDD = 1.00V`, parallel PMOS pull-ups + series NMOS pull-downs) CAD viewer & scaling sandbox (`Wp`, `Wn`, `L`) with nested KCL dual-input VTC, `SiliconParamInfoModal` (`ⓘ`), optional bulk carriers, and 9-step tour.

## Files

- `index.html` -> Viewport, `A`/`B` logic + continuous sliders, sweep selector (`va`/`vb`/`both`), `#wb-geometry-section` (`Balanced (2:2)` / `Min Area (1:1)` / `Strong Pull-Down` presets + `Wp`/`Wn`/`L` sliders), `ⓘ` info buttons, expandable VTC modal (`#iv-modal-backdrop`), `#toggle-holes` (`Show Bulk Carriers`), schematic/theory overlays, `window.SILICON_TOUR_CONFIG`, and script stack.
- `css/style.css` -> NAND2 EDA theme tokens, dual-input HUD, static `.iv-expand-btn` header, `.geom-presets`/`.geom-preset-btn`, uniform green `--param-color` overrides, and modal styles.
- `js/data.js` -> Layer legend (`LEGEND`) and component inspector metadata (`INFO`).
- `js/geometry.js` -> `buildNand2Cell` twin-well standard cell, dynamic `updateNandGeometry3D(Wp, Wn, L)` (with `userData.restPos` + `applyExplode()` sync), `depletion` shells, parallel PMOS + series NMOS diffusions, dual HKMG gates, 8 flush `Si3N4` spacers, NiSi, filleted Metal-1 & vias, plus optional `InstancedMesh` bulk carriers (`toggleSubstrateHoles`, `updateSubGateCarriers`).
- `js/logic-state.js` -> Geometry- & SCE-coupled nested KCL solver (`solveNmosSeriesStack` / `calcNandVout`, `computeTransistorRegions` with intermediate node `vx`, `computeNand2State`, `setNandGeometry`, `setNandGeometryPreset`), live $V_M$ / $NM_H$ / $NM_L$ telemetry, `applyLogicTint`, `SiliconParamInfoModal.register`, and dual-canvas transfer plotter (`drawTransferGraph`, `openModal`, `closeModal`).
- `js/flow.js` -> Dual `THREE.InstancedMesh` tapered streamline pools (`poolA`, `poolB`) scaling lane/density with `Wp`/`Wn` (`rebuildFlowCurves`, `updateFlowMarkers`, `hideAllFlowMarkers`, `setFlowMode`, `updateFlowTheme`).
- `js/build-anim.js` -> Offline 9-step `FAB_STEPS` drop-down tour (`applyFabStep`, `applyTourPositions`, `updateTourBanner`, `startBuildAnimation`).
- `js/controls-explode-scrub.js` -> Layer Y-explode (`applyExplode`, `computeExplodedPosition`) and X/Y/Z clipping-plane scrub (`setClipSliderPlane`, `resetExplodeAndScrub`).
- `js/selection.js` -> 6px drag-threshold raycasting via `SiliconSelectionHighlight`, synced with Architecture Tree, Inspector, popover, and 2D schematic (`syncTreeAndSchematicSelection`).
- `js/ui-panels.js` -> `TREE`, `VIRTUAL` (`pmosA`, `pmosB`, `nmosA`, `nmosB`, `pmos`, `nmos`), `layerVisibility`, `applyLayerVisibility`, `buildUiPanels`, and `#toggle-holes` handler wiring.
- `js/dimensions.js` -> Mead–Conway λ rules (`LAMBDA_PRESETS`, `DIM_RULES`, `DIM_MAP`, `renderDimensionsPanel`).
- `js/view-mode.js` -> Layout vs. Schematic switching and SVG highlighting (`setViewMode`, `updateSchematicVisuals`, `initViewMode`).
- `js/scene.js` -> Three.js renderer, camera presets (`INITIAL_POS`, `TOUR_CLOSEUP_POS`, `TOUR_CLOSEUP_TARGET`), lights, grid, and resize/theme handlers (`applySceneTheme`, `rebuildGrid`, `resize`).
- `js/render-loop.js` -> Main render tick (`renderTick`), bulk-carrier pulse (`updateSubGateCarriers`), active-pulse loop (`updateActivePulse`), and `layerColorOf`.
- `js/theme.js` -> Theme key sync (`applyTheme`, `toggleTheme`, `THEME_COLOR_FALLBACKS`, `setAllThemeKeys`).
- `js/main.js` -> Workbench drag-resize (`initWorkbenchResize`, `toggleWorkbench`), camera hint, `initMainUi`, and `resetAll` (restores default `'balanced'` geometry and `Show Bulk Carriers` OFF).
- `js/voice-assistant.js` -> Browser client for Sarvam AI voice tutoring and audio playback.
- `api/voice-assistant.js` -> Node/serverless proxy handler for Sarvam AI chat and TTS.

## Key Symbols

- **Geometry, Scaling & Carriers:** `Y`, `LAYER_ORDER`, `allMeshes`, `meshById`, `meshesById`, `resolveNandCanonProp`, `buildNand2Cell`, `updateNandGeometry3D`, `getNandGeom3DState`, `buildNandWellShellPerimeter`, `createNandWellShellGeometry`, `updateNandWellShell`, `updateNandGateCradle`, `evalNandChanThickness`, `updateNandDepletion`, `updateNandChannels`, `updateNandChannelThemes`, `updateMaterialsTheme`, `updateNandLabelPlacement`, `toggleLabels`, `showSubstrateHoles`, `showBulkCarriers`, `toggleSubstrateHoles`, `toggleBulkCarriers`, `syncBulkCarriersExplode`, `updateSubGateCarriers`, `updateBulkCarriersTheme`.
- **Physics, Scaling & State:** `getNandGeomState`, `setNandGeometry`, `setNandGeometryPreset`, `calcNandVout`, `computeTransistorRegions`, `computeNand2State`, `getCircuitStateSnapshot`, `applyLogicTint`, `setInputs`, `initLogicStateControls`.
- **VTC Graph & Modal:** `drawTransferGraph`, `drawTransferOnCanvas`, `setupCanvasDrag`, `openModal`, `closeModal`.
- **Carrier Flow:** `rebuildFlowCurves`, `updateFlowMarkers`, `hideAllFlowMarkers`, `setFlowMode`, `updateFlowTheme`.
- **Tour & Selection:** `FAB_STEPS`, `fabState`, `applyFabStep`, `applyTourPositions`, `startBuildAnimation`, `stopTour`, `selectById`, `clearSelection`, `syncTreeAndSchematicSelection`, `SILICON_TOUR_CONFIG`.
- **UI & Controls:** `applyLayerVisibility`, `syncVisibilityCheckboxes`, `VIRTUAL`, `TREE`, `layerVisibility`, `setViewMode`, `applyExplode`, `setClipSliderPlane`, `resetAll`.

## Rules / Gotchas

- **Z-Fighting Y-Stack:** `Y` shares Inverter's planar stack (`subTop: 2.0`, `wellTop: 2.05`, `actTop: 1.95`, `silBot: 1.952`, `oxideBot: 1.95`, `highkBot: 1.985`, `polyBot: 2.02`, `metalBot: 2.95`); translucent meshes and `InstancedMesh` carriers/streamlines set `depthWrite: false` and `polygonOffset`.
- **Flush Spacer & Fixed Shared Bridge:** 8 `Si3N4` spacers (`nandSpacerGap = 0.002`, `nandSpacerW = 0.20`) anchor flush to each scaled gate edge while Gate A (`-(2.0 + halfL)`) and Gate B (`+(2.0 + halfL)`) slide outward so the central `[-2.0, +2.0]` shared P+ drain / N+ series bridge stays constant across `L = 20..200 nm`. Keep `userData.restPos` updated on geometry changes and invoke `applyExplode()` so Y-explode never snaps stale coordinates.
- **Unique Modal, Layer, Bulk Carriers & Tour Patterns:** Graph modal uses `openModal`/`closeModal` (`#iv-modal-backdrop`); `LAYER_ORDER` and `layerVisibility` include `depletion` and `sde`; `showSubstrateHoles` defaults to `false` on load and `resetAll()`; `startBuildAnimation` forces `setInputs('off', 'off')` and restores `_savedTourInputs` on exit.
- **Series Pull-Down Intermediate Node:** `computeTransistorRegions` solves intermediate node `vx` + body effect between `MN1` (gate `A`) and `MN2` (gate `B`) against parallel `MP1`/`MP2`; `VOUT` stays `1.00V` unless both `VA > VTN` and `VB > VTN`.
- **Click & Schematic Sync:** `selection.js` uses `SiliconSelectionHighlight` and calls `syncTreeAndSchematicSelection` so 3D clicks highlight the corresponding 2D schematic element.
