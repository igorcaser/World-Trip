// Places feature: a city name that is a link to an online "what to do here" page.
export const PROVIDERS = { maps: 'Google Maps', tripadvisor: 'TripAdvisor', wikivoyage: 'Wikivoyage' };

// Links are never stored: built from the city + country name when the list is drawn.
export function placeLink(provider, city, country) {
  const enc = encodeURIComponent;
  switch (provider) {
    case 'tripadvisor': return `https://www.tripadvisor.com/Search?q=${enc(`${city} ${country}`)}`;
    case 'wikivoyage': return `https://en.wikivoyage.org/wiki/Special:Search?search=${enc(`${city} ${country}`)}&go=Go`;
    default: return `https://www.google.com/maps/search/?api=1&query=${enc(`things to do in ${city}, ${country}`)}`;
  }
}

export function create(container, { data, ui }) {
  const { el, toast, confirmAction, normName, plural } = ui;
  let current = { stop: null, state: null };
  let editing = null; // { id, name, provider } as shown when the edit dialog opened

  const input = el('input');
  input.type = 'text'; input.placeholder = 'Add a city'; input.maxLength = 80;
  input.autocomplete = 'off'; input.required = true; input.setAttribute('aria-label', 'New city');
  const addBtn = el('button', 'btn primary', 'Add'); addBtn.type = 'submit';
  const form = el('form', 'add-row', input, addBtn);
  const list = el('ul', 'list');
  const empty = el('p', 'empty', 'No places yet. Add the first city above.'); empty.hidden = true;
  const dlg = el('dialog');
  dlg.innerHTML = `<form class="form"><h2>Edit place</h2>
    <label>City<input type="text" maxlength="80" autocomplete="off" required></label>
    <label>Link opens<select>${Object.entries(PROVIDERS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <p class="error" role="alert"></p>
    <div class="actions"><button type="button" class="btn danger" data-delete>Delete</button>
    <button type="button" class="btn" data-cancel>Cancel</button>
    <button type="submit" class="btn primary">Save</button></div></form>`;
  const editForm = dlg.querySelector('form');
  const editInput = dlg.querySelector('input');
  const select = dlg.querySelector('select');
  const editError = dlg.querySelector('.error');
  container.append(form, list, empty, dlg);

  const isDuplicate = (name, exceptId) => current.state.places.some((p) =>
    p.stopId === current.stop.id && p.id !== exceptId && normName(p.name) === normName(name));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { stop } = current;
    if (!stop) return;
    const name = input.value.trim();
    if (!name) { toast('Please type a city first.'); return; }
    if (isDuplicate(name, null) &&
        !(await confirmAction(`${name} is already in the list for ${stop.name}. Add it anyway?`, 'Add anyway', false))) return;
    data.addPlace({ stopId: stop.id, name, provider: 'maps' });
    input.value = '';
    input.focus();
  });

  dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = editInput.value.trim();
    const provider = select.value;
    if (!name) { editError.textContent = 'Please enter a city.'; return; }
    if (!current.state.places.some((p) => p.id === editing.id)) {
      toast('This place was deleted on the other phone.'); dlg.close(); return;
    }
    if (name !== editing.name && isDuplicate(name, editing.id) &&
        !(await confirmAction(`${name} is already in the list for ${current.stop.name}. Use the same name anyway?`, 'Save anyway', false))) return;
    const changes = {};
    if (name !== editing.name) changes.name = name;
    if (provider !== editing.provider) changes.provider = provider;
    if (Object.keys(changes).length) data.updatePlace(editing.id, changes);
    dlg.close();
  });
  dlg.querySelector('[data-delete]').addEventListener('click', async () => {
    const place = current.state.places.find((p) => p.id === editing.id);
    dlg.close();
    if (!place) return;
    const linked = current.state.activities.filter((a) => a.placeId === place.id).map((a) => a.id);
    const extra = linked.length
      ? ` ${plural(linked.length, 'activity', 'activities')} linked to it will stay in the list, without a place.` : '';
    if (await confirmAction(`Delete ${place.name}?${extra}`)) data.deletePlace(place.id);
  });

  function openEdit(p) {
    editing = { id: p.id, name: p.name, provider: PROVIDERS[p.provider] ? p.provider : 'maps' };
    editInput.value = editing.name; select.value = editing.provider; editError.textContent = '';
    dlg.showModal();
  }
  function row(p, stop) {
    const provider = PROVIDERS[p.provider] ? p.provider : 'maps';
    const a = el('a', 'row place-link',
      el('div', 'main', el('div', 'name', p.name), el('div', 'sub', `${PROVIDERS[provider]} ↗`)));
    a.href = placeLink(provider, p.name, stop.name);
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    const edit = el('button', 'icon-btn', '✎'); edit.type = 'button';
    edit.setAttribute('aria-label', `Edit ${p.name}`);
    edit.addEventListener('click', () => openEdit(p));
    return el('li', 'item place', a, edit);
  }

  return {
    update({ stop, state }) {
      current = { stop, state };
      const places = state.places.filter((p) => p.stopId === stop.id).sort((a, b) => a.createdAt - b.createdAt);
      list.replaceChildren(...places.map((p) => row(p, stop)));
      empty.hidden = places.length > 0 || !state.placesReady;
      if (dlg.open && editing && !state.places.some((p) => p.id === editing.id)) {
        dlg.close(); toast('This place was deleted on the other phone.');
      }
    }
  };
}
