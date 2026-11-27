# LVDT Simulator Navigation Map (`src/modules/transducers/lvdt/`)

**Purpose:** Interactive 3D cutaway & enclosed LVDT (Linear Variable Differential Transformer) simulator using the 3-Stage Process Engineering layout (`Theory | Sliders | Industry`) on a zero-build vanilla Three.js r128 stack.

## Files

- `index.html` -> 3-Stage header (`Theory | Sliders | Industry`), full-viewport 3D canvas, floating glassmorphic HUD drawers, `0. Origin Story` + Theory cards (HTML/Unicode math), Industry cards + relocated Interactive Lab Challenges, and unified info popover modal.
- `css/style.css` -> Design-token integration, glassmorphic HUD drawers, enlarged 2D plot boxes, layer visibility/info rows, slider info popovers, and responsive mobile rules.
- `js/physics.js` -> `LVDTPhysics` analytical engine (mutual inductance `VS1`/`VS2`, `tanh` saturation roll-off, frequency response `H(f)`, quadrature residual null phasor, sensitivity, linearity error, and oscilloscope/transfer-curve samplers).
- `js/scene.js` -> `LVDTScene` Three.js r128 CAD renderer (switchable Cutaway vs. Enclosed outer housing, bobbin, copper `P`/`S1`/`S2` coils, sliding Ni-Fe core + push-rod, animated magnetic flux lines/beads, collision-free 100% exploded view, per-layer visibility, `SiliconLayerHighlight` raycasting, 5-step guided tour, and theme lighting).
- `js/plots.js` -> `LVDTPlots` dual high-DPI 2D `<canvas>` renderer for the enlarged AC Oscilloscope (`Vin` vs `Vout`) and Transfer Curve (`Vout` vs `x` with `±5 mm` linear band).
- `js/challenges.js` -> `LVDTChallenges` state machine and live pass/fail evaluator for the 3 Interactive Lab Challenges.
- `js/main.js` -> `LVDTApp` controller wiring tab switching, slider/toggle controls, Housing View (`cutaway` | `enclosed`), layer Eye/Info actions, slider Info popovers, guided tour playback, telemetry updates, and Industry presets.
- `README.md` -> Governing equations, material constants, and guided tour overview.

## Key Symbols

- **Physics (`js/physics.js`):** `LVDTPhysics.CONSTANTS`, `LVDTPhysics.frequencyResponse`, `LVDTPhysics.effectiveDisplacement`, `LVDTPhysics.computeState`, `LVDTPhysics.sampleTransferCurve`, `LVDTPhysics.sampleOscilloscope`.
- **3D Scene (`js/scene.js`):** `LVDTScene.init`, `LVDTScene.updateState`, `LVDTScene.setExplode`, `LVDTScene.setHousingView`, `LVDTScene.setLayerVisible`, `LVDTScene.getLayerVisible`, `LVDTScene.highlightLayer`, `LVDTScene.clearHighlight`, `LVDTScene.applyTourStep`, `LVDTScene.resetCamera`, `LVDTScene.applySceneTheme`, `LVDTScene.TOUR_STEPS`, `LVDTScene.PARTS_INFO`.
- **2D Plots (`js/plots.js`):** `LVDTPlots.init`, `LVDTPlots.render`, `LVDTPlots.renderOscilloscope`, `LVDTPlots.renderTransferCurve`, `LVDTPlots.resize`.
- **Challenges (`js/challenges.js`):** `LVDTChallenges.CHALLENGES`, `LVDTChallenges.evaluate`, `LVDTChallenges.getProgress`.
- **Controller (`js/main.js`):** `LVDTApp.switchTab`, `LVDTApp.applyPreset`, `LVDTApp.startTour`, `LVDTApp.stopTour`, `LVDTApp.selectLayer`, `LVDTApp.toggleLayerVisibility`, `LVDTApp.setHousingView`, `LVDTApp.openSliderInfo`, `LVDTApp.openLayerInfo`, `LVDTApp.closeInfoPopover`, `LVDTApp.resetAll`.

## Rules / Gotchas

- **Zero-Build `file://` Compatibility:** All scripts use classic IIFE globals (`window.LVDTPhysics`, `window.LVDTScene`, `window.LVDTPlots`, `window.LVDTChallenges`, `window.LVDTApp`) with no ES module `import`, no Babel XHR, and no external LaTeX renderer (pure HTML/Unicode math only).
- **Cutaway vs. Enclosed Housing & Transparency:** `housingCutawayGroup` (`transparent: true, depthWrite: false, renderOrder: 3`) and `housingEnclosedGroup` (opaque 360° metallic cylinder + sealed end-caps) share `userData.layerId = 'housing'` and respect both `setHousingView` and `setLayerVisible('housing', ...)`.
- **Collision-Free Exploded View:** `core` and `pushrod` carry separate `explodeOffset` vectors inside `moverGroup` so all 7 CAD parts separate with zero overlap at 100% explode across the entire `x ∈ [-10, +10] mm` stroke.
- **Sign & Phase Convention:** `x < 0` couples more flux to `S1` (`VS1 > VS2`, `φ = 0°`); `x > 0` couples more flux to `S2` (`VS2 > VS1`, `φ = 180°`). `vOutRms` is always non-negative (`+2.00 Vrms` at `x = +4.00 mm, Vp = 5.0 V`), while `vOutDemodDc` is signed (`-` for `x < 0`, `+` for `x > 0`).
