// Places feature: a city name that is a link to an online "what to do here" page, with optional dates.
import { fmtDate, datesText } from '../ui.js';

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

// Places with dates first (by arrival, same date: order added), undated places after them (order added).
function sortPlaces(list) {
  const key = (p) => p.arrival || p.departure || null;
  return [...list].sort((a, b) => {
    const ka = key(a); const kb = key(b);
    if (ka && kb) return ka.localeCompare(kb) || a.createdAt - b.createdAt;
    if (ka) return -1;
    if (kb) return 1;
    return a.createdAt - b.createdAt;
  });
}
// A dated place is "outside" if the country has no full date range or a place date is outside it.
export function isOutside(p, stop) {
  if (!p.arrival && !p.departure) return false;
  if (!stop.arrival || !stop.departure) return true;
  return [p.arrival, p.departure].some((d) => d && (d < stop.arrival || d > stop.departure));
}

export function create(container, { data, ui }) {
  const { el, toast, confirmAction, normName, plural } = ui;
  let current = { stop: null, state: null };
  let editing = null; // { id, name, provider, arrival, departure } as shown when the edit dialog opened

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
    <label>Arrival (optional)<span class="date-row"><input data-arr type="date"><button type="button" class="link" data-clear-arr>Clear</button></span></label>
    <label>Departure (optional)<span class="date-row"><input data-dep type="date"><button type="button" class="link" data-clear-dep>Clear</button></span></label>
    <p class="sub" data-hint hidden>Add the country's dates first.</p>
    <p class="error" role="alert"></p>
    <div class="actions"><button type="button" class="btn danger" data-delete>Delete</button>
    <button type="button" class="btn" data-cancel>Cancel</button>
    <button type="submit" class="btn primary">Save</button></div></form>`;
  const editForm = dlg.querySelector('form');
  const editInput = dlg.querySelector('input');
  const select = dlg.querySelector('select');
  const editError = dlg.querySelector('.error');
  const arrIn = dlg.querySelector('[data-arr]');
  const depIn = dlg.querySelector('[data-dep]');
  const hint = dlg.querySelector('[data-hint]');
  const clearArr = dlg.querySelector('[data-clear-arr]');
  const clearDep = dlg.querySelector('[data-clear-dep]');
  clearArr.addEventListener('click', () => { arrIn.value = ''; });
  clearDep.addEventListener('click', () => { depIn.value = ''; });
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
    const arrival = arrIn.value || null;
    const departure = depIn.value || null;
    const stop = current.stop;
    if (!name) { editError.textContent = 'Please enter a city.'; return; }
    if (arrival !== editing.arrival || departure !== editing.departure) { // dates are only checked when they were changed
      if (arrival && departure && departure < arrival) { editError.textContent = "Departure can't be before arrival."; return; }
      if ([arrival, departure].some((d) => d && (d < stop.arrival || d > stop.departure))) {
        editError.textContent = `Dates must be inside the country's stay (${fmtDate(stop.arrival)} – ${fmtDate(stop.departure)}).`;
        return;
      }
    }
    if (!current.state.places.some((p) => p.id === editing.id)) {
      toast('This place was deleted on the other phone.'); dlg.close(); return;
    }
    if (name !== editing.name && isDuplicate(name, editing.id) &&
        !(await confirmAction(`${name} is already in the list for ${current.stop.name}. Use the same name anyway?`, 'Save anyway', false))) return;
    const changes = {};
    if (name !== editing.name) changes.name = name;
    if (provider !== editing.provider) changes.provider = provider;
    if (arrival !== editing.arrival) changes.arrival = arrival;
    if (departure !== editing.departure) changes.departure = departure;
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
    editing = { id: p.id, name: p.name, provider: PROVIDERS[p.provider] ? p.provider : 'maps',
      arrival: p.arrival || null, departure: p.departure || null };
    editInput.value = editing.name; select.value = editing.provider; editError.textContent = '';
    const stop = current.stop;
    const hasRange = !!(stop.arrival && stop.departure);
    arrIn.value = editing.arrival || ''; depIn.value = editing.departure || '';
    const canArr = hasRange || !!editing.arrival, canDep = hasRange || !!editing.departure;
    arrIn.disabled = clearArr.disabled = !canArr;
    depIn.disabled = clearDep.disabled = !canDep;
    hint.hidden = canArr && canDep;
    dlg.showModal();
  }
  function row(p, stop) {
    const provider = PROVIDERS[p.provider] ? p.provider : 'maps';
    const dates = datesText(p, '');
    const main = el('div', 'main', el('div', 'name', p.name),
      el('div', 'sub', `${dates ? `${dates} · ` : ''}${PROVIDERS[provider]} ↗`));
    if (isOutside(p, stop)) main.append(el('div', 'warn', "Outside the country's dates"));
    const a = el('a', 'row place-link', main);
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
      const places = sortPlaces(state.places.filter((p) => p.stopId === stop.id));
      list.replaceChildren(...places.map((p) => row(p, stop)));
      empty.hidden = places.length > 0 || !state.placesReady;
      if (dlg.open && editing && !state.places.some((p) => p.id === editing.id)) {
        dlg.close(); toast('This place was deleted on the other phone.');
      }
    }
  };
}
