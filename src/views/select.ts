// Desplegable propio: mismo aspecto que el resto de controles y opciones con el color de cada persona.
import { h } from '../dom';
import { icon, type IconName } from '../icons';
import type { Member } from '../domain';
import { withColor } from '../ui';

export interface SelectOption {
  value: string;
  label: string;
  member?: Member;
}

export function selectMenu(opts: { id?: string; value: string; options: SelectOption[]; icon?: IconName; onChange: (v: string) => void; label: string }): HTMLElement {
  const current = opts.options.find((o) => o.value === opts.value) ?? opts.options[0];
  const swatch = (o: SelectOption) => (o.member ? withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), o.member) : opts.icon ? icon(opts.icon, 16) : null);
  const trigger = h(
    'button',
    { class: 'sel-trigger input', type: 'button', id: opts.id ?? null, 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': `${opts.label}: ${current.label}` },
    swatch(current),
    h('span', { class: 'sel-label' }, current.label),
    icon('chevronDown', 14),
  );
  const list = h(
    'div',
    { class: 'sel-pop', role: 'listbox', 'aria-label': opts.label, hidden: true },
    opts.options.map((o) => {
      const b = h('button', { class: 'sel-opt', type: 'button', role: 'option', 'aria-selected': String(o.value === current.value) }, swatch(o), h('span', null, o.label), o.value === current.value ? icon('check', 14) : null);
      b.addEventListener('click', () => {
        close();
        if (o.value !== current.value) opts.onChange(o.value);
      });
      return b;
    }),
  );
  const wrap = h('div', { class: 'sel' }, trigger, list);
  const onDoc = (e: Event) => !wrap.contains(e.target as Node) && close();
  const onKey = (e: KeyboardEvent) => {
    const items = [...list.querySelectorAll<HTMLButtonElement>('.sel-opt')];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'Escape') {
      close();
      trigger.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
  };
  function close() {
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDoc, true);
    wrap.removeEventListener('keydown', onKey);
  }
  trigger.addEventListener('click', () => {
    if (!list.hidden) return close();
    list.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onDoc, true);
    wrap.addEventListener('keydown', onKey);
    (list.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus();
  });
  return wrap;
}
