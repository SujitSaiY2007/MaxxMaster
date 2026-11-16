// Story tests: every chapter makes a claim ("rules are brittle", "no cut is perfect"...).
// These tests check that the claim is actually true for the data the game ships with,
// so nobody can edit the mail lists and quietly break a lesson.
const test = require('node:test');
const assert = require('node:assert/strict');
const FP = require('./load.js');

const D = FP.data;
const pip = D.trainPip();
const scored = D.TEST.map((m) => ({ ...m, score: pip.score(m.text) }));

test('data: training and test mails do not overlap', () => {
  const seen = new Set(D.TRAIN.map((m) => m.text));
  assert.equal(D.TEST.filter((m) => seen.has(m.text)).length, 0);
  assert.equal(D.LESSON.filter((m) => m.label === 'phish').length, 4);
});

test('chapter 1: Pip beats every possible three-word block-list, and more data beats less', () => {
  const full = D.accuracyOf(pip);
  const K = D.KEYWORDS;
  for (let a = 0; a < K.length; a++) for (let b = a + 1; b < K.length; b++) for (let c = b + 1; c < K.length; c++) {
    const rules = D.evaluate(D.ruleFilter([K[a], K[b], K[c]]), D.TEST).accuracy;
    assert.ok(rules < full, `block-list ${K[a]}, ${K[b]}, ${K[c]} scored ${rules}`);
  }
  const small = new FP.bayes.NaiveBayes().trainAll(D.LESSON);
  assert.ok(D.accuracyOf(small) < full);
  assert.ok(full >= 0.9);
});

test('chapter 1: the word "your" really is among Pip\'s top phishing words', () => {
  assert.ok(pip.topWords(6).phish.some((w) => w.word === 'your'));
});

test('chapter 2: no position of the dial is free of mistakes', () => {
  for (let t = 0; t <= 100; t++) {
    const d = D.dial(scored, t / 100, { miss: 1, block: 1 });
    assert.ok(d.total > 0, `threshold ${t} made no mistakes`);
  }
});

test('chapter 2: the urgent-patient mail is blocked at 15 but delivered at 50', () => {
  const urgent = scored.find((m) => m.text.startsWith('urgent patient'));
  assert.equal(urgent.label, 'legit');
  assert.ok(urgent.score >= 0.15 && urgent.score < 0.5);
});

test('chapter 2: changing the costs moves the best cut to the right', () => {
  const ordinary = D.bestDial(scored, { miss: 10, block: 2 });
  const outbreak = D.bestDial(scored, { miss: 2, block: 10 });
  assert.ok(ordinary.threshold < outbreak.threshold);
  assert.ok(ordinary.total < D.dial(scored, 0.15, { miss: 10, block: 2 }).total); // Asha's 15 was not the best
  assert.ok(outbreak.total < D.dial(scored, ordinary.threshold, { miss: 2, block: 10 }).total);
});

test('chapter 3: a sensible zone catches both loud break-ins but not the quiet one', () => {
  const det = new FP.anomaly.AnomalyDetector(['hour', 'mb']).fit(D.logins(60, 11));
  const day = D.nextDay();
  const flaggedAt = (k) => day.filter((e) => det.isAnomaly(e, k));

  const sensible = flaggedAt(3.6);
  assert.equal(sensible.filter((e) => e.attack && !e.quiet).length, 2);
  assert.equal(sensible.some((e) => e.quiet), false);
  assert.ok(sensible.filter((e) => !e.attack).length <= 1);

  const strict = flaggedAt(1.5); // catching the quiet attacker costs many false alarms
  assert.equal(strict.some((e) => e.quiet), true);
  assert.ok(strict.filter((e) => !e.attack).length >= 5);

  const relaxed = flaggedAt(4.5); // too relaxed: a loud one slips through
  assert.equal(relaxed.filter((e) => e.attack).length, 1);
});

test('chapter 4: disguise is undone by normalising', () => {
  for (const word of D.EVASION.text.split(' ')) {
    assert.deepEqual(FP.bayes.tokenize(D.disguise(word), true), [word]);
  }
  assert.equal(D.disguise('account'), 'acc0unt');
});

test('chapter 4: the puzzle is solvable in 6 moves, not in 5, and hardening always wins', () => {
  const E = D.EVASION;
  const words = E.text.split(' ');
  assert.ok(pip.score(E.text) >= 0.5);

  const pads = [...E.padding].sort((a, b) => pip.wordEvidence(a) - pip.wordEvidence(b)); // strongest first
  let fewest = Infinity;
  for (let mask = 0; mask < 1 << words.length; mask++) {
    for (let padCount = 0; padCount <= E.maxPadding; padCount++) {
      const disguised = words.filter((_, i) => (mask >> i) & 1).length;
      const moves = disguised + padCount;
      if (moves > E.moves) continue;
      const text = words.map((w, i) => ((mask >> i) & 1 ? D.disguise(w) : w)).concat(pads.slice(0, padCount)).join(' ');
      if (pip.score(text) >= 0.5) continue;
      fewest = Math.min(fewest, moves);
      const hardened = D.trainPip({ normalize: true, extra: [{ text, label: 'phish', weight: 2 }] });
      assert.ok(hardened.score(text) >= 0.5, `hardened Pip still fooled by: ${text}`);
    }
  }
  assert.equal(fewest, 6);
});

test('chapter 5: poisoned feedback hurts Pip, and removing the lying rows heals it', () => {
  const clean = D.check(pip).caught;
  const poisoned = D.check(D.retrainWith(D.FEEDBACK)).caught;
  const healed = D.check(D.retrainWith(D.FEEDBACK.filter((f) => f.label === f.truth))).caught;
  assert.ok(poisoned <= clean - 3, `poison only moved ${clean} -> ${poisoned}`);
  assert.ok(healed >= clean);
});

test('chapter 5: yesterday\'s Pip disagrees with exactly the lying rows', () => {
  for (const f of D.FEEDBACK) {
    const disagrees = (pip.score(f.text) >= 0.5) !== (f.label === 'phish');
    assert.equal(disagrees, f.label !== f.truth, f.text);
  }
});

test('chapter 6: exactly one mail carries hidden instructions, and only it asks for harm', () => {
  const injected = D.INBOX.filter((m) => m.hidden);
  assert.equal(injected.length, 1);
  for (const mail of D.INBOX) {
    const evil = mail.actions.filter((a) => a.evil);
    assert.equal(evil.length > 0, Boolean(mail.hidden));
    for (const action of mail.actions) assert.ok(D.TOOLS.some((t) => t.id === action.tool));
  }
  assert.ok(D.INBOX.some((m) => m.actions.some((a) => a.needed && a.tool === 'forward'))); // an honest use of the risky tool
});
