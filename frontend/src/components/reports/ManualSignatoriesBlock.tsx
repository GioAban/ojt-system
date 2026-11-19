import type { CSSProperties } from "react";
import { signatoryRows, type ManualSignatory, type SignAlign } from "@/lib/manualSignatories";

/** Ang pirmahan sa dulo ng report, at kung paano ito ipinapakita */
export interface ManualSignatoriesProps {
  items: ManualSignatory[];
  /** Annual at HTE: ipakita rin ang built-in na pirmahan bago ang mga ito */
  showBuiltIn: boolean;
  /** Sa editor lang (wala sa preview, print at PDF): ang "+ Add signatory" sa papel */
  onAdd?: () => void;
  /** Sa Edit mode lang: Edit at Delete sa bawat signatory sa papel */
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const COLUMN: Record<SignAlign, number> = { left: 1, center: 2, right: 3 };
const TEXT_ALIGN: Record<SignAlign, CSSProperties["textAlign"]> = { left: "left", center: "center", right: "right" };

const SMALL_BUTTON = {
  padding: "2px 8px", minHeight: 28, border: "1px solid #cbd5e1", borderRadius: 4, background: "#fff",
  font: "inherit", fontSize: "0.8em", cursor: "pointer",
} as const;

function Signer({ s, onEdit, onDelete }: { s: ManualSignatory; onEdit?: (id: string) => void; onDelete?: (id: string) => void }) {
  const align = TEXT_ALIGN[s.align];
  const lineMargin = s.align === "center" ? "0 auto" : s.align === "right" ? "0 0 0 auto" : undefined;
  return (
    <div style={{ gridColumn: COLUMN[s.align], textAlign: align, minWidth: 0 }}>
      {s.label.trim() && <div>{s.label}</div>}
      <div style={{ height: 30 }} />
      <div style={{ width: 220, maxWidth: "100%", borderBottom: "1px solid #000", margin: lineMargin }} />
      <div style={{ fontWeight: 700, textTransform: "uppercase", overflowWrap: "anywhere" }}>{s.name}</div>
      {s.position.trim() && <div style={{ overflowWrap: "anywhere" }}>{s.position}</div>}
      {s.dateLine && (
        <div style={{ marginTop: 6 }}>
          Date: <span style={{ display: "inline-block", width: 120, borderBottom: "1px solid #000" }}>&nbsp;</span>
        </div>
      )}
      {(onEdit || onDelete) && (
        <div data-screen-only="" style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: s.align === "center" ? "center" : s.align === "right" ? "flex-end" : "flex-start" }}>
          {onEdit && <button type="button" style={SMALL_BUTTON} onClick={() => onEdit(s.id)}>Edit</button>}
          {onDelete && <button type="button" style={{ ...SMALL_BUTTON, color: "#b91c1c" }} onClick={() => onDelete(s.id)}>Delete</button>}
        </div>
      )}
    </div>
  );
}

/**
 * Mga pirmahang tina-type ng coordinator. Isang buo na hindi hinahati sa dalawang pahina.
 * Kapag walang laman at wala sa editor, walang ipinapakita (walang napi-print).
 */
export function ManualSignatoriesBlock({ items, onAdd, onEdit, onDelete }: {
  items: ManualSignatory[];
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  if (items.length === 0 && !onAdd) return null;
  return (
    <div style={{ paddingTop: 28, breakInside: "avoid", pageBreakInside: "avoid" }}>
      {signatoryRows(items).map((row, i) => (
        <div
          key={i}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", columnGap: 32, marginTop: i === 0 ? 0 : 24, breakInside: "avoid" }}
        >
          {row.map((s) => <Signer key={s.id} s={s} onEdit={onEdit} onDelete={onDelete} />)}
        </div>
      ))}
      {onAdd && (
        <button
          type="button"
          data-screen-only=""
          onClick={onAdd}
          style={{
            marginTop: items.length > 0 ? 16 : 0, padding: "6px 12px", minHeight: 36, border: "1px dashed #2563eb",
            borderRadius: 6, background: "rgba(37,99,235,.05)", color: "#1d4ed8", font: "inherit", cursor: "pointer",
          }}
        >
          + Add signatory
        </button>
      )}
    </div>
  );
}
