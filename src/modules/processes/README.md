# Pillar 2: Semiconductor Process Engineering

Welcome to the **Semiconductor Process Engineering** pillar of **Silicon Sliders**.

Fabricating microelectronics requires mastering physical chemistry, thermodynamics, plasma kinetics, and high-vacuum transport. This pillar provides interactive, mathematically accurate simulations of fab unit processes, connecting textbook physical models to the operational decisions made on real foundry floors.

---

## 🏛️ The Mandatory 3-Stage Process Module Template

Every process engineering module in Silicon Sliders strictly follows a standardized **3-Stage Template**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     3-STAGE FAB MODULE TEMPLATE                           │
├───────────────────────────────────────────────────────────────────────────┤
│  STAGE 1: THEORY & PHYSICAL DERIVATIONS                                   │
│  • Concise mathematical formulation of governing transport equations      │
│  • Rate constants, Arrhenius activation energies, and physical regimes    │
│  • Boundary conditions and volume expansion/consumption mechanics        │
├───────────────────────────────────────────────────────────────────────────┤
│  STAGE 2: INTERACTIVE SLIDERS & FAB CHALLENGES                            │
│  • Real-time parameter controls (Temperature, Pressure, Gas Flow, Time)   │
│  • Live kinetic plots and dynamic wafer cross-section canvas              │
│  • "Think Like a Fab Engineer" problem scenarios with expert solutions    │
├───────────────────────────────────────────────────────────────────────────┤
│  STAGE 3: INDUSTRY EQUIPMENT & COMMERCIAL FAB TOOLING                     │
│  • Equipment vendors (Tokyo Electron, Applied Materials, ASM, Lam)        │
│  • Tool chamber architectures (Vertical Batch vs. Single-Wafer RTP)       │
│  • Critical subsystems (Load locks, MFCs, SiC boats, in-situ pyrometry)   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Active & Planned Process Modules

| Process Module | Status | Governing Physics / Model | Links |
| :--- | :---: | :--- | :--- |
| **Thermal Oxidation** | `Active` | Deal-Grove Kinetic Model · Dry vs. Wet Steam · Si Consumption | [Launch Simulator](oxidation/index.html) · [Module Spec](oxidation/README.md) |
| **Plasma & RIE Etching** | `In Dev` | Reactive Ion Etching (RIE) · Anisotropy · Bosch DRIE | *Coming Soon* |
| **Thin-Film PVD / Sputtering** | `In Dev` | Magnetron Sputtering · Step Coverage · Mean Free Path | *Coming Soon* |
| **Chemical Vapor Deposition (CVD/ALD)** | `Roadmap` | Self-Limiting Precursor Saturation · High-Aspect Trenches | *Roadmap* |
| **Ion Implantation & Annealing** | `Roadmap` | Pearson IV Distribution · Projected Range ($R_p$) · RTA | *Roadmap* |
| **Chemical Mechanical Planarization (CMP)** | `Roadmap` | Preston's Law · Slurry Chemistry · Dielectric Erosion | *Roadmap* |

---

## 🔬 Standards for Contributing a Process Module

