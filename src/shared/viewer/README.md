# Shared 3D CAD Viewer Architecture (`src/shared/viewer/`)

The **Shared Viewer** architecture extracts common CAD controls, UI panels, theme management, and 3D camera utilities so future semiconductor devices (FinFETs, GAAFETs, transmission gates) plug in without duplicating boilerplate code.

---

## 🏛️ Shared Modules & Subsystems

```text
src/shared/viewer/
├── css/
│   └── viewer-shell.css      # Unified high-contrast styling for topbars, HUDs, drawers & λ tables
└── js/
    ├── viewer-theme.js       # Light / Dark mode sync between landing page & 3D viewers
    ├── viewer-topbar.js      # Layout/Schematic mode, Carrier flow, Reset & dynamic input segs
    ├── viewer-panels.js      # Layer Visibility, Legend, λ design-rules table & collapsible drawers
    └── viewer-core.js        # SiliconViewer central coordinator and module configuration loader
```

---

## ⚙️ Data-Driven Module Configuration

Each new transistor cell exports a pure JavaScript configuration object to `SiliconViewer.init(config)`.

### Example Module Configuration

```javascript
SiliconViewer.init({
  moduleId: 'cmos-inverter',
  title: 'CMOS Inverter',
  subtitle: 'inverter / rev 01',

  // 1. Dynamic Topbar Logic Inputs
  inputs: [
    {
      id: 'in',
      label: 'IN =',
      options: ['0', '1', 'off'],
      default: 'off'
    }
  ],

  // 2. Mead–Conway λ Presets & Dimension Rules
  defaultLambda: 90,
  lambdaPresets: [
    { label: 'λ = 1000 nm (legacy 2 µm process)', nm: 1000 },
    { label: 'λ = 350 nm (0.35 µm process)', nm: 350 },
    { label: 'λ = 130 nm (0.13 µm process)', nm: 130 },
    { label: 'λ = 90 nm (default)', nm: 90 },
    { label: 'λ = 45 nm', nm: 45 },
    { label: 'λ = 16 nm (illustrative)', nm: 16 }
  ],
  dimRules: [
    { key: 'gateLength', label: 'Gate length (L)', lambda: 2 },
    { key: 'gateWidth',  label: 'Gate width (W)',  lambda: 6 },
    { key: 'sdLength',    label: 'Source/Drain length', lambda: 3 }
  ],

  // 3. Layer Legend & Visibility Definitions
  legend: [
    { id: 'substrate', name: 'P-Substrate', color: '#475569' },
    { id: 'well',      name: 'N-Well',      color: '#059669' },
    { id: 'active',    name: 'Active S/D',  color: '#d97706' },
    { id: 'poly',      name: 'Polysilicon', color: '#dc2626' },
    { id: 'metal',     name: 'Metal-1',     color: '#2563eb' }
  ],

  // 4. Lifecycle Callbacks
  onInputChange: function (inputId, value) {
    // Update circuit logic state & carrier flow animations
    setLogicInput(inputId, value);
  },
  onViewModeChange: function (mode) {
    // Toggle 3D Physical Layout vs. 2D SVG Schematic
    toggleSchematic(mode === 'schematic');
  },
  onFlowChange: function (flowMode) {
    // Toggle conventional current vs. electron flow
    updateCarrierFlowMode(flowMode);
  },
  onResetCamera: function () {
    // Reset OrbitControls and camera target
    resetViewportCamera();
  }
});
```

---

## 🎨 Theme Synchronization

Theme state (`dark` or `light`) is stored in `localStorage` under `silicon_sliders_theme` (with backward-compatible mirrored keys `cmos_viewer_theme` and `cmos_nand_viewer_theme`).
When a user switches themes on the **Silicon Sliders Landing Page**, all sub-modules automatically inherit the selected theme upon loading.
