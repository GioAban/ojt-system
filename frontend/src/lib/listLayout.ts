// Lapad ng mga column ng listahan: sapat para hindi maputol ang mga salita, ang sobra ay hinahati ayon sa weight.

import { FONT_PX, MARGINS, paperSize } from "@/lib/paperExport";
import { cellOf, orderedColumns, visibleUnits } from "@/lib/listTemplates";
import type { ListContent } from "@/types/reports";

/** Padding at border ng isang cell */
const CELL_EXTRA = 14;
/** Hindi hahayaang kainin ng isang napakahabang salita ang buong table */
const MAX_WORD_SHARE = 0.35;

let context: CanvasRenderingContext2D | null | undefined;
const cache = new Map<string, number>();

function textWidth(text: string, font: string, fallbackPx: number): number {
  const key = `${font}|${text}`;
  const known = cache.get(key);
  if (known !== undefined) return known;
  if (context === undefined) context = document.createElement("canvas").getContext("2d");
  let width = text.length * fallbackPx * 0.62;
  if (context) {
    context.font = font;
    width = context.measureText(text).width;
  }
  cache.set(key, width);
  return width;
}

function longestWord(text: string, font: string, px: number): number {
  let longest = 0;
  for (const word of text.split(/\s+/)) {
    if (word) longest = Math.max(longest, textWidth(word, font, px));
  }
  return longest;
}

export interface ListLayout {
  /** Porsiyento: una ang column ng bilang, saka ang mga napiling column */
  numberWidth: number;
  widths: Record<string, number>;
  /** Hindi kasya kahit buo ang mga salita: maraming column para sa papel na ito */
  tight: boolean;
}

export function listLayout(c: ListContent): ListLayout {
  const px = FONT_PX[c.settings.fontSize].px;
  const margin = MARGINS[c.settings.margins];
  const available = paperSize(c.settings.orientation, c.settings.paper).width - margin.left - margin.right;
  const columns = orderedColumns(c);
  const numbered = c.display?.rowNumbers !== false;
  const units = visibleUnits(c);
  const regular = `${px}px Arial, Helvetica, sans-serif`;
  const bold = `bold ${px}px Arial, Helvetica, sans-serif`;
  const cap = available * MAX_WORD_SHARE;

  // Walang column ng bilang kapag naka-off ang Row numbering
  const numberMin = numbered ? Math.max(longestWord("NO.", bold, px), longestWord(String(units.length), regular, px)) + CELL_EXTRA : 0;
  const mins = columns.map((col) => {
    let word = longestWord(col.label, bold, px);
    for (const u of units) {
      if (u.kind === "row") word = Math.max(word, longestWord(cellOf(c, u.row, col.key), regular, px));
    }
    return Math.min(cap, word) + CELL_EXTRA;
  });

  const needed = mins.reduce((sum, w) => sum + w, numberMin);
  const totalWeight = columns.reduce((sum, col) => sum + col.weight, 0) || 1;
  const spare = available - needed;
  const tight = spare < 0;
  const scale = tight ? available / needed : 1;
  const widths: Record<string, number> = {};
  columns.forEach((col, i) => {
    const w = mins[i] * scale + (tight ? 0 : (spare * col.weight) / totalWeight);
    widths[col.key] = (w / available) * 100;
  });
  return { numberWidth: ((numberMin * scale) / available) * 100, widths, tight };
}
