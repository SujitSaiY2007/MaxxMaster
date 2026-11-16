// Small helpers shared by the whole game.
(function (FP) {
  'use strict';

  // mulberry32: a tiny seeded random generator. Same seed -> same numbers,
  // so every player (and every test run) sees the same "random" data.
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Box-Muller transform: turns two uniform numbers into one bell-curve number.
  function gaussian(rand, mean, sd) {
    const u = 1 - rand();
    const v = rand();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const pct = (x) => Math.round(x * 100);

  FP.util = { rng, gaussian, clamp, pct };
})((globalThis.FP = globalThis.FP || {}));
