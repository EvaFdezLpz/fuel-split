// Construcción del DOM sin innerHTML: todo el texto entra por textContent,
// así que ningún dato de la base de datos puede convertirse en HTML o script (XSS).
export type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

const SVG_NS = 'http://www.w3.org/2000/svg';
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href']);

function safeUrl(v: string): boolean {
  // Solo rutas internas por hash, imágenes JPEG en data: o blob: generados por nosotros.
  return /^#\/[\w\-/.@%]*$/.test(v) || /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v) || /^blob:/.test(v);
}

function apply(el: Element, attrs: Attrs | undefined) {
  if (!attrs) return;
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v);
      continue;
    }
    if (typeof v === 'function') continue;
    if (/^on/i.test(k) || k === 'style' || k === 'srcdoc') continue; // nunca manejadores ni estilos en línea
    const s = v === true ? '' : String(v);
    if (URL_ATTRS.has(k) && !safeUrl(s)) continue;
    el.setAttribute(k, s);
  }
}

function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs ?? undefined);
  append(el, children.flat());
  return el;
}

export function s(tag: string, attrs?: Attrs | null, ...children: (Child | Child[])[]): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs ?? undefined);
  append(el, children.flat());
  return el as SVGElement;
}

export function clear(el: Element) {
  el.replaceChildren();
}
