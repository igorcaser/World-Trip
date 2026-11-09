// All Firebase access lives here (auth + Firestore). The UI never talks to Firebase directly.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, updateDoc, deleteDoc, writeBatch, onSnapshot }
  from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // keeps the user logged in (stored on the phone) until log-out
// Offline cache: reads AND writes work offline and sync automatically when back online.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

let writeErrorHandler = (e) => console.error(e);
export const onWriteError = (fn) => { writeErrorHandler = fn; };
// Never await Firestore writes in the UI: offline they only resolve once the server confirms.
const fire = (promise) => { promise.catch((e) => writeErrorHandler(e)); };

export const onUser = (cb) => onAuthStateChanged(auth, cb);
export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);

const watch = (name, cb, onError) =>
  onSnapshot(collection(db, name),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError);
export const watchStops = (cb, onError) => watch('stops', cb, onError);
export const watchTodos = (cb, onError) => watch('todos', cb, onError);
export const watchPlaces = (cb, onError) => watch('places', cb, onError);
export const watchActivities = (cb, onError) => watch('activities', cb, onError);
export const watchNotes = (cb, onError) => watch('notes', cb, onError);
// Travellers live in one private document: settings/travellers = { list: [{ name, passports: ['IT', ...] }] }
export const watchTravellers = (cb, onError) => onSnapshot(doc(db, 'settings', 'travellers'),
  (snap) => cb(snap.exists() ? (snap.data().list || []).map((t) => ({ name: t.name, passports: t.passports.split(',') })) : []),
  onError);

export function addStop({ name, countryCode, arrival, departure }) {
  fire(setDoc(doc(collection(db, 'stops')), { name, countryCode, arrival, departure, createdAt: Date.now() }));
}
export function updateStop(id, changes) { // only the changed fields, so a partner's edits to other fields survive
  fire(updateDoc(doc(db, 'stops', id), changes));
}
export function deleteStop(id, { todoIds, placeIds, activityIds, noteIds }) { // removes the stop and everything in it, one batch
  const batch = writeBatch(db);
  todoIds.forEach((t) => batch.delete(doc(db, 'todos', t)));
  placeIds.forEach((p) => batch.delete(doc(db, 'places', p)));
  activityIds.forEach((a) => batch.delete(doc(db, 'activities', a)));
  noteIds.forEach((n) => batch.delete(doc(db, 'notes', n)));
  batch.delete(doc(db, 'stops', id));
  fire(batch.commit());
}
export function addTodo(stopId, text) {
  fire(setDoc(doc(collection(db, 'todos')),
    { stopId, text, done: false, doneAt: null, createdAt: Date.now() }));
}
export function updateTodoText(id, text) { fire(updateDoc(doc(db, 'todos', id), { text })); }
export function setDone(id, done) {
  fire(updateDoc(doc(db, 'todos', id), { done, doneAt: done ? Date.now() : null }));
}
export function deleteTodo(id) { fire(deleteDoc(doc(db, 'todos', id))); }

// ---- places: a city per country; the online link is built in the UI, never stored
export function addPlace({ stopId, name, provider }) {
  fire(setDoc(doc(collection(db, 'places')), { stopId, name, provider, createdAt: Date.now() }));
}
export function updatePlace(id, changes) { fire(updateDoc(doc(db, 'places', id), changes)); }
// Linked activities stay. Their placeId is left alone: the UI treats a placeId that points to a
// missing place as "unlinked" (ids are never reused), so nothing can fail if the partner just deleted one.
export function deletePlace(id) { fire(deleteDoc(doc(db, 'places', id))); }

// ---- activities: title + notes + optional place
export function addActivity({ stopId, title, notes, placeId }) {
  fire(setDoc(doc(collection(db, 'activities')), { stopId, title, notes, placeId, createdAt: Date.now() }));
}
export function updateActivity(id, changes) { fire(updateDoc(doc(db, 'activities', id), changes)); }
export function deleteActivity(id) { fire(deleteDoc(doc(db, 'activities', id))); }

// ---- travellers (whole list is saved at once; last save wins)
export function saveTravellers(list) { // passports are stored as one string "IT,BR" (simple to validate in the rules)
  fire(setDoc(doc(db, 'settings', 'travellers'),
    { list: list.map((t) => ({ name: t.name, passports: t.passports.join(',') })) }));
}

// ---- notes: generic text lines per stop and feature (e.g. feature 'visa')
export function addNote(stopId, feature, text) {
  fire(setDoc(doc(collection(db, 'notes')), { stopId, feature, text, createdAt: Date.now() }));
}
export function updateNote(id, text) { fire(updateDoc(doc(db, 'notes', id), { text })); }
export function deleteNote(id) { fire(deleteDoc(doc(db, 'notes', id))); }
