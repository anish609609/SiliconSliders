# Pillar 3: MEMS Sensors & Micro-Actuators

Welcome to the **MEMS Sensors** pillar of **Silicon Sliders**.

Micro-Electro-Mechanical Systems (MEMS) merge semiconductor micromachining (surface and bulk silicon etching, sacrificial oxide release) with classical continuum mechanics, electrostatics, and solid-state sensing. This pillar provides interactive 3D visualizations and parameter sliders to explore the mechanical and electrical dynamics of micro-sensors.

---

## 📦 Active & Planned MEMS Modules

| Sensor Module | Status | Physical Principle | Links |
| :--- | :---: | :--- | :--- |
| **Micro-Cantilever Beam Resonator** | `Upcoming / Spec` | Euler-Bernoulli Mechanics · Tip Mass Tuning · AFM Resonator | [Module Spec](cantilever-beam/README.md) |
| **Capacitive Comb-Drive Accelerometer** | `Roadmap` | Folded-Beam Suspension · Differential Capacitive Sensing | *Roadmap* |
| **Tuning Fork Micro-Gyroscope** | `Roadmap` | Coriolis Force Coupling · Drive/Sense Resonance Matching | *Roadmap* |
| **Piezoelectric Pressure Sensor** | `Roadmap` | Silicon Diaphragm Deflection · Piezoresistive Wheatstone Bridge | *Roadmap* |

---

## 📐 Electromechanical Physics & Modeling Standards

All MEMS modules in Silicon Sliders are built upon rigorous continuum mechanics and electrostatic principles:

### 1. Spring Constant & Elastic Deflection
For beam-based structures under small-deflection continuum mechanics:
- **Cantilever Beam (Point Load at Tip):**
  $$k = \frac{E \cdot W \cdot t^3}{4 L^3}$$
- **Fixed-Fixed Guided Beam (Clamped-Clamped):**
  $$k = \frac{16 E \cdot W \cdot t^3}{L^3}$$
Where:
- $E$: Young's Modulus of the material ($\sim 169\,\text{GPa}$ for single-crystal $\text{Si}\langle 110 \rangle$, $\sim 160\,\text{GPa}$ for LPCVD polysilicon).
- $W$: Beam width.
- $t$: Beam thickness in the direction of bending.
- $L$: Beam length.

### 2. Resonant Frequency & Effective Mass
The fundamental undamped natural frequency of the micro-resonator is:
$$f_0 = \frac{1}{2\pi} \sqrt{\frac{k}{m_{eff}}}$$

Where the effective dynamic mass $m_{eff}$ accounts for distributed beam mass ($m_{beam} = \rho \cdot W \cdot t \cdot L$) and any added tip proof-mass ($M_{tip}$):
$$m_{eff} \approx 0.24 \cdot m_{beam} + M_{tip}$$

### 3. Quality Factor & Damping
- In high vacuum ($P < 10^{-3}\,\text{Torr}$), internal anchor loss and thermoelastic dissipation dominate ($Q > 50,000$).
- At atmospheric pressure ($1\,\text{atm}$), squeeze-film and viscous Stokes air drag dramatically reduce the quality factor ($Q \approx 50 - 500$), causing broad resonance peaks and increased thermal-mechanical Brownian noise.

---

## 💡 Contributing a MEMS Sensor Module
When building a new MEMS module:
1. Provide dynamic 3D geometry rendered using Three.js (including substrate anchor, suspended proof-mass, and capacitive electrodes).
2. Wire real-time sliders for structural dimensions ($L, W, t$) and applied forces/accelerations.
3. Display real-time frequency response curves ($|X(f)|$ Bode magnitude and phase).
