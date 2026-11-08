import type { CSSProperties } from "react";
import { Letterhead } from "@/components/reports/Letterhead";
import { ReportPages, type SheetMode } from "@/components/reports/ReportPages";
import { SheetText } from "@/components/reports/editor/EditableText";
import { listLayout } from "@/lib/listLayout";
import { cellOf, listCellId, templateColumns, visibleUnits, type ListUnit } from "@/lib/listTemplates";
import type { ListContent, ReportContext } from "@/types/reports";

const CELL: CSSProperties = { border: "1px solid #000", padding: "4px 6px", verticalAlign: "top", overflowWrap: "anywhere" };
const HEAD: CSSProperties = { ...CELL, background: "#e7e6e6", textAlign: "center", verticalAlign: "middle", fontWeight: 700 };
const GROUP: CSSProperties = { ...CELL, background: "#f3f3f3", fontWeight: 700 };
const NOTE: CSSProperties = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" };

/** Mga koneksiyon ng papel sa builder kapag naka-on ang Edit mode */
export interface ListEditBindings {
  onText: (rowId: string, col: string, value: string) => void;
  labelOf: (id: string) => string;
}

/** Ang papel ng isang listahan; iisang component para sa builder, preview, print at PDF */
export function ListSheet({ content: c, title, context, mode, edit }: {
  content: ListContent;
  title: string;
  context: ReportContext;
  mode: SheetMode;
  edit?: ListEditBindings;
}) {
  const editing = mode === "edit" && edit !== undefined;
  const columns = templateColumns(c.template).filter((col) => c.columns.includes(col.key));
  const units = visibleUnits(c);
  const layout = listLayout(c);
  const semesterLine = [context.term, context.schoolYear].filter(Boolean).join(" ") || context.semesterName;

  const titleBlock = (
    <div style={{ marginBottom: 10 }}>
      <div style={{ textAlign: "center", fontWeight: 700, marginTop: 6, ...NOTE }}>{title}</div>
      <div style={{ textAlign: "center" }}>{semesterLine}</div>
      {context.programName && <div style={{ textAlign: "center" }}>{context.programName}</div>}
      {c.headerText.trim() && <div style={{ marginTop: 8, ...NOTE }}>{c.headerText}</div>}
      {units.length === 0 && <div style={{ marginTop: 16, textAlign: "center", fontStyle: "italic" }}>No records match these filters.</div>}
    </div>
  );

  const footer = c.footerText.trim() ? <div style={{ paddingTop: 16, breakInside: "avoid", ...NOTE }}>{c.footerText}</div> : null;

  const colgroup = (
    <colgroup>
      <col style={{ width: `${layout.numberWidth}%` }} />
      {columns.map((col) => <col key={col.key} style={{ width: `${layout.widths[col.key]}%` }} />)}
    </colgroup>
  );

  const renderUnit = (u: ListUnit, live: boolean) => {
    if (u.kind === "group") {
      return (
        <tr key={u.key} style={{ breakInside: "avoid" }}>
          <td colSpan={columns.length + 1} style={GROUP}>{u.label} ({u.count})</td>
        </tr>
      );
    }
    return (
      <tr key={u.key} data-unit-key={live ? u.key : undefined} style={{ breakInside: "avoid" }}>
        <td style={{ ...CELL, textAlign: "center" }}>{u.number}</td>
        {columns.map((col) => {
          const value = cellOf(c, u.row, col.key);
          const style = { ...CELL, ...(col.center ? { textAlign: "center" as const } : null) };
          if (!live || !edit) return <td key={col.key} style={style}>{value}</td>;
          const id = listCellId(u.row.id, col.key);
          return (
            <td key={col.key} style={style}>
              <SheetText
                id={id}
                value={value}
                editable
                blurOnly
                edited={value !== (u.row.cells[col.key] ?? "")}
                label={edit.labelOf(id)}
                placeholder=" "
                onCommit={(v) => edit.onText(u.row.id, col.key, v)}
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
      measureKey={JSON.stringify([title, semesterLine, c.headerText, c.footerText, c.columns, c.settings, c.overrides, units.map((u) => u.key)])}
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
          <th style={HEAD}>NO.</th>
          {columns.map((col) => <th key={col.key} style={HEAD}>{col.label}</th>)}
        </tr>
      }
      unitGroups={units.map((_, i) => i)}
      unitKeys={units.map((u) => u.key)}
      unitKeepNext={units.map((u) => u.kind === "group")}
      renderMeasureRow={(i) => renderUnit(units[i], false)}
      renderBody={(slice) => units.slice(slice.start, slice.end).map((u) => renderUnit(u, editing))}
      signatories={footer}
      measureSignatories={footer}
    />
  );
}
