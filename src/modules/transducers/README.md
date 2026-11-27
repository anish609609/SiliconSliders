# Pillar 4: Transducers & Electromechanical Sensors

Welcome to the **Transducers** pillar of **Silicon Sliders**, aligned with the **EE6403 Transducers & Instrumentation** curriculum.

While semiconductor devices and MEMS operate at the micrometer-to-nanometer scale, precision industrial, aerospace, and process-control instrumentation relies on macroscopic electromechanical transducers that convert physical measurands (linear displacement, angular position, force, pressure, temperature) into conditioned electrical signals. This pillar pairs interactive 3D cutaway CAD models with real-time analytical physics, virtual oscilloscopes, and signal-conditioning theory.

---

## 📦 Active & Planned Transducer Modules

| Transducer Module | Status | Physical Principle | Links |
| :--- | :---: | :--- | :--- |
| **LVDT (Linear Variable Differential Transformer)** | `Active` | Differential Mutual Inductance · Series-Opposition Secondaries · $180^\circ$ Phase Flip | [Launch Simulator](lvdt/index.html) · [Module Spec](lvdt/README.md) |
| **RVDT (Rotary Variable Differential Transformer)** | `Roadmap` | Angular Differential Reluctance · $\pm 40^\circ$ Linear Stroke | *Roadmap* |
| **Strain Gauge Wheatstone Bridge** | `Roadmap` | Piezoresistive Gauge Factor ($G_f$) · Quarter/Half/Full Bridge | *Roadmap* |
| **Variable Reluctance & Eddy-Current Proximity** | `Roadmap` | Magnetic Circuit Reluctance · High-Frequency Skin Effect | *Roadmap* |

---

## 📐 Core Transduction Metrics (EE6403 Scope)

Every transducer module in this pillar emphasizes four universal instrumentation metrics:

1. **Sensitivity ($S$):** Ratio of electrical output change per unit excitation per unit physical input (e.g., $\text{mV/V/mm}$ for AC inductive bridges).
2. **Linearity Error ($\epsilon_L$):** Maximum deviation of the actual transfer curve from the ideal best-fit straight line over the rated linear stroke, expressed as $\% \text{ of Full Scale } (\%\text{FS})$.
3. **Null / Offset & Quadrature Residual:** Imperfections at the zero-input datum due to inter-winding stray capacitance, harmonic distortion, or magnetic asymmetry.
4. **Phase-Sensitive Signal Conditioning:** Synchronous demodulation and low-pass filtering (e.g., **AD698** / **AD598**) required to recover signed magnitude and direction from an AC-modulated carrier.
