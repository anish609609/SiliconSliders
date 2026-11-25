# PN Junction Diode Navigation Map (`src/modules/diodes/pn-diode/`)

**Purpose:** Interactive 3D Planar PN Junction Diode CAD viewer with Poisson depletion physics, I-V / E(x) graphs, 2D abrupt junction cross-section, and 7-step fabrication tour.

## Files

- `index.html` -> Viewport, workbench tabs, I-V modal (`#iv-modal-backdrop`), 2D junction overlay, and script load order.
- `css/style.css` -> Diode viewer layout, bias/doping slider styling, and theme overrides.
- `js/data.js` -> Component metadata (`COMPONENTS`), layer toggle definitions (`LAYERS_LIST`), `ARCHITECTURE_TREE`, and `LAMBDA_RULES`.
- `js/physics.js` -> `DiodePhysics` engine (Varshni `Eg`, `Vbi`, `W`/`xp`/`xn`, `Emax`, Sze `VBR`, Shockley + breakdown current).
- `js/geometry.js` -> 3D wafer, N-Well, P+ Anode tub, N+ Cathode tap, conformal straddling depletion shell, space-charge ions, STI/ILD, W vias, and Metal-1.
- `js/logic-state.js` -> Applies `VA`, `NA`, `ND`, `T` state to physics, 3D depletion/ions/breakdown glow, 2D schematic SVG, and telemetry.
- `js/graph.js` -> High-DPI I-V and `rho(x)`/`E(x)` canvas plots plus expandable modal (`openIvModal`, `closeIvModal`) with pointer scrubbing.
- `js/view-2d-junction.js` -> `View2DJunction` interactive 2D cross-section with live minority/majority carriers and recombination sparks.
- `js/flow.js` -> 3D carrier particle stream (`rebuildFlowSimulation`, `updateFlowParticles`) along planar anode-cathode path.
- `js/build-anim.js` -> Offline 7-step `FAB_STEPS` drop-down fabrication tour (`applyFabStep`, `updateBuildAnimation`).
- `js/controls-explode-scrub.js` -> Layer Y-explode and X/Y/Z clipping-plane cross-section scrub (`initExplodeAndScrub`, `pnExplodeState`).
- `js/selection.js` -> 6px drag-threshold raycasting via `SiliconLayerHighlight.raycastLayer`, synced with tree, inspector, and popover.
- `js/ui-panels.js` -> Layer checkboxes (`buildLayersList`), legend (`buildLegendList`), Architecture Tree (`buildArchitectureTree`), and tabs (`switchWorkbenchTab`).
- `js/dimensions.js` -> λ process-node dimension table renderer (`initDimensions`).
- `js/view-mode.js` -> Switches 3D Layout, 2D Junction, and Schematic views (`setViewMode`, `setSubView`, `initViewMode`).
- `js/scene.js` -> Three.js renderer, camera, lights, grid, and resize/theme handlers (`applySceneTheme`, `resize`).
- `js/render-loop.js` -> Main `requestAnimationFrame` loop (`animate`) driving controls, flow particles, and build drop animations.
- `js/theme.js` -> Theme key persistence (`setAllThemeKeys`, `getStoredTheme`, `initTheme`, `applyTheme`).
- `js/main.js` -> Workbench drag-resize (`initWorkbenchResize`, `toggleWorkbench`), camera hint, and `resetAll`.
- `js/voice-assistant.js` -> Browser client for Sarvam AI voice tutoring and audio playback.
- `api/voice-assistant.js` -> Node/serverless proxy handler for Sarvam AI chat and TTS.

## Key Symbols

- **Geometry:** `groups`, `registerDiodeMesh` (sets `userData.layerId`), `createStraddlingDepletionGeometry`, `updateDepletionShellVertices`, `createGaussianTubGeometry`, `buildDiodeGeometry`, `buildIonMarkers`, `updateDiode3DGeometry`, `updateMaterialsTheme`, `diodeMaterials`.
- **Physics:** `DiodePhysics.builtInPotential`, `DiodePhysics.depletionWidths`, `DiodePhysics.breakdownVoltage`, `DiodePhysics.peakElectricField`, `DiodePhysics.diodeCurrent`.
- **State & Schematic:** `applyDiodeState`, `getDiodeState`, `setDiodeBiasVoltage`, `updateSchematicSVG`, `initLogicControls`.
- **Graphs & 2D View:** `initGraphs`, `renderGraphs`, `renderIVCurve`, `renderFieldProfile`, `openIvModal`, `closeIvModal`, `View2DJunction`.
- **Flow & Tour:** `rebuildFlowSimulation`, `updateFlowParticles`, `FAB_STEPS`, `LAYER_KEYS`, `dropOffsets`, `applyFabStep`, `startBuildAnimation`, `stopBuildAnimation`.
- **UI & Controls:** `selectComponentById`, `clearSelection`, `initExplodeAndScrub`, `setViewMode`, `setSubView`, `resetAll`.

## Rules / Gotchas

- **Depletion Shell Depth & Ordering:** `diodeMaterials.depletion` MUST keep `transparent: true, depthWrite: false` with `renderOrder = 4` on `depletionShellMesh`; `depOuterTopLoop`/`depInnerTopLoop` sit at `yTop = 0.008` to remain visible above silicon without Z-fighting.
- **Z-Fighting Micro-Offsets:** `nwellMesh` sits at top `+0.002`, `pTubMesh` and `nTapMesh` sit at top `+0.004`, and `stiMesh` / `ild*` use `polygonOffset` (`-1.0` / `-1.5`) with `depthWrite: false` on translucent dielectrics.
- **Layer Toggle Keys (`LAYERS_LIST`):** `substrate`, `nwell`, `active`, `depletion`, `ions`, `field`, `passivation`, `silicide`, `contact`, `metal` (`labels` is included in `LAYER_KEYS` for tour/toggleLabels).
- **2D Junction Sync & Tour Cutoff:** `2d-junction` pauses/resumes `View2DJunction`; `startBuildAnimation` sets `VA = 0.0` (equilibrium), suppresses carriers via `window.isTourActive`, and restores `_savedTourVa` on exit/reset.
