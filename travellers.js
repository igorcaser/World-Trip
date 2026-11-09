// Travellers screen: names + passports, stored privately in Firestore (settings/travellers).
import { countries, countryName } from './countries.js';

const MAX_TRAVELLERS = 6;
const MAX_PASSPORTS = 4;

export function create(container, { data, ui }) {
  const { el, confirmAction, countryPicker } = ui;
  let list = [];
  let editingIndex = null; // null = new traveller
  let draft = null;

  const intro = el('p', 'sub', 'Names and passports are stored privately and used for the Visa / Documentation page.');
  const ul = el('ul', 'list');
  const empty = el('p', 'empty', 'No travellers yet. Add the first one.'); empty.hidden = true;
  const addBtn = el('button', 'btn primary wide', '+ Add traveller'); addBtn.type = 'button';
  const dlg = el('dialog');
  dlg.innerHTML = `<form class="form"><h2></h2>
    <label>Name<input data-name type="text" maxlength="40" autocomplete="off" required></label>
    <div class="field"><span class="field-label">Passports</span><ul class="chips"></ul><div data-picker></div></div>
    <p class="error" role="alert"></p>
    <div class="actions"><button type="button" class="btn danger" data-delete hidden>Remove</button>
    <button type="button" class="btn" data-cancel>Cancel</button>
    <button type="submit" class="btn primary">Save</button></div></form>`;
  const heading = dlg.querySelector('h2');
  const nameInput = dlg.querySelector('[data-name]');
  const chips = dlg.querySelector('.chips');
  const error = dlg.querySelector('.error');
  const delBtn = dlg.querySelector('[data-delete]');
  const picker = countryPicker(countries, { placeholder: 'Add a passport: search country' });
  dlg.querySelector('[data-picker]').append(picker.el);
  container.append(intro, ul, empty, addBtn, dlg);

  function renderChips() {
    chips.replaceChildren(...draft.passports.map((p) => {
      const x = el('button', 'chip-x', '✕'); x.type = 'button';
      x.setAttribute('aria-label', `Remove ${countryName(p)} passport`);
      x.addEventListener('click', () => { draft.passports = draft.passports.filter((q) => q !== p); renderChips(); });
      return el('li', 'chip', `${countryName(p)} passport`, x);
    }));
    picker.el.hidden = draft.passports.length >= MAX_PASSPORTS;
  }
  picker.el.addEventListener('pick', (e) => {
    const c = e.detail.code;
    if (!draft.passports.includes(c) && draft.passports.length < MAX_PASSPORTS) draft.passports.push(c);
    picker.set(null, '');
    error.textContent = '';
    renderChips();
  });

  function open(i) {
    editingIndex = i;
    const t = i == null ? { name: '', passports: [] } : list[i];
    draft = { name: t.name, passports: [...t.passports] };
    heading.textContent = i == null ? 'Add traveller' : 'Edit traveller';
    nameInput.value = draft.name;
    delBtn.hidden = i == null;
    error.textContent = '';
    picker.set(null, '');
    renderChips();
    dlg.showModal();
  }
  addBtn.addEventListener('click', () => open(null));
  dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
  dlg.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) { error.textContent = 'Please enter a name.'; return; }
    if (!draft.passports.length) { error.textContent = 'Add at least one passport.'; return; }
    const next = [...list];
    const t = { name, passports: draft.passports };
    if (editingIndex == null) next.push(t); else next[editingIndex] = t;
    data.saveTravellers(next);
    dlg.close();
  });
  delBtn.addEventListener('click', async () => {
    const i = editingIndex;
    dlg.close();
    if (i == null || !list[i]) return;
    if (await confirmAction(`Remove ${list[i].name} from the travellers?`, 'Remove')) {
      data.saveTravellers(list.filter((_, j) => j !== i));
    }
  });

  return {
    update({ state }) {
      list = state.travellers;
      ul.replaceChildren(...list.map((t, i) => {
        const b = el('button', 'row',
          el('div', 'main', el('div', 'name', t.name),
            el('div', 'sub', t.passports.map((p) => `${countryName(p)} passport`).join(', '))),
          el('span', 'chev', '›'));
        b.type = 'button';
        b.addEventListener('click', () => open(i));
        return el('li', 'item', b);
      }));
      empty.hidden = list.length > 0 || !state.travellersReady;
      addBtn.hidden = list.length >= MAX_TRAVELLERS;
    }
  };
}
