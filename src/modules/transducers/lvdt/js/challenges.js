/**
 * challenges.js - Interactive LVDT Lab Challenge State Machine & Verification
 *
 * Evaluates live LVDT state against 3 interactive instrumentation challenges:
 *   1. Find the Null (|x| <= 0.05 mm)
 *   2. Phase Inversion Check (180 deg phase shift at Vout = +2.0 V +/- 0.1 V inside linear range)
 *   3. Linearity Limit (maximum positive x before linearity error exceeds 1%)
 */
(function (root) {
  'use strict';

  var CHALLENGES = [
    {
      id: 'find-null',
      step: 1,
      title: 'Find the Null',
      prompt: 'Position the core within ±0.05 mm of magnetic null so secondary windings balance (VS1 ≈ VS2).',
      targetHint: 'Target: |x| ≤ 0.05 mm',
      check: function (st) {
        var passed = Math.abs(st.xMm) <= 0.05;
        return {
          passed: passed,
          liveText: 'x = ' + st.xMm.toFixed(2) + ' mm · Vout = ' + (st.vOutRms * 1000).toFixed(1) + ' mVrms'
        };
      }
    },
    {
      id: 'phase-inversion',
      step: 2,
      title: 'Phase Inversion Check',
      prompt: 'Move the core inside the ±5 mm linear zone to get a 180° phase-shifted output of +2.0 V ± 0.1 V.',
      targetHint: 'Target: φ ≈ 180°, |x| ≤ 5.0 mm, Vout = 2.00 ± 0.10 V',
      check: function (st) {
        var vMag = st.demodulatorMode === 'demod' ? st.vOutDemodDc : st.vOutRms;
        var inLinear = st.xMm > 0 && st.xMm <= 5.0;
        var phaseOk = st.phaseDeg >= 165.0;
        var voltOk = vMag >= 1.90 && vMag <= 2.10;
        var passed = inLinear && phaseOk && voltOk;
        return {
          passed: passed,
          liveText: 'φ = ' + st.phaseDeg.toFixed(1) + '° · Vout = ' + vMag.toFixed(2) + ' V'
        };
      }
    },
    {
      id: 'linearity-limit',
      step: 3,
      title: 'Linearity Limit',
      prompt: 'Find the maximum positive displacement before linearity error exceeds 1.00% FS.',
      targetHint: 'Target: +5.40 mm ≤ x ≤ +5.80 mm with error ≤ 1.00%',
      check: function (st) {
        var passed = st.xMm >= 5.40 && st.xMm <= 5.80 && st.linearityErrorPct <= 1.00;
        return {
          passed: passed,
          liveText: 'x = +' + Math.max(0, st.xMm).toFixed(2) + ' mm · Err = ' + st.linearityErrorPct.toFixed(2) + '%'
        };
      }
    }
  ];

  var completedIds = {};

  function evaluate(state) {
    var results = [];
    var newlyCompleted = [];
    for (var i = 0; i < CHALLENGES.length; i++) {
      var c = CHALLENGES[i];
      var res = c.check(state);
      if (res.passed && !completedIds[c.id]) {
        completedIds[c.id] = true;
        newlyCompleted.push(c.id);
      }
      results.push({
        id: c.id,
        step: c.step,
        title: c.title,
        prompt: c.prompt,
        targetHint: c.targetHint,
        passedNow: res.passed,
        completed: Boolean(completedIds[c.id]),
        liveText: res.liveText
      });
    }
    return {
      results: results,
      newlyCompleted: newlyCompleted,
      completedCount: Object.keys(completedIds).length,
      totalCount: CHALLENGES.length
    };
  }

  function reset() {
    completedIds = {};
  }

  function getProgress() {
    return {
      completedIds: Object.assign({}, completedIds),
      completedCount: Object.keys(completedIds).length,
      totalCount: CHALLENGES.length
    };
  }

  root.LVDTChallenges = {
    CHALLENGES: CHALLENGES,
    evaluate: evaluate,
    reset: reset,
    getProgress: getProgress
  };
})(typeof window !== 'undefined' ? window : globalThis);
