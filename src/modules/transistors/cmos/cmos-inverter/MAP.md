# CMOS Inverter Navigation Map (`src/modules/transistors/cmos/cmos-inverter/`)

**Purpose:** Interactive 3D Standard-Cell CMOS Inverter (`VDD = 1.00V`, twin-well P/N layout) CAD viewer with 5-region VTC curve, shoot-through current flow, and 9-step fab tour.

## Files

- `index.html` -> Viewport, `VIN` controls (`0`, `1`, `OFF` + continuous slider), expandable VTC modal (`#iv-modal-backdrop`), schematic/theory overlays, and script stack.
- `css/style.css` -> CMOS Inverter EDA theme variables, HUD, and modal styles.
- `js/data.js` -> Layer legend (`LEGEND`) and component inspector metadata (`INFO`).
- `js/geometry.js` -> Twin-well (`N-Well`, `P-Well`) standard cell, dynamic `DEPLETION REGION` shells, active S/D + taps, SDE/LDD, `pmosChannel`/`nmosChannel`, HKMG gates, Si3N4 spacers, NiSi salicide, Metal-1 & vias.
- `js/logic-state.js` -> Analytical 5-region VTC (`calcCmosState`, `getVoutAt`, `getIddAt`), `applyLogicState`, `setOnOffTint`, and dual-canvas VTC plotter (`drawVtcGraph`, `openIvModal`, `closeIvModal`).
- `js/flow.js` -> Orthogonal Metal-1 & channel carrier tracks (`PMOS_PATH_IDS`, `NMOS_PATH_IDS`, `SHOOT_THROUGH_PATH_IDS`) with `stepFlowMarkers` and `refreshConnections`.
- `js/build-anim.js` -> Offline 9-step `FAB_STEPS` drop-down tour (`applyFabStep`, `updateBuildAnimation`, `startBuildAnimation`).
- `js/controls-explode-scrub.js` -> Layer Y-explode (`applyExplode`) and X/Y/Z clipping-plane scrub (`wireScrub`, `resetScrub`).
- `js/selection.js` -> 6px drag-threshold raycasting via `SiliconSelectionHighlight`, synced with Architecture Tree, Inspector, and popover.
- `js/ui-panels.js` -> `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`, tree renderer (`renderTree`), and tab switcher (`switchWorkbenchTab`).
- `js/dimensions.js` -> Mead–Conway λ rules (`LAMBDA_PRESETS`, `DIM_RULES`, `DIM_MAP`, `renderDimsTable`).
- `js/view-mode.js` -> Layout vs. Schematic mode switching (`setViewMode`).
- `js/scene.js` -> Three.js renderer, camera, lights, grid, and resize/theme handlers (`applySceneTheme`, `updateGridTheme`, `resize`).
- `js/render-loop.js` -> Main animation loop (`animate`) and layer tint helper (`layerColorOf`).
- `js/theme.js` -> Theme key persistence (`setAllThemeKeys`, `getStoredTheme`, `initTheme`, `applyTheme`).
- `js/main.js` -> Workbench drag-resize (`initWorkbenchResize`, `toggleWorkbench`), camera hint, and `resetAll`.
- `js/voice-assistant.js` -> Browser client for Sarvam AI voice tutoring and audio playback.
- `api/voice-assistant.js` -> Node/serverless proxy handler for Sarvam AI chat and TTS.

## Key Symbols

- **Geometry & Channels:** `Y`, `LAYER_ORDER`, `buildActiveRow`, `createCmosDeplBox`, `updateInverterDepletion`, `createCmosSalicideGeo`, `addInverterSilicide`, `updateInverterChannels`, `updateChannelThemes`, `updateMaterialsTheme`, `toggleLabels`.
- **Physics & State:** `calcCmosState`, `getVoutAt`, `getIddAt`, `applyLogicState`, `setOnOffTint`, `setVinState`, `initLogicStateControls`.
- **VTC Graph & Modal:** `drawVtcGraph`, `renderSingleVtcGraph`, `openIvModal`, `closeIvModal`, `VTC_GRAPH_PAD`.
- **Carrier Flow:** `PMOS_PATH_IDS`, `NMOS_PATH_IDS`, `SHOOT_THROUGH_PATH_IDS`, `METAL_FLOW_Y`, `rebuildFlowCurves`, `refreshConnections`, `stepFlowMarkers`.
- **Tour & Selection:** `FAB_STEPS`, `fabState`, `applyFabStep`, `startBuildAnimation`, `pauseBuildAnimation`, `stopBuildAnimation`, `selectById`, `clearSelection`.
- **UI & Controls:** `applyExplode`, `wireScrub`, `resetScrub`, `setViewMode`, `resetAll`, `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`.

## Rules / Gotchas

- **Z-Fighting Y-Stack:** `Y` uses distinct elevations (`subTop: 2.0`, `wellTop: 2.05`, `actTop: 1.95`, `silBot: 1.952`, `oxideBot: 1.95`, `highkBot: 1.985`, `polyBot: 2.02`, `metalBot: 2.95`); translucent overlays/channels use `depthWrite: false` and `polygonOffsetFactor: -1.0`.
- **Spacer-to-LDD Alignment:** `cmosSpacerGap = 0.004` from `CH.max` out to `cmosSpacerOuterX = 1.20` (`cmosSpacerW = 0.196`), matching the outer edge of the `0.55`-wide SDE/LDD regions at `±1.20`.
- **Peak Shoot-Through at `VM = 0.50V`:** Region C (`0.48 <= VIN <= 0.52`) drives both `PMOS` and `NMOS` into `SATURATION`, activating `SHOOT_THROUGH_PATH_IDS` in `flow.js`.
- **Layer, Depletion & Tour Sync:** Toggleable `layerMeta` includes `depletion` (`substrate`, `well`, `depletion`, `active`, `sde`, `oxide`, `highk`, `poly`, `spacer`, `silicide`, `contact`, `metal`); `startBuildAnimation` forces `setVinState('off')` and suppresses carriers until `stopBuildAnimation`.
- **Click & Modal Invariants:** `selection.js` enforces a 6px drag threshold with `SiliconSelectionHighlight.apply`; `#iv-modal-backdrop` opens via `openIvModal` and closes on `Escape` or backdrop click.
