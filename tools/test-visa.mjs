// Checks for the pure functions in features/visa.js and the data/um-dk.json links.  Run: node tools/test-visa.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { statusFor, statusText, easiestIndex, stayDays, stayText, formatRange, officialLinks } from '../features/visa.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok  ', name); };

t('statusFor: own country, known, unknown', () => {
  assert.deepEqual(statusFor({}, 'IT', 'IT'), { code: 'own' });
  assert.deepEqual(statusFor({ JP: ['vf', 90] }, 'IT', 'JP'), { code: 'vf', days: 90 });
  assert.deepEqual(statusFor({ JP: ['vf'] }, 'IT', 'JP'), { code: 'vf', days: undefined });
  assert.deepEqual(statusFor({}, 'IT', 'JP'), { code: 'none' });
  assert.deepEqual(statusFor(null, 'IT', 'JP'), { code: 'none' });
});
t('statusText', () => {
  assert.equal(statusText({ code: 'vf', days: 90 }), 'Visa free · 90 days');
  assert.equal(statusText({ code: 'voa' }), 'Visa on arrival');
});
t('easiestIndex: order of ease and ties', () => {
  assert.equal(easiestIndex([{ code: 'vr' }]), -1);
  assert.equal(easiestIndex([{ code: 'ev' }, { code: 'vf', days: 30 }]), 1);
  assert.equal(easiestIndex([{ code: 'vf', days: 30 }, { code: 'vf', days: 90 }]), 1);
  assert.equal(easiestIndex([{ code: 'vf', days: 90 }, { code: 'vf', days: 90 }]), -1);
  assert.equal(easiestIndex([{ code: 'vr' }, { code: 'eta' }]), 1);
  assert.equal(easiestIndex([{ code: 'voa' }, { code: 'eta' }]), 0);
  assert.equal(easiestIndex([{ code: 'na' }, { code: 'vr' }]), 1);
  assert.equal(easiestIndex([{ code: 'own' }, { code: 'vf', days: 90 }]), 0);
});
t('stayDays counts arrival and departure day', () => {
  assert.equal(stayDays('2027-03-01', '2027-03-20'), 20);
  assert.equal(stayDays('2027-03-01', '2027-03-01'), 1);
  assert.equal(stayDays('2027-02-27', '2027-03-02'), 4);
  assert.equal(stayDays('2027-12-30', '2028-01-02'), 4);
  assert.equal(stayDays('2028-02-28', '2028-03-01'), 3); // leap year
  assert.equal(stayDays(null, '2027-03-20'), null);
  assert.equal(stayDays('2027-03-01', null), null);
});
t('stayText: days and nights', () => {
  assert.equal(stayText(20), '20 days / 19 nights');
  assert.equal(stayText(1), '1 day / 0 nights');
  assert.equal(stayText(2), '2 days / 1 night');
});
t('formatRange', () => {
  assert.equal(formatRange('2027-03-01', '2027-03-20'), '1–20 Mar');
  assert.equal(formatRange('2027-02-28', '2027-03-03'), '28 Feb – 3 Mar');
  assert.equal(formatRange('2027-12-28', '2028-01-03'), '28 Dec 2027 – 3 Jan 2028');
  assert.equal(formatRange('2027-03-01', '2027-03-01'), '1 Mar');
});

const UM = 'https://um.dk/rejse-og-ophold/rejse-til-udlandet/';
const um = JSON.parse(readFileSync(new URL('../data/um-dk.json', import.meta.url), 'utf8'));
const all = new Set(['DK', 'IT', 'BR']);
const find = (links, part) => links.find((l) => l.label.includes(part));
t('data/um-dk.json: Japan and China as given by the client', () => {
  assert.equal(`${UM}rejsevejledninger/${um.JP[0]}/`, UM + 'rejsevejledninger/japan/');
  assert.equal(`${UM}rejsevejledninger/${um.CN[0]}/`, UM + 'rejsevejledninger/kina/');
  assert.equal(`${UM}pas-og-visum/${um.JP[1]}/`, UM + 'pas-og-visum/japan/');
});
t('officialLinks: direct Danish links', () => {
  const l = officialLinks('JP', all, um);
  assert.equal(find(l, 'travel advice (um.dk)').url, UM + 'rejsevejledninger/japan/');
  assert.equal(find(l, 'passport & visa').url, UM + 'pas-og-visum/japan/');
  assert.equal(find(officialLinks('CN', all, um), 'travel advice (um.dk)').url, UM + 'rejsevejledninger/kina/');
  assert.equal(find(officialLinks('TW', all, um), 'passport & visa').url, UM + 'pas-og-visum/taiwan/');
  assert.equal(l.length, 7); // 2 Danish + Italian + Brazilian + CDC + WHO + immigration
});
t('officialLinks: fallback to search when um.dk has no page or data is missing', () => {
  for (const [code, data] of [['HK', um], ['MO', um], ['JP', null], ['JP', {}]]) {
    const l = officialLinks(code, all, data);
    assert.match(find(l, 'travel advice (um.dk)').url, /^https:\/\/www\.google\.com\/search\?q=site%3Aum\.dk/);
    assert.match(find(l, 'passport & visa').url, /^https:\/\/www\.google\.com\/search\?q=site%3Aum\.dk/);
  }
  assert.match(find(officialLinks('FM', all, um), 'travel advice (um.dk)').url, /mikronesien/); // has advice page
  assert.match(find(officialLinks('FM', all, um), 'passport & visa').url, /google\.com/);       // no visa page
});
t('officialLinks: only ministries of held passports; CDC, WHO, immigration always', () => {
  const it = officialLinks('JP', new Set(['IT']), um);
  assert.equal(it.length, 4);
  assert.ok(!it.some((l) => l.label.includes('um.dk')));
  const none = officialLinks('JP', new Set(), um);
  assert.deepEqual(none.map((l) => l.label.split(' ')[0]), ['CDC', 'WHO', 'Official']);
});
t('data/um-dk.json: valid shape', () => {
  for (const [code, pair] of Object.entries(um)) {
    assert.match(code, /^[A-Z]{2}$/);
    assert.equal(pair.length, 2);
    for (const slug of pair) assert.ok(slug === null || /^[a-z-]+$/.test(slug), `${code}: ${slug}`);
  }
});
console.log(`\n${n} checks passed`);
