# Thermal Oxidation Simulator Navigation Map (`src/modules/processes/oxidation/`)

**Purpose:** 3-tab Deal-Grove Thermal Oxidation lab (Theory, Interactive Sliders, Industry Tooling) with Massoud thin-oxide kinetics, CSTR gas switching, wafer cross-section, and time-aligned charts.

## Files

- `index.html` -> Tailwind CDN + React 18 + ReactDOM 18 + `@babel/standalone` bootstrap loading `shared/css/guided-tour.css`, `shared/js/guided-tour.js`, `physics.js`, `canvas-wafer.js`, `charts.js`, and `js/app.js` (`type="text/babel"`).
- `css/style.css` -> Dark/light glassmorphic panels, semantic tour/theme tokens, custom range slider tracks, and split-screen chamber layout.
- `js/physics.js` -> `OxidationPhysics` solving 300-step Deal-Grove + Massoud thin-oxide trajectories, CSTR `C_ox`/`C_n2` flushing, cumulative thermal budget, and wafer slip risk.
- `js/canvas-wafer.js` -> `WaferCanvasRenderer` animating N2 elastic bounces, Fickian oxidant diffusion, 44% Si consumption / 56% upward SiO2 expansion, interface sparks, and 1x–50x zoom.
- `js/charts.js` -> `OxidationCharts` rendering synchronized top (`x_ox(t)` & `T(t)`) and bottom (`N2` & oxidant MFC) DPR canvases with hover/click seek.
- `js/app.js` -> `SimulatorApp` React component managing presets (`PRESETS`), slider info popovers (`SLIDER_INFOS`), `THEORY_SECTION_MAP` deep-links, Fab Challenges, playback loop, and 4-step `SILICON_TOUR_CONFIG` onboarding (`#btn-guided-tour`, `siliconsliders_process_tour_seen`).
- `js/oxidation.js` -> Legacy standalone Deal-Grove canvas prototype (not loaded by `index.html`).
- `README.md` -> Module documentation covering Deal-Grove derivations, rate constants, and 3-stage layout.

## Key Symbols

- **Physics Constants & Trajectory (`physics.js`):** `OxidationPhysics.kB`, `OxidationPhysics.T_IDLE`, `OxidationPhysics.solveOxidationTrajectory`.
- **Physics Helpers (`physics.js`):** `OxidationPhysics.interpolateState`, `OxidationPhysics.getChemConfig` (`'dry'`, `'wet'`, `'issg'`).
- **Wafer Canvas (`canvas-wafer.js`):** `WaferCanvasRenderer`, `initEvents`, `initParticles`, `getWaferColor`, `getVisualHeight`, `render`.
- **Wafer Zoom Controls (`canvas-wafer.js`):** `setZoomLevel`, `zoomIn`, `zoomOut`, `resetZoom` (wheel and preset steps `1x` to `50x`).
- **Dual Charts (`charts.js`):** `OxidationCharts`, `initEvents`, `render`, `renderCurrent`, `drawChartGridAndStages`.
- **Chart Sub-Renderers & Seek (`charts.js`):** `renderTopChart`, `renderBottomChart`, `setHoverTime`, `clearHover`.
- **React Workspace (`app.js`):** `SimulatorApp` (tabs `'theory'`, `'sliders'`, `'industry'`), `PRESETS` (`gate`, `field`, `issg`, `rto`).
- **Workspace Handlers (`app.js`):** `handleApplyPreset`, `handleTogglePlay`, `handleSeek`, `handleZoomIn`, `handleZoomOut`, `handleResetZoom`, `toggleTheme`.
- **Theory & Challenge Navigation (`app.js`):** `handleRunInSliders`, `handleDiveDeep`, `SLIDER_INFOS`, `THEORY_SECTION_MAP`, `InfoGlyph`.
- **Parameter Formatters (`app.js`):** `pressureToSliderVal`, `sliderValToPressure`, `formatPressure`, `LOG_MIN`, `LOG_MAX`.
- **Playback & Shortcuts (`app.js`):** `loop` (`requestAnimationFrame` time advance), `handleKeyDown`, `onStorage` (cross-tab theme listener).
- **Chemistry Color Tokens (`physics.js` / `canvas-wafer.js`):** `dry` (`#22d3ee`), `wet` (`#10b981`), `issg` (`#c084fc`) via `getChemConfig`.
- **Chart Margin Layout (`charts.js`):** Fixed margins (`left: 58`, `right: 58`, `top: 22`, `bottom: 24`) align time axes across top and bottom canvases.

## Rules / Gotchas

- **Active vs. Legacy JS:** `index.html` loads `physics.js`, `canvas-wafer.js`, `charts.js`, and `app.js` (Babel JSX). `oxidation.js` is legacy and unused—edit `app.js` and `physics.js` for simulator changes.
- **Babel Browser Compilation:** `app.js` is compiled in-browser by `@babel/standalone` via XHR. Always run through `npm start` over HTTP (never `file://`), and stick to ES5-friendly `var` + React hooks (`React.useState`, etc.) + JSX.
- **Volumetric Partitioning Invariant:** Both `physics.js` (`x_si`, `x_up`) and `canvas-wafer.js` enforce `0.44 * x_ox` silicon substrate consumption and `0.56 * x_ox` upward SiO2 expansion relative to the original Si datum.
- **Log Pressure Slider & Theme Sync:** Pressure maps logarithmically (`0.005`–`20.0` atm) via `pressureToSliderVal`/`sliderValToPressure`; theme sync toggles the `dark` class and `data-theme` attribute across `silicon_sliders_theme`, `cmos_viewer_theme`, and `cmos_nand_viewer_theme`.
- **CSTR & Slip Thresholds:** `physics.js` switches flush time `tau_flush` to `0.15` min for `issg` or `rampRate > 20` C/min (otherwise `2.0` min), and flags `Elevated` above `12` C/min or `High Slip Risk` above `25` C/min.
- **Orientation Multiplier:** `<111>` wafers scale linear rate `B/A` by `1.68` in `solveOxidationTrajectory` while leaving parabolic diffusion constant `B` unchanged.
- **Standalone Non-Three Module:** Unlike the 3D CAD viewers, Oxidation uses 2D Canvas + React 18 + Tailwind CDN and does not import `src/shared/viewer/`.
