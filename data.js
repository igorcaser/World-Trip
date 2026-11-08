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

export function addStop({ name, arrival, departure }) {
  fire(setDoc(doc(collection(db, 'stops')), { name, arrival, departure, createdAt: Date.now() }));
}
export function updateStop(id, changes) { // only the changed fields, so a partner's edits to other fields survive
  fire(updateDoc(doc(db, 'stops', id), changes));
}
export function deleteStop(id, todoIds) { // removes the stop and all its to-dos in one batch
  const batch = writeBatch(db);
  todoIds.forEach((t) => batch.delete(doc(db, 'todos', t)));
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
