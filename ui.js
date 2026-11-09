// Small helpers shared by app.js and the feature modules.
export const $ = (id) => document.getElementById(id);

export function el(tag, cls, ...children) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  n.append(...children);
  return n;
}

let toastTimer;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 4000);
}

// Resolves true if the user confirms. danger=false gives a normal (non-red) confirm button.
export function confirmAction(message, okLabel = 'Delete', danger = true) {
  return new Promise((resolve) => {
    const dlg = $('confirm-dialog');
    $('confirm-text').textContent = message;
    const ok = $('confirm-ok');
    ok.textContent = okLabel;
    ok.className = 'btn ' + (danger ? 'danger' : 'primary');
    dlg.returnValue = '';
    dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
    dlg.showModal();
  });
}

export const normName = (s) => s.trim().replace(/\s+/g, ' ').toLowerCase();
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Searchable country picker. getList() returns [{code, name, aliases?}].
// .code is the chosen ISO-2 code (null until a country is tapped). Fires a 'pick' event on the element.
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export function countryPicker(getList, { placeholder = 'Search country' } = {}) {
  const input = el('input');
  input.type = 'text'; input.placeholder = placeholder; input.autocomplete = 'off';
  input.spellcheck = false; input.setAttribute('aria-label', placeholder);
  const box = el('ul', 'picker-list'); box.hidden = true;
  const wrap = el('div', 'picker', input, box);
  let code = null;

  function choose(c) {
    code = c.code; input.value = c.name; box.hidden = true;
    wrap.dispatchEvent(new CustomEvent('pick', { detail: c }));
  }
  function search() {
    code = null;
    const q = fold(input.value);
    if (!q) { box.hidden = true; box.replaceChildren(); return; }
    const hits = [];
    for (const c of getList()) {
      const names = [c.name, ...(c.aliases || [])].map(fold);
      const score = (c.code.toLowerCase() === q || names.some((n) => n.startsWith(q))) ? 0
        : names.some((n) => n.includes(q)) ? 1 : -1;
      if (score >= 0) hits.push([score, c]);
    }
    hits.sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name, 'en'));
    box.replaceChildren(...(hits.length ? hits.slice(0, 8).map(([, c]) => {
      const b = el('button', 'picker-item', c.name); b.type = 'button';
      b.addEventListener('click', () => choose(c));
      return el('li', '', b);
    }) : [el('li', 'picker-empty', 'No country found')]));
    box.hidden = false;
  }
  input.addEventListener('input', search);
  return {
    el: wrap,
    get code() { return code; },
    get text() { return input.value.trim(); },
    set(c, fallbackText = '') {
      const item = getList().find((x) => x.code === c);
      code = item ? item.code : null;
      input.value = item ? item.name : fallbackText;
      box.hidden = true; box.replaceChildren();
    },
    search,
    focus: () => input.focus()
  };
}
