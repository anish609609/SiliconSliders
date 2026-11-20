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
