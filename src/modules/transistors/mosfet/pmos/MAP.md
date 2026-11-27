# Enhancement-Mode PMOS Navigation Map (`src/modules/transistors/mosfet/pmos/`)

**Purpose:** Interactive 3D Enhancement-mode PMOS CAD viewer inside an N-Well body with dynamic device geometry scaling (`L`, `W`, `t_ox`), short-channel effects, VSG/VSD controls, ISD-VSD graph (`Lock Y`), unified hole/current streak flow, optional bulk carriers, `ⓘ` info popovers, and 8-step fabrication tour.

## Files

- `index.html` -> Viewport, VSG/VSD + `ⓘ` info popovers, `DEVICE GEOMETRY` sandbox (`L`, `W`, `t_ox` + presets), `Show Bulk Carriers` toggle, expandable I-V modal (`#iv-modal-backdrop`), schematic/theory overlays, `? Tour` onboarding (`guided-tour`), and script stack (including `shared/js/param-info-modal.js`).
- `css/style.css` -> PMOS theme tokens (`--c-well`, `--c-active-p`, `--c-sde-p`, `--c-depletion`), graph header/Lock Y, geometry preset pills, uniform teal/green `ⓘ` styles, HUD, and modal styles.
- `js/data.js` -> Layer legend (`LEGEND`) and component inspector metadata (`INFO`).
- `js/geometry.js` -> 3D P-Substrate, N-Well tub, P+ S/D + N+ well tap, P-SDE/LDD extensions, dynamic hole channel + depletion shells, HKMG gate, flush Si3N4 spacers (`0.002` clearance), NiSi, W contacts, Metal-1, `updateDeviceGeometry3D(L, W, tox)`, and optional N-Well majority electrons (`holeInstMesh` / `updateSubGateCarriers`, default OFF).
- `js/logic-state.js` -> Continuous geometry-dependent PMOS physics (`computePmosPoint`, `calculateIsd`, `getMosfetPhysicsState`, `setMosfetGeometry`) with `mu_p ~ 0.45*mu_n`, `VTH,p` roll-off, DIBL, velocity saturation, `lambda ~ 1/L`, `SiliconParamInfoModal` registrations, and Lock-Y ISD-VSD canvas renderer.
- `js/flow.js` -> Unified `InstancedMesh` hole/current streaks (`createFlowCurve`, `rebuildFlowCurves`, `stepFlowMarkers`, `updateFlowMarkers`) scaling lane count with `W`, zero-bias thermal jitter, and acceleration across `deltaL`.
- `js/build-anim.js` -> Offline 8-step `FAB_STEPS` drop-down tour (`applyFabStep`, `updateBuildAnimation`, `startBuildAnimation`).
- `js/controls-explode-scrub.js` -> Layer Y-explode (`applyExplode`) and X/Y/Z clipping-plane scrub (`wireScrub`, `resetScrub`).
- `js/selection.js` -> 6px drag-threshold raycasting via `SiliconSelectionHighlight`, synced with Architecture Tree, Inspector, and popover.
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

- **Geometry & Materials:** `Y`, `LAYER_ORDER`, `gaussianDopingMesh`, `createWellShellGeometry`, `updateHalfWellShell`, `getChannelThicknessAtX`, `updateChannelGeometry`, `buildSilicidePadMesh`, `updateMaterialsTheme`, `toggleLabels`.
- **Physics Engine:** `calculateIsd`, `getMosfetPhysicsState` (returns `vsg`, `vsd`, `vth`, `vov`, `isd`, `region`, `deltaL`, `leff`), `applyLogicState`, `initLogicStateControls`.
- **I-V Graph & Modal:** `renderSinglePmosGraph`, `drawIsdVdsGraph`, `openIvModal`, `closeIvModal`.
- **Flow & Tour:** `createFlowCurve`, `rebuildFlowCurves`, `stepFlowMarkers`, `updateFlowMarkers`, `FAB_STEPS`, `dropOffsets`, `applyFabStep`, `startBuildAnimation`, `pauseBuildAnimation`, `stopBuildAnimation`.
- **Selection & Tree:** `selectById`, `clearSelection`, `highlightMeshes`, `meshesForId` (`SiliconLayerHighlight`), `TREE`, `VIRTUAL`, `layerMeta`, `nonToggleableKeys`.
- **Tour Cutoff Sync:** `startBuildAnimation` forces Cutoff (`currentVsg = 0.0`, `window.isTourActive = true`) to suppress hole flow and restores `_savedTourBias` on stop/reset.
- **Explode, Scrub & View:** `applyExplode`, `wireScrub`, `resetScrub`, `setViewMode`, `resetAll`.

## Rules / Gotchas

- **Z-Fighting Y-Stack:** `Y` enforces monotonic elevations (`subTop: 3.0`, `wellTop: 3.003`, `actTop: 3.006`, `silTop: 3.078`, `sdeTop: 3.009`, `oxBot: 3.009`, `hkBot: 3.189`, `polyBot: 3.429`, `m1Bot: 5.159`); keep N-Well between substrate and active tops.
- **Spacer-to-LDD Alignment:** P-SDE extensions sit at `sdeSrcX = -1.55`, `sdeDrnX = 1.55` (`sdeW = 1.1`), with Si3N4 spacers starting at `gateL/2 + 0.004` to match the outer P-SDE boundary.
- **Depletion `depthWrite: false`:** `pinchMat` (`srcDeplMesh`, `drnDeplMesh`, `gateDeplMesh`) and `deplEdgeMat` MUST retain `transparent: true, depthWrite: false` (`renderOrder: 2`) so the P-channel remains visible.
- **Layer & Non-Toggleable Keys:** Toggleable `layerMeta` keys are `substrate`, `well`, `depletion`, `active`, `sde`, `oxide`, `highk`, `poly`, `spacer`, `silicide`, `contact`, `metal`; `nonToggleableKeys = ['channel', 'src', 'drn', 'gate', 'body']`.
- **Click & Modal Invariants:** `selection.js` relies on `SiliconSelectionHighlight.apply` with a 6px drag threshold; `#iv-modal-backdrop` syncs canvas DPI on open and closes via `Escape` or backdrop click.
