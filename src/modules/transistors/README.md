# Pillar 1: Transistor Structures & Base Circuits

Welcome to the **Transistors & Base Circuits** pillar of **Silicon Sliders**.

This pillar focuses on translating abstract circuit schematics and textbook 2D cross-sections into **full physical 3D CAD standard cells**. By inspecting actual geometric layouts—including substrate wells, halo/LDD extensions, high-K metal gate stacks, tungsten contacts, and metal routing—students and engineers gain true layout-versus-schematic (LVS) intuition.

---

## 📦 Active & Planned Modules

| Module | Status | Technology / Topology | Links |
| :--- | :---: | :--- | :--- |
| **CMOS Inverter** | `Active` | Planar Bulk CMOS · HKMG ($HfO_2 / SiO_2$) · SDE/LDD | [Launch 3D](cmos-inverter/index.html) · [Module Spec](cmos-inverter/README.md) |
| **CMOS 2-Input NAND** | `Active` | Euler-Path Dual Gate · Uncontacted Series $N^+$ Bridge | [Launch 3D](cmos-nand/index.html) · [Module Spec](cmos-nand/README.md) |
| **3D FinFET (Tri-Gate)** | `In Dev` | Non-Planar Tri-Gate · Sub-16nm Channel Electrostatics | *Coming Soon* |
| **GAAFET (Nanosheet)** | `Roadmap` | Vertically Stacked Nanosheets · Sub-3nm Technology | *Roadmap* |
| **CMOS 2-Input NOR** | `Roadmap` | Parallel NMOS Pull-Down · Series PMOS Pull-Up | *Roadmap* |
| **6T SRAM Cell** | `Roadmap` | Cross-Coupled Inverter Pair · Wordline Pass Transistors | *Roadmap* |

---

## 📐 Standard Engineering & Documentation Template

All transistor modules in Silicon Sliders must adhere to the following standard architectural conventions:

### 1. Mead–Conway Scalable Lambda ($\lambda$) Rules
Dimensions are defined relative to a scalable parameter $\lambda$ (where channel length $L_{min} = 2\lambda$). Selecting a process node ($1000\,\text{nm} \rightarrow 16\,\text{nm}$) dynamically computes real physical nanometer readouts:

| Parameter | Symbol | Standard Rule | Description |
| :--- | :---: | :---: | :--- |
| **Gate Length** | $L$ | $2\lambda$ | Minimum gate length along channel direction |
| **PMOS Width** | $W_p$ | $6\lambda - 8\lambda$ | Sized larger to compensate for hole mobility ($\mu_h \approx \frac{1}{2} \mu_e$) |
| **NMOS Width** | $W_n$ | $3\lambda - 4\lambda$ | Sized for electron mobility balance |
| **Contact Plug Cut** | $W_{cut}$ | $2\lambda \times 2\lambda$ | Square tungsten via footprint |
| **Metal-1 Width** | $W_{m1}$ | $3\lambda$ | Minimum metal interconnect rail width |
| **Poly Overhang** | $L_{ext}$ | $2\lambda$ | Polysilicon endcap extension beyond active diffusion |

### 2. Standard Physical Stack
Every 3D transistor layout is constructed using an authentic 8-layer lithography stack:
1. **$P$-Substrate / Wafer Base:** Lightly boron-doped silicon base ($N_A \approx 10^{15}\,\text{cm}^{-3}$).
2. **Retrograde Wells:** Deep N-Well for PMOS ($N_D \approx 10^{17}\,\text{cm}^{-3}$) and P-Well for NMOS.
3. **Active Diffusion & SDE / LDD:** Heavy $N^+ / P^+$ source/drain diffusion regions flanked by shallow, lightly doped drain extensions to suppress Drain-Induced Barrier Lowering (DIBL).
4. **Interfacial Oxide Layer:** Thermally grown interfacial $SiO_2$ ($\sim 0.7 - 1.2\,\text{nm}$).
5. **High-K Gate Dielectric:** Atomic Layer Deposited (ALD) $HfO_2$ ($\kappa \approx 22$) to boost $C_{ox} = \frac{\kappa \varepsilon_0}{t_{ox}}$ and halt quantum tunneling leakage.
6. **Polysilicon / Metal Gate:** Heavily doped continuous polysilicon gate runner.
7. **Tungsten Contacts ($W$):** Vertical plugs with diffusion barrier liners (Ti/TiN) connecting active silicon and poly to metallization.
8. **Metal-1 Routing:** Low-resistance planar tracks for $V_{DD}$, $GND$, Inputs, and Outputs.

### 3. Interactive Logic State & Carrier Simulation
- **Logic State Engine:** Inputs ($0$, $1$, and floating `OFF`) dynamically toggle transistor states (Conducting vs. Cutoff/Leakage).
- **Dual Flow Modes:** Toggle between **Conventional Current** (positive charge direction) and **Electron Flow** (true physical carrier motion) with animated particle curves along conducting paths.
- **Schematic Cross-Probing:** 2D circuit schematic view where clicking any MOSFET or net cross-highlights its 3D counterpart in the layout viewport.

### 4. Step-by-Step 3D Fabrication Tour
Each module includes an automated `[▶ PLAY TOUR]` feature animating the layer-by-layer deposition and lithography sequence from bare wafer substrate to top metallization, with synchronized Sarvam AI voice narration.

---

## 💡 Adding a New Transistor Module
When adding a new logic cell:
1. Copy the structure of `cmos-inverter/` or `cmos-nand/`.
2. Define the Euler path for minimal diffusion breaks.
3. Implement 3D geometries in `js/geometry.js` and register component metadata in `js/data.js`.
4. Ensure full responsive support for the EDA dark/light theme engine.
