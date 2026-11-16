// Menu, progress and chapter flow.
(function (FP) {
  'use strict';

  const { $, h } = FP.ui;
  const SAVE_KEY = 'false-positive-save';

  // Progress is { stars: [3, 2, ...], unlockAll: true|false }. If the browser refuses
  // localStorage (private mode, file:// in some browsers) the game still runs, unsaved.
  function load() {
    try {
      return JSON.parse(localStorage.getItem(SAVE_KEY)) || {};
    } catch (err) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
    } catch (err) {
      /* play on without saving */
    }
  }

  let progress = load();
  const starsFor = (i) => (progress.stars && progress.stars[i]) || 0;
  const unlocked = (i) => progress.unlockAll || i === 0 || starsFor(i - 1) > 0;
  const finished = () => FP.chapters.every((_, i) => starsFor(i) > 0);

  function header(text, inChapter) {
    $('crumb').textContent = text;
    $('menu-btn').hidden = !inChapter;
    $('dialogue').hidden = !inChapter;
    window.scrollTo(0, 0);
  }

  function menu() {
    FP.ui.abort();
    header('FALSE POSITIVE', false);

    const stop = (i) => {
      const ch = FP.chapters[i];
      return h('li', { class: starsFor(i) ? 'done' : '' },
        h('button', { class: 'stop', disabled: !unlocked(i), onclick: () => play(i) },
          h('span', { class: 'dim' }, String(i + 1).padStart(2, '0')),
          h('span', {}, ch.title),
          h('span', { class: 'dim concept' }, ch.concept),
          h('span', { class: 'stars' }, starsFor(i) ? FP.ui.stars(starsFor(i)) : unlocked(i) ? 'play' : 'locked')));
    };
    const epilogueOpen = progress.unlockAll || finished();

    FP.ui.stage(
      h('h1', {}, 'FALSE POSITIVE'),
      h('p', { class: 'tagline' }, 'A short story game about AI in security. Six night shifts at a small clinic. Train a model, tune it, attack it, defend it.'),
      h('div', { class: 'act' }, 'ACT I · THE SHIELD · AI that protects'),
      h('ol', { class: 'path' }, [0, 1, 2].map(stop)),
      h('div', { class: 'act' }, 'ACT II · THE TARGET · AI that gets attacked'),
      h('ol', { class: 'path' }, [3, 4, 5].map(stop),
        h('li', { class: finished() ? 'done' : '' },
          h('button', { class: 'stop', disabled: !epilogueOpen, onclick: epilogue },
            h('span', { class: 'dim' }, '—'), h('span', {}, 'Epilogue'), h('span', { class: 'dim concept' }, 'shift report'), h('span', { class: 'stars' }, epilogueOpen ? 'read' : 'locked')))),
      h('div', { class: 'foot' },
        h('button', { class: 'link', onclick: () => { progress.unlockAll = !progress.unlockAll; save(); menu(); } }, progress.unlockAll ? 'lock chapters again' : 'unlock all chapters'),
        h('button', { class: 'link', onclick: () => { progress = {}; save(); menu(); } }, 'reset progress')));
  }

  async function play(i) {
    const chapter = FP.chapters[i];
    header(`CHAPTER ${i + 1} · ${chapter.title.toUpperCase()}`, true);
    FP.ui.stage();
    try {
      const stars = await chapter.run(FP.ui);
      progress.stars = progress.stars || [];
      progress.stars[i] = Math.max(starsFor(i), stars);
      save();

      FP.ui.stage(h('div', { class: 'card center' },
        h('p', { class: 'dim' }, `Chapter ${i + 1} complete`),
        h('h2', {}, chapter.title),
        h('p', { class: 'stars' }, FP.ui.stars(stars)),
        h('p', {}, chapter.lesson)));
      const last = i + 1 === FP.chapters.length;
      const pick = await FP.ui.choose([last ? 'Epilogue' : 'Next chapter', 'Back to chapters'], 'End of shift.');
      if (pick === 1) menu();
      else if (last) epilogue();
      else play(i + 1);
    } catch (err) {
      if (err !== FP.ui.ABORT) throw err; // ABORT just means the player went back to the menu
    }
  }

  async function epilogue() {
    header('EPILOGUE', true);
    FP.ui.stage();
    try {
      await FP.ui.say('sys', '06:00. Grey light over the car park. The night shift is ending.');
      await FP.ui.say('vesper', 'You taught it well. I will come back when it has forgotten. — V');
      await FP.ui.say('asha', 'They will, too. That is the job. The attacker changes, so the model has to keep learning, and somebody has to keep checking what it learns.');
      await FP.ui.say('pip', 'I did not replace you. I read every mail so that you could think about the ten that mattered.');
      FP.ui.stage(
        h('h2', {}, 'Shift report'),
        FP.chapters.map((ch, i) => h('div', { class: 'card' },
          h('h3', {}, `${i + 1} · ${ch.title} · ${ch.concept} `, h('span', { class: 'stars' }, FP.ui.stars(starsFor(i)))),
          h('p', {}, ch.lesson))));
      await FP.ui.choose(['Back to chapters'], 'Six ideas. AI is a shield, and it is also a new thing to protect.');
      menu();
    } catch (err) {
      if (err !== FP.ui.ABORT) throw err;
    }
  }

  FP.ui.init();
  $('menu-btn').addEventListener('click', menu);
  menu();
})(globalThis.FP);
