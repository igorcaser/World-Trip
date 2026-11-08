import * as data from './data.js';

const $ = (id) => document.getElementById(id);
const state = { user: null, stops: [], todos: [], stopsReady: false };
let unsubs = [];
let currentView = null;
let editingStopId = null;
let editingTodoId = null;

/* ---------- helpers ---------- */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
function datesText(s) {
  if (s.arrival && s.departure) return `${fmtDate(s.arrival)} – ${fmtDate(s.departure)}`;
  if (s.arrival) return `Arrive ${fmtDate(s.arrival)}`;
  if (s.departure) return `Depart ${fmtDate(s.departure)}`;
  return 'No dates yet';
}
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });

// Stops with an arrival date first (date, then A-Z); stops without arrival date last (A-Z).
function sortStops(list) {
  return [...list].sort((a, b) => {
    if (a.arrival && b.arrival) return a.arrival.localeCompare(b.arrival) || byName(a, b) || a.createdAt - b.createdAt;
    if (a.arrival) return -1;
    if (b.arrival) return 1;
    return byName(a, b) || a.createdAt - b.createdAt;
  });
}
// Open to-dos first (oldest first), done to-dos at the bottom (earliest done first).
function sortTodos(list) {
  const open = list.filter((t) => !t.done).sort((a, b) => a.createdAt - b.createdAt);
  const done = list.filter((t) => t.done).sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0));
  return open.concat(done);
}
function el(tag, cls, ...children) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.append(...children);
  return n;
}
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}
function confirmAction(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    const dlg = $('confirm-dialog');
    $('confirm-text').textContent = message;
    $('confirm-ok').textContent = okLabel;
    dlg.returnValue = '';
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.showModal();
  });
}

/* ---------- views ---------- */
function show(name) {
  for (const v of ['login', 'stops-view', 'stop-view']) $(v).hidden = v !== name;
  if (name && name !== currentView) window.scrollTo(0, 0);
  currentView = name;
}
function render() {
  if (!state.user) return show('login');
  const m = location.hash.match(/^#\/stop\/([A-Za-z0-9]+)$/);
  if (!m) { show('stops-view'); return renderStops(); }
  if (!state.stopsReady) return show(null);
  const stop = state.stops.find((s) => s.id === m[1]);
  if (!stop) { location.hash = '#/'; return; } // deleted (maybe by the other user)
  show('stop-view');
  renderStop(stop);
}

function renderStops() {
  const counts = {};
  for (const t of state.todos) {
    const c = counts[t.stopId] || (counts[t.stopId] = { done: 0, total: 0 });
    c.total++; if (t.done) c.done++;
  }
  const list = $('stops');
  list.replaceChildren();
  for (const s of sortStops(state.stops)) {
    const c = counts[s.id] || { done: 0, total: 0 };
    const a = el('a', 'row stop',
      el('div', 'main', el('div', 'name', s.name), el('div', 'sub', datesText(s))),
      el('div', 'badge' + (c.total && c.done === c.total ? ' complete' : ''), `${c.done}/${c.total}`),
      el('span', 'chev', '›'));
    a.href = `#/stop/${s.id}`;
    list.append(el('li', 'item', a));
  }
  $('stops-empty').hidden = !state.stopsReady || state.stops.length > 0;
}

function renderStop(stop) {
  $('stop-title').textContent = stop.name;
  $('stop-dates').textContent = datesText(stop);
  const list = $('todos');
  list.replaceChildren();
  const todos = sortTodos(state.todos.filter((t) => t.stopId === stop.id));
  for (const t of todos) {
    const cb = el('input'); cb.type = 'checkbox'; cb.checked = t.done;
    cb.setAttribute('aria-label', 'Done');
    cb.addEventListener('change', () => data.setDone(t.id, cb.checked));
    const text = el('button', 'todo-text', t.text); text.type = 'button';
    text.addEventListener('click', () => openTodoEdit(t));
    const del = el('button', 'icon-btn', '✕'); del.type = 'button';
    del.setAttribute('aria-label', 'Delete to-do');
    del.addEventListener('click', async () => {
      if (await confirmAction('Delete this to-do?')) data.deleteTodo(t.id);
    });
    list.append(el('li', 'item todo' + (t.done ? ' done' : ''), el('label', 'check', cb), text, del));
  }
  $('todos-empty').hidden = todos.length > 0;
}

/* ---------- stop dialog (add / edit / delete) ---------- */
function openStopDialog(stop) {
  editingStopId = stop ? stop.id : null;
  $('stop-dialog-title').textContent = stop ? 'Edit country' : 'Add country';
  $('stop-name').value = stop ? stop.name : '';
  $('stop-arrival').value = stop?.arrival || '';
  $('stop-departure').value = stop?.departure || '';
  $('stop-error').textContent = '';
  $('stop-delete').hidden = !stop;
  $('stop-dialog').showModal();
}
$('add-stop').addEventListener('click', () => openStopDialog(null));
$('edit-stop').addEventListener('click', () => {
  const id = location.hash.split('/')[2];
  const stop = state.stops.find((s) => s.id === id);
  if (stop) openStopDialog(stop);
});
$('stop-cancel').addEventListener('click', () => $('stop-dialog').close());
document.querySelectorAll('[data-clear]').forEach((b) =>
  b.addEventListener('click', () => { $(b.dataset.clear).value = ''; }));
$('stop-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('stop-name').value.trim();
  const arrival = $('stop-arrival').value || null;
  const departure = $('stop-departure').value || null;
  if (!name) { $('stop-error').textContent = 'Please enter a country name.'; return; }
  if (arrival && departure && departure < arrival) {
    $('stop-error').textContent = "Departure can't be before arrival."; return;
  }
  if (editingStopId) data.updateStop(editingStopId, { name, arrival, departure });
  else data.addStop({ name, arrival, departure });
  $('stop-dialog').close();
});
$('stop-delete').addEventListener('click', async () => {
  const id = editingStopId;
  const stop = state.stops.find((s) => s.id === id);
  if (!stop) return;
  const todoIds = state.todos.filter((t) => t.stopId === id).map((t) => t.id);
  const extra = todoIds.length ? ` and its ${todoIds.length} to-do${todoIds.length > 1 ? 's' : ''}` : '';
  $('stop-dialog').close();
  if (await confirmAction(`Delete ${stop.name}${extra}?`)) {
    data.deleteStop(id, todoIds);
    location.hash = '#/';
  }
});