When developing a new unit process module for this pillar:
1. **Mathematical Accuracy:** Formulas must implement verified literature models (e.g., Deal-Grove for oxidation, Preston's equation for CMP, Langmuir adsorption isotherms for ALD).
2. **Interactive Telemetry:** The interface must update outputs in real time as the user drags sliders. Never require a manual page reload.
3. **Fab Engineer Prompts:** Include at least three practical engineering trade-off scenarios under the *"Think Like a Fab Engineer"* section (e.g., thermal budget limits, selectivity trade-offs, defect suppression).
4. **Industry Tooling:** Accurately cite current foundry tooling platforms used in 300 mm and 200 mm volume manufacturing.

---

## 🧭 Mandatory 3-Stage Interactive Guided Tour

Every Process Engineering Lab module must integrate the shared zero-build Guided Tour (`src/shared/css/guided-tour.css` + `src/shared/js/guided-tour.js`) using this standardized 3-stage onboarding flow:

- **Top-Right `? Tour` Navbar Button:** Place `<button id="btn-guided-tour" class="tbtn-guided-tour">...</button>` directly beside the Light/Dark theme toggle button in `<header>`.
- **First-Visit Persistence:** Use `storageKey: 'siliconsliders_process_tour_seen'` so first-time visitors see the tour automatically and returning users can relaunch it anytime via `? Tour`.
- **Standard 4-Step Flow (`Theory` → `Sliders` → `Industry`):**
  1. **Step 1 — Theory Tab:** Switch to `theory` and spotlight the Theory tab button (`Theory`), introducing the origin story, physical kinetics, and governing equations.
  2. **Step 2 — Sliders: Chamber Controls & Parameter Correspondence:** Switch to `sliders`, spotlight the parameter sidebar (`data-tour-peek-zone`), and render a compact `.ss-tour-corr-list` **Parameter → Output Correspondence Guide** inside `descriptionHtml` while Peek Mode fades the overlay during slider drags.
  3. **Step 3 — Sliders: Playback & Live Reaction Front:** Spotlight the playback bar + live wafer/chamber reaction canvas so users see how to run the cycle (`▶ PLAY`, speed, timeline scrubber).
  4. **Step 4 — Industry Tab:** Switch to `industry` and spotlight the Industry tab button (`Industry`), highlighting commercial fab tooling, process challenges, and 1-click recipe launch.

### Copy-Paste `SILICON_TOUR_CONFIG` Template

```html
<link rel="stylesheet" href="../../../shared/css/guided-tour.css" />
<script src="../../../shared/js/guided-tour.js"></script>
```

```javascript
window.SILICON_TOUR_CONFIG = {
  storageKey: 'siliconsliders_process_tour_seen',
  readySelector: '#btn-guided-tour',
  peekContainerSelector: '#process-controls-aside, [data-tour-peek-zone]',
  onStop: function () { switchTab('sliders'); },
  steps: [
    {
      id: 'process-theory',
      title: '1. Review Process Theory',
      description: 'Review origin story, physical kinetics, and governing equations before configuring the chamber.',
      selectors: ['#tab-theory'],
      pulseSelector: '#tab-theory',
      beforeEnter: function () { switchTab('theory'); }
    },
    {
      id: 'chamber-controls',
      title: '2. Chamber Controls & Parameters',
      description: 'Adjust chamber parameters and watch outputs react live.',
      descriptionHtml:
        'Test sliders live (Peek Mode fades the overlay while dragging):' +
        '<div class="ss-tour-corr-list">' +
          '<div class="ss-tour-corr-row"><span class="ss-tour-corr-key">Param A</span><span class="ss-tour-corr-arrow">&rarr;</span><span class="ss-tour-corr-val">Primary Output &amp; Rate</span></div>' +
          '<div class="ss-tour-corr-row"><span class="ss-tour-corr-key">Param B</span><span class="ss-tour-corr-arrow">&rarr;</span><span class="ss-tour-corr-val">Uniformity / Defect Metric</span></div>' +
        '</div>',
      selectors: ['#process-controls-aside'],
      pulseSelector: '#tab-sliders',
      beforeEnter: function () { switchTab('sliders'); }
    },
    {
      id: 'playback-reaction',
      title: '3. Playback & Live Reaction Front',
      description: 'Run the thermal/plasma cycle with PLAY, speed controls, and timeline scrubber.',
      targets: [['#playback-bar'], ['#wafer-cross-section']],
      pulseSelector: '#tab-sliders',
      beforeEnter: function () { switchTab('sliders'); }
    },
    {
      id: 'process-industry',
      title: '4. Commercial Fab Tooling & Industry',
      description: 'Explore real-world foundry tools, challenges, and 1-click recipe presets.',
      selectors: ['#tab-industry'],
      pulseSelector: '#tab-industry',
      beforeEnter: function () { switchTab('industry'); }
    }
  ]
};
```
