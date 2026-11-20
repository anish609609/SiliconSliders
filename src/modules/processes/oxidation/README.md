# Thermal Oxidation — Semiconductor Process Engineering CAD Lab

An interactive, physically accurate semiconductor fabrication process simulator for **Silicon Thermal Oxidation** based on the classical **Deal-Grove Kinetic Model**, built with pure standard web technologies for the [Silicon Sliders](https://github.com/anish609609/SiliconSliders) educational platform.

Simulates the thermal conversion of crystalline silicon into high-purity silicon dioxide ($\text{SiO}_2$) inside a high-temperature quartz diffusion furnace, dynamically calculating linear and parabolic kinetic regimes, Arrhenius rate constants, dynamic wafer volume partitioning ($0.44\,\text{Si}$ consumed vs. $0.56\,\text{SiO}_2$ expansion), and orientation enhancements.

---

## 🌟 Highlights & Key Features

### 🔬 1. Complete Deal-Grove Physical Kinetics Engine
- **Full Kinetic Implementation:** Implements the classic Deal-Grove relationship:
  $$x_o^2 + A x_o = B(t + \tau)$$
- **Dynamic Regime Differentiation:** Real-time classification between **Linear (Reaction-Rate Limited)** for thin layers ($x_o \ll A/2$) and **Parabolic (Diffusion Limited)** for thicker oxide barriers ($x_o \gg A/2$).
- **Arrhenius Thermal Scaling:** Rate constants $B$ and $B/A$ scale with absolute furnace temperature ($T_K = T_C + 273.15\,\text{K}$) following empirical activation energies:
  $$B = B_0 \exp\left(-\frac{E_{a,B}}{k_B T}\right), \quad \frac{B}{A} = \left(\frac{B}{A}\right)_0 \exp\left(-\frac{E_{a,l}}{k_B T}\right)$$
- **Ambient Flexibility:** Instant switching between **Dry Oxygen ($\text{O}_2$)** for high-quality gate dielectrics and **Wet Steam ($\text{H}_2\text{O}$)** for high-throughput field and masking oxides.
- **Wafer Crystal Orientation Scaling:** Supports $\langle 100 \rangle$ and $\langle 111 \rangle$ silicon substrates, accounting for the $+68\%$ increase in surface silicon reaction site density on the $\langle 111 \rangle$ lattice plane.

### 📊 2. Real-Time Furnace & Kinetic Visualizers
- **Dynamic Chamber Cross-Section:** Animated HTML5 canvas displaying the glowing quartz furnace environment, floating oxidant molecules with velocity vectors, and a moving silicon boundary showing oxide expanding above and consuming below the initial substrate surface.
- **Deal-Grove $x_{ox}(t)$ Growth Trajectory:** Live plotting of the continuous oxide growth curve over $0 - 300\,\text{minutes}$, marked with a glowing operating point indicator at the user's active slider settings.

### ⚡ 3. "Think Like a Fab Engineer" Problem Challenges
- **Real-World Scenarios:** Interactive troubleshooting cases covering:
  - **Gate Dielectric Integrity:** Why dry oxidation at $850^\circ\text{C}$ is strictly mandated over steam for gate oxide trap density ($D_{it} < 10^{10}\,\text{cm}^{-2}\text{eV}^{-1}$).
  - **Thermal Budget Management:** Preventing lateral source/drain dopant profile redistribution ($D \cdot t$) in sub-micron transistors.
  - **3D FinFET Sidewall Growth:** Addressing non-uniform oxide growth caused by $\langle 100 \rangle$ top plane vs. $\langle 110 \rangle$ vertical fin sidewalls.
  - **High-Pressure Oxidation (HIPOX):** Utilizing high pressure ($10 - 25\,\text{atm}$) to lower temperature and conserve dopant boundaries.

### 🏭 4. Commercial Foundry Tooling Context
- Detailed architectural overviews of commercial production equipment manufactured by **Tokyo Electron (TEL)**, **ASM International**, **Applied Materials (AMAT)**, and **Centrotherm**.

---

## 🛠️ Getting Started

### Option 1: Direct File Launch (No Server Required)
Double-click `index.html` or drag it into Chrome, Edge, Safari, or Firefox.

### Option 2: Unified Platform Server
From the root repository directory:
```bash
npm start
# or
node server.js
```
Open `http://localhost:3000/oxidation` in your browser.

---

## 🏗️ Thermal Oxidation Furnace Cycle Stages

A commercial diffusion furnace recipe follows an automated multi-step temperature and gas program:

| Step | Cycle Phase | Temperature | Ambient | Description |
| :---: | :--- | :---: | :---: | :--- |
| **1** | **Wafer Load** | $600^\circ\text{C} - 700^\circ\text{C}$ | Pure $\text{N}_2$ | Wafers transferred into quartz tube at idling temperature to avoid thermal shock. |
| **2** | **Temperature Ramp-Up** | $\rightarrow 1000^\circ\text{C}$ ($10^\circ\text{C}/\text{min}$) | $\text{N}_2 + 1\%\,\text{O}_2$ | Controlled heating preventing slip dislocations in large 300 mm silicon wafers. |
| **3** | **Oxidation Dwell** | $850^\circ\text{C} - 1100^\circ\text{C}$ | Dry $\text{O}_2$ or Steam | Thermal reaction converting silicon to $\text{SiO}_2$ according to Deal-Grove kinetics. |
| **4** | **In-Situ Post-Anneal** | Furnace Temp | Ultra-pure $\text{N}_2$ / $\text{Ar}$ | Neutral anneal to heal oxygen vacancies and reduce fixed oxide charge ($Q_f$). |
| **5** | **Temperature Ramp-Down** | $\rightarrow 600^\circ\text{C}$ ($5^\circ\text{C}/\text{min}$) | Pure $\text{N}_2$ | Controlled slow cooling to avoid wafer warpage before unloading into the load lock. |

---

## 📂 Project Architecture

```text
oxidation/
├── index.html                  # 3-Stage interface: Theory -> Sliders & Challenges -> Industry
├── README.md                   # Comprehensive physics derivations & rate constants
├── css/
│   └── style.css               # Furnace layout, telemetry cards & EDA styling
└── js/
    └── oxidation.js            # Deal-Grove solver, particle engine & curve canvas
```

---

## 📐 Mathematical Derivations & Kinetic Parameters

### 1. Steady-State Flux Derivation
The Deal-Grove model balances three sequential fluxes:
1. **Gas transport to wafer surface:**
   $$F_1 = h_g(C_g - C_s)$$
2. **Diffusion through existing oxide layer ($x_o$):**
   $$F_2 = D_{eff} \frac{C_o - C_i}{x_o}$$
3. **Chemical reaction at $Si\text{--}SiO_2$ interface:**
   $$F_3 = k_s C_i$$

Under steady-state conditions, $F_1 = F_2 = F_3 = F$. Solving for the interface concentration $C_i$ and expressing the oxide growth rate:
$$\frac{dx_o}{dt} = \frac{F}{N_1} = \frac{D_{eff} C^* / N_1}{x_o + \frac{D_{eff}}{k_s} + \frac{D_{eff}}{h}}$$

Integrating from $t = 0$ ($x_o = x_i$) to time $t$ yields the classical quadratic equation:
$$x_o^2 + A x_o = B(t + \tau)$$

Where:
- Parabolic rate constant: $B = \frac{2 D_{eff} C^*}{N_1}$
- Linear rate constant: $\frac{B}{A} = \frac{k_s h C^*}{N_1(k_s + h)} \approx \frac{k_s C^*}{N_1}$
- Initial time offset: $\tau = \frac{x_i^2 + A x_i}{B}$
- $N_1$: Number of oxidant molecules incorporated per unit volume of $\text{SiO}_2$ ($2.2 \times 10^{22}\,\text{cm}^{-3}$ for $\text{O}_2$, $4.4 \times 10^{22}\,\text{cm}^{-3}$ for $\text{H}_2\text{O}$).

### 2. Arrhenius Kinetic Constants Table (Silicon $\langle 100 \rangle$)

| Ambient | Parabolic Pre-Factor ($B_0$) | Parabolic $E_a$ ($E_{a,B}$) | Linear Pre-Factor ($(B/A)_0$) | Linear $E_a$ ($E_{a,l}$) |
| :--- | :---: | :---: | :---: | :---: |
| **Dry $\text{O}_2$** | $7.72 \times 10^2\,\mu\text{m}^2/\text{hr}$ | $1.23\,\text{eV}$ | $3.71 \times 10^6\,\mu\text{m/hr}$ | $2.00\,\text{eV}$ |
| **Wet Steam ($\text{H}_2\text{O}$)** | $3.86 \times 10^2\,\mu\text{m}^2/\text{hr}$ | $0.78\,\text{eV}$ | $1.63 \times 10^8\,\mu\text{m/hr}$ | $2.05\,\text{eV}$ |

*Note: On $\langle 111 \rangle$ silicon, $(B/A)_0$ is multiplied by $1.68$ due to the higher areal density of silicon surface bonds.*

### 3. Silicon Volume Consumption Ratio
From the molecular weights and densities of silicon and silicon dioxide:
- Silicon density $\rho_{Si} = 2.33\,\text{g/cm}^3$, molar mass $M_{Si} = 28.09\,\text{g/mol} \rightarrow N_{Si} = 5.0 \times 10^{22}\,\text{atoms/cm}^3$.
- $\text{SiO}_2$ density $\rho_{ox} = 2.21\,\text{g/cm}^3$, molar mass $M_{ox} = 60.08\,\text{g/mol} \rightarrow N_{ox} = 2.21 \times 10^{22}\,\text{molecules/cm}^3$.

Because each $\text{SiO}_2$ molecule consumes one silicon atom:
$$\frac{x_{Si}}{x_{ox}} = \frac{N_{ox}}{N_{Si}} = \frac{2.21 \times 10^{22}}{5.0 \times 10^{22}} \approx 0.44$$

Therefore, **$44\%$ of the oxide thickness grows into the silicon wafer**, while **$56\%$ expands outward**.

---

## ⚠️ Conceptual Accuracy Disclaimer

This module models thermal oxidation for educational study and intuition building. Extreme ultra-thin initial dry oxidation regimes ($x_o < 20\,\text{nm}$) exhibit an accelerated linear growth rate (often modeled using Massoud's empirical addition $\frac{dx_o}{dt} = \frac{B}{2x_o + A} + C_0 e^{-x_o / L_0}$), which is simplified here into the classical Deal-Grove relation with an initial native offset $\tau$.

---

## 📄 License & Attribution

Part of the **Silicon Sliders** platform under the [MIT License](../../../LICENSE).  
Developed by **Raydurg Anish** ([Portfolio](https://raydurg-anish-portfolio-amta50oot-anish609609s-projects.vercel.app/) · [GitHub](https://github.com/anish609609)).
