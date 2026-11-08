// To-do list feature: text + checkbox. Done items move to the bottom.
function sortTodos(list) {
  const open = list.filter((t) => !t.done).sort((a, b) => a.createdAt - b.createdAt);
  const done = list.filter((t) => t.done).sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0));
  return open.concat(done);
}

export function create(container, { data, ui }) {
  const { el, toast, confirmAction } = ui;
  let stopId = null;
  let editingId = null;

  const input = el('input');
  input.type = 'text'; input.placeholder = 'Add a to-do'; input.maxLength = 500;
  input.autocomplete = 'off'; input.required = true; input.setAttribute('aria-label', 'New to-do');
  const addBtn = el('button', 'btn primary', 'Add'); addBtn.type = 'submit';
  const form = el('form', 'add-row', input, addBtn);
  const list = el('ul', 'list');
  const empty = el('p', 'empty', 'No to-dos yet. Add the first one above.'); empty.hidden = true;
  const dlg = el('dialog');
  dlg.innerHTML = `<form class="form"><h2>Edit to-do</h2>
    <label>Text<input type="text" maxlength="500" autocomplete="off" required></label>
    <p class="error" role="alert"></p>
    <div class="actions"><button type="button" class="btn" data-cancel>Cancel</button>
    <button type="submit" class="btn primary">Save</button></div></form>`;
  const editForm = dlg.querySelector('form');
  const editInput = dlg.querySelector('input');
  const editError = dlg.querySelector('.error');
  container.append(form, list, empty, dlg);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!stopId) return;
    if (!text) { toast('Please type something first.'); return; }
    data.addTodo(stopId, text);
    input.value = '';
    input.focus();
  });
  dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = editInput.value.trim();
    if (!text) { editError.textContent = 'Please type something.'; return; }
    data.updateTodoText(editingId, text);
    dlg.close();
  });

  function openEdit(t) {
    editingId = t.id; editInput.value = t.text; editError.textContent = '';
    dlg.showModal();
  }
  function row(t) {
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = t.done;
    cb.setAttribute('aria-label', `Done: ${t.text}`);
    cb.addEventListener('change', () => data.setDone(t.id, cb.checked));
    const text = el('button', 'todo-text', t.text); text.type = 'button';
    text.addEventListener('click', () => openEdit(t));
    const del = el('button', 'icon-btn', '✕'); del.type = 'button';
    del.setAttribute('aria-label', 'Delete to-do');
    del.addEventListener('click', async () => {
      if (await confirmAction('Delete this to-do?')) data.deleteTodo(t.id);
    });
    return el('li', 'item todo' + (t.done ? ' done' : ''), el('label', 'check', cb), text, del);
  }

  return {
    update({ stop, state }) {
      stopId = stop.id;
      const todos = sortTodos(state.todos.filter((t) => t.stopId === stop.id));
      list.replaceChildren(...todos.map(row));
      empty.hidden = todos.length > 0 || !state.todosReady;
    }
  };
}
