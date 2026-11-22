# PN Junction Diode — 3D Physical CAD & Semiconductor Breakdown Simulation

Interactive 3D physical modeling and Poisson electrostatics for a discrete planar/mesa **PN Junction Diode**.

---

## 🔬 Core Physics & Mathematical Engine

### 1. Built-in Potential ($V_{bi}$)
$$V_{bi} = \frac{kT}{q} \ln\left(\frac{N_A N_D}{n_i^2}\right)$$
- $n_i(T)$ is temperature-dependent intrinsic carrier concentration in Silicon.
- $V_t = \frac{kT}{q} = 25.85\text{ mV}$ at $300\text{ K}$.

### 2. Depletion Width ($W$) & One-Sided Asymmetric Extensions ($x_p, x_n$)
$$W = \sqrt{\frac{2\varepsilon_s}{q} \left(\frac{1}{N_A} + \frac{1}{N_D}\right) \max(V_{bi} - V_A, 0.05)}$$
$$x_p = W \frac{N_D}{N_A + N_D}, \quad x_n = W \frac{N_A}{N_A + N_D}$$
- Demonstrates space-charge neutrality ($q N_A x_p = q N_D x_n$).
- Depletion extends significantly further into the more lightly doped side.

### 3. Peak Electric Field ($|E_{\max}|$)
$$|E_{\max}| = \frac{q N_A x_p}{\varepsilon_s} = \frac{2(V_{bi} - V_A)}{W}$$

### 4. Sze Empirical Breakdown Formulation & Temperature Coefficients
$$V_{BR0} \approx 60 \left(\frac{E_g(T)}{1.1\text{ eV}}\right)^{1.5} \left(\frac{N_{\text{eff}}}{10^{16}\text{ cm}^{-3}}\right)^{-0.75}$$
- **Zener Breakdown ($V_{BR} < 5\text{ V}$):** Direct band-to-band quantum mechanical tunneling; exhibits a **negative temperature coefficient** ($\frac{dV_{BR}}{dT} < 0$).
- **Avalanche Breakdown ($V_{BR} > 6\text{ V}$):** Cascading impact ionization and secondary electron-hole pair multiplication; exhibits a **positive temperature coefficient** ($\frac{dV_{BR}}{dT} > 0$).

### 5. Total Diode Current (Shockley + Breakdown)
- Forward bias: $I = I_s \left(e^{\frac{q V_A}{n k T}} - 1\right)$ clamped smoothly by series resistance $R_s$.
- Reverse breakdown ($V_A \le -V_{BR}$): Smooth exponential turn-on leading into series-resistance linear limit without numerical divergence.

---

## 🚀 Key Features

1. **Segmented 3-Tab View Switcher:**
   - **THEORY:** Comprehensive textbook-grade theory with quick jump chips, parameter tables, and comparison cards.
   - **PHYSICAL LAYOUT:** Interactive 3D WebGL viewport with OrbitControls, layer explode/scrubbing, and docked telemetry HUD.
   - **CIRCUIT DIAGRAM:** Live 2D SVG schematic with animated current arrows, terminal readouts, and mode badges.
2. **Interactive Sliders:**
   - Bias Voltage $V_A$ ($-20.0\text{ V}$ to $+0.8\text{ V}$)
   - Acceptor Doping $N_A$ ($10^{15}$ to $10^{19}\text{ cm}^{-3}$, log scale)
   - Donor Doping $N_D$ ($10^{15}$ to $10^{19}\text{ cm}^{-3}$, log scale)
   - Temperature $T$ ($250\text{ K}$ to $400\text{ K}$)
3. **Dual Interactive Graphs:**
   - **I-V Curve:** Full sweep from $-20\text{ V}$ to $+0.8\text{ V}$ with vertical $-V_{BR}$ line and click/drag operating point marker.
   - **$\rho(x)$ & $E(x)$ Profile:** Step space-charge profile and triangular electric field profile with critical field $E_{\text{crit}}$ threshold.
4. **Dynamic Carrier Flow:**
   - Quantum electron particles (cyan), hole particles (orange), and conventional current arrows (gold).
   - Thermal Brownian jitter in equilibrium.
   - Forward injection across narrowed junction ($e^-$ from N $\rightarrow$ P, $h^+$ from P $\rightarrow$ N, current from Anode $\rightarrow$ Cathode).
   - Reverse bias majority pullback with minimal leakage drift.
   - High-field glow and rapid reverse current during Zener tunneling and Avalanche ionization.
5. **Sarvam AI Voice Assistant:**
   - Live spoken voice tutor powered by Sarvam AI `bulbul:v4-flash` and `sarvam-105b-conversations`.
   - Multilingual support: English (en-IN), Hindi (hi-IN), Telugu (te-IN).
   - Automatic fallback physics responses for offline operation.
