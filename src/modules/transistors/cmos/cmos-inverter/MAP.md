# CMOS Inverter Navigation Map (`src/modules/transistors/cmos/cmos-inverter/`)

**Purpose:** Interactive 3D Standard-Cell CMOS Inverter (`VDD = 1.00V`, twin-well P/N layout) CAD viewer & scaling sandbox (`Wp`, `Wn`, `L`) with live KCL bisection VTC curve, shoot-through current flow, `SiliconParamInfoModal` (`ⓘ`), optional bulk carriers, and 9-step fab tour.

## Files

- `index.html` -> Viewport, `VIN` controls (`0`, `1`, `OFF` + continuous slider), `#wb-geometry-section` (`Balanced (2:1)` / `Min Area (1:1)` / `PMOS-Skewed` presets + `Wp`/`Wn`/`L` sliders), `ⓘ` info buttons, expandable VTC modal (`#iv-modal-backdrop`), `#toggle-holes` (`Show Bulk Carriers`), schematic/theory overlays, `window.SILICON_TOUR_CONFIG`, and script stack.
- `css/style.css` -> CMOS Inverter EDA theme variables, HUD, static `.iv-expand-btn` header, `.geom-presets`/`.geom-preset-btn`, uniform green `--param-color` overrides, and modal styles.
- `js/data.js` -> Layer legend (`LEGEND`) and component inspector metadata (`INFO`).
- `js/geometry.js` -> Twin-well (`N-Well`, `P-Well`) standard cell, dynamic `updateCmosGeometry3D(Wp, Wn, L)`, `DEPLETION REGION` shells, active S/D + taps, SDE/LDD, `pmosChannel`/`nmosChannel`, HKMG gates, flush `Si3N4` spacers, NiSi salicide, Metal-1 & vias, plus optional `InstancedMesh` bulk carriers (`toggleSubstrateHoles`, `updateSubGateCarriers`).
- `js/logic-state.js` -> Geometry- & SCE-coupled KCL bisection VTC solver (`calcCmosState`, `getVoutAt`, `getIddAt`, `setCmosGeometry`, `setCmosGeometryPreset`), live $V_M$ / $NM_H$ / $NM_L$ telemetry, `applyLogicState`, `SiliconParamInfoModal.register`, and dual-canvas VTC plotter (`drawVtcGraph`, `openIvModal`, `closeIvModal`).
- `js/flow.js` -> Dual `THREE.InstancedMesh` tapered streamline pools (`pmosPool`, `nmosPool`) scaling lane/density with `Wp`/`Wn` and Explode Y (`rebuildFlowCurves`, `refreshConnections`, `stepFlowMarkers`, `updateFlowTheme`).
- `js/build-anim.js` -> Offline 9-step `FAB_STEPS` drop-down tour (`applyFabStep`, `updateBuildAnimation`, `startBuildAnimation`).
- `js/controls-explode-scrub.js` -> Layer Y-explode (`applyExplode`) and X/Y/Z clipping-plane scrub (`wireScrub`, `resetScrub`).
- `js/selection.js` -> 6px drag-threshold raycasting via `SiliconSelectionHighlight`, synced with Architecture Tree, Inspector, and popover.
- `js/ui-panels.js` -> `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`, tree renderer (`renderTree`), and tab switcher (`switchWorkbenchTab`).
- `js/dimensions.js` -> Mead–Conway λ rules (`LAMBDA_PRESETS`, `DIM_RULES`, `DIM_MAP`, `renderDimsTable`).
- `js/view-mode.js` -> Layout vs. Schematic mode switching (`setViewMode`), including `#toggle-holes` handler wiring.
- `js/scene.js` -> Three.js renderer, camera presets (`INITIAL_POS`, `TOUR_CLOSEUP_POS`, `TOUR_CLOSEUP_TARGET`), lights, grid, and resize/theme handlers (`applySceneTheme`, `updateGridTheme`, `resize`).
- `js/render-loop.js` -> Main animation loop (`animate`), bulk-carrier pulse (`updateSubGateCarriers`), and layer tint helper (`layerColorOf`).
- `js/theme.js` -> Theme key persistence (`setAllThemeKeys`, `getStoredTheme`, `initTheme`, `applyTheme`).
- `js/main.js` -> Workbench drag-resize (`initWorkbenchResize`, `toggleWorkbench`), camera hint, and `resetAll` (restores default `'balanced'` geometry and `Show Bulk Carriers` OFF).
- `js/voice-assistant.js` -> Browser client for Sarvam AI voice tutoring and audio playback.
- `api/voice-assistant.js` -> Node/serverless proxy handler for Sarvam AI chat and TTS.

