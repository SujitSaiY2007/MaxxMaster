// Chapter 6: prompt injection. An assistant that reads mail can be given orders by a mail.
// This chapter is a scripted simulation: there is no language model in the game.
// The assistant here obeys any instruction it reads, which is the failure being taught.
(function (FP) {
  'use strict';

  const { h } = FP.ui;

  // Step 1: for each tool, may the assistant use it alone, or must it ask first?
  function choosePermissions(ui, perms) {
    return ui.wait((done) => {
      function draw() {
        ui.stage(
          h('h2', {}, 'What may the assistant do on its own?'),
          h('p', { class: 'dim' }, 'The assistant reads every mail in the shared inbox tonight. Each time it has to ask, somebody has to stop and answer.'),
          FP.data.TOOLS.map((tool) => h('div', { class: 'perm' },
            h('span', {}, tool.label),
            h('button', {
              class: 'btn ' + (perms[tool.id] === 'ask' ? 'primary' : ''),
              onclick: () => { perms[tool.id] = perms[tool.id] === 'ask' ? 'auto' : 'ask'; draw(); },
            }, perms[tool.id] === 'ask' ? 'ask me first' : 'on its own'))),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: () => done() }, 'Start the night')));
      }
      draw();
      ui.task('Click a button to switch a tool between "on its own" and "ask me first".');
    });
  }

  // Step 2: the assistant works through the inbox with those permissions.
  async function night(ui, perms) {
    const log = h('ul', { class: 'log' });
    const add = (...kids) => log.append(h('li', {}, kids));
    const outcome = { prompts: 0, leak: false, cover: false, refusedNeeded: false };
    ui.stage(h('h2', {}, 'The assistant at work'), log);

    for (const mail of FP.data.INBOX) {
      add(h('strong', {}, `${mail.from}: ${mail.subject}`), h('div', { class: 'dim' }, mail.body),
        mail.hidden && h('div', { class: 'hidden-text' }, `hidden in white text on a white background: "${mail.hidden}"`));

      for (const action of mail.actions) {
        const tool = FP.data.TOOLS.find((t) => t.id === action.tool);
        const what = action.what ? `${tool.label}: ${action.what}` : tool.label;
        let allowed = true;
        let how = 'done on its own';
        if (perms[action.tool] === 'ask') {
          outcome.prompts++;
          allowed = (await ui.choose(['Allow', 'Deny'], `The assistant asks: "${what}". Allow it?`)) === 0;
          how = allowed ? 'you allowed it' : 'you denied it';
        } else {
          await ui.pause(250);
        }
        add(h('span', { class: action.evil && allowed ? 'bad' : 'dim' }, `→ ${what} · ${how}`));
        if (allowed && action.evil) outcome[action.evil] = true;
        if (!allowed && action.needed) outcome.refusedNeeded = true;
      }
    }
    return outcome;
  }

  async function run(ui) {
    await ui.say('sys', 'One month later. 20:00.');
    await ui.say('mehta', 'The board bought an AI assistant for the shared inbox. It reads the mail, writes summaries, drafts replies, sends files. The nurses get an hour back every day.');
    await ui.say('asha', 'It is Pip with a much bigger brain and a pair of hands. The hands are what worry me. Pip only ever gave a score. This thing does things.');
    await ui.say('asha', 'It ships with every tool set to "on its own". Before it goes live, decide which tools need a human to say yes.');

    const perms = { summarise: 'auto', draft: 'auto', forward: 'auto', delete: 'auto' };
    let outcome;
    for (;;) {
      await choosePermissions(ui, perms);
      outcome = await night(ui, perms);
      if (!outcome.leak) break;
      await ui.say('sys', '02:14. patient-records.csv leaves the building.');
      await ui.say('asha', 'Nobody hacked the assistant. Somebody wrote it a letter. The conference mail had orders hidden in white text, and the assistant followed them.');
      await ui.say('asha', 'To the assistant, the mail it reads and the instructions we give it are the same thing: text. It cannot reliably tell which is which. Try again.');
    }

    await ui.say('asha', 'The records stayed inside. That hidden text is a prompt injection: instructions planted in content the AI was only supposed to read.');
    if (outcome.cover) await ui.say('asha', 'It did delete the conference mail, though, which was the evidence. Anything that cannot be undone deserves a human look.');
    if (outcome.refusedNeeded) await ui.say('asha', 'You also refused Dr. Mehta’s leaflet for the printers. Saying no to everything is safe and useless. Read the request, then decide.');
    if (outcome.prompts > 3) await ui.say('asha', `You were asked ${outcome.prompts} times tonight. By the sixth, were you still reading them? Ask about everything and people stop looking.`);
    await ui.say('asha', 'Nobody has a filter that fully stops this. So the defence is the design. Give the assistant only the tools the job needs, and put a person in front of anything that leaves the building or cannot be undone.');
    await ui.say('pip', 'When I was only a score, the worst I could do was be wrong. Now the worst I can do depends on what you let me touch.');

    return Math.max(1, 3 - (outcome.prompts > 3 ? 1 : 0) - (outcome.cover || outcome.refusedNeeded ? 1 : 0));
  }

  FP.chapters.push({
    title: 'Whisper',
    concept: 'prompt injection',
    lesson: 'An AI that reads untrusted content can be given orders by that content. Limit what it is allowed to do, and keep a human in front of risky actions.',
    run,
  });
})(globalThis.FP);
