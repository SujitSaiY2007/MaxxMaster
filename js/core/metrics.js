// Ways to measure how good a detector is.
(function (FP) {
  'use strict';

  // scored: [{ score: 0..1, label: 'phish' | 'legit' }]
  // A mail is blocked when its score is at or above the threshold.
  //   tp = phishing blocked        fn = phishing missed
  //   fp = real mail blocked       tn = real mail delivered
  function confusion(scored, threshold) {
    const c = { tp: 0, fp: 0, tn: 0, fn: 0 };
    for (const s of scored) {
      const blocked = s.score >= threshold;
      if (s.label === 'phish') c[blocked ? 'tp' : 'fn']++;
      else c[blocked ? 'fp' : 'tn']++;
    }
    return c;
  }

  function summary(c) {
    const div = (a, b) => (b === 0 ? 0 : a / b);
    const precision = div(c.tp, c.tp + c.fp); // of everything blocked, how much was phishing?
    const recall = div(c.tp, c.tp + c.fn); // of all phishing, how much was blocked?
    return {
      accuracy: div(c.tp + c.tn, c.tp + c.fp + c.tn + c.fn),
      precision,
      recall,
      f1: div(2 * precision * recall, precision + recall),
    };
  }

  FP.metrics = { confusion, summary };
})((globalThis.FP = globalThis.FP || {}));
