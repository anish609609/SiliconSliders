# LVDT — Linear Variable Differential Transformer Simulator

An interactive 3D cutaway simulator for the **Linear Variable Differential Transformer (LVDT)**, using the 3-Stage Process Engineering Lab layout (**Theory | Sliders | Industry**).

---

## 1. Governing Equations

An LVDT consists of one center **Primary Coil ($P$)** flanked symmetrically by two **Secondary Coils ($S_1, S_2$)** connected in **series opposition**, with a movable high-permeability **Ni-Fe (Permalloy) Core** sliding inside a non-magnetic insulating bobbin.

### Differential Mutual Inductance & Induced Voltages

When the primary is driven by an AC sinusoidal excitation $v_{in}(t) = \sqrt{2}\, V_p \sin(2\pi f t)$:

$$V_{S1}(x) = V_{S0}(f) - \frac{1}{2}\, S_{\text{eff}}(f)\, V_p\, x_{\text{eff}}(x)$$

$$V_{S2}(x) = V_{S0}(f) + \frac{1}{2}\, S_{\text{eff}}(f)\, V_p\, x_{\text{eff}}(x)$$

Because $S_1$ and $S_2$ are wired in **series opposition**, the net differential AC phasor is:

$$\tilde{V}_{out}(x) = \left(V_{S1}(x) - V_{S2}(x)\right) + j\, V_{\text{quad}} = -S_{\text{eff}}(f)\, V_p\, x_{\text{eff}}(x) + j\, V_{\text{quad}}$$

where:
- $S_0 = 100\,\text{mV/V/mm}$ ($0.10\,\text{V}_{\text{rms}} / (\text{V}_{\text{rms}} \cdot \text{mm})$) is the nominal mid-band sensitivity.
- $V_p \in [1, 10]\,\text{V}_{\text{rms}}$ is the primary excitation amplitude.
- $f \in [50, 10000]\,\text{Hz}$ is the carrier frequency with inductive low-frequency roll-off below $\sim 120\,\text{Hz}$ and mild core/stray-capacitance roll-off near $10\,\text{kHz}$ (normalized to $H(2500\,\text{Hz}) = 1.000$).
- $V_{\text{quad}} = 0.008\, V_p$ (when **Residual Null** is enabled) models realistic quadrature stray-capacitance / harmonic imbalance at null ($40\,\text{mV}_{\text{rms}}$ at $V_p = 5\,\text{V}_{\text{rms}}$).

### Smooth $\tanh$-Based Saturation Roll-Off

Inside the rated linear stroke ($|x| \le x_L = 5.0\,\text{mm}$), the effective displacement follows a high-linearity polynomial ($< 0.4\%$ non-linearity). Outside $\pm 5.0\,\text{mm}$, magnetic flux leakage at the bobbin ends causes smooth $\tanh$ saturation:

$$x_{\text{eff}}(x) = \begin{cases}
x \left(1 - c_3 x^2\right), & |x| \le x_L \\
\operatorname{sgn}(x)\left[ x_L(1 - c_3 x_L^2) + s_L\, w_{\text{sat}} \tanh\!\left(\dfrac{|x| - x_L}{w_{\text{sat}}}\right) \right], & |x| > x_L
\end{cases}$$

with $x_L = 5.0\,\text{mm}$, $c_3 = 0.00015\,\text{mm}^{-2}$, $s_L = 1 - 3 c_3 x_L^2 = 0.98875$, and $w_{\text{sat}} = 2.6\,\text{mm}$.

### Phase Shift ($\phi$) & Synchronous Demodulation

- **Left of Null ($x < 0$):** $V_{S1} > V_{S2} \implies \phi \approx 0^\circ$ (in phase with primary $V_{in}$).
- **At Null ($x = 0$):** $V_{S1} = V_{S2} \implies V_{out} \to 0$ (or $V_{\text{quad}}$ at $\phi = 90^\circ$ when residual null is enabled).
- **Right of Null ($x > 0$):** $V_{S2} > V_{S1} \implies \phi \approx 180^\circ$ (phase-inverted relative to $V_{in}$).
- **Phase-Sensitive Demodulator (Signed DC):** Recovers signed displacement polarity, outputting negative DC for $x < 0$ and positive DC for $x > 0$.

---

## 2. Material & Structural Constants

| Component | Material | Optical / Physical Role |
| :--- | :--- | :--- |
| Outer Housing | 316L Stainless Steel / Mu-Metal | Magnetic shielding & IP67/IP68 environmental sealing |
| Bobbin / Former | Glass-Filled PEEK / Phenolic | Non-magnetic, low-thermal-expansion coil support |
| Primary Coil ($P$) | Enamel-Insulated Copper (AWG 34) | Center AC excitation winding generating symmetric MMF |
| Secondaries ($S_1, S_2$) | Matched Bifilar Copper Windings | Series-opposition pickup coils |
| Sliding Core | High-$\mu$ Ni-Fe Permalloy (78% Ni) | Low-coercivity ferromagnetic flux-coupling armature |
| Push-Rod | Non-Magnetic 304 SS / Titanium | Mechanical linkage without perturbing core reluctance |

---

## 3. Guided 3D Tour Overview

1. **Cutaway Architecture:** Full isometric inspection of the housing, bobbin, coils, and sliding core.
2. **Primary Excitation ($P$):** Focuses on the central primary winding driven by AC excitation $V_p, f$.
3. **Null Balance ($x = 0\,\text{mm}$):** Centers the Ni-Fe core for balanced mutual inductance ($V_{S1} = V_{S2}$).
4. **Left Displacement ($x = -4.5\,\text{mm}$):** Slides the core toward $S_1$, shifting magnetic flux leftward ($0^\circ$ phase).
5. **$180^\circ$ Phase Reversal ($x = +4.5\,\text{mm}$):** Slides the core toward $S_2$, inverting differential polarity ($180^\circ$ phase).
