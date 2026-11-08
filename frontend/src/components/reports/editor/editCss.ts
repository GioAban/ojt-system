/** Sa screen lang: hint sa blangkong cell, outline sa hover/focus (hindi kailanman sa print o PDF) */
export const EDIT_CSS = `
.rp-edit [data-cell-id] { cursor: text; border-radius: 2px; transition: box-shadow .1s; }
.rp-edit [data-cell-id]:hover { box-shadow: 0 0 0 1px rgba(37,99,235,.4); }
.rp-edit [data-cell-id]:focus { outline: none; box-shadow: 0 0 0 2px #2563eb; }
.rp-edit [data-edited] { position: relative; }
.rp-edit [data-edited]::after {
  content: ""; position: absolute; top: -2px; right: -2px; width: 7px; height: 7px; border-radius: 50%;
  background: #f59e0b; pointer-events: none;
}
.rp-edit [data-ph]:empty::before {
  content: attr(data-ph); color: #6b7280; font-style: italic; font-weight: 400; text-transform: none; pointer-events: none;
}
`;
