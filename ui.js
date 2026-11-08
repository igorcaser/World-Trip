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
