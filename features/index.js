// Feature registry: one entry = one icon tile on the country page.
// To add a feature: create features/<name>.js (export create), import it here, add a line below.
// Each module exports create(container, { data, ui }) -> { update({ stop, state }) }.
import * as todos from './todos.js';
import * as places from './places.js';
import * as activities from './activities.js';

const svg = (inner) => `<svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const features = [
  { id: 'todos', title: 'To-do list', create: todos.create,
    icon: svg('<rect x="8" y="6" width="32" height="36" rx="5"/><path d="M15 17l3 3 5-6M15 30l3 3 5-6M28 18h7M28 31h7"/>') },
  { id: 'places', title: 'Places', create: places.create,
    icon: svg('<path d="M24 43s13-12.5 13-23a13 13 0 1 0-26 0c0 10.5 13 23 13 23z"/><circle cx="24" cy="20" r="5"/>') },
  { id: 'activities', title: 'Activities', create: activities.create,
    icon: svg('<path d="M6 16a4 4 0 0 1 4-4h28a4 4 0 0 1 4 4v4a4 4 0 0 0 0 8v4a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4v-4a4 4 0 0 0 0-8z"/><path d="M30 14v20" stroke-dasharray="2 4"/>') }
];
