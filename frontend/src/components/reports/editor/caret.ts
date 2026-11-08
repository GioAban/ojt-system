// Pagbasa at paglalagay ng cursor sa loob ng nae-edit na teksto ng papel.

/** Pansamantalang titik para makita ang bagong linya sa dulo ng teksto; hindi ito sine-save */
export const ZWSP = String.fromCharCode(0x200b);
const ZWSP_ALL = new RegExp(ZWSP, "g");

export function readText(el: HTMLElement) {
  return (el.textContent ?? "").replace(ZWSP_ALL, "");
}

export function caretOf(el: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return readText(el).length;
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.anchorNode as Node, sel.anchorOffset);
  return range.toString().replace(ZWSP_ALL, "").length;
}

export function setCaret(el: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let left = offset;
  let node = walker.nextNode();
  while (node) {
    const len = (node.textContent ?? "").length;
    if (left <= len) {
      const r = document.createRange();
      r.setStart(node, left);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }
    left -= len;
    node = walker.nextNode();
  }
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

/** Lahat ng nae-edit na cell sa editor, sa ayos ng pagbasa */
function editableCells(from: HTMLElement): HTMLElement[] {
  const root = from.closest("[data-editor-root]") ?? document;
  return Array.from(root.querySelectorAll<HTMLElement>("[data-cell-id][contenteditable]"));
}

export function focusSibling(from: HTMLElement, dir: 1 | -1) {
  const cells = editableCells(from);
  const next = cells[cells.indexOf(from) + dir];
  if (next) {
    next.focus();
    setCaret(next, dir === 1 ? 0 : readText(next).length);
  }
}
