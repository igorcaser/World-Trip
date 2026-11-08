// Activities feature: title + optional notes (max 2000 chars) + optional link to a place of this country.
export function create(container, { data, ui }) {
  const { el, toast, confirmAction } = ui;
  let current = { stop: null, state: null };
  let editing = null; // null = adding; else { id, title, notes, placeId } as shown when the dialog opened

  const addBtn = el('button', 'btn primary wide', '+ Add activity'); addBtn.type = 'button';
  const list = el('ul', 'list');
  const empty = el('p', 'empty', 'No activities yet. Tap "Add activity" to start.'); empty.hidden = true;
  const dlg = el('dialog');
  dlg.innerHTML = `<form class="form"><h2></h2>
    <label>Title<input data-title type="text" maxlength="120" autocomplete="off" required></label>
    <label>Notes (optional)<textarea data-notes maxlength="2000" rows="6"></textarea></label>
    <label>Place (optional)<select></select></label>
    <p class="error" role="alert"></p>
    <div class="actions"><button type="button" class="btn danger" data-delete hidden>Delete</button>
    <button type="button" class="btn" data-cancel>Cancel</button>
    <button type="submit" class="btn primary">Save</button></div></form>`;
  const heading = dlg.querySelector('h2');
  const titleInput = dlg.querySelector('[data-title]');
  const notesInput = dlg.querySelector('[data-notes]');
  const select = dlg.querySelector('select');
  const error = dlg.querySelector('.error');
  const delBtn = dlg.querySelector('[data-delete]');
  container.append(addBtn, list, empty, dlg);

  function open(a) {
    const { stop, state } = current;
    const places = state.places.filter((p) => p.stopId === stop.id).sort((x, y) => x.createdAt - y.createdAt);
    select.replaceChildren(el('option', '', 'No place'), ...places.map((p) => {
      const o = el('option', '', p.name); o.value = p.id; return o;
    }));
    select.firstChild.value = '';
    const placeId = a && places.some((p) => p.id === a.placeId) ? a.placeId : null;
    editing = a ? { id: a.id, title: a.title, notes: a.notes || '', placeId } : null;
    heading.textContent = a ? 'Edit activity' : 'Add activity';
    titleInput.value = a ? a.title : '';
    notesInput.value = a ? (a.notes || '') : '';
    select.value = placeId || '';
    delBtn.hidden = !a;
    error.textContent = '';
    dlg.showModal();
  }
  addBtn.addEventListener('click', () => open(null));
  dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());

  dlg.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const notes = notesInput.value.trim();
    const placeId = select.value || null;
    if (!title) { error.textContent = 'Please enter a title.'; return; }
    if (editing) {
      if (!current.state.activities.some((a) => a.id === editing.id)) {
        toast('This activity was deleted on the other phone.');
      } else {
        const changes = {};
        if (title !== editing.title) changes.title = title;
        if (notes !== editing.notes) changes.notes = notes;
        if (placeId !== editing.placeId) changes.placeId = placeId;
        if (Object.keys(changes).length) data.updateActivity(editing.id, changes);
      }
    } else {
      data.addActivity({ stopId: current.stop.id, title, notes, placeId });
    }
    dlg.close();
  });
  delBtn.addEventListener('click', async () => {
    const id = editing && editing.id;
    dlg.close();
    if (id && await confirmAction('Delete this activity?')) data.deleteActivity(id);
  });

  function row(a, placesById) {
    const place = placesById.get(a.placeId);
    const main = el('div', 'main', el('div', 'name', a.title));
    if (place) main.append(el('div', 'sub', place.name));
    const btn = el('button', 'row act', main, el('span', 'chev', '›'));
    btn.type = 'button';
    btn.addEventListener('click', () => open(a));
    return el('li', 'item', btn);
  }

  return {
    update({ stop, state }) {
      current = { stop, state };
      const placesById = new Map(state.places.filter((p) => p.stopId === stop.id).map((p) => [p.id, p]));
      const acts = state.activities.filter((a) => a.stopId === stop.id).sort((a, b) => a.createdAt - b.createdAt);
      list.replaceChildren(...acts.map((a) => row(a, placesById)));
      empty.hidden = acts.length > 0 || !state.activitiesReady;
      if (dlg.open && editing && !state.activities.some((a) => a.id === editing.id)) {
        dlg.close(); toast('This activity was deleted on the other phone.');
      }
    }
  };
}
