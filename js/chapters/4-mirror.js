// Chapter 4: evasion. The player becomes the attacker and slips a mail past their own model.
(function (FP) {
  'use strict';

  const { h } = FP.ui;
  const { pct } = FP.util;

  async function run(ui) {
    const D = FP.data;
    const E = D.EVASION;
    const pip = D.trainPip();

    await ui.say('sys', 'The next night. 22:30.');
    await ui.say('asha', 'I found the mail that stole the password. Every dangerous word in it was misspelt on purpose: "acc0unt", "cl1ck". Pip waved it through.');
    await ui.say('asha', 'To understand how, you are going to do it yourself. Tonight you are the attacker. Here is a mail Pip blocks easily. Get it delivered.');
    await ui.say('pip', 'I will show you how much each word worries me. That is more than a real attacker gets. They have to guess by sending mails and watching what comes back.');

    // The puzzle: each disguise or added word costs one move.
    const crafted = await ui.wait((done) => {
      const words = E.text.split(' ').map((plain) => ({ plain, hidden: false }));
      const pads = [];
      const shown = (w) => (w.hidden ? D.disguise(w.plain) : w.plain);
      const text = () => words.map(shown).concat(pads).join(' ');
      const used = () => words.filter((w) => w.hidden).length + pads.length;
      const tone = (word) => {
        const evidence = pip.wordEvidence(word);
        return evidence > 0.5 ? 'hot' : evidence < -0.5 ? 'cool' : 'blind';
      };

      function draw() {
        const score = pip.score(text());
        const left = E.moves - used();
        ui.stage(
          h('h2', {}, 'Red team: get this mail past Pip'),
          h('p', { class: 'dim' }, 'Red words push Pip towards "phishing". Green words push towards "real". Dashed words Pip has never seen, so it ignores them.'),
          h('div', { class: 'mail words' },
            words.map((w) => h('button', {
              class: 'word ' + tone(shown(w)),
              disabled: !w.hidden && left === 0,
              onclick: () => { w.hidden = !w.hidden; draw(); },
            }, shown(w))),
            pads.map((pad, i) => h('button', { class: 'word ' + tone(pad), title: 'remove this word', onclick: () => { pads.splice(i, 1); draw(); } }, pad))),
          h('div', { class: 'row wrap' },
            h('span', { class: 'dim' }, 'add a friendly word:'),
            E.padding.filter((pad) => !pads.includes(pad)).map((pad) => h('button', {
              class: 'chip',
              disabled: left === 0 || pads.length >= E.maxPadding,
              onclick: () => { pads.push(pad); draw(); },
            }, '+ ' + pad))),
          ui.bar("Pip's suspicion", score, `${pct(score)} · ${score >= 0.5 ? 'blocked' : 'delivered'}`, score >= 0.5 ? 'bad' : 'good'),
          h('p', { class: 'dim' }, `moves left: ${left} of ${E.moves}`),
          h('div', { class: 'row' },
            h('button', { class: 'btn primary', disabled: score >= 0.5, onclick: () => done({ text: text(), moves: used(), score }) }, 'Send the mail'),
            h('button', { class: 'btn', onclick: () => { words.forEach((w) => { w.hidden = false; }); pads.length = 0; draw(); } }, 'Start over')));
      }

      draw();
      ui.task('Click a word to disguise it, or add friendly words. Get the score under 50, then send.');
    });

    await ui.say('pip', `Score ${pct(crafted.score)}. Looks fine to me. Delivered.`);
    await ui.say('asha', 'And a nurse still reads every one of those words without blinking. You did not fool the human. You fooled the counting.');
    await ui.say('asha', 'That is an evasion attack. Now that you know the hole, close it. Teach Pip to read look-alike letters, and add your own mail to its training, labelled phishing.');

    // The defence: normalise look-alike characters, and retrain with the attack as an example.
    const hardened = D.trainPip({ normalize: true, extra: [{ text: crafted.text, label: 'phish', weight: 2 }] });
    const after = hardened.score(crafted.text);
    ui.stage(
      h('h2', {}, 'The same mail, two Pips'),
      h('div', { class: 'mail' }, crafted.text),
      ui.bar('Pip, before', crafted.score, `${pct(crafted.score)} · delivered`, 'good'),
      ui.bar('Pip, hardened', after, `${pct(after)} · ${after >= 0.5 ? 'blocked' : 'delivered'}`, after >= 0.5 ? 'bad' : 'good'));
    await ui.say('pip', after >= 0.5 ? `Now I score your mail ${pct(after)}. Blocked.` : `I still score it ${pct(after)}. That trick needs another fix.`);
    await ui.say('asha', 'Good. And tomorrow the attacker finds the next hole, and we close that one too. It never ends: attack, retrain, attack.');
    await ui.say('asha', 'A model nobody has attacked is not a safe model. It is a model whose holes have not been found yet. So we look for them first.');

    return crafted.moves <= 6 ? 3 : crafted.moves === 7 ? 2 : 1;
  }

  FP.chapters.push({
    title: 'Mirror',
    concept: 'adversarial evasion',
    lesson: 'A model has blind spots, and attackers look for them. Defence is a loop: attack your own model, retrain it, repeat.',
    run,
  });
})(globalThis.FP);
