import { createContext, useContext } from "react";

/** Ang cell na kasalukuyang ine-edit: para sa pag-pin ng row at sa pagbalik ng cursor kung sakaling ma-remount */
export interface ActiveCell {
  id: string;
  /** Posisyon ng cursor (bilang ng titik mula sa simula) */
  caret: number;
  /** Ang nai-type na (maaaring hindi pa naco-commit) */
  text?: string;
}

export interface CellFocusInfo {
  id: string;
  /** Susi ng row (tr) na kinalalagyan ng cell; null kung wala sa table (pamagat, pirmahan) */
  rowKey: string | null;
  /** Index ng pahina kung nasaan ang cell ngayon */
  page: number;
}

export interface EditorApi {
  /** Telepono: walang direktang pag-type; ang tap ay nagbubukas ng bottom sheet */
  touch: boolean;
  onCellFocus: (info: CellFocusInfo) => void;
  onCellBlur: (id: string) => void;
  openSheet: (id: string) => void;
  /** Escape mula sa cell: ilipat ang focus sa mga control ng row */
  focusControls: () => void;
  /** Ang cell na ine-edit (hindi naka-render; kailangang mabasa agad) */
  getActive: () => ActiveCell | null;
  setActive: (cell: ActiveCell | null) => void;
}

export const EditorContext = createContext<EditorApi | null>(null);

/** null kapag wala sa editor (preview, print, PDF) */
export function useEditor() {
  return useContext(EditorContext);
}
