// The tiny "engine": building DOM elements, the dialogue box, and waiting for the player.
// Chapters are written as plain async functions:  await ui.say('asha', '...')
(function (FP) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const query = new URLSearchParams(location.search);
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const auto = query.has('auto'); // ?auto : dialogue advances by itself (used for automated playthroughs)
  const fast = auto || calm || query.has('fast'); // ?fast : no typewriter effect

  const ABORT = { aborted: true };
  const NAMES = { asha: 'Asha', pip: 'Pip', mehta: 'Dr. Mehta', vesper: 'Unknown sender', sys: '' };

  let pending = null; // reject() of whatever the game is waiting on right now
  let advance = null; // what a click on the dialogue box should do
  let timer = null; // typewriter interval

  // h('button', { class: 'btn', onclick: fn }, 'label', childNode, ...)
  function build(el, attrs, kids) {
    for (const [key, value] of Object.entries(attrs || {})) {
      if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
      else if (value !== false && value != null) el.setAttribute(key, value === true ? '' : value);
    }
    el.append(...kids.flat(Infinity).filter((k) => k != null && k !== false));
    return el;
  }
  const h = (tag, attrs, ...kids) => build(document.createElement(tag), attrs, kids);
  const svg = (tag, attrs, ...kids) => build(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs, kids);

  // Every pause in the game goes through wait(). That gives one place to cancel from
  // when the player leaves a chapter half-way: abort() rejects the promise in flight.
  function wait(setup) {
    return new Promise((resolve, reject) => {
      pending = reject;
      setup((value) => {
        if (pending !== reject) return; // a stale button from an abandoned screen
        pending = null;
        resolve(value);
      });
    });
  }

  function abort() {
    clearInterval(timer);
    advance = null;
    if (pending) {
      const reject = pending;
      pending = null;
      reject(ABORT);
    }
  }

  function setBox(mode, who, text) {
    const box = $('dialogue');
    box.hidden = false;
    box.className = mode;
    $('speaker').textContent = NAMES[who] === undefined ? who : NAMES[who];
    $('speaker').className = 'speaker ' + who;
    $('line').textContent = text;
    $('choices').replaceChildren();
  }

  // One line of story. Types itself out; a click finishes the typing, the next click continues.
  function say(who, text) {
    setBox('talking', who, fast ? text : '');
    if (auto) return Promise.resolve();
    return wait((done) => {
      let shown = fast ? text.length : 0;
      const finish = () => {
        clearInterval(timer);
        shown = text.length;
        $('line').textContent = text;
        $('dialogue').classList.add('ready');
      };
      if (fast) finish();
      else {
        timer = setInterval(() => {
          shown += 2;
          $('line').textContent = text.slice(0, shown);
          if (shown >= text.length) finish();
        }, 16);
      }
      advance = () => {
        if (shown < text.length) return finish();
        advance = null;
        done();
      };
    });
  }

  // An instruction for the player while they use the stage. Does not wait.
  function task(text) {
    setBox('task', 'your move', text);
  }

  // Buttons in the dialogue box. Resolves with the index of the one clicked.
  function choose(labels, prompt) {
    if (prompt) task(prompt);
    return wait((done) => {
      $('choices').replaceChildren(
        ...labels.map((label, i) => h('button', { class: 'btn', onclick: () => { $('choices').replaceChildren(); done(i); } }, label))
      );
    });
  }

  function stage(...kids) {
    $('stage').replaceChildren(...kids.flat(Infinity).filter(Boolean));
    return $('stage');
  }

  // A labelled horizontal bar:  bar('phishing caught', 0.75, '9 of 12', 'good')
  function bar(label, fraction, text, tone) {
    return h('div', { class: 'bar-row' },
      h('span', {}, label),
      h('span', { class: 'bar-track' }, h('span', { class: 'bar-fill ' + (tone || ''), style: `width:${Math.round(fraction * 100)}%` })),
      h('span', { class: 'bar-text' }, text));
  }

  const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  const pause = (ms) => (fast ? Promise.resolve() : wait((done) => setTimeout(done, ms)));

  function init() {
    $('dialogue').addEventListener('click', () => advance && advance());
    document.addEventListener('keydown', (e) => {
      const typing = /^(BUTTON|INPUT)$/.test(e.target.tagName);
      if ((e.key === 'Enter' || e.key === ' ') && advance && !typing) {
        e.preventDefault();
        advance();
      }
    });
  }

  FP.ui = { $, h, svg, wait, abort, say, task, choose, stage, bar, stars, pause, init, ABORT };
  FP.chapters = [];
})((globalThis.FP = globalThis.FP || {}));
