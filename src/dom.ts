// A tiny element builder. Text always goes through text nodes, never innerHTML, so names and
// messages from Discord can't inject markup.

type Child = Node | string | number | null | undefined | false
type Attrs = Record<string, string | number | boolean | EventListener | undefined>

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  setAttrs(el, attrs)
  append(el, children)
  return el
}

const svgNS = 'http://www.w3.org/2000/svg'

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(svgNS, tag)
  setAttrs(el, attrs)
  append(el, children)
  return el
}

function setAttrs(el: Element, attrs: Attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
}

function append(el: Element, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.append(c instanceof Node ? c : String(c))
  }
}
