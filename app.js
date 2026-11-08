import * as data from './data.js';
import { $, el, toast, confirmAction, normName, plural } from './ui.js';
import { features } from './features/index.js';

const state = {
  user: null, stops: [], todos: [], places: [], activities: [],
  stopsReady: false, todosReady: false, placesReady: false, activitiesReady: false
};
const ui = { el, toast, confirmAction, normName, plural };
const ROUTE = /^#\/stop\/([A-Za-z0-9]+)(?:\/([a-z]+))?$/; // #/stop/<id>  or  #/stop/<id>/<featureId>
let unsubs = [];
let currentView = null;
let editingStopId = null;
let editingOriginal = null; // values shown when the edit dialog opened
let mounted = null;         // the open feature page: { update }
let mountedKey = null;

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
const joinList = (parts) => (parts.length > 1
  ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0]);

/* ---------- views ---------- */
function clearFeature() {
  if (mounted) { $('feature-body').replaceChildren(); mounted = null; mountedKey = null; }
}
function show(name) {
  for (const v of ['login', 'stops-view', 'stop-view', 'feature-view']) $(v).hidden = v !== name;
  if (name !== 'feature-view') clearFeature();
  if (name && name !== currentView) window.scrollTo(0, 0);
  currentView = name;
}
function render() {
  if (!state.user) return show('login');
  const m = location.hash.match(ROUTE);
  if (!m) { show('stops-view'); return renderStops(); }
  if (!state.stopsReady) return show(null);
  const stop = state.stops.find((s) => s.id === m[1]);
  if (!stop) { location.hash = '#/'; return; } // deleted (maybe by the other user)
  const feature = m[2] && features.find((f) => f.id === m[2]);
  if (m[2] && !feature) { location.replace(`#/stop/${stop.id}`); return; } // unknown feature -> country page
  if (!feature) { show('stop-view'); return renderStop(stop); }
  show('feature-view');
  renderFeature(stop, feature);
}

function renderStops() {
  const list = $('stops');
  list.replaceChildren();
  for (const s of sortStops(state.stops)) {
    const a = el('a', 'row stop',
      el('div', 'main', el('div', 'name', s.name), el('div', 'sub', datesText(s))),
      el('span', 'chev', '›'));
    a.href = `#/stop/${s.id}`;
    list.append(el('li', 'item', a));
  }
  $('stops-empty').hidden = !state.stopsReady || state.stops.length > 0;
}

function renderStop(stop) { // country page: one icon tile per feature
  $('stop-title').textContent = stop.name;
  $('stop-dates').textContent = datesText(stop);
  const tiles = $('tiles');
  tiles.replaceChildren();
  for (const f of features) {
    const icon = el('span', 'tile-icon'); icon.innerHTML = f.icon; // our own constant SVG
    const a = el('a', 'tile', icon, el('span', 'tile-name', f.title));
    a.href = `#/stop/${stop.id}/${f.id}`;
    tiles.append(a);
  }
}

function renderFeature(stop, feature) {
  const key = `${stop.id}/${feature.id}`;
  if (mountedKey !== key) { // opening a different feature/country: build its page once
    $('feature-body').replaceChildren();
    mounted = feature.create($('feature-body'), { data, ui });
    mountedKey = key;
  }
  $('feature-title').textContent = feature.title;
  $('feature-back').textContent = `‹ ${stop.name}`;
  mounted.update({ stop, state });
}

/* ---------- stop dialog (add / edit / delete) ---------- */
function openStopDialog(stop) {
  editingStopId = stop ? stop.id : null;
  editingOriginal = stop ? { name: stop.name, arrival: stop.arrival || null, departure: stop.departure || null } : null;
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
  if (editingStopId) {
    if (!state.stops.some((s) => s.id === editingStopId)) {
      toast('This country was deleted on the other phone.');
    } else {
      const changes = {};
      if (name !== editingOriginal.name) changes.name = name;
      if (arrival !== editingOriginal.arrival) changes.arrival = arrival;
      if (departure !== editingOriginal.departure) changes.departure = departure;
      if (Object.keys(changes).length) data.updateStop(editingStopId, changes);
    }
  } else data.addStop({ name, arrival, departure });
  $('stop-dialog').close();
});
$('stop-delete').addEventListener('click', async () => {
  const id = editingStopId;
  const stop = state.stops.find((s) => s.id === id);
  if (!stop) return;
  const todoIds = state.todos.filter((t) => t.stopId === id).map((t) => t.id);
  const placeIds = state.places.filter((p) => p.stopId === id).map((p) => p.id);
  const activityIds = state.activities.filter((a) => a.stopId === id).map((a) => a.id);
  const parts = [];
  if (todoIds.length) parts.push(plural(todoIds.length, 'to-do', 'to-dos'));
  if (placeIds.length) parts.push(plural(placeIds.length, 'place', 'places'));
  if (activityIds.length) parts.push(plural(activityIds.length, 'activity', 'activities'));
  const extra = parts.length ? ` and its ${joinList(parts)}` : '';
  $('stop-dialog').close();
  if (await confirmAction(`Delete ${stop.name}${extra}?`)) {
    data.deleteStop(id, { todoIds, placeIds, activityIds });
    location.hash = '#/';
  }
});

/* ---------- navigation ---------- */
$('back').addEventListener('click', () => { location.hash = '#/'; });
$('feature-back').addEventListener('click', () => { location.hash = `#/stop/${location.hash.split('/')[2]}`; });
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
  Object.assign(state, {
    user, stops: [], todos: [], places: [], activities: [],
    stopsReady: false, todosReady: false, placesReady: false, activitiesReady: false
  });
  if (user) {
    $('login-form').reset();
    unsubs.push(data.watchStops((list) => {
      state.stops = list; state.stopsReady = true;
      const dlg = $('stop-dialog');
      if (dlg.open && editingStopId && !list.some((s) => s.id === editingStopId)) {
        dlg.close(); toast('This country was deleted on the other phone.');
      }
      render();
    }, onListenError));
    unsubs.push(data.watchTodos((l) => { state.todos = l; state.todosReady = true; render(); }, onListenError));
    unsubs.push(data.watchPlaces((l) => { state.places = l; state.placesReady = true; render(); }, onListenError));
    unsubs.push(data.watchActivities((l) => { state.activities = l; state.activitiesReady = true; render(); }, onListenError));
  }
  render();
});

/* ---------- offline banner + service worker ---------- */
const updateOnline = () => { $('offline').hidden = navigator.onLine; };
window.addEventListener('online', updateOnline);
window.addEventListener('offline', updateOnline);
updateOnline();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
