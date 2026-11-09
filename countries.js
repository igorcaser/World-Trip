// Country list (ISO-2 code + English name + search aliases), loaded once from data/countries.json.
let list = [];
const byCode = new Map();
let promise = null;

export function loadCountries() {
  promise ??= fetch('data/countries.json').then((r) => r.json()).then((l) => {
    list = l; l.forEach((c) => byCode.set(c.code, c)); return l;
  }).catch((e) => { promise = null; console.error(e); return []; });
  return promise;
}
export const countries = () => list;
export const countryName = (code) => byCode.get(code)?.name || code;
// Country name in another language (for searches on foreign-ministry sites), e.g. ('JP','it') -> 'Giappone'.
export function localName(code, lang) {
  try { return new Intl.DisplayNames([lang], { type: 'region' }).of(code) || countryName(code); }
  catch { return countryName(code); }
}
