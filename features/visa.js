// Visa / Documentation: visa status per traveller and passport (built-in table, indicative),
// stay warning, official links, and notes that can be copied into the to-do list.
import { countryName, localName } from '../countries.js';

export const LABEL = { own: 'Own country', vf: 'Visa free', voa: 'Visa on arrival', eta: 'Electronic authorisation (eta)',
  ev: 'e-visa', vr: 'Visa required', na: 'Entry not permitted', none: 'No data for this country' };
const RANK = { own: 0, vf: 1, voa: 2, eta: 3, ev: 4, vr: 5, na: 6, none: 7 };
const TONE = { own: 'ok', vf: 'ok', voa: 'ok', eta: 'mid', ev: 'mid', vr: 'bad', na: 'bad', none: 'none' };

// table = { DEST: [code, days?] } for one passport
export function statusFor(table, passport, dest) {
  if (passport === dest) return { code: 'own' };
  const e = table && table[dest];
  return e ? { code: e[0], days: e[1] } : { code: 'none' };
}
export function statusText(s) {
  return s.days ? `${LABEL[s.code]} · ${s.days} days` : LABEL[s.code];
}
// Index of the easiest status, or -1 if there is only one or the best ones tie.
export function easiestIndex(statuses) {
  if (statuses.length < 2) return -1;
  const days = (s) => s.days ?? ((s.code === 'vf' || s.code === 'own') ? Infinity : 0);
  const cmp = (a, b) => (RANK[a.code] - RANK[b.code]) || (days(b) - days(a) || 0);
  let best = 0;
  for (let i = 1; i < statuses.length; i++) if (cmp(statuses[i], statuses[best]) < 0) best = i;
  return statuses.some((s, i) => i !== best && cmp(s, statuses[best]) === 0) ? -1 : best;
}
// Days of stay counting both the arrival and the departure day; null if a date is missing.
export function stayDays(arrival, departure) {
  if (!arrival || !departure) return null;
  const t = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(departure) - t(arrival)) / 86400000) + 1;
}

const google = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const MINISTRIES = {
  DK: { label: 'Danish foreign ministry travel advice (um.dk)', lang: 'da', q: (n) => `site:um.dk rejsevejledning ${n}` },
  IT: { label: 'Viaggiare Sicuri (Italian foreign ministry)', lang: 'it', q: (n) => `site:viaggiaresicuri.it ${n}` },
  BR: { label: 'Itamaraty (Brazilian foreign ministry): visas', lang: 'pt-BR', q: (n) => `site:gov.br/mre vistos ${n}` }
};
export function officialLinks(code, heldPassports) {
  const en = countryName(code);
  const links = Object.entries(MINISTRIES).filter(([p]) => heldPassports.has(p))
    .map(([, m]) => ({ label: m.label, url: google(m.q(localName(code, m.lang))) }));
  links.push(
    { label: 'CDC travel health (vaccines)', url: google(`site:wwwnc.cdc.gov/travel/destinations ${en}`) },
    { label: 'WHO vaccination requirements', url: google(`site:who.int vaccination requirements international travellers ${en}`) },
    { label: 'Official immigration / visa website', url: google(`${en} official government immigration visa website`) });
  return links;
}

// Visa tables are static files, loaded per passport and kept in memory (the service worker keeps them offline).
const tables = new Map(); // passport -> Promise<table|null>
const loaded = new Map(); // passport -> table|null (settled)
const failedAt = new Map(); // passport -> time of the last failed download
function loadTable(p) {
  if (!tables.has(p)) {
    // 404 = no data for this passport -> empty table (final). Network error (offline) -> null, retried later.
    tables.set(p, fetch(`data/visa/${p}.json`).then((r) => (r.ok ? r.json() : r.status === 404 ? {} : null)).catch(() => null)
      .then((t) => { loaded.set(p, t); if (!t) { tables.delete(p); failedAt.set(p, Date.now()); } return t; }));
  }
  return tables.get(p);
}
let metaPromise = null;
let meta = null;
function loadMeta() {
  metaPromise ??= fetch('data/visa/meta.json').then((r) => r.json()).then((m) => { meta = m; return m; })
    .catch(() => { metaPromise = null; return null; });
  return metaPromise;
}

