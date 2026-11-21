# Silicon Sliders — Interactive 3D Semiconductor CAD & Fab Engineering Platform

[![Platform](https://img.shields.io/badge/Platform-Silicon%20Sliders-00e5ff.svg)](index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Zero Build Overhead](https://img.shields.io/badge/Build-Zero%20Bundler%20Overhead-ffcf4d.svg)](index.html)
[![Three.js](https://img.shields.io/badge/3D-Three.js%20r128-a855f7.svg)](https://threejs.org/)

**Silicon Sliders** is an open, tactile 3D educational web platform engineered to bridge the gap between academic microelectronics theory, semiconductor device physics, and real-world semiconductor foundry (fab) engineering.

Instead of studying static 2D cross-sections or isolated SPICE netlists, students and engineers can orbit, explode, slice, simulate, and configure real physical standard-cell geometries, dynamic thermal oxidation chambers, and micro-electromechanical sensors (MEMS).

---

## 🏛️ Platform Architecture: The Three Core Pillars

Silicon Sliders is organized around three foundational pillars of microelectronics:

```
                                  SILICON SLIDERS
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
  1. TRANSISTORS                   2. PROCESSES                      3. MEMS
  & BASE CIRCUITS                  ENGINEERING                       SENSORS
  • CMOS Inverter (Live)           • Deal-Grove Oxidation (Live)    • Micro-Cantilever (Spec)
  • CMOS NAND2 (Live)              • Plasma / RIE Etching (Planned) • Comb-Drive Accelerometer
  • FinFET & GAAFET (Planned)      • PVD & ALD Deposition (Planned) • Micro-Gyroscopes (Planned)
```

1. **Exploring Transistor Structures & Base Circuits (`src/modules/transistors/`)**
   - Interactive 3D physical layouts of standard logic cells (CMOS Inverter, CMOS 2-Input NAND).
   - High-K Metal Gate (HKMG) stacks ($HfO_2 / SiO_2$), lightly doped drain (SDE/LDD) extensions, Gaussian doping tubs, Euler-path polysilicon routing, and Mead–Conway $\lambda$ process-node scaling ($1000\,\text{nm} \rightarrow 16\,\text{nm}$).
   - Integrated with Sarvam AI multilingual voice tutoring (English, Hindi, Telugu).

2. **Semiconductor Process Engineering (`src/modules/processes/`)**
   - Fab unit process simulations starting with **Thermal Oxidation** (Deal-Grove kinetics).
   - Structured around a standardized **3-Stage Template**:
     - **Stage 1 (Theory):** Mathematical derivations and physical governing equations.
     - **Stage 2 (Interactive Sliders & Fab Challenges):** Real-time parameter manipulation (temperature, pressure, gas ambient, crystal orientation) with *"Think Like a Fab Engineer"* scenario challenges.
     - **Stage 3 (Industry Tooling):** Real equipment and furnace architectures manufactured by **Tokyo Electron (TEL)**, **ASM International**, and **Applied Materials (AMAT)**.

3. **MEMS Sensors (`src/modules/mems/`)**
   - Interactive 3D visualizations of micro-electromechanical systems.
   - Modules such as the **Micro-Cantilever Beam Resonator**, dynamically linking mechanical geometry (length, width, thickness, proof-mass) to stiffness, deflection, and resonant frequency ($f_0$).

---

## 📂 Repository Directory Tree

```text
SiliconSliders/
├── index.html                           # Silicon Sliders Homepage (Lightweight Landing Hub)
├── server.js                            # Unified Node.js Server (static file server + Sarvam API proxy)
├── package.json                         # Unified package scripts (npm start, npm dev)
├── README.md                            # Platform Master Documentation (This file)
│
├── src/
│   ├── shared/                          # Reusable styles, tokens, and UI components
│   │   ├── css/
│   │   │   ├── design-tokens.css        # EDA color tokens, typography & glassmorphism
│   │   │   └── home.css                 # Homepage responsive styles & telemetry strip
│   │   └── js/
│   │       └── home.js                  # Homepage interactive telemetry & navigation
│   │
│   └── modules/
│       ├── transistors/                 # Pillar 1: Transistors & Base Circuits
│       │   ├── README.md                # Pillar 1 Guide & Mead-Conway Design Rules
│       │   ├── mosfet/                  # MOSFET Family (Discrete Transistors)
│       │   │   ├── nmos/index.html      # 3D NMOS CAD viewer & physical shell
│       │   │   └── pmos/index.html      # 3D PMOS CAD viewer & physical shell
│       │   └── cmos/                    # CMOS Logic Family (Standard Cells)
│       │       ├── cmos-inverter/       # 3D CMOS Inverter CAD viewer & tour
│       │       │   ├── index.html       # CAD viewport & HUD layout
│       │       │   ├── README.md        # Comprehensive cell documentation
│       │       │   ├── css/style.css    # EDA dark/light theme
│       │       │   ├── js/*.js          # Modular Three.js geometry, logic & voice engine
│       │       │   └── api/voice-assistant.js
│       │       └── cmos-nand/           # 3D CMOS 2-Input NAND CAD viewer & tour
│       │           ├── index.html       # CAD viewport & HUD layout
│       │           ├── README.md        # Comprehensive cell documentation
│       │           ├── css/style.css    # EDA dark/light theme
│       │           ├── js/*.js          # Modular Three.js geometry, logic & voice engine
│       │           └── api/voice-assistant.js
│       │
│       ├── processes/                   # Pillar 2: Semiconductor Process Engineering
│       │   ├── README.md                # Pillar 2 Guide & 3-Stage Process Template
│       │   └── oxidation/               # Deal-Grove Thermal Oxidation Simulator
│       │       ├── index.html           # 3-Stage Interface (Theory, Sliders, Tools)
│       │       ├── README.md            # Deal-Grove derivations & rate constants
│       │       ├── css/style.css        # Furnace & chamber layout styles
│       │       └── js/oxidation.js      # Deal-Grove kinetic solver & canvas graphics
│       │
│       └── mems/                        # Pillar 3: MEMS Sensors
│           ├── README.md                # Pillar 3 Guide & Electromechanical Standards
│           └── cantilever-beam/         # Micro-Cantilever Beam Resonator
│               └── README.md            # Beam mechanics, spring constants & f₀ derivations
│
├── cmos_inverter_CAD/                   # Backward-compatibility alias
└── CMOS_NAND/                           # Backward-compatibility alias
```

---

## 🚀 Getting Started

### Option 1: Direct File Launch (Zero Server Required)
Because Silicon Sliders uses pure standard web technologies without bundlers or build steps, you can open any module directly in any modern browser:
- Double-click `index.html` to launch the Silicon Sliders Homepage.
- Or double-click `src/modules/transistors/cmos/cmos-inverter/index.html` directly off your disk.

### Option 2: Unified Node Server (Recommended)
Running the unified Node server enables the local `/api/voice-assistant` proxy endpoint and automatic `.env` `SARVAM_API_KEY` resolution:

```bash
# 1. Install optional dev dependencies (if any) or launch immediately:
npm start

# 2. Or launch using Node directly:
node server.js
```

Open `http://localhost:3000` in your web browser.

Quick URLs:
- **Homepage:** `http://localhost:3000/`
- **CMOS Inverter:** `http://localhost:3000/inverter`
- **CMOS NAND2:** `http://localhost:3000/nand`
- **Thermal Oxidation:** `http://localhost:3000/oxidation`

---

## 🛠️ Developer Guide: How to Add New Modules

The Silicon Sliders architecture is engineered to make adding new devices, process simulations, and sensors straightforward and modular.

### 1. Adding a New Transistor / Circuit Cell
1. Create a directory: `src/modules/transistors/<your-cell-name>/`
2. Follow the standard CAD module structure:
   - `index.html`: Three.js viewport container, collapsible HUD drawers, logic state toggle.
   - `css/style.css`: Use CSS custom variables from `design-tokens.css` (`--bg-primary`, `--accent-cyan`).
   - `js/geometry.js`: Build parametric 3D meshes adhering to Mead–Conway $\lambda$ rules.
   - `js/logic-state.js`: Define circuit states and dynamic emission/flow paths.
   - `README.md`: Document physical layers, $\lambda$ formulas, and lithography tour sequence.
3. Link the new cell inside `src/modules/transistors/README.md` and on the root `index.html` homepage.

### 2. Adding a New Process Engineering Simulation
1. Create a directory: `src/modules/processes/<process-step-name>/`
2. Implement the mandatory **3-Stage Template**:
   - **Stage 1 (Theory):** Mathematical formulas (e.g., Arrhenius relations, plasma sheath equations, sputtering yield).
   - **Stage 2 (Interactive Sliders & Fab Challenges):** Parameter inputs (RF power, gas pressure, temperature, duration) paired with 3–4 *"Think Like a Fab Engineer"* scenario prompts.
   - **Stage 3 (Industry Tooling):** Commercial fab tool vendors (TEL, Lam Research, Applied Materials, ASM).
3. Document all rate constants and activation energies in `README.md`.
4. Link the module in `src/modules/processes/README.md` and the homepage grid.

### 3. Adding a New MEMS Sensor
1. Create a directory: `src/modules/mems/<sensor-name>/`
2. Define the mechanical governing equations (stiffness tensor, resonant mode shapes, damping coefficient, capacitive sensitivity).
3. Provide interactive sliders for structural geometry and material constants (polysilicon, silicon nitride, quartz).

---

## 📄 License & Attribution

This project is open-source under the [MIT License](LICENSE).
