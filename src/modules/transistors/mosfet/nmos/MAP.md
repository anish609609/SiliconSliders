# Enhancement-Mode NMOS Navigation Map (`src/modules/transistors/mosfet/nmos/`)

**Purpose:** Interactive 3D Enhancement-mode NMOS device-scaling sandbox (`L`: 20–200 nm, `W`: 40–400 nm, `t_ox`: 1.2–10.0 nm) with continuous Cutoff/Linear/Saturation physics, short-channel effects (VTH roll-off, DIBL, velocity saturation, CLM), live 3D mesh scaling, pinch-off channel/depletion rendering, IDS-VDS graph with Y-axis lock, and 8-step fab tour.

## Files

- `index.html` -> Viewport, VGS/VDS controls, Device Geometry scaling controls & presets, Lock Y-Axis I-V graph & expandable modal (`#iv-modal-backdrop`), schematic/theory overlays, `? Tour` onboarding (`guided-tour`), and script stack.
- `css/style.css` -> Module-specific theme colors (`--c-substrate`, `--c-active-n`, `--c-sde-n`, `--c-depletion`), Device Geometry preset pills, I-V header/lock toggle, HUD, and modal styles.
- `js/data.js` -> Layer legend (`LEGEND`) and component inspector metadata (`INFO`).
- `js/geometry.js` -> 3D substrate, N+ S/D Gaussian tubs, N-SDE/LDD extensions, dynamic inversion channel + depletion shells, HKMG gate stack, Si3N4 spacers, NiSi salicide, W contacts, Metal-1, and `updateDeviceGeometry3D(L, W, tox)` scaling engine.
- `js/logic-state.js` -> Geometry-aware NMOS physics (`getMosfetPhysicsState`, `setMosfetGeometry`), 3-region IDS(VGS, VDS, L, W, tox) solver with SCE (VTH roll-off, DIBL, velocity saturation, `lambda ∝ 1/L`), channel/depletion modulation, and IDS-VDS inline/modal canvas renderer with `toggleLockYAxis`.
- `js/flow.js` -> Particle flow markers (`createFlowCurve`, `rebuildFlowCurves`, `updateFlowMarkers`) coupled to `getMosfetPhysicsState` and current/electron mode.
- `js/build-anim.js` -> Offline 8-step `FAB_STEPS` drop-down tour (`applyFabStep`, `updateBuildAnimation`, `startBuildAnimation`).
- `js/controls-explode-scrub.js` -> Layer Y-explode (`applyExplode`) and X/Y/Z clipping-plane scrub (`wireScrub`, `resetScrub`).
- `js/selection.js` -> 6px drag-threshold raycasting using `SiliconSelectionHighlight`, synced with Architecture Tree, Inspector, and popover.
- `js/ui-panels.js` -> `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`, tree renderer (`renderTree`), and tab switcher (`switchWorkbenchTab`).
- `js/dimensions.js` -> Mead–Conway λ rules (`LAMBDA_PRESETS`, `DIM_RULES`, `DIM_MAP`, `renderDimsTable`).
- `js/view-mode.js` -> Layout vs. Schematic mode switching (`setViewMode`).
- `js/scene.js` -> Three.js renderer, camera presets (`INITIAL_POS`, `TOUR_CLOSEUP_POS`, `TOUR_CLOSEUP_TARGET`), lights, grid, and resize/theme handlers (`applySceneTheme`, `updateGridTheme`, `resize`).
- `js/render-loop.js` -> Main animation loop (`animate`) and layer tint helper (`layerColorOf`).
- `js/theme.js` -> Theme key persistence (`setAllThemeKeys`, `getStoredTheme`, `initTheme`, `applyTheme`).
- `js/main.js` -> Workbench drag-resize (`initWorkbenchResize`, `toggleWorkbench`), camera hint, and `resetAll`.
- `js/voice-assistant.js` -> Browser client for Sarvam AI voice tutoring and audio playback.
- `api/voice-assistant.js` -> Node/serverless proxy handler for Sarvam AI chat and TTS.

## Key Symbols

- **Geometry & Materials:** `Y`, `LAYER_ORDER`, `gaussianDopingMesh`, `createWellShellGeometry`, `updateHalfWellShell`, `getChannelThicknessAtX`, `updateChannelGeometry`, `getDeviceGeomState`, `updateDeviceGeometry3D`, `buildSilicidePadMesh`, `updateMaterialsTheme`, `toggleLabels`.
- **Physics Engine:** `getMosfetPhysicsState` (returns `vgs`, `vds`, `vth`, `vov`, `vdsSat`, `ids`, `region`, `deltaL`, `leff`, `L`, `W`, `tox`, `wlRatio`), `setMosfetGeometry`, `GEOM_PRESETS`, `applyLogicState`, `initLogicStateControls`.
- **I-V Graph & Modal:** `drawIdsVdsGraph`, `renderSingleGraph`, `toggleLockYAxis`, `openIvModal`, `closeIvModal`, `IV_GRAPH_PAD`.
- **Flow & Tour:** `createFlowCurve`, `rebuildFlowCurves`, `stepFlowMarkers`, `updateFlowMarkers`, `FAB_STEPS`, `dropOffsets`, `applyFabStep`, `startBuildAnimation`, `pauseBuildAnimation`, `stopBuildAnimation`.
- **Selection & Tree:** `selectById`, `clearSelection`, `highlightMeshes`, `meshesForId` (`SiliconLayerHighlight`), `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`.
- **Rules / Invariants:** Run `startBuildAnimation` forces Cutoff (`currentVgs = 0.0`, suppresses carriers) and restores `_savedTourBias` on stop; `reg` sets `userData.layerId` for auto-discovery.
- **Explode, Scrub & View:** `applyExplode`, `wireScrub`, `resetScrub`, `setViewMode`, `resetAll`, `SILICON_TOUR_CONFIG`.

## Rules / Gotchas

- **Z-Fighting Y-Stack:** `Y` uses progressive micro-offsets (`subTop: 3.0`, `actTop: 3.004`, `silTop: 3.076`, `sdeTop: 3.008`, `oxBot: 3.008`, `hkBot: 3.188`, `polyBot: 3.428`, `m1Bot: 5.158`); keep offsets monotonic when editing stack heights.
- **Spacer-to-LDD Alignment:** N-SDE extensions sit at `sdeSrcX = -1.55`, `sdeDrnX = 1.55` (`sdeW = 1.1`), and Si3N4 spacers span `gateL/2 + 0.004` out to `spacerOuterX = gateL/2 + sdeW` so spacers cap the LDD extensions cleanly.
- **Depletion `depthWrite: false`:** `pinchMat` (used by `srcDeplMesh`, `drnDeplMesh`, `gateDeplMesh`) and `deplEdgeMat` MUST keep `transparent: true, depthWrite: false` (`renderOrder: 2`) so the enclosed inversion channel remains visible.
- **Layer & Non-Toggleable Keys:** Toggleable `layerMeta` keys are `substrate`, `depletion`, `active`, `sde`, `oxide`, `highk`, `poly`, `spacer`, `silicide`, `contact`, `metal`; `nonToggleableKeys = ['channel', 'src', 'drn', 'gate', 'body']`.
- **Click & Modal Invariants:** `selection.js` relies on `SiliconSelectionHighlight.apply` with a 6px drag threshold; `#iv-modal-backdrop` syncs canvas DPI on open and closes via `Escape` or backdrop click.
