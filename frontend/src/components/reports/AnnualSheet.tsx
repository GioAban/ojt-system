import type { CSSProperties } from "react";
import { Letterhead } from "@/components/reports/Letterhead";
import type { ManualSignatoriesProps } from "@/components/reports/ManualSignatoriesBlock";
import { signatoryArea } from "@/components/reports/signatoryArea";
import { ReportPages, type SheetMode } from "@/components/reports/ReportPages";
import { SignatoriesSheet, type TextRenderer } from "@/components/reports/SignatoriesSheet";
import { SheetText } from "@/components/reports/editor/EditableText";
import { TypedCell } from "@/components/reports/editor/TypedCell";
import type { CellSpec } from "@/lib/reportFields";
import { annualColumns } from "@/lib/annualReport";
import { STRIPE, displayOf, shownCell } from "@/lib/reportDisplay";
import type { AnnualContent, PendingMap, ReportContext, SignatorySet } from "@/types/reports";

const CELL: CSSProperties = { border: "1px solid #000", padding: "4px 6px", verticalAlign: "top", overflowWrap: "anywhere" };
const HEAD: CSSProperties = { ...CELL, background: "#e7e6e6", textAlign: "center", verticalAlign: "middle", fontWeight: 700 };
/** Sumusunod sa laman ang lapad ng mga column ng buod, kaya hindi nahahati ang mga salita */
const SUMMARY_TABLE: CSSProperties = { width: "100%", borderCollapse: "collapse", tableLayout: "auto" };
const WHOLE_WORDS: CSSProperties = { overflowWrap: "break-word" };
const SECTION: CSSProperties = { fontWeight: 700, margin: "12px 0 4px" };

/** Mga koneksiyon ng papel sa editor (wala sa preview, print at PDF) */
export interface AnnualEditBindings {
  onText: (id: string, value: string) => void;
  labelOf: (id: string) => string;
  isEdited: (id: string) => boolean;
  selectedRow: string | null;
  pin: { key: string; page: number } | null;
  onOversized: (keys: string[]) => void;
  /**
   * Cell na may sariling input: buod (company at department = tunay na record; bilang = report lang) at pirmahan.
   * null = tekstong diretsong nae-edit sa papel.
   */
  typed: (id: string, kind: "text" | "number" | null) => CellSpec | null;
  pending: PendingMap;
  problems: Record<string, string>;
  /** key ng pagbabago na kaka-save lang sa database (pansamantalang marka) */
  saved: Record<string, true>;
  onOpen: (spec: CellSpec) => void;
}

interface AnnualSheetProps {
  content: AnnualContent;
  context: ReportContext;
  signatories: SignatorySet;
  mode: SheetMode;
  edit?: AnnualEditBindings;
  /** Mga pirmahang tina-type ng coordinator (sa device lang); pumapalit sa built-in kapag mayroon */
  manual?: ManualSignatoriesProps;
}

