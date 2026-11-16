// Chapter 3: anomaly detection. Pip learns what normal looks like and flags the rest.
(function (FP) {
  'use strict';

  const { h, svg } = FP.ui;

  // Plot geometry: x = hour of day (0..24), y = megabytes downloaded (0..160).
  const W = 520, H = 280, LEFT = 46, RIGHT = 22, TOP = 10, BOTTOM = 30;
  const px = (hour) => LEFT + (hour / 24) * (W - LEFT - RIGHT);
  const py = (mb) => H - BOTTOM - (mb / 160) * (H - TOP - BOTTOM);
  const clock = (hour) => `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.floor((hour % 1) * 60)).padStart(2, '0')}`;

  function plot(detector, week) {
    const el = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'plot', role: 'img', 'aria-label': 'Logins by time of day and download size' });
    el.append(
      svg('line', { x1: LEFT, y1: H - BOTTOM, x2: W - RIGHT, y2: H - BOTTOM, class: 'axis-line' }),
      svg('line', { x1: LEFT, y1: TOP, x2: LEFT, y2: H - BOTTOM, class: 'axis-line' }));
    for (const hour of [0, 6, 12, 18, 24]) el.append(svg('text', { x: px(hour), y: H - 10, class: 'tick', 'text-anchor': 'middle' }, `${hour}:00`));
    for (const mb of [0, 50, 100, 150]) el.append(svg('text', { x: LEFT - 6, y: py(mb) + 3, class: 'tick', 'text-anchor': 'end' }, `${mb} MB`));

    // The "normal zone": k standard deviations around the average, in both directions.
    // The clip keeps the zone from spilling over the axes.
    const clip = svg('clipPath', { id: 'plot-area' }, svg('rect', { x: LEFT, y: TOP, width: W - LEFT - RIGHT, height: H - TOP - BOTTOM }));
    const zone = svg('ellipse', { cx: px(detector.mean.hour), cy: py(detector.mean.mb), class: 'zone', 'clip-path': 'url(#plot-area)' });
    const live = svg('g', {});
    el.append(clip, zone, ...week.map((e) => svg('circle', { cx: px(e.hour), cy: py(e.mb), r: 2.5, class: 'past' })), live);

    const setK = (k) => {
      zone.setAttribute('rx', (k * detector.sd.hour * (W - LEFT - RIGHT)) / 24);
      zone.setAttribute('ry', (k * detector.sd.mb * (H - TOP - BOTTOM)) / 160);
    };
    return { el, live, setK };
  }

  // One attempt: choose a sensitivity, watch a day of logins, read the alarms.
  async function attempt(ui, detector, week, day, startK) {
    const view = plot(detector, week);
    const slider = h('input', { type: 'range', min: 1.5, max: 5, step: 0.1, value: startK, 'aria-label': 'Size of the normal zone' });
    const label = h('span', {});
    const go = h('button', { class: 'btn primary' }, 'Watch the next 24 hours');
    const alarms = h('ul', { class: 'log' });
    const update = () => {
      view.setK(Number(slider.value));
      label.textContent = `normal zone: ${Number(slider.value).toFixed(1)} standard deviations wide`;
    };
    slider.addEventListener('input', update);
    update();

    ui.stage(
      h('h2', {}, 'What does normal look like?'),
      h('p', { class: 'dim' }, 'Grey dots: last week’s logins. The green zone is what Pip will call normal. Anything outside it rings an alarm.'),
      view.el, slider, h('div', { class: 'row' }, label, go), alarms);
    ui.task('Set how wide "normal" is. Small zone: more alarms. Large zone: fewer.');

    const k = await ui.wait((done) => go.addEventListener('click', () => done(Number(slider.value))));
    slider.disabled = go.disabled = true;
    ui.task('Watching…');

    const flagged = [];
    for (const event of day) {
      const alarm = detector.isAnomaly(event, k);
      view.live.append(svg('circle', { cx: px(event.hour), cy: py(event.mb), r: alarm ? 6 : 3, class: alarm ? 'alarm' : 'event' }));
      if (alarm) flagged.push(event);
      await ui.pause(140);
    }

    const row = (event, verdict, tone) => h('li', {}, h('span', { class: tone }, verdict), ` · ${clock(event.hour)} · ${event.who} · ${Math.round(event.mb)} MB · ${event.note}`);
    const missed = day.filter((e) => e.attack && !flagged.includes(e));
    alarms.append(
      ...flagged.map((e) => (e.attack ? row(e, 'ALARM, real attack', 'bad') : row(e, 'ALARM, harmless', 'dim'))),
      ...missed.map((e) => row(e, 'NO ALARM, missed attack', 'bad')));

    return {
      k,
      loud: flagged.filter((e) => e.attack && !e.quiet).length, // out of 2
      quiet: flagged.some((e) => e.quiet),
      falseAlarms: flagged.filter((e) => !e.attack).length,
    };
  }

  async function run(ui) {
    const D = FP.data;
    const week = D.logins(60, 11);
    const detector = new FP.anomaly.AnomalyDetector(['hour', 'mb']).fit(week);
    const day = D.nextDay();

    await ui.say('sys', 'One week later. 23:10.');
    await ui.say('asha', 'The phishing slowed down. I do not like it. I think one of those mails worked, and somebody out there now has a real password.');
    await ui.say('asha', 'A stolen password is not phishing. There is no mail to score and no example to learn from. So Pip will do something different.');
    await ui.say('pip', 'I watched a week of logins: what time, and how much data. I do not know what an attack looks like. I only know what a normal day looks like.');
    await ui.say('asha', 'Anything far from normal rings my phone. You decide how far is "far". Catch the break-in without waking me five times for nothing.');

    let result = null;
    for (;;) {
      result = await attempt(ui, detector, week, day, result ? result.k : 2.5);
      if (result.loud < 2) await ui.say('asha', 'Too relaxed. A pharmacy login at half past two at night was "normal enough" and slid past.');
      else if (result.falseAlarms > 3) await ui.say('asha', `${result.falseAlarms} false alarms in one day. By Friday nobody reads the alerts any more. That has a name: alert fatigue.`);
      else await ui.say('asha', `Both night-time break-ins caught, ${result.falseAlarms} false alarm${result.falseAlarms === 1 ? '' : 's'}. I can live with that.`);
      if (result.quiet) await ui.say('asha', `You even caught the quiet one in the lab. It took a zone so tight that ${result.falseAlarms} honest people set it off too.`);
      else await ui.say('asha', 'Now look at the one with no alarm: the lab, mid-afternoon, 58 MB. That was the attacker too, staying inside normal on purpose. This detector cannot see an attacker who behaves normally.');
      if ((await ui.choose(['File the report', 'Try another setting'], 'Keep this setting?')) === 0) break;
    }

    await ui.say('pip', 'Nobody ever showed me an attack. That is why I could flag one I had never seen before.');
    await ui.say('asha', 'And why you flagged Dr. Okafor for working late. Unusual is not the same as malicious. The alarm starts the investigation. A person finishes it.');

    return result.loud === 2 && result.falseAlarms <= 1 ? 3 : result.loud === 2 && result.falseAlarms <= 3 ? 2 : 1;
  }

  FP.chapters.push({
    title: 'Normal',
    concept: 'anomaly detection',
    lesson: 'Learning "normal" catches attacks nobody has seen before, with no labels. But unusual is not malicious, and a careful attacker can hide inside normal.',
    run,
  });
})(globalThis.FP);
