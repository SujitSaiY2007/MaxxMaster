// Chapter 5: data poisoning. Nobody touches the model. They corrupt what it learns from.
(function (FP) {
  'use strict';

  const { h } = FP.ui;
  const { pct } = FP.util;

  async function run(ui) {
    const D = FP.data;
    const yesterday = D.trainPip();
    const before = D.check(yesterday);
    const sick = D.check(D.retrainWith(D.FEEDBACK));
    const removed = new Set(); // indexes of quarantined feedback rows
    let usedHint = false;

    await ui.say('sys', 'Two weeks later. 06:50.');
    await ui.say('pip', `Good morning. I feel fine. Yesterday I caught ${before.caught} of ${before.phish} phishing mails in the weekly replay. Today I caught ${sick.caught}.`);
    await ui.say('asha', 'Nobody changed Pip’s code. But Pip retrains every night on the mails that staff report, and somebody has been reporting.');
    await ui.say('asha', 'Here is last night’s feedback. Some of it is lying. Quarantine the liars and retrain.');

    let after, kept;
    for (;;) {
      await ui.wait((done) => {
        function draw() {
          const rows = D.FEEDBACK.map((f, i) => {
            const out = removed.has(i);
            const old = yesterday.score(f.text);
            const disagrees = (old >= 0.5) !== (f.label === 'phish');
            return h('tr', { class: out ? 'out' : '' },
              h('td', {}, h('button', { class: 'btn', 'aria-pressed': String(out), onclick: () => { out ? removed.delete(i) : removed.add(i); draw(); } }, out ? 'restore' : 'quarantine')),
              h('td', {}, f.text),
              h('td', { class: f.label === 'phish' ? 'bad' : 'good' }, f.label === 'phish' ? 'phishing' : 'real'),
              h('td', { class: 'dim' }, f.source),
              usedHint && h('td', { class: disagrees ? 'bad' : 'dim' }, `${pct(old)}${disagrees ? ' · disagrees' : ''}`));
          });
          ui.stage(
            h('h2', {}, 'Last night’s feedback'),
            h('p', { class: 'dim' }, 'Each row is a mail that staff reported, with the label they gave it. Pip trusts every row, and a row reported 20 times counts 20 times.'),
            h('table', { class: 'feed' },
              h('tr', {}, h('th', {}, ''), h('th', {}, 'mail'), h('th', {}, 'reported as'), h('th', {}, 'reported by'), usedHint && h('th', {}, 'yesterday’s Pip')),
              rows),
            h('div', { class: 'row' },
              h('button', { class: 'btn primary', onclick: () => done() }, 'Retrain Pip'),
              h('button', { class: 'btn', disabled: usedHint, onclick: () => { usedHint = true; draw(); } }, 'Ask yesterday’s Pip')));
        }
        draw();
        ui.task('Quarantine the reports you do not trust, then retrain.');
      });

      kept = D.FEEDBACK.filter((f, i) => !removed.has(i));
      after = D.check(D.retrainWith(kept));
      ui.stage(
        h('h2', {}, 'Phishing caught in the weekly replay'),
        ui.bar('yesterday', before.caught / before.phish, `${before.caught} of ${before.phish}`, 'good'),
        ui.bar('this morning', sick.caught / sick.phish, `${sick.caught} of ${sick.phish}`, 'bad'),
        ui.bar('after your cleanup', after.caught / after.phish, `${after.caught} of ${after.phish}`, after.caught >= before.caught ? 'good' : 'bad'));
      if (after.caught >= before.caught) break;
      await ui.say('pip', `I caught ${after.caught} of ${after.phish}. Still worse than yesterday.`);
      await ui.say('asha', 'There is still poison in there. Look at who sent each report.');
    }

    const poisonLeft = kept.filter((f) => f.label !== f.truth).length;
    const honestLost = D.FEEDBACK.filter((f, i) => removed.has(i) && f.label === f.truth).length;
    await ui.say('pip', `I caught ${after.caught} of ${after.phish} again. I feel the same as before. I always feel the same.`);
    if (poisonLeft) await ui.say('asha', `The numbers recovered, but ${poisonLeft} lying report${poisonLeft === 1 ? ' is' : 's are'} still in the set. Passing the test is not the same as being clean.`);
    if (honestLost) await ui.say('asha', `You also threw away ${honestLost} honest report${honestLost === 1 ? '' : 's'}. Deleting good data has a cost too.`);
    await ui.say('asha', 'The attacker never touched Pip. They made twenty fake accounts and told Pip that phishing was real mail, over and over. That is data poisoning.');
    await ui.say('asha', usedHint
      ? 'Asking yesterday’s Pip was the right instinct. A trusted older model, or a test set the attacker cannot reach, is a tripwire for bad training data.'
      : 'You found them from the reporters alone. Next time there is also yesterday’s Pip: a trusted older model is a tripwire for bad training data.');
    await ui.say('asha', 'A model is what it eats. Guard the training data like you guard the passwords.');

    return Math.max(1, 3 - (usedHint ? 1 : 0) - (honestLost ? 1 : 0) - (poisonLeft ? 1 : 0));
  }

  FP.chapters.push({
    title: 'Poison',
    concept: 'data poisoning',
    lesson: 'An attacker does not need to break the model if they can change what it learns from. Protect and check the training data.',
    run,
  });
})(globalThis.FP);
