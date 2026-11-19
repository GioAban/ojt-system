import type { CSSProperties } from "react";
import { Letterhead } from "@/components/reports/Letterhead";
import type { ManualSignatoriesProps } from "@/components/reports/ManualSignatoriesBlock";
import { signatoryArea } from "@/components/reports/signatoryArea";
import { ReportPages, type SheetMode } from "@/components/reports/ReportPages";
import { TypedCell } from "@/components/reports/editor/TypedCell";
import { listLayout } from "@/lib/listLayout";
import type { CellSpec } from "@/lib/reportFields";
import { cellOf, orderedColumns, visibleUnits, type ListUnit } from "@/lib/listTemplates";
import { STRIPE, shownCell } from "@/lib/reportDisplay";
import type { ListContent, ListRow, PendingMap, ReportContext } from "@/types/reports";

const CELL: CSSProperties = { border: "1px solid #000", padding: "4px 6px", verticalAlign: "top", overflowWrap: "anywhere" };
const HEAD: CSSProperties = { ...CELL, background: "#e7e6e6", textAlign: "center", verticalAlign: "middle", fontWeight: 700 };
const GROUP: CSSProperties = { ...CELL, background: "#f3f3f3", fontWeight: 700 };
const NOTE: CSSProperties = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" };

/** Mga koneksiyon ng papel sa builder kapag naka-on ang Edit mode (sa screen lang) */
export interface ListEditBindings {
  /** Ano ang cell: nakakabit sa record, o binabago sa report lang */
  spec: (row: ListRow, col: string) => CellSpec;
  pending: PendingMap;
  /** key ng pagbabago -> error mula sa server */
  problems: Record<string, string>;
  /** key ng pagbabago na kaka-save lang sa database (pansamantalang marka) */
  saved: Record<string, true>;
  labelOf: (row: ListRow, col: string) => string;
  onOpen: (spec: CellSpec) => void;
}

/** Ang papel ng isang listahan; iisang component para sa builder, preview, print at PDF */
export function ListSheet({ content: c, title, context, mode, edit, manual }: {
  content: ListContent;
  title: string;
  context: ReportContext;
  mode: SheetMode;
  edit?: ListEditBindings;
  /** Mga pirmahang tina-type ng coordinator (sa device lang) */
  manual?: ManualSignatoriesProps;
}) {
  const editing = mode === "edit" && edit !== undefined;
  const columns = orderedColumns(c);
  const units = visibleUnits(c);
  const display = c.display;
  const numbered = display.rowNumbers;
  // Halinhinang kulay: bawat row sa loob ng pangkat
  const stripeOf = new Map<string, boolean>();
  units.forEach((u) => { if (u.kind === "row") stripeOf.set(u.key, display.striped && u.number % 2 === 0); });
  const layout = listLayout(c);
  const semesterLine = [context.term, context.schoolYear].filter(Boolean).join(" ") || context.semesterName;

  const titleBlock = (
    <div style={{ marginBottom: 10 }}>
      <div style={{ textAlign: "center", fontWeight: 700, marginTop: 6, ...NOTE }}>{title}</div>
      {c.subtitle.trim() && <div style={{ textAlign: "center", ...NOTE }}>{c.subtitle}</div>}
      <div style={{ textAlign: "center" }}>{semesterLine}</div>
      {context.programName && <div style={{ textAlign: "center" }}>{context.programName}</div>}
      {c.headerText.trim() && <div style={{ marginTop: 8, ...NOTE }}>{c.headerText}</div>}
      {units.length === 0 && <div style={{ marginTop: 16, textAlign: "center", fontStyle: "italic" }}>No records match these filters.</div>}
    </div>
  );

  const footer = c.footerText.trim() ? <div style={{ paddingTop: 16, breakInside: "avoid", ...NOTE }}>{c.footerText}</div> : null;

  // Footer text, saka ang pirmahan (walang built-in na pirmahan ang mga listahan)
  const area = signatoryArea(null, manual);
  const endOfReport = footer || area ? <>{footer}{area}</> : null;

  const colgroup = (
    <colgroup>
      {numbered && <col style={{ width: `${layout.numberWidth}%` }} />}
      {columns.map((col) => <col key={col.key} style={{ width: `${layout.widths[col.key]}%` }} />)}
    </colgroup>
  );

  const renderUnit = (u: ListUnit, live: boolean) => {
    if (u.kind === "group") {
      return (
        <tr key={u.key} style={{ breakInside: "avoid" }}>
          <td colSpan={columns.length + (numbered ? 1 : 0)} style={GROUP}>{u.label} ({u.count})</td>
        </tr>
      );
    }
    return (
      <tr
        key={u.key}
        data-unit-key={live ? u.key : undefined}
        style={{ breakInside: "avoid", ...(stripeOf.get(u.key) ? { background: STRIPE } : null) }}
      >
        {numbered && <td style={{ ...CELL, textAlign: "center" }}>{u.number}</td>}
        {columns.map((col) => {
          // Format ng petsa at blangkong cell (Advanced); hindi nito binabago ang datos
          const value = shownCell(cellOf(c, u.row, col.key), display);
          const style = { ...CELL, ...(col.center ? { textAlign: "center" as const } : null) };
          if (!live || !edit) return <td key={col.key} style={style}>{value}</td>;
          const spec = edit.spec(u.row, col.key);
          return (
            <td key={col.key} style={style}>
              <TypedCell
                spec={spec}
                pending={edit.pending}
                value={value}
                label={edit.labelOf(u.row, col.key)}
                problems={edit.problems}
                saved={edit.saved}
                onOpen={edit.onOpen}
              />
            </td>
          );
        })}
      </tr>
    );
  };

  return (
    <ReportPages
      settings={c.settings}
      mode={mode}
      measureKey={JSON.stringify([title, semesterLine, c.headerText, c.footerText, c.columns, c.settings, c.overrides, editing ? c.pending : null, units.map((u) => u.key), c.subtitle, display, manual ? [manual.items, manual.showBuiltIn, Boolean(manual.onAdd)] : null])}
      letterhead={
        <Letterhead
          collegeName={context.collegeName}
          collegeAbbreviation={context.collegeAbbreviation}
          collegeLogoPath={context.collegeLogoPath}
        />
      }
      title={titleBlock}
      measureTitle={titleBlock}
      colgroup={colgroup}
      headerRow={
        <tr>
          {numbered && <th style={HEAD}>NO.</th>}
          {columns.map((col) => <th key={col.key} style={HEAD}>{col.label}</th>)}
        </tr>
      }
      unitGroups={units.map((_, i) => i)}
      unitKeys={units.map((u) => u.key)}
      unitKeepNext={units.map((u) => u.kind === "group")}
      renderMeasureRow={(i) => renderUnit(units[i], false)}
      renderBody={(slice) => units.slice(slice.start, slice.end).map((u) => renderUnit(u, editing))}
      signatories={endOfReport}
      measureSignatories={endOfReport}
    />
  );
}