/* ---------- to-dos ---------- */
$('todo-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('todo-input').value.trim();
  const id = location.hash.split('/')[2];
  if (!id) return;
  if (!text) { toast('Please type something first.'); return; }
  data.addTodo(id, text);
  $('todo-input').value = '';
  $('todo-input').focus();
});
function openTodoEdit(t) {
  editingTodoId = t.id;
  $('todo-edit-text').value = t.text;
  $('todo-edit-error').textContent = '';
  $('todo-dialog').showModal();
}
$('todo-edit-cancel').addEventListener('click', () => $('todo-dialog').close());
$('todo-edit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('todo-edit-text').value.trim();
  if (!text) { $('todo-edit-error').textContent = 'Please type something.'; return; }
  data.updateTodoText(editingTodoId, text);
  $('todo-dialog').close();
});

/* ---------- navigation ---------- */
$('back').addEventListener('click', () => { location.hash = '#/'; });
window.addEventListener('hashchange', render);

/* ---------- login / logout ---------- */
function loginMessage(e) {
  switch (e.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email': return 'Wrong email or password.';
    case 'auth/network-request-failed': return 'No internet connection. Logging in needs internet.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
    default: return 'Could not log in. Please try again.';
  }
}
$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('login-btn');
  $('login-error').textContent = '';
  btn.disabled = true;
  try { await data.login($('login-email').value.trim(), $('login-password').value); }
  catch (err) { $('login-error').textContent = loginMessage(err); }
  btn.disabled = false;
});
$('logout').addEventListener('click', async () => {
  if (await confirmAction('Log out? You need internet to log in again.', 'Log out')) data.logout();
});

/* ---------- data wiring ---------- */
function onListenError(err) {
  console.error(err);
  toast(err.code === 'permission-denied'
    ? 'This account does not have access to the trip data.'
    : 'Could not load data.');
}
data.onWriteError((err) => {
  console.error(err);
  toast(err.code === 'permission-denied' ? 'Not allowed to save this change.' : 'A change could not be saved.');
});
data.onUser((user) => {
  unsubs.forEach((u) => u()); unsubs = [];
  Object.assign(state, { user, stops: [], todos: [], stopsReady: false });
  if (user) {
    $('login-form').reset();
    unsubs.push(data.watchStops((list) => { state.stops = list; state.stopsReady = true; render(); }, onListenError));
    unsubs.push(data.watchTodos((list) => { state.todos = list; render(); }, onListenError));
  }
  render();
});

/* ---------- offline banner + service worker ---------- */
const updateOnline = () => { $('offline').hidden = navigator.onLine; };
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
