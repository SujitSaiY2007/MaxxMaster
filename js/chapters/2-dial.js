// Chapter 2: where to put the threshold. False positives against false negatives.
(function (FP) {
  'use strict';

  const { h } = FP.ui;
  const { pct } = FP.util;

  // One round: every mail is a dot placed by Pip's score. The player moves the cut.
  function round(ui, scored, cost, start, title) {
    return ui.wait((done) => {
      const caption = h('p', { class: 'dim caption' }, 'Click a dot to read the mail.');
      const readout = h('div', { class: 'readout' });
      const cut = h('div', { class: 'cut' });
      const shade = h('div', { class: 'shade' });
      const slider = h('input', { type: 'range', min: 0, max: 100, value: Math.round(start * 100), 'aria-label': 'Block mails scoring at or above' });

      // Phishing in the top lane, real mail in the bottom lane. Dots that would overlap are stacked.
      const lanes = { phish: [], legit: [] };
      const dots = [...scored].sort((a, b) => a.score - b.score).map((mail) => {
        const level = lanes[mail.label].filter((s) => Math.abs(s - mail.score) < 0.03).length;
        lanes[mail.label].push(mail.score);
        const top = (mail.label === 'phish' ? 6 : 86) + level * 13;
        const kind = mail.label === 'phish' ? 'PHISHING' : 'REAL MAIL';
        const el = h('button', {
          class: 'dot ' + mail.label,
          style: `left:${mail.score * 100}%; top:${top}px`,
          'aria-label': `${kind}, score ${pct(mail.score)}`,
          onclick: () => { caption.textContent = `${kind} · score ${pct(mail.score)} · "${mail.text}"`; },
        });
        return { mail, el };
      });

      function update() {
        const threshold = slider.value / 100;
        const d = FP.data.dial(scored, threshold, cost);
        cut.style.left = shade.style.left = `${slider.value}%`;
        for (const { mail, el } of dots) el.classList.toggle('error', (mail.score >= threshold) !== (mail.label === 'phish'));
        readout.replaceChildren(
          h('span', {}, `block at ${slider.value} and above`),
          h('span', { class: 'bad' }, `phishing missed: ${d.missed} × ${cost.miss}`),
          h('span', { class: 'bad' }, `real mail blocked: ${d.blocked} × ${cost.block}`),
          h('span', { class: 'total' }, `damage: ${d.total}`),
          h('span', { class: 'dim' }, `precision ${pct(d.precision)}% · recall ${pct(d.recall)}%`));
      }
      slider.addEventListener('input', update);

      const lock = h('button', {
        class: 'btn primary',
        onclick: () => done({ threshold: slider.value / 100, ...FP.data.dial(scored, slider.value / 100, cost) }),
      }, 'Lock the dial');

      ui.stage(
        h('h2', {}, title),
        h('p', { class: 'dim' }, 'Top row: phishing. Bottom row: real mail. Further right means Pip is more suspicious. Everything right of the dashed line is blocked. Ringed dots are mistakes.'),
        h('div', { class: 'axis' }, shade, cut, dots.map((d) => d.el)),
        h('div', { class: 'scale' }, h('span', {}, '0 · surely real'), h('span', {}, 'surely phishing · 100')),
        slider, readout, caption, lock);
      update();
      ui.task('Slide the dial to the setting with the least damage, then lock it.');
    });
  }

  async function run(ui) {
    const D = FP.data;
    const pip = D.trainPip();
    const scored = D.TEST.map((mail) => ({ ...mail, score: pip.score(mail.text) }));

    await ui.say('sys', 'Three nights later. 07:15.');
    await ui.say('asha', 'I set Pip to block anything scoring 15 or more. Better safe than sorry, I thought.');
    await ui.say('mehta', 'Your new filter threw away a mail about an urgent patient in ward three. A nurse found out by walking down the corridor. Fix it.');
    await ui.say('asha', 'That is a false positive: a real mail that Pip called phishing. The opposite, phishing that gets through, is a false negative.');
    await ui.say('pip', 'I never say yes or no. I give each mail a suspicion score from 0 to 100. Someone has to decide where the cut is.');
    await ui.say('asha', 'Tonight that someone is you. A missed phishing mail costs us about 10. A blocked real mail costs about 2. Find the cut with the least damage.');

    const costA = { miss: 10, block: 2 };
    const bestA = D.bestDial(scored, costA);
    const a = await round(ui, scored, costA, 0.15, 'The dial · an ordinary week');
    await ui.say('asha', a.total <= bestA.total ? `Damage ${a.total}. That is the best this dial can do.` : `Damage ${a.total}. The best possible was ${bestA.total}, but you see the idea.`);
    await ui.say('asha', 'Notice that you could not get both numbers to zero. Some phishing sounds polite. Some real mail sounds alarming. The scores overlap, so every cut makes some mistake.');

    await ui.say('sys', 'Winter. A flu outbreak. Every bed is full.');
    await ui.say('mehta', 'This week a delayed message can cost a life. I would rather read ten scam mails than lose one real one.');
    await ui.say('asha', 'Same Pip, same mails, new costs. A blocked real mail now costs 10 and a missed phishing mail costs 2. Move the dial.');

    const costB = { miss: 2, block: 10 };
    const bestB = D.bestDial(scored, costB);
    const b = await round(ui, scored, costB, a.threshold, 'The dial · outbreak week');
    await ui.say('asha', b.total <= bestB.total ? `Damage ${b.total}. Best possible.` : `Damage ${b.total}. The best possible was ${bestB.total}.`);
    await ui.say('asha', `You moved the cut from ${pct(a.threshold)} to ${pct(b.threshold)}, and the model did not change at all. The right setting depends on what each mistake costs.`);
    await ui.say('pip', 'I can tell you how suspicious a mail looks. I cannot tell you what a mistake costs. That part is yours.');

    return 1 + (a.total <= bestA.total ? 1 : 0) + (b.total <= bestB.total ? 1 : 0);
  }

  FP.chapters.push({
    title: 'The Dial',
    concept: 'false positives vs. false negatives',
    lesson: 'A detector gives a score, not an answer. Wherever you cut, you trade missed attacks against false alarms, and the costs decide the cut.',
    run,
  });
})(globalThis.FP);
