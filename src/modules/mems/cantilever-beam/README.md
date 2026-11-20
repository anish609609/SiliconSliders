# Micro-Cantilever Beam Resonator — MEMS Sensor Specification

An interactive 3D electromechanical simulation and design specification for a **Micro-Cantilever Beam Resonator**, engineered for the [Silicon Sliders](https://github.com/anish609609/SiliconSliders) MEMS Sensors pillar.

Models dynamic mechanical deflection, proof-mass frequency tuning, stress distributions, and thermal-mechanical Brownian noise limits across micro-machined silicon cantilever structures used in **Atomic Force Microscopy (AFM)**, mass spectrometers, and biochemical resonance sensors.

---

## 🌟 Highlights & Key Features

### 🔬 1. Euler-Bernoulli Continuum Mechanics
- **Geometric Parameter Sliders:** Real-time manipulation of length ($L = 50 - 500\,\mu\text{m}$), width ($W = 10 - 50\,\mu\text{m}$), thickness ($t = 0.5 - 5\,\mu\text{m}$), and tip proof-mass ($M_{tip} = 0 - 50\,\text{ng}$).
- **Spring Constant Scaling ($k \propto t^3 / L^3$):** Demonstrates cubic stiffness scaling and the dramatic impact of wafer thickness variations on micro-resonators.
- **Dynamic Mode Shapes:** Visualizes the fundamental bending mode shape $w(x)$ under static tip load and harmonic oscillation.

### ⚡ 2. Resonant Frequency Tuning ($f_0$)
- **Fundamental Resonance Calculation:**
  $$f_0 = \frac{1}{2\pi} \sqrt{\frac{k}{m_{eff}}}$$
- **Dynamic Mass Partitioning:** Automatically calculates distributed beam mass ($m_{beam} = \rho \cdot W \cdot t \cdot L$) and tip load to compute the Rayleigh-Ritz effective mass $m_{eff} \approx 0.24\,m_{beam} + M_{tip}$.
- **Mass Detection Sensitivity ($\Delta f / \Delta m$):** Live readout of frequency shift per femtogram ($10^{-15}\,\text{g}$) of adsorbed chemical or viral payload at the beam tip.

### 📍 3. Stress Distribution & Piezoresistive Readout
- **Bending Moment Gradient:** Demonstrates that axial surface stress $\sigma_x(x)$ reaches its maximum directly at the clamped anchor ($x = 0$):
  $$\sigma_{max} = \frac{6 F L}{W t^2}$$
- Explains why silicon piezoresistors ($p$-type diffusion lines configured in a Wheatstone bridge) are strategically placed at the clamped root rather than along the free cantilever arm.

---

## 📐 Mathematical Derivations & Mechanics

### 1. Beam Deflection Differential Equation
Under standard Euler-Bernoulli beam theory (neglecting rotary inertia and shear deformation for slender beams where $L / t > 10$):
$$E I \frac{d^4 w(x)}{dx^4} = q(x)$$

For a rectangular beam cross-section:
- **Area Moment of Inertia ($I$):**
  $$I = \frac{W \cdot t^3}{12}$$

Under a static point force $F$ applied at the free tip ($x = L$), the boundary conditions are:
- Clamped anchor at $x = 0$: $w(0) = 0, \quad w'(0) = 0$
- Free end at $x = L$: $w''(L) = 0, \quad E I w'''(L) = -F$

Integrating gives the deflection profile:
$$w(x) = \frac{F}{6 E I} \left(3 L x^2 - x^3\right)$$

Maximum tip deflection ($x = L$):
$$w_{max} = \frac{F L^3}{3 E I} = \frac{4 F L^3}{E W t^3}$$

### 2. Tip Spring Constant ($k$)
The mechanical spring stiffness at the cantilever tip is:
$$k = \frac{F}{w_{max}} = \frac{E \cdot W \cdot t^3}{4 L^3}$$

### 3. Dynamic Resonant Frequency & Rayleigh-Ritz Method
Using the kinetic energy equivalence of a vibrating beam in its fundamental mode, the effective lumped mass is:
$$m_{eff} = \int_0^L \rho W t \left(\frac{w(x)}{w_{max}}\right)^2 dx = \frac{33}{140} m_{beam} \approx 0.243 \cdot m_{beam}$$

Adding an external proof-mass $M_{tip}$ at the tip:
$$f_0 = \frac{1}{2\pi} \sqrt{\frac{k}{0.243 \cdot m_{beam} + M_{tip}}}$$

### 4. Thermal-Mechanical Brownian Noise Limit
The minimum detectable force in a detection bandwidth $B$ limited by Johnson-Nyquist thermal fluctuations is:
$$F_{min} = \sqrt{\frac{4 k_B T k B}{\omega_0 Q}}$$

Where $Q$ is the quality factor and $\omega_0 = 2\pi f_0$.

---

## 🏗️ Typical MEMS Fabrication Sequence (Bulk / Surface Micromachining)

| Step | Fabrication Stage | Materials / Tooling | Function |
| :---: | :--- | :--- | :--- |
| **1** | **Starting Substrate** | Silicon-On-Insulator (SOI) Wafer | $2\,\mu\text{m}$ single-crystal Si device layer on $1\,\mu\text{m}$ buried oxide (BOX). |
| **2** | **Piezoresistor Doping** | Boron Ion Implantation ($B^+$) | Forms high-gauge-factor piezoresistive traces at the cantilever anchor. |
| **3** | **Metallization** | Sputtered Al / TiW / Au | Electrical interconnect pads for Wheatstone bridge wirebonding. |
| **4** | **Cantilever Outline Etch** | Deep Reactive Ion Etching (Bosch DRIE) | Anisotropic vertical etch through the device layer defining beam $L$ and $W$. |
| **5** | **Sacrificial Release** | Vapor Hydrofluoric Acid (Vapor HF) | Isotropic etch of the underlying BOX oxide to freely suspend the beam without capillary stiction. |

---

## 📊 Default Geometric & Material Parameters

| Parameter | Symbol | Default Value | Tuning Range | Units |
| :--- | :---: | :---: | :---: | :---: |
| **Beam Length** | $L$ | `200` | $50 - 500$ | $\mu\text{m}$ |
| **Beam Width** | $W$ | `30` | $10 - 60$ | $\mu\text{m}$ |
| **Beam Thickness** | $t$ | `2.0` | $0.5 - 5.0$ | $\mu\text{m}$ |
| **Tip Proof-Mass** | $M_{tip}$ | `0.0` | $0.0 - 50.0$ | $\text{ng}$ |
| **Silicon Density** | $\rho$ | `2330` | Fixed | $\text{kg/m}^3$ |
| **Young's Modulus** | $E$ | `169` | Fixed ($\text{Si}\langle 110 \rangle$) | $\text{GPa}$ |

---

## 📄 License & Attribution

Part of the **Silicon Sliders** platform under the [MIT License](../../../LICENSE).  
Developed by **Raydurg Anish** ([Portfolio](https://raydurg-anish-portfolio-amta50oot-anish609609s-projects.vercel.app/) · [GitHub](https://github.com/anish609609)).