const plainText: TextRenderer = (_id, value, style) => (
  <div style={{ minHeight: "1.3em", whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>{value}</div>
);

/** Ang papel ng Annual Report; iisang component para sa editor, preview, print at PDF */
export function AnnualSheet({ content: c, context, signatories, mode, edit, manual }: AnnualSheetProps) {
  const editing = mode === "edit" && edit !== undefined;
  const { summary, issues } = annualColumns(c);

  const live = (multiline: boolean): TextRenderer => (id, value, style, placeholder) => {
    const spec = edit!.typed(id, null);
    if (spec) {
      return (
        <TypedCell
          key={id}
          spec={spec}
          pending={edit!.pending}
          value={value}
          label={edit!.labelOf(id)}
          problems={edit!.problems}
          saved={edit!.saved}
          style={style}
          onOpen={edit!.onOpen}
        />
      );
    }
    return (
    <SheetText
      key={id}
      id={id}
      value={value}
      editable
      multiline={multiline}
      edited={edit!.isEdited(id)}
      label={edit!.labelOf(id)}
      placeholder={placeholder}
      style={style}
      onCommit={(v) => edit!.onText(id, v)}
    />
    );
  };
  const text: TextRenderer = editing ? live(false) : plainText;
  const display = displayOf(c.display);
  const NOTE: CSSProperties = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" };
  const stripe = (i: number) => (display.striped && i % 2 === 1 ? { background: STRIPE } : null);
  // Ang buod ay bilang mula sa system: sa Edit mode, binabago sa report lang (numero), may marka at Reset
  const summaryCell = (id: string, value: string, kind: "text" | "number") =>
    editing ? (
      <TypedCell
        key={id}
        spec={edit.typed(id, kind) as CellSpec}
        pending={edit.pending}
        value={value}
        label={edit.labelOf(id)}
        problems={edit.problems}
        saved={edit.saved}
        onOpen={edit.onOpen}
      />
    ) : plainText(id, value);
  const longText: TextRenderer = editing ? live(true) : plainText;

  const titleBlock = (tx: TextRenderer) => (
    <div style={{ marginBottom: 8 }}>
      {tx("h:annex", c.annexLabel, { textAlign: "right", fontWeight: 700 }, "Annex label")}
      <div style={{ textAlign: "center", marginTop: 6 }}>
        {c.titleLines.map((line, i) => (
          <div key={i}>{tx(`h:title:${i}`, line, { fontWeight: 700 }, "Title")}</div>
        ))}
        {tx("h:sem", c.semesterLine, { fontWeight: 700 }, "School year")}
        {c.subtitle?.trim() && <div style={NOTE}>{c.subtitle}</div>}
      </div>
      <div style={{ fontWeight: 700, marginTop: 12 }}>
        {([["HEI", "h:hei", c.hei], ["ADDRESS", "h:address", c.address], ["DEGREE PROGRAM", "h:degree", c.degreeProgram]] as const).map(
          ([label, id, value]) => (
            <div key={id} style={{ display: "flex" }}>
              <span style={{ whiteSpace: "pre" }}>{label}: </span>
              <div style={{ flex: 1, minWidth: 0 }}>{tx(id, value, undefined, label)}</div>
            </div>
          ),
        )}
      </div>
      {c.headerText?.trim() && <div style={{ marginTop: 10, ...NOTE }}>{c.headerText}</div>}
      <div style={SECTION}>A. SUMMARY OF STUDENT INTERNS</div>
      <table style={SUMMARY_TABLE}>
        <thead>
          <tr>{summary.map((col) => <th key={col.key} style={{ ...HEAD, ...WHOLE_WORDS }}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {c.summary.map((r, ri) => (
            <tr key={r.id} style={stripe(ri) ?? undefined}>
              {summary.map((col) => (
                <td key={col.key} style={{ ...CELL, ...WHOLE_WORDS, ...(col.kind === "number" || col.key === "program" ? { textAlign: "center" as const } : null) }}>
                  {tx === plainText ? plainText(`sum:${r.id}:${col.key}`, shownCell(r[col.key], display)) : summaryCell(`sum:${r.id}:${col.key}`, r[col.key], col.kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={SECTION}>B. ISSUES AND CONCERNS, SOLUTIONS AND RECOMMENDATIONS</div>
    </div>
  );

  const footer = c.footerText?.trim()
    ? <div style={{ paddingTop: 16, breakInside: "avoid", ...NOTE }}>{c.footerText}</div>
    : null;

  const colgroup = (
    <colgroup>
      {issues.map((col) => <col key={col.key} style={{ width: `${100 / issues.length}%` }} />)}
    </colgroup>
  );
  const headerRow = <tr>{issues.map((col) => <th key={col.key} style={HEAD}>{col.label}</th>)}</tr>;

  const cells = (i: number, tx: TextRenderer) => {
    const r = c.issues[i];
    return issues.map((col) => (
      <td key={col.key} style={CELL}>
        {tx(`i:${r.id}:${col.key}`, tx === plainText ? shownCell(r[col.key], display) : r[col.key], undefined, col.placeholder)}
      </td>
    ));
  };

  return (
    <ReportPages
      settings={c.settings}
      mode={mode}
      measureKey={JSON.stringify([c, signatories, context.semesterId, manual ? [manual.items, manual.showBuiltIn, Boolean(manual.onAdd)] : null])}
      pin={editing ? edit.pin : null}
      onOversized={editing ? edit.onOversized : undefined}
      letterhead={
        <Letterhead
          collegeName={context.collegeName}
          collegeAbbreviation={context.collegeAbbreviation}
          collegeLogoPath={context.collegeLogoPath}
        />
      }
      title={titleBlock(text)}
      measureTitle={titleBlock(plainText)}
      colgroup={colgroup}
      headerRow={headerRow}
      unitGroups={c.issues.map((_, i) => i)}
      unitKeys={c.issues.map((r) => r.id)}
      renderMeasureRow={(i) => <tr key={c.issues[i].id}>{cells(i, plainText)}</tr>}
      renderBody={(slice) => {
        const rows = [];
        for (let i = slice.start; i < slice.end; i++) {
          const r = c.issues[i];
          rows.push(
            <tr
              key={r.id}
              data-unit-key={r.id}
              style={{
                breakInside: "avoid",
                ...stripe(i),
                ...(editing && edit.selectedRow === r.id ? { background: "rgba(37,99,235,.07)" } : null),
              }}
            >
              {cells(i, longText)}
            </tr>,
          );
        }
        return rows;
      }}
      signatories={<>{footer}{signatoryArea(<SignatoriesSheet people={signatories} text={text} />, manual)}</>}
      measureSignatories={<>{footer}{signatoryArea(<SignatoriesSheet people={signatories} />, manual)}</>}
    />
  );
}
