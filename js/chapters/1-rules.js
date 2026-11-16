// Chapter 1: hand-written rules against a model that learns from examples.
(function (FP) {
  'use strict';

  const { h } = FP.ui;
  const { pct } = FP.util;

  function report(title, result) {
    return h('div', { class: 'card' },
      h('h3', {}, title),
      FP.ui.bar('phishing caught', result.caught / result.phish, `${result.caught} of ${result.phish}`, 'good'),
      FP.ui.bar('real mail blocked', result.blocked.length / result.legit, `${result.blocked.length} of ${result.legit}`, 'bad'));
  }

  async function run(ui) {
    const D = FP.data;

    await ui.say('sys', 'Brightwater Clinic, 21:40. Your first night shift on the security desk.');
    await ui.say('asha', 'Welcome to nights. Three phishing mails reached the nurses last week. One wrong click and patient records walk out of the door.');
    await ui.say('asha', 'Our old filter is a block-list. If a mail contains a banned word, it is thrown away. Pick three words and let us see how far that gets you.');

    // Part 1: the player writes the rules.
    const banned = await ui.wait((done) => {
      const chosen = new Set();
      const deploy = h('button', { class: 'btn primary', disabled: true, onclick: () => done([...chosen]) }, 'Deploy block-list');
      const chips = D.KEYWORDS.map((word) => h('button', {
        class: 'chip',
        onclick: (e) => {
          if (chosen.has(word)) chosen.delete(word);
          else if (chosen.size < 3) chosen.add(word);
          e.currentTarget.classList.toggle('on', chosen.has(word));
          deploy.disabled = chosen.size !== 3;
        },
      }, word));
      ui.stage(
        h('h2', {}, 'The block-list'),
        h('p', { class: 'dim' }, 'Any mail that contains one of your three words is blocked.'),
        h('div', { class: 'chips' }, chips),
        deploy);
      ui.task('Choose three words to ban, then deploy.');
    });

    const rules = D.evaluate(D.ruleFilter(banned), D.TEST);
    ui.stage(h('h2', {}, "Last week's mail, replayed"), report(`Block-list: ${banned.join(', ')}`, rules));
    await ui.say('asha', `Your list caught ${rules.caught} of ${rules.phish} phishing mails and threw away ${rules.blocked.length} real ones.`);
    if (rules.blocked.length) await ui.say('asha', `This one was real, and you blocked it: "${rules.blocked[0].text}".`);
    if (rules.missed.length) await ui.say('asha', `This one walked straight past: "${rules.missed[0].text}". The attacker only has to avoid three words.`);
    await ui.say('asha', 'Rules are brittle. So we stop writing rules and show a machine examples instead. Meet Pip.');
    await ui.say('pip', 'Hello. I know nothing yet. Show me a mail, tell me what it is, and I will count the words.');

    // Part 2: the player labels eight mails, and Pip learns from exactly those labels.
    const labelled = [];
    for (let i = 0; i < D.LESSON.length; i++) {
      const mail = D.LESSON[i];
      const label = await ui.wait((done) => {
        ui.stage(
          h('h2', {}, `Teach Pip · ${i + 1} of ${D.LESSON.length}`),
          h('div', { class: 'mail' }, mail.text),
          h('div', { class: 'row' },
            h('button', { class: 'btn bad', onclick: () => done('phish') }, 'Phishing'),
            h('button', { class: 'btn good', onclick: () => done('legit') }, 'Real mail')));
        ui.task('Is this mail phishing, or real?');
      });
      labelled.push({ text: mail.text, label, truth: mail.label });
    }

    const wrong = labelled.filter((m) => m.label !== m.truth).length;
    const small = new FP.bayes.NaiveBayes().trainAll(labelled);
    const smallResult = D.check(small);
    ui.stage(h('h2', {}, "Last week's mail, replayed"), report('Block-list', rules), report('Pip, taught with 8 mails', smallResult));
    await ui.say('pip', `I learned from your 8 examples. I judged ${pct(smallResult.accuracy)}% of last week's mail correctly. Your block-list managed ${pct(rules.accuracy)}%.`);
    if (wrong) await ui.say('asha', `You mislabelled ${wrong} of the 8, by the way. Pip believed you. A model cannot tell when its teacher is wrong. Remember that.`);
    await ui.say('asha', 'Eight examples is not much. Here is my archive: every mail I labelled by hand this year.');

    // Part 3: the same algorithm with more data.
    const pip = D.trainPip();
    const fullResult = D.check(pip);
    const top = pip.topWords(6);
    ui.stage(
      h('h2', {}, "Last week's mail, replayed"),
      report('Block-list', rules),
      report('Pip, taught with 8 mails', smallResult),
      report(`Pip, taught with ${D.TRAIN.length} mails`, fullResult),
      h('div', { class: 'card' },
        h('h3', {}, 'What Pip learned'),
        h('p', {}, h('span', { class: 'dim' }, 'smells like phishing: '), top.phish.map((w) => h('span', { class: 'word hot' }, w.word))),
        h('p', {}, h('span', { class: 'dim' }, 'smells like real mail: '), top.legit.map((w) => h('span', { class: 'word cool' }, w.word)))));
    await ui.say('pip', `With ${D.TRAIN.length} examples I judge ${pct(fullResult.accuracy)}% correctly. Nobody gave me a rule. I counted which words appear in which kind of mail.`);
    await ui.say('asha', 'Look at its word list. "your" is on it. Pip does not understand language. It found a pattern in the counts, and the pattern happens to work.');
    await ui.say('asha', 'That is machine learning in security. Not one clever rule, but many weak clues added together. More examples, better clues.');

    return wrong === 0 ? 3 : wrong <= 2 ? 2 : 1;
  }

  FP.chapters.push({
    title: 'Rules',
    concept: 'rules vs. learning',
    lesson: 'A rule is written by hand and easy to dodge. A model learns many weak clues from examples, and it is only as good as those examples.',
    run,
  });
})(globalThis.FP);
