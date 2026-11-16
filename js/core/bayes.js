// Naive Bayes text classifier, written from scratch.
//
// Idea: count how often each word shows up in phishing mails and in real mails.
// A new mail is scored by adding up the evidence of each of its words.
(function (FP) {
  'use strict';

  // Attackers swap letters for look-alike symbols ("passw0rd"). This map undoes that.
  const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

  // "Verify your acc0unt!" -> ["verify", "your", "acc0unt"]
  // With normalize = true the last word becomes "account".
  function tokenize(text, normalize) {
    const words = String(text).toLowerCase().match(/[a-z0-9@$]+/g) || [];
    if (!normalize) return words;
    return words.map((w) => (/[a-z]/.test(w) ? w.replace(/[013457@$]/g, (c) => LEET[c]) : w));
  }

  class NaiveBayes {
    constructor(options = {}) {
      this.normalize = Boolean(options.normalize);
      // Naive Bayes is overconfident (it treats every word as independent proof),
      // so scores pile up at 0 and 1. Dividing by a "temperature" spreads them out.
      this.temperature = options.temperature || 3;
      this.docs = { phish: 0, legit: 0 }; // mails seen per class
      this.words = { phish: {}, legit: {} }; // word -> count, per class
      this.total = { phish: 0, legit: 0 }; // total words per class
      this.vocab = new Set();
    }

    // weight lets one sample count several times (used in the poisoning chapter).
    train(text, label, weight = 1) {
      this.docs[label] += weight;
      for (const w of tokenize(text, this.normalize)) {
        this.words[label][w] = (this.words[label][w] || 0) + weight;
        this.total[label] += weight;
        this.vocab.add(w);
      }
      return this;
    }

    trainAll(samples) {
      for (const s of samples) this.train(s.text, s.label, s.weight || 1);
      return this;
    }

    // log( P(word | phish) / P(word | legit) ).  Above 0 leans phishing, below 0 leans real.
    // The +1 is Laplace smoothing: a word never seen in one class must not give a zero.
    wordEvidence(word) {
      if (!this.vocab.has(word)) return 0; // never seen in training: no evidence either way
      const v = this.vocab.size;
      const pPhish = ((this.words.phish[word] || 0) + 1) / (this.total.phish + v);
      const pLegit = ((this.words.legit[word] || 0) + 1) / (this.total.legit + v);
      return Math.log(pPhish / pLegit);
    }

    // Prior (how common phishing is overall) plus the evidence of every word.
    logOdds(text) {
      let sum = Math.log((this.docs.phish + 1) / (this.docs.legit + 1));
      for (const w of tokenize(text, this.normalize)) sum += this.wordEvidence(w);
      return sum;
    }

    // Suspicion score between 0 (surely real) and 1 (surely phishing).
    score(text) {
      return 1 / (1 + Math.exp(-this.logOdds(text) / this.temperature));
    }

    predict(text, threshold = 0.5) {
      return this.score(text) >= threshold ? 'phish' : 'legit';
    }

    // Per-word evidence for one mail, so the game can show *why* Pip decided.
    explain(text) {
      return tokenize(text, this.normalize).map((word) => ({ word, evidence: this.wordEvidence(word) }));
    }

    // The n words that lean hardest towards each class.
    topWords(n) {
      const ranked = [...this.vocab]
        .map((word) => ({ word, evidence: this.wordEvidence(word) }))
        .sort((a, b) => b.evidence - a.evidence);
      return { phish: ranked.slice(0, n), legit: ranked.slice(-n).reverse() };
    }
  }

  FP.bayes = { tokenize, NaiveBayes };
})((globalThis.FP = globalThis.FP || {}));
