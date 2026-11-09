// Month calendar drawing (used by the whole-trip page and the country tile).
import { el, plural } from './ui.js';
import * as core from './calendar-core.js';

export function createCalendar(container) {
  let ym = core.shiftMonth({ y: new Date().getFullYear(), m: new Date().getMonth() }, 0);
  let auto = true; // follow the data until the user taps an arrow
  let items = core.buildItems([], []);
  let colours = new Map();
  let onlyStop = false;

  const nav = (label, text) => { const b = el('button', 'cal-nav', text); b.type = 'button'; b.setAttribute('aria-label', label); return b; };
  const prev = nav('Previous month', '‹');
  const next = nav('Next month', '›');
  const title = el('h2', 'cal-title');
  const dow = el('div', 'cal-dow', ...['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => el('span', '', d)));
  const grid = el('div', 'cal-grid');
  const foot = el('p', 'cal-foot');
  container.append(el('div', 'cal-head', prev, title, next), dow, grid, foot);
  prev.addEventListener('click', () => { auto = false; ym = core.shiftMonth(ym, -1); draw(); });
  next.addEventListener('click', () => { auto = false; ym = core.shiftMonth(ym, 1); draw(); });

  const at = (node, col, row) => { node.style.gridColumn = col; node.style.gridRow = row; return node; };

  function weekEl(week) {
    const lay = core.weekLayout(week, items.bars, items.cities);
    const row = el('div', 'cal-week');
    row.style.gridTemplateRows = `auto repeat(${lay.laneCount}, 20px) minmax(30px, auto)`;
    const today = core.todayIso();
    week.forEach((d, c) => {
      const cell = at(el('div', 'cal-cell'), c + 1, '1 / -1');
      if (c === 0) cell.style.borderLeft = '0';
      row.append(cell,
        at(el('div', 'cal-day' + (d.inMonth ? '' : ' out') + (d.iso === today ? ' today' : ''), el('span', '', String(d.day))), c + 1, 1));
    });
    for (const s of lay.segs) {
      const col = colours.get(s.bar.stopId) || core.PALETTE[0];
      const bar = at(el('div', 'cal-bar' + (s.startsHere ? ' start' : '') + (s.endsHere ? ' end' : ''), s.bar.name),
        `${s.from + 1} / ${s.to + 2}`, s.lane + 2);
      bar.style.background = col.bg; bar.style.color = col.fg;
      bar.title = `${s.bar.name}: ${s.bar.start} – ${s.bar.end}`;
      row.append(bar);
    }
    lay.perDay.forEach((p, c) => {
      if (!p.shown.length) return;
      const box = at(el('div', 'cal-cities'), c + 1, lay.laneCount + 2);
      for (const city of p.shown) {
        const t = el('div', 'cal-city', city.name);
        t.style.borderLeftColor = (colours.get(city.stopId) || core.PALETTE[0]).bg;
        t.title = city.name;
        box.append(t);
      }
      if (p.more) box.append(el('div', 'cal-more', `+${p.more}`));
      row.append(box);
    });
    return row;
  }

  function draw() {
    title.textContent = `${core.MONTH_NAMES[ym.m]} ${ym.y}`;
    grid.replaceChildren(...core.monthGrid(ym.y, ym.m).map(weekEl));
    const parts = [];
    if (items.undatedStops) parts.push(plural(items.undatedStops, 'country', 'countries'));
    if (items.undatedPlaces) parts.push(plural(items.undatedPlaces, 'place', 'places'));
    foot.textContent = onlyStop && items.undatedStops ? 'Not shown: this country has no dates.'
      : parts.length ? `Not shown: ${parts.join(' and ')} without dates.` : '';
    foot.hidden = !parts.length;
  }

  return {
    // data = { stops, places, onlyStopId (optional), order (all countries, sorted) }
    update(data) {
      onlyStop = !!data.onlyStopId;
      items = core.buildItems(data.stops, data.places, data.onlyStopId || null);
      colours = core.colourMap(data.order);
      if (auto) ym = core.initialMonth(items, core.todayIso());
      draw();
    }
  };
}
