// Unit tests for the algorithms: tokenizer, Naive Bayes, metrics, anomaly detector.
const test = require('node:test');
const assert = require('node:assert/strict');
const FP = require('./load.js');

const { tokenize, NaiveBayes } = FP.bayes;
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not close to ${b}`);

test('tokenize lowercases and splits on anything that is not a letter or digit', () => {
  assert.deepEqual(tokenize('Verify your ACCOUNT, now!'), ['verify', 'your', 'account', 'now']);
  assert.deepEqual(tokenize(''), []);
});

test('tokenize with normalize undoes look-alike letters but leaves plain numbers alone', () => {
  assert.deepEqual(tokenize('passw0rd acc0unt cl1ck', true), ['password', 'account', 'click']);
  assert.deepEqual(tokenize('room 104', true), ['room', '104']);
  assert.deepEqual(tokenize('passw0rd', false), ['passw0rd']);
});

test('a word never seen in training gives no evidence either way', () => {
  const nb = new NaiveBayes().train('click the link', 'phish').train('see you at lunch', 'legit');
  assert.equal(nb.wordEvidence('zebra'), 0);
});

test('word evidence leans the right way and smoothing keeps it finite', () => {
  const nb = new NaiveBayes().train('click click link', 'phish').train('lunch menu', 'legit');
  assert.ok(nb.wordEvidence('click') > 0);
  assert.ok(nb.wordEvidence('lunch') < 0);
  assert.ok(Number.isFinite(nb.wordEvidence('click'))); // "click" has zero count in legit
});

test('the classifier separates obvious examples', () => {
  const nb = new NaiveBayes()
    .train('verify your password now', 'phish')
    .train('click the link to claim your prize', 'phish')
    .train('meeting moved to friday', 'legit')
    .train('lunch menu for next week', 'legit');
  assert.equal(nb.predict('claim your prize now'), 'phish');
  assert.equal(nb.predict('friday lunch meeting'), 'legit');
});

test('score is a probability and temperature never changes which side it lands on', () => {
  const samples = [{ text: 'verify password', label: 'phish' }, { text: 'lunch menu', label: 'legit' }];
  const sharp = new NaiveBayes({ temperature: 1 }).trainAll(samples);
  const soft = new NaiveBayes({ temperature: 5 }).trainAll(samples);
  for (const text of ['verify password', 'lunch menu', 'verify lunch']) {
    assert.ok(soft.score(text) >= 0 && soft.score(text) <= 1);
    assert.equal(sharp.score(text) >= 0.5, soft.score(text) >= 0.5);
  }
  assert.ok(Math.abs(soft.score('verify password') - 0.5) < Math.abs(sharp.score('verify password') - 0.5));
});

test('training with weight 3 is the same as training three times', () => {
  const once = new NaiveBayes().train('lunch', 'legit').train('click link', 'phish', 3);
  const thrice = new NaiveBayes().train('lunch', 'legit');
  for (let i = 0; i < 3; i++) thrice.train('click link', 'phish');
  close(once.logOdds('click lunch'), thrice.logOdds('click lunch'));
});

test('explain returns one entry per word', () => {
  const nb = new NaiveBayes().train('click link', 'phish').train('lunch menu', 'legit');
  assert.deepEqual(nb.explain('click lunch').map((w) => w.word), ['click', 'lunch']);
});

test('confusion matrix counts each kind of outcome', () => {
  const scored = [
    { score: 0.9, label: 'phish' }, // blocked phishing  -> tp
    { score: 0.2, label: 'phish' }, // missed phishing   -> fn
    { score: 0.8, label: 'legit' }, // blocked real mail -> fp
    { score: 0.1, label: 'legit' }, // delivered real    -> tn
    { score: 0.5, label: 'phish' }, // exactly on the cut counts as blocked
  ];
  assert.deepEqual(FP.metrics.confusion(scored, 0.5), { tp: 2, fp: 1, tn: 1, fn: 1 });
});

test('summary computes accuracy, precision, recall and survives empty input', () => {
  const s = FP.metrics.summary({ tp: 2, fp: 1, tn: 1, fn: 1 });
  close(s.accuracy, 3 / 5);
  close(s.precision, 2 / 3);
  close(s.recall, 2 / 3);
  assert.deepEqual(FP.metrics.summary({ tp: 0, fp: 0, tn: 0, fn: 0 }), { accuracy: 0, precision: 0, recall: 0, f1: 0 });
});

test('anomaly detector learns mean and spread, and measures distance in standard deviations', () => {
  const det = new FP.anomaly.AnomalyDetector(['x']).fit([{ x: 8 }, { x: 10 }, { x: 12 }]);
  close(det.mean.x, 10);
  close(det.sd.x, Math.sqrt(8 / 3));
  close(det.distance({ x: 10 }), 0);
  close(det.distance({ x: 10 + 2 * det.sd.x }), 2);
  assert.equal(det.isAnomaly({ x: 30 }, 3), true);
  assert.equal(det.isAnomaly({ x: 11 }, 3), false);
});

test('anomaly detector combines features and does not divide by zero on a constant feature', () => {
  const det = new FP.anomaly.AnomalyDetector(['x', 'y']).fit([{ x: 0, y: 5 }, { x: 2, y: 5 }]);
  assert.equal(det.sd.y, 1);
  close(det.distance({ x: 1 + 3, y: 5 + 4 }), 5); // 3-4-5 triangle: sd.x is 1, sd.y falls back to 1
});

test('the seeded random generator repeats itself', () => {
  const a = FP.util.rng(42);
  const b = FP.util.rng(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(FP.util.rng(1)(), FP.util.rng(2)());
});
