// Anomaly detector: learns what "normal" looks like, then flags whatever is far from it.
// It never sees a labelled attack. That is the point of the chapter that uses it.
(function (FP) {
  'use strict';

  class AnomalyDetector {
    constructor(features) {
      this.features = features; // e.g. ['hour', 'mb']
      this.mean = {};
      this.sd = {};
    }

    // Learn the average and the spread (standard deviation) of each feature.
    fit(rows) {
      for (const f of this.features) {
        const xs = rows.map((r) => r[f]);
        const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
        const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length;
        this.mean[f] = mean;
        this.sd[f] = Math.sqrt(variance) || 1;
      }
      return this;
    }

    // How many standard deviations away from the average is this value?
    zscore(row, feature) {
      return (row[feature] - this.mean[feature]) / this.sd[feature];
    }

    // Combine the z-scores of all features into one distance from "normal".
    distance(row) {
      return Math.sqrt(this.features.reduce((sum, f) => sum + this.zscore(row, f) ** 2, 0));
    }

    // k is the sensitivity dial: small k = strict, large k = relaxed.
    isAnomaly(row, k) {
      return this.distance(row) > k;
    }
  }

  FP.anomaly = { AnomalyDetector };
})((globalThis.FP = globalThis.FP || {}));
