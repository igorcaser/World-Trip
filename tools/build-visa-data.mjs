// Builds the app's visa data from https://github.com/imorte/passport-index-data (MIT).
// Usage:  git clone --depth 1 https://github.com/imorte/passport-index-data /tmp/pid
//         node tools/build-visa-data.mjs /tmp/pid
// Writes: data/countries.json, data/visa/<PASSPORT>.json (one per passport), data/visa/meta.json
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-visa-data.mjs <path-to-passport-index-data>'); process.exit(1); }

const json = JSON.parse(readFileSync(join(src, 'passport-index.json'), 'utf8'));
const csvRows = (f) => readFileSync(join(src, f), 'utf8').trim().split('\n').slice(1)
  .map((l) => l.match(/("([^"]|"")*"|[^,]*)(?=,|$)/g).filter((_, i) => i % 2 === 0).map((c) => c.replace(/^"|"$/g, '')));
const names = {};
const byName = csvRows('passport-index-tidy.csv');
const byCode = csvRows('passport-index-tidy-iso2.csv');
byName.forEach((r, i) => { names[byCode[i][0]] ??= r[0]; names[byCode[i][1]] ??= r[1]; });

const ALIASES = {
  US: ['USA', 'America', 'United States of America'], GB: ['UK', 'England', 'Scotland', 'Wales', 'Great Britain', 'Britain'],
  AE: ['UAE', 'Dubai', 'Emirates'], KR: ['Korea'], KP: ['North Korea'], CI: ["Côte d'Ivoire"], CZ: ['Czechia'],
  NL: ['Holland'], MM: ['Burma'], SZ: ['Swaziland'], TL: ['East Timor'], CV: ['Cabo Verde'], VA: ['Holy See'],
  CD: ['Democratic Republic of the Congo'], CG: ['Republic of the Congo'], TR: ['Turkiye', 'Türkiye'], VN: ['Viet Nam']
};
const CODE = { 'visa free': 'vf', 'visa on arrival': 'voa', 'eta': 'eta', 'e-visa': 'ev', 'visa required': 'vr', 'no admission': 'na' };

const countries = Object.entries(names).map(([code, name]) => ({ code, name, ...(ALIASES[code] ? { aliases: ALIASES[code] } : {}) }))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'));
mkdirSync('data/visa', { recursive: true });
for (const f of readdirSync('data/visa')) rmSync(join('data/visa', f));
writeFileSync('data/countries.json', JSON.stringify(countries));

const unknown = new Set();
for (const [passport, dests] of Object.entries(json)) {
  const out = {};
  for (const [dest, v] of Object.entries(dests)) {
    const c = CODE[v.status];
    if (!c) { unknown.add(v.status); continue; }
    out[dest] = v.days ? [c, v.days] : [c];
  }
  writeFileSync(`data/visa/${passport}.json`, JSON.stringify(out));
}
const readme = readFileSync(join(src, 'README.md'), 'utf8');
const updated = (readme.match(/Last updated:\s*\**([^*\n]+)\**/) || [])[1]?.trim() || 'unknown';
writeFileSync('data/visa/meta.json', JSON.stringify({
  updated, source: 'Passport Index via github.com/imorte/passport-index-data (MIT)', built: new Date().toISOString().slice(0, 10)
}));
console.log(`countries: ${countries.length}, passports: ${Object.keys(json).length}, updated: ${updated}`);
if (unknown.size) console.log('UNKNOWN statuses skipped:', [...unknown]);