## Key Symbols

- **Geometry, Scaling & Carriers:** `Y`, `LAYER_ORDER`, `resolveInverterCanonProp`, `buildActiveRow`, `updateCmosGeometry3D`, `getCmosGeom3DState`, `buildCmosWellShellPerimeter`, `createCmosWellShellGeometry`, `updateCmosWellShell`, `updateCmosGateCradle`, `getCmosChanThicknessAtWorldX`, `updateInverterDepletion`, `createCmosSalicideGeo`, `addInverterSilicide`, `updateInverterChannels`, `updateChannelThemes`, `updateMaterialsTheme`, `updateLabelPlacement`, `toggleLabels`, `showSubstrateHoles`, `showBulkCarriers`, `toggleSubstrateHoles`, `toggleBulkCarriers`, `updateSubGateCarriers`, `updateBulkCarriersTheme`.
- **Physics, Scaling & State:** `getCmosGeomState`, `setCmosGeometry`, `setCmosGeometryPreset`, `calcCmosState`, `getVoutAt`, `getIddAt`, `applyLogicState`, `setOnOffTint`, `setVinState`, `currentIn`, `initLogicStateControls`.
- **VTC Graph & Modal:** `drawVtcGraph`, `renderSingleVtcGraph`, `openIvModal`, `closeIvModal`, `VTC_GRAPH_PAD`.
- **Carrier Flow:** `rebuildFlowCurves`, `refreshConnections`, `stepFlowMarkers`, `updateFlowTheme`.
- **Tour & Selection:** `FAB_STEPS`, `fabState`, `applyFabStep`, `startBuildAnimation`, `pauseBuildAnimation`, `stopBuildAnimation`, `selectById`, `clearSelection`, `SILICON_TOUR_CONFIG`.
- **UI & Controls:** `applyExplode`, `wireScrub`, `resetScrub`, `setViewMode`, `resetAll`, `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`.

## Rules / Gotchas

- **Z-Fighting Y-Stack:** `Y` uses distinct elevations (`subTop: 2.0`, `wellTop: 2.05`, `actTop: 1.95`, `silBot: 1.952`, `oxideBot: 1.95`, `highkBot: 1.985`, `polyBot: 2.02`, `metalBot: 2.95`); translucent overlays/channels and `InstancedMesh` carriers/streamlines use `depthWrite: false` and `polygonOffset`.
- **Flush Spacer & Twin-Well Anchor:** `cmosSpacerGap = 0.002` (`cmosSpacerW = 0.20`) tracks scaled gate faces (`±halfL`) dynamically, while inner S/D & well boundaries remain anchored at `±1.55` to preserve the central `[-0.75, +0.75]` P-substrate isolation gap across `L = 20..200 nm`.
- **Live $V_M$ KCL Bisection & `currentIn` Sync:** `logic-state.js` solves `I_DS,n = I_DS,p` (`MU_N = 2.0 * MU_P`, $L$-dependent $V_{TH}(L)$ roll-off, velocity saturation, $\lambda \propto 1/L$) so $V_M$ shifts continuously with $W_p/W_n$ and $L$, and keeps `window.currentIn` synced with `currentVin` for `render-loop.js`.
- **Layer, Depletion, Bulk Carriers & Tour Sync:** Toggleable `layerMeta` includes `depletion`; `showSubstrateHoles` defaults to `false` on load and `resetAll()`; `startBuildAnimation` forces `setVinState('off')` and suppresses carriers until `stopBuildAnimation`.
- **Click & Modal Invariants:** `selection.js` enforces a 6px drag threshold with `SiliconSelectionHighlight.apply`; `#iv-modal-backdrop` opens via `openIvModal` and closes on `Escape` or backdrop click.
