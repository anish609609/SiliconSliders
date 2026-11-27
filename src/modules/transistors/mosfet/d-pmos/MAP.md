# Depletion-Mode PMOS Navigation Map (`src/modules/transistors/mosfet/d-pmos/`)

**Purpose:** Interactive 3D Depletion-Mode PMOS (`VTH,p = +0.80V`, normally ON at `VGS = 0V`) CAD viewer inside an N-Well with implanted P-channel, wrap-around depletion, ISD-VSD graph, and 9-step tour.

## Files

- `index.html` -> Viewport, VGS (`-1.00V` to `+1.20V`)/VSD controls, expandable I-V modal (`#iv-modal-backdrop`), schematic/theory overlays, `? Tour` onboarding (`guided-tour`), and script stack.
- `css/style.css` -> D-PMOS theme tokens (`--c-well`, `--c-active-p`, `--c-sde-p`, `--c-depletion`), HUD, and modal styles.
- `js/data.js` -> Layer legend (`LEGEND`) and component inspector metadata (`INFO`).
- `js/geometry.js` -> 3D P-Substrate, N-Well tub, P+ S/D + N+ well tap, implanted P-channel (`dchannel`), P-SDE/LDD, wrap-around depletion + upper/lower channel pinch-off meshes, HKMG, spacers, NiSi, W contacts, Metal-1.
- `js/logic-state.js` -> Continuous D-PMOS physics (`getMosfetPhysicsState`, `applyLogicState`) with `VOV = VTH_P - VGS` across Cutoff, Depletion, Zero-Bias, and Enhancement modes plus ISD-VSD canvas renderer.
- `js/flow.js` -> Hole/electron flow markers (`createFlowCurve`, `rebuildFlowCurves`, `updateFlowMarkers`) synced to `getMosfetPhysicsState`.
- `js/build-anim.js` -> Offline 9-step `FAB_STEPS` drop-down tour (adds Threshold/P-Channel Implant at step 2).
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
- **Physics Engine:** `getMosfetPhysicsState` (`VTH_P = 0.80`, returns `vgs`, `vsd`, `vov`, `vsdSat`, `isd`, `region`, `mode`, `deltaL`, `leff`), `applyLogicState`, `initLogicStateControls`.
- **I-V Graph & Modal:** `renderSingleDpmosGraph`, `drawIsdVsdGraph`, `openIvModal`, `closeIvModal`.
- **Flow & Tour:** `createFlowCurve`, `rebuildFlowCurves`, `stepFlowMarkers`, `updateFlowMarkers`, `FAB_STEPS`, `dropOffsets`, `applyFabStep`, `startBuildAnimation`, `pauseBuildAnimation`, `stopBuildAnimation`.
- **Selection & Tree:** `selectById`, `clearSelection`, `highlightMeshes`, `meshesForId` (`SiliconLayerHighlight`), `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`.
- **Tour Cutoff Sync:** `startBuildAnimation` forces D-PMOS Cutoff (`currentVgs = 1.20` since `VTH,p = +0.80V`), suppresses hole flow, and restores `_savedTourBias` on stop.
- **Explode, Scrub & View:** `applyExplode`, `wireScrub`, `resetScrub`, `setViewMode`, `resetAll`.

## Rules / Gotchas

- **Z-Fighting Y-Stack:** `Y` enforces monotonic elevations (`subTop: 3.0`, `wellTop: 3.003`, `actTop: 3.006`, `silTop: 3.078`, `sdeTop: 3.009`, `oxBot: 3.009`, `hkBot: 3.189`, `polyBot: 3.429`, `m1Bot: 5.159`).
- **Spacer-to-LDD Alignment:** P-SDE extensions sit at `sdeSrcX = -1.55`, `sdeDrnX = 1.55` (`sdeW = 1.1`), with Si3N4 spacers starting at `gateL/2 + 0.004` to match the outer P-SDE edge.
- **Depletion `depthWrite: false`:** Shared `pinchMat` (`junctionDeplMesh`, `pinchMesh`, `deplUpperMesh`, `deplLowerMesh`) and `junctionDeplEdgeMat` MUST keep `transparent: true, depthWrite: false` (`renderOrder: 2–3`).
- **Layer & Non-Toggleable Keys:** Toggleable `layerMeta` keys are `substrate`, `well`, `depletion`, `active`, `dchannel`, `sde`, `oxide`, `highk`, `poly`, `spacer`, `silicide`, `contact`, `metal`; `nonToggleableKeys = ['src', 'drn', 'gate', 'welltap']` (uses `welltap`, not `body`).
- **Click & Modal Invariants:** `selection.js` relies on `SiliconSelectionHighlight.apply` with a 6px drag threshold; `#iv-modal-backdrop` syncs canvas DPI on open and closes via `Escape` or backdrop click.
