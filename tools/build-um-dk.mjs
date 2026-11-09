// Builds data/um-dk.json: ISO-2 code -> [travel-advice slug, passport-and-visa slug] on um.dk (Danish foreign ministry).
// Usage (run from the project folder, needs internet): node tools/build-um-dk.mjs
// Reads the two um.dk index pages, matches the Danish country names to ISO codes, applies the manual
// overrides below, then checks that every link answers 200. Re-run when refreshing the visa data.
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://um.dk/rejse-og-ophold/rejse-til-udlandet/';
const ADVICE = BASE + 'rejsevejledninger/';
const VISA = BASE + 'pas-og-visum/';

// Names that do not match automatically: [advice slug, visa slug]
const OVERRIDES = {
  CG: ['republikken-congo', 'congo-brazille'],
  CD: ['den-demokratiske-republik-congo', 'den-demokratiske-republik-congo'],
  AE: ['forenede-arabiske-emirater', 'de-forenede-arabiske-emirater'],
  MM: ['myanmar', 'myanmar'],
  PS: ['palaestina', 'palaestina'],
  TW: ['taipei', 'taiwan'],
  TL: ['oesttimor', 'oesttimor'],
  KP: ['nord-korea', 'nordkorea-den-demokratiske-folkerepublik'],
  MH: ['marshall-oeerne', 'martinique-og-guadeloupe'], // um.dk's own address for the Marshall Islands visa page; re-check on refresh
  FM: ['mikronesien', null]
};

const decode = (s) => s.replace(/&#x([0-9A-F]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&').trim();
const fold = (s) => s.toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const fold2 = (s) => s.toLowerCase().replace(/[æå]/g, 'a').replace(/ø/g, 'o').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

async function slugs(base) {
  const html = await (await fetch(base)).text();
  const re = new RegExp(`href="${base.replace('https://um.dk', '')}([^"/]+)/"[^>]*>\\s*(?:<[^>]+>\\s*)*([^<]+)`, 'g');
  const out = {};
  for (const [, slug, name] of html.matchAll(re)) out[slug] ??= decode(name);
  return out;
}
const index = (o) => { const m = {}; for (const [s, n] of Object.entries(o)) for (const k of [fold(n), fold2(n), fold(s), fold2(s)]) m[k] = s; return m; };

const [advice, visa] = await Promise.all([slugs(ADVICE), slugs(VISA)]);
const ia = index(advice), iv = index(visa);
const dn = new Intl.DisplayNames(['da'], { type: 'region' });
const codes = JSON.parse(readFileSync('data/countries.json', 'utf8')).map((c) => c.code);

const out = {};
for (const code of codes.sort()) {
  let pair = OVERRIDES[code];
  if (!pair) {
    const n = dn.of(code);
    pair = [ia[fold(n)] || ia[fold2(n)] || null, iv[fold(n)] || iv[fold2(n)] || null];
  }
  if (pair[0] || pair[1]) out[code] = pair;
}

// Check every link answers 200.
const urls = Object.values(out).flatMap(([a, v]) => [a && ADVICE + a + '/', v && VISA + v + '/']).filter(Boolean);
const bad = [];
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < urls.length) { const u = urls[next++]; const r = await fetch(u); if (r.status !== 200) bad.push(`${r.status} ${u}`); }
}));

writeFileSync('data/um-dk.json', JSON.stringify(out));
console.log(`countries with a um.dk page: ${Object.keys(out).length} of ${codes.length}; links checked: ${urls.length}`);
console.log('without any um.dk page:', codes.filter((c) => !out[c]).join(' ') || 'none');
if (bad.length) { console.log('BROKEN LINKS:'); bad.forEach((b) => console.log(' ', b)); process.exitCode = 1; }
