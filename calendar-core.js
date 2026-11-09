// Pure calendar logic (no DOM): easy to test. Dates are "YYYY-MM-DD" strings.
// Bar colours follow the brand (brand.md); fg is chosen for >= 4.5:1 contrast on bg.
export const PALETTE = [
  { bg: '#1F3A5F', fg: '#F3E9D2' }, // navy
  { bg: '#B5483B', fg: '#FFFFFF' }, // faded red
  { bg: '#D9A441', fg: '#1F3A5F' }, // gold
  { bg: '#4A6A94', fg: '#FFFFFF' }, // light navy
  { bg: '#8A3328', fg: '#F3E9D2' }, // dark red
  { bg: '#96691A', fg: '#FFFFFF' }  // dark gold
];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];
const DAY = 86400000;
export const toMs = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const toIso = (ms) => new Date(ms).toISOString().slice(0, 10);
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// {start, end} from an arrival and/or departure; a single date gives a one-day range; none gives null.
export function dateRange(a, b) {
  const x = a || b; const y = b || a;
  if (!x) return null;
  return x <= y ? { start: x, end: y } : { start: y, end: x };
}

// Stable colour per country: its position in the sorted list of all countries.
export function colourMap(sortedStops) {
  return new Map(sortedStops.map((s, i) => [s.id, PALETTE[i % PALETTE.length]]));
}

// bars = dated countries, cities = dated places; counts of what has no dates.
export function buildItems(stops, places, onlyStopId = null) {
  const chosen = onlyStopId ? stops.filter((s) => s.id === onlyStopId) : stops;
  const ids = new Set(chosen.map((s) => s.id));
  const bars = []; const cities = [];
  let undatedStops = 0; let undatedPlaces = 0;
  for (const s of chosen) {
    const r = dateRange(s.arrival, s.departure);
    if (r) bars.push({ stopId: s.id, name: s.name, ...r }); else undatedStops++;
  }
  for (const p of places) {
    if (!ids.has(p.stopId)) continue;
    const r = dateRange(p.arrival, p.departure);
    if (r) cities.push({ placeId: p.id, stopId: p.stopId, name: p.name, ...r }); else undatedPlaces++;
  }
  const cmp = (a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.name.localeCompare(b.name, 'en');
  return { bars: bars.sort(cmp), cities: cities.sort(cmp), undatedStops, undatedPlaces };
}

// Weeks (Monday first) covering a month. month = 0..11.
export function monthGrid(year, month) {
  const first = Date.UTC(year, month, 1);
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const rows = Math.ceil((lead + days) / 7);
  return Array.from({ length: rows }, (_, r) => Array.from({ length: 7 }, (_, c) => {
    const ms = first - lead * DAY + (r * 7 + c) * DAY;
    const d = new Date(ms);
    return { iso: toIso(ms), day: d.getUTCDate(), inMonth: d.getUTCMonth() === month };
  }));
}

// Where bars and city names go inside one week row.
export function weekLayout(week, bars, cities, maxCities = 2) {
  const first = week[0].iso; const last = week[6].iso;
  const segs = bars.filter((b) => b.end >= first && b.start <= last).map((b) => ({
    bar: b,
    from: b.start < first ? 0 : week.findIndex((d) => d.iso === b.start),
    to: b.end > last ? 6 : week.findIndex((d) => d.iso === b.end),
    startsHere: b.start >= first, endsHere: b.end <= last
  }));
  const lanes = [];
  for (const seg of segs) {
    let l = lanes.findIndex((end) => end < seg.from);
    if (l < 0) { l = lanes.length; lanes.push(-1); }
    lanes[l] = seg.to; seg.lane = l;
  }
  const perDay = week.map((d) => {
    const here = cities.filter((c) => c.start <= d.iso && c.end >= d.iso);
    return { shown: here.slice(0, maxCities), more: Math.max(0, here.length - maxCities) };
  });
  return { segs, laneCount: lanes.length, perDay };
}

export function initialMonth(items, today) {
  const all = [...items.bars, ...items.cities];
  const ym = (iso) => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1 });
  if (!all.length) return ym(today);
  const t = today.slice(0, 7);
  if (all.some((i) => i.start.slice(0, 7) <= t && i.end.slice(0, 7) >= t)) return ym(today);
  return ym(all.map((i) => i.start).sort()[0]);
}
export function shiftMonth({ y, m }, delta) {
  const n = y * 12 + m + delta;
  return { y: Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
}
