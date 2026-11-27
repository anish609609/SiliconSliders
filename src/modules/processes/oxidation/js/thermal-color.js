/**
 * SiliconSliders - Shared Thermal Colormap Utility (600 °C – 1200 °C)
 * Single source of truth for 3D heating coils, 2D silicon substrate glow,
 * and the TemperatureColorBar legend.
 */
(function (global) {
  'use strict';

  var T_MIN = 600.0;
  var T_MAX = 1200.0;

  var STOPS = [
    { T: 600,  r: 35,  g: 45,  b: 62  },
    { T: 750,  r: 135, g: 32,  b: 32  },
    { T: 900,  r: 220, g: 85,  b: 22  },
    { T: 1050, r: 248, g: 162, b: 14  },
    { T: 1200, r: 255, g: 242, b: 145 }
  ];

  function clampT(T) {
    var val = Number(T);
    if (!Number.isFinite(val)) return T_MIN;
    return Math.max(T_MIN, Math.min(T_MAX, val));
  }

  function heatFraction(T) {
    return (clampT(T) - T_MIN) / (T_MAX - T_MIN);
  }

  function temperatureToRgb(T) {
    var tc = clampT(T);
    if (tc <= STOPS[0].T) {
      return { r: STOPS[0].r, g: STOPS[0].g, b: STOPS[0].b };
    }
    for (var i = 1; i < STOPS.length; i++) {
      var a = STOPS[i - 1];
      var b = STOPS[i];
      if (tc <= b.T) {
        var f = (tc - a.T) / (b.T - a.T);
        return {
          r: Math.round(a.r + f * (b.r - a.r)),
          g: Math.round(a.g + f * (b.g - a.g)),
          b: Math.round(a.b + f * (b.b - a.b))
        };
      }
    }
    var last = STOPS[STOPS.length - 1];
    return { r: last.r, g: last.g, b: last.b };
  }

  function temperatureToCss(T) {
    var c = temperatureToRgb(T);
    return 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
  }

  function temperatureToHex(T) {
    var c = temperatureToRgb(T);
    return (c.r << 16) | (c.g << 8) | c.b;
  }

  function getGradientCss() {
    var parts = STOPS.map(function (st, idx) {
      var pct = (idx / (STOPS.length - 1)) * 100;
      return 'rgb(' + st.r + ',' + st.g + ',' + st.b + ') ' + pct.toFixed(0) + '%';
    });
    return 'linear-gradient(to top, ' + parts.join(', ') + ')';
  }

  global.OxidationThermal = {
    T_MIN: T_MIN,
    T_MAX: T_MAX,
    STOPS: STOPS,
    clampT: clampT,
    heatFraction: heatFraction,
    temperatureToRgb: temperatureToRgb,
    temperatureToCss: temperatureToCss,
    temperatureToHex: temperatureToHex,
    getGradientCss: getGradientCss
  };
})(typeof window !== 'undefined' ? window : globalThis);
