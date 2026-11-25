# Depletion-Mode NMOS Navigation Map (`src/modules/transistors/mosfet/d-nmos/`)

**Purpose:** Interactive 3D Depletion-Mode NMOS (`VTH = -0.80V`, normally ON at `VGS = 0V`) CAD viewer with implanted N-channel slab, wrap-around junction depletion, IDS-VDS graph, and 9-step tour.

## Files

- `index.html` -> Viewport, VGS (`-1.20V` to `+1.00V`)/VDS controls, expandable I-V modal (`#iv-modal-backdrop`), schematic/theory overlays, and script stack.
- `css/style.css` -> D-NMOS theme tokens (`--c-substrate`, `--c-active-n`, `--c-sde-n`, `--c-depletion`), HUD, and modal styles.
- `js/data.js` -> Layer legend (`LEGEND`) and component inspector metadata (`INFO`).
- `js/geometry.js` -> 3D substrate, N+ S/D tubs, implanted N-channel slab (`dchannel`), N-SDE/LDD, wrap-around PN depletion envelope + upper/lower channel pinch-off meshes, HKMG, spacers, silicide, W contacts, Metal-1.
- `js/logic-state.js` -> Continuous D-NMOS physics (`getMosfetPhysicsState`, `applyLogicState`) across Cutoff, Depletion, Zero-Bias, and Enhancement modes plus IDS-VDS inline/modal canvas renderer.
- `js/flow.js` -> Electron/current flow markers (`createFlowCurve`, `rebuildFlowCurves`, `updateFlowMarkers`) synced to `getMosfetPhysicsState`.
- `js/build-anim.js` -> Offline 9-step `FAB_STEPS` drop-down tour (adds Threshold/N-Channel Implant at step 2).
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

- **Geometry & Depletion:** `Y`, `LAYER_ORDER`, `groups`, `gaussianDopingMesh`, `getIslandDepthAtX`, `createWrapDepletionGeometry`, `updateWrapDepletionGeometry`, `updateChannelGeometry`, `buildSilicidePadMesh`, `updateMaterialsTheme`, `toggleLabels`.
- **Physics Engine:** `getMosfetPhysicsState` (`VTH = -0.80V`, returns `vgs`, `vds`, `vov`, `vdsSat`, `ids`, `region`, `deltaL`, `leff`), `applyLogicState`, `initLogicStateControls`.
- **I-V Graph & Modal:** `drawIdsVdsGraph`, `renderSingleGraph`, `openIvModal`, `closeIvModal`, `IV_GRAPH_PAD`.
- **Flow & Tour:** `createFlowCurve`, `rebuildFlowCurves`, `stepFlowMarkers`, `updateFlowMarkers`, `FAB_STEPS`, `dropOffsets`, `applyFabStep`, `startBuildAnimation`, `pauseBuildAnimation`, `stopBuildAnimation`.
- **Selection & Tree:** `selectById`, `clearSelection`, `highlightMeshes`, `meshesForId` (`SiliconLayerHighlight`), `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`.
- **Tour Cutoff Sync:** `startBuildAnimation` forces D-NMOS Cutoff (`currentVgs = -1.20` since `VTH = -0.80V`), suppresses electron flow, and restores `_savedTourBias` on stop.
- **Explode, Scrub & View:** `applyExplode`, `wireScrub`, `resetScrub`, `setViewMode`, `resetAll`.

## Rules / Gotchas

- **Z-Fighting Y-Stack:** `Y` keeps monotonic offsets (`subTop: 3.0`, `actTop: 3.004`, `silTop: 3.076`, `sdeTop: 3.008`, `oxBot: 3.008`, `hkBot: 3.188`, `polyBot: 3.428`, `m1Bot: 5.158`); implanted `dchannel` sits immediately beneath `oxBot`.
- **Spacer-to-LDD Alignment:** N-SDE extensions sit at `sdeSrcX = -1.55`, `sdeDrnX = 1.55` (`sdeW = 1.1`), and Si3N4 spacers run from `gateL/2 + 0.004` to `spacerOuterX = gateL/2 + sdeW`.
- **Depletion `depthWrite: false`:** Shared `pinchMat` (`junctionDeplMesh`, `pinchMesh`, `deplUpperMesh`, `deplLowerMesh`) and `junctionDeplEdgeMat` MUST keep `transparent: true, depthWrite: false` (`renderOrder: 2–3`) so the implanted N-channel stays visible.
- **Layer & Non-Toggleable Keys:** Toggleable `layerMeta` keys add `dchannel`: `substrate`, `depletion`, `active`, `dchannel`, `sde`, `oxide`, `highk`, `poly`, `spacer`, `silicide`, `contact`, `metal`; `nonToggleableKeys = ['src', 'drn', 'gate', 'body']`.
- **Click & Modal Invariants:** `selection.js` relies on `SiliconSelectionHighlight.apply` with a 6px drag threshold; `#iv-modal-backdrop` syncs canvas DPI on open and closes via `Escape` or backdrop click.