export function create(container, { data, ui }) {
  const { el, toast, confirmAction } = ui;
  let ctx = null;
  let editingId = null;

  const notice = el('p', 'notice');
  const cards = el('div', 'cards');
  const linksTitle = el('h2', 'section-title', 'Check before you go');
  const linksHint = el('p', 'sub', 'Passport validity, entry forms and vaccinations: check these official sources and write what you find in the notes.');
  const links = el('ul', 'list');
  const notesTitle = el('h2', 'section-title', 'Notes');
  const input = el('input');
  input.type = 'text'; input.placeholder = 'Add a note'; input.maxLength = 500;
  input.autocomplete = 'off'; input.setAttribute('aria-label', 'New note');
  const addBtn = el('button', 'btn primary', 'Add'); addBtn.type = 'submit';
  const form = el('form', 'add-row', input, addBtn);
  const notes = el('ul', 'list');
  const notesEmpty = el('p', 'empty small', 'No notes yet.'); notesEmpty.hidden = true;
  const dlg = el('dialog');
  dlg.innerHTML = `<form class="form"><h2>Edit note</h2>
    <label>Text<input type="text" maxlength="500" autocomplete="off" required></label>
    <p class="error" role="alert"></p>
    <div class="actions"><button type="button" class="btn" data-cancel>Cancel</button>
    <button type="submit" class="btn primary">Save</button></div></form>`;
  const editInput = dlg.querySelector('input');
  const editError = dlg.querySelector('.error');
  container.append(notice, cards, linksTitle, linksHint, links, notesTitle, form, notes, notesEmpty, dlg);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!ctx) return;
    if (!text) { toast('Please type something first.'); return; }
    data.addNote(ctx.stop.id, 'visa', text);
    input.value = ''; input.focus();
  });
  dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
  dlg.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = editInput.value.trim();
    if (!text) { editError.textContent = 'Please type something.'; return; }
    if (!ctx.state.notes.some((n) => n.id === editingId)) toast('This note was deleted on the other phone.');
    else data.updateNote(editingId, text);
    dlg.close();
  });

  function message(text, buttonLabel, onClick) {
    const b = el('button', 'btn primary', buttonLabel); b.type = 'button';
    b.addEventListener('click', onClick);
    return el('div', 'card center', el('p', '', text), b);
  }

  function renderCards() {
    const { stop, state, actions } = ctx;
    notice.textContent = `Indicative only${meta ? ` — visa data from ${meta.updated}` : ''}. Always check the official source before you travel.`;
    if (!stop.countryCode) {
      cards.replaceChildren(message('Pick the country from the list to see visa information.', 'Pick country', () => actions.editStop(stop)));
      return;
    }
    if (!state.travellersReady) { cards.replaceChildren(); return; }
    if (!state.travellers.length) {
      cards.replaceChildren(message('Add the travellers and their passports first.', 'Add travellers', () => actions.goTravellers()));
      return;
    }
    const stay = stayDays(stop.arrival, stop.departure);
    cards.replaceChildren(...state.travellers.map((t) => {
      const statuses = t.passports.map((p) => statusFor(loaded.get(p), p, stop.countryCode));
      const complete = t.passports.every((p) => p === stop.countryCode || loaded.get(p));
      const best = complete ? easiestIndex(statuses) : -1; // no 'Easiest' while some data is missing
      const lines = t.passports.map((p, i) => {
        const s = statuses[i];
        const pending = !loaded.has(p);
        const missing = loaded.has(p) && loaded.get(p) === null && s.code !== 'own';
        const text = pending && s.code !== 'own' ? 'Loading…' : missing ? 'Visa data not available (go online once)' : statusText(s);
        const line = el('li', 'pass-line',
          el('div', 'pass-name', `${countryName(p)} passport`),
          el('div', 'pass-status', el('span', `status ${missing || pending ? 'none' : TONE[s.code]}`, text),
            ...(i === best ? [el('span', 'easiest', 'Easiest')] : [])));
        if (stay && s.days && stay > s.days && s.code !== 'own') {
          line.append(el('p', 'warn', `Your stay of ${stay} days is longer than the ${s.days} days allowed.`));
        }
        return line;
      });
      return el('section', 'card trav', el('h3', '', t.name), el('ul', 'pass-list', ...lines));
    }));
  }

  function renderLinks() {
    const { stop, state } = ctx;
    if (!stop.countryCode) { links.replaceChildren(); linksTitle.hidden = linksHint.hidden = true; return; }
    linksTitle.hidden = linksHint.hidden = false;
    const held = new Set(state.travellers.flatMap((t) => t.passports));
    links.replaceChildren(...officialLinks(stop.countryCode, held).map((l) => {
      const a = el('a', 'row', el('div', 'main', el('div', 'name', l.label)), el('span', 'chev', '↗'));
      a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      return el('li', 'item', a);
    }));
  }

  function renderNotes() {
    const { stop, state } = ctx;
    const list = state.notes.filter((n) => n.stopId === stop.id && n.feature === 'visa')
      .sort((a, b) => a.createdAt - b.createdAt);
    notes.replaceChildren(...list.map((n) => {
      const text = el('button', 'todo-text', n.text); text.type = 'button';
      text.addEventListener('click', () => { editingId = n.id; editInput.value = n.text; editError.textContent = ''; dlg.showModal(); });
      const toTodo = el('button', 'btn small', 'To-do'); toTodo.type = 'button';
      toTodo.setAttribute('aria-label', `Add to to-dos: ${n.text}`);
      toTodo.addEventListener('click', () => { data.addTodo(stop.id, n.text); toast('Added to to-dos.'); });
      const del = el('button', 'icon-btn', '✕'); del.type = 'button';
      del.setAttribute('aria-label', 'Delete note');
      del.addEventListener('click', async () => { if (await confirmAction('Delete this note?')) data.deleteNote(n.id); });
      return el('li', 'item note', text, toTodo, del);
    }));
    notesEmpty.hidden = list.length > 0 || !state.notesReady;
    if (dlg.open && editingId && !state.notes.some((n) => n.id === editingId)) {
      dlg.close(); toast('This note was deleted on the other phone.');
    }
  }

  function renderAll() { renderCards(); renderLinks(); renderNotes(); }

  return {
    update(next) {
      ctx = next;
      renderAll();
      const need = ctx.stop.countryCode ? ctx.state.travellers.flatMap((t) => t.passports).filter((p) => !loaded.has(p) || (loaded.get(p) === null && navigator.onLine && Date.now() - (failedAt.get(p) || 0) > 30000)) : [];
      const metaNeeded = !meta;
      if (need.length || metaNeeded) {
        Promise.all([...need.map(loadTable), metaNeeded ? loadMeta() : null]).then(() => { if (ctx) renderAll(); });
      }
    }
  };
}
