import type { CSSProperties, KeyboardEvent } from "react";
import { Letterhead } from "@/components/reports/Letterhead";
import type { ManualSignatoriesProps } from "@/components/reports/ManualSignatoriesBlock";
import { signatoryArea } from "@/components/reports/signatoryArea";
import { ReportPages, type SheetMode } from "@/components/reports/ReportPages";
import { SignatoriesSheet, type TextRenderer } from "@/components/reports/SignatoriesSheet";
import { SheetText, type TextControl } from "@/components/reports/editor/EditableText";
import { TypedCell } from "@/components/reports/editor/TypedCell";
import { hteColumnsOf, resolveTitle } from "@/lib/hteCells";
import { STRIPE, displayOf, shownCell } from "@/lib/reportDisplay";
import type { CellSpec } from "@/lib/reportFields";
import type { HteContent, HteVariant, PendingMap, ReportContext, SignatorySet } from "@/types/reports";

const CELL: CSSProperties = { border: "1px solid #000", padding: "4px 6px", verticalAlign: "top", overflowWrap: "anywhere" };
const HEAD: CSSProperties = { ...CELL, background: "#e7e6e6", textAlign: "center", verticalAlign: "middle", fontWeight: 700 };
/** Hati sa lapad ng mga column, mula sa template (Annex D) */
const WEIGHTS: Record<string, number> = { company: 23.6, name: 43.2, program: 8.1, gender: 8.6, period: 16.5, department: 16 };
const HEADERS: Record<string, string> = {
  company: "HOST TRAINING ESTABLISHMENT", name: "NAME OF STUDENT", program: "PROGRAM", gender: "GENDER",
  period: "PERIOD OF TRAINING", department: "DEPARTMENT",
};

interface Unit {
  key: string;
  group: number;
  /** -1 = grupong walang student (blangkong row) */
  student: number;
  /** Bilang sa listahan (1., 2., ...); 0 kung blangko */
  number: number;
}

function unitsOf(content: HteContent, showCompany: boolean): Unit[] {
  const units: Unit[] = [];
  let n = 0;
  content.groups.forEach((g, gi) => {
    // Walang silbi ang blangkong row kapag walang column ng company
    if (g.students.length === 0 && !showCompany) return;
    if (g.students.length === 0) units.push({ key: `e:${g.id}`, group: gi, student: -1, number: 0 });
    else g.students.forEach((s, si) => units.push({ key: s.id, group: gi, student: si, number: ++n }));
  });
  return units;
}

/** Mga koneksiyon ng papel sa editor (wala sa preview, print at PDF) */
export interface HteEditBindings {
  onText: (id: string, value: string) => void;
  /** Enter, Backspace at arrow sa loob ng bullet ng department */
  onBulletKey: (groupId: string, index: number, e: KeyboardEvent<HTMLDivElement>, ctl: TextControl) => boolean;
  labelOf: (id: string) => string;
  /** May tuldok: iba sa nasa system */
  isEdited: (id: string) => boolean;
  /** Row na napili (naka-highlight sa screen lang) */
  selectedRow: string | null;
  pin: { key: string; page: number } | null;
  /** Cell na may sariling input (record o report lang); null = tekstong diretsong nae-edit sa papel */
  typed: (id: string) => CellSpec | null;
  pending: PendingMap;
  problems: Record<string, string>;
  /** key ng pagbabago na kaka-save lang sa database (pansamantalang marka) */
  saved: Record<string, true>;
  onOpen: (spec: CellSpec) => void;
}

interface HteSheetProps {
  content: HteContent;
  context: ReportContext;
  variant: HteVariant;
  signatories: SignatorySet;
  mode: SheetMode;
  edit?: HteEditBindings;
  /** Mga pirmahang tina-type ng coordinator (sa device lang); pumapalit sa built-in kapag mayroon */
  manual?: ManualSignatoriesProps;
}

const plainText: TextRenderer = (_id, value, style) => (
  <div style={{ minHeight: "1.3em", whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>{value}</div>
);

/**
 * Ang mismong papel ng Report on the List of HTEs (Annex D) at ng List of HTEs.
 * Iisang component para sa editor, preview, print at PDF. Sa "list" ay walang laman ang Period of Training.
 */
export function HteSheet({ content, context, variant, signatories, mode, edit, manual }: HteSheetProps) {
  const editing = mode === "edit" && edit !== undefined;
  const cols = hteColumnsOf(content);
  const showCompany = cols.includes("company");
  const showDepartment = cols.includes("department");
  const studentCols = cols.filter((k) => k !== "company");
  const totalWeight = cols.reduce((sum, k) => sum + (WEIGHTS[k] ?? 10), 0);
  const units = unitsOf(content, showCompany);
  const firstUnit = new Map<number, number>();
  units.forEach((u, i) => { if (!firstUnit.has(u.group)) firstUnit.set(u.group, i); });
  const t = resolveTitle(content, variant, context);
  const display = displayOf(content.display);
  // Format ng petsa at blangkong cell: sa papel na hindi ine-edit (preview, print, PDF)
  const fmt = (value: string) => (editing ? value : shownCell(value, display));
  const NOTE: CSSProperties = { whiteSpace: "pre-wrap", overflowWrap: "anywhere" };

  const live: TextRenderer = (id, value, style, placeholder) => {
    const spec = edit!.typed(id);
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
        edited={edit!.isEdited(id)}
        label={edit!.labelOf(id)}
        placeholder={placeholder}
        style={style}
        onCommit={(v) => edit!.onText(id, v)}
      />
    );
  };
  const text: TextRenderer = editing ? live : plainText;

  const titleBlock = (tx: TextRenderer) => (
    <div style={{ marginBottom: 12 }}>
      {t.annex !== null && tx("h:annex", t.annex, { textAlign: "right", fontWeight: 700 }, "Annex label")}
      <div style={{ textAlign: "center", fontWeight: variant === "report" ? 700 : 400, marginTop: 6 }}>
        {t.lines.map((line, i) => (
          <div key={i}>{tx(`h:title:${i}`, line, { fontWeight: 700 }, "Title")}</div>
        ))}
        {tx("h:sem", t.semester, variant === "report" ? { fontWeight: 700 } : undefined, "School year")}
        {content.subtitle?.trim() && <div style={NOTE}>{content.subtitle}</div>}
      </div>
      <div style={{ fontWeight: 700, marginTop: 12 }}>
        {([["HEI", "h:hei", content.hei], ["ADDRESS", "h:address", content.address], ["DEGREE PROGRAM", "h:degree", content.degreeProgram]] as const).map(
          ([label, id, value]) => (
            <div key={id} style={{ display: "flex" }}>
              <span style={{ whiteSpace: "pre" }}>{label}: </span>
              <div style={{ flex: 1, minWidth: 0 }}>{tx(id, value, undefined, label)}</div>
            </div>
          ),
        )}
      </div>
      {content.headerText?.trim() && <div style={{ marginTop: 10, ...NOTE }}>{content.headerText}</div>}
    </div>
  );

  const colgroup = (
    <colgroup>
      {cols.map((k) => <col key={k} style={{ width: `${((WEIGHTS[k] ?? 10) / totalWeight) * 100}%` }} />)}
    </colgroup>
  );

  const headerRow = (
    <tr>{cols.map((k) => <th key={k} style={HEAD}>{HEADERS[k]}</th>)}</tr>
  );

  const hteCell = (gi: number, continued: boolean, tx: TextRenderer, live: boolean) => {
    const g = content.groups[gi];
    // Walang company: blangko ang cell
    if (g.noHte) return <div style={{ minHeight: "1.3em" }} />;
    const name = continued || !live ? plainText(`g:${g.id}:name`, g.name) : tx(`g:${g.id}:name`, g.name, undefined, "Company name");
    if (continued) {
      return (
        <>
          {name}
          <div style={{ fontStyle: "italic", fontSize: "0.85em" }}>(continued)</div>
        </>
      );
    }
    return (
      <>
        {name}
        {g.departments.length > 0 && !showDepartment && (
          <ul style={{ margin: "2px 0 0", paddingLeft: 18, listStyle: "disc" }}>
            {g.departments.map((d, i) => (
              <li key={i}>
                {live && edit!.typed(`g:${g.id}:dept:${i}`) ? (
                  // Linya na tugma sa tunay na department: pangalan ng department ang binabago
                  <TypedCell
                    spec={edit!.typed(`g:${g.id}:dept:${i}`) as CellSpec}
                    pending={edit!.pending}
                    value={d}
                    label={edit!.labelOf(`g:${g.id}:dept:${i}`)}
                    problems={edit!.problems}
                    saved={edit!.saved}
                    onOpen={edit!.onOpen}
                  />
                ) : live ? (
                  <SheetText
                    id={`g:${g.id}:dept:${i}`}
                    value={d}
                    editable
                    label={edit!.labelOf(`g:${g.id}:dept:${i}`)}
                    placeholder="Department"
                    onCommit={(v) => edit!.onText(`g:${g.id}:dept:${i}`, v)}
                    onKey={(e, ctl) => edit!.onBulletKey(g.id, i, e, ctl)}
                  />
                ) : (
                  plainText("", d)
                )}
              </li>
            ))}
          </ul>
        )}
      </>
    );
  };

  const studentCells = (u: Unit, tx: TextRenderer) => {
    const s = u.student >= 0 ? content.groups[u.group].students[u.student] : null;
    if (!s) {
      return <>{studentCols.map((k) => <td key={k} style={CELL} />)}</>;
    }
    return (
      <>
        {studentCols.map((k) => {
          switch (k) {
            case "name":
              return (
                <td key={k} style={CELL}>
                  <div style={{ display: "flex" }}>
                    {display.rowNumbers && <span style={{ whiteSpace: "pre" }}>{u.number}. </span>}
                    <div style={{ flex: 1, minWidth: 0 }}>{tx(`s:${s.id}:name`, s.name, undefined, "LASTNAME,FIRSTNAME M.")}</div>
                  </div>
                </td>
              );
            case "program":
              return <td key={k} style={{ ...CELL, textAlign: "center" }}>{tx(`s:${s.id}:program`, fmt(s.program), undefined, "Program")}</td>;
            case "gender":
              return <td key={k} style={{ ...CELL, textAlign: "center" }}>{tx(`s:${s.id}:gender`, fmt(s.gender), undefined, "Gender")}</td>;
            case "period":
              return (
                <td key={k} style={CELL}>
                  {variant === "report" ? tx(`s:${s.id}:period`, fmt(s.period), undefined, "Period") : plainText("", "")}
                </td>
              );
            default:
              return <td key={k} style={CELL}>{tx(`s:${s.id}:department`, fmt(s.department), undefined, " ")}</td>;
          }
        })}
      </>
    );
  };

  const footer = content.footerText?.trim()
    ? <div style={{ paddingTop: 16, breakInside: "avoid", ...NOTE }}>{content.footerText}</div>
    : null;

  const measureKey = JSON.stringify([content, variant, signatories, context.semesterId, t, manual ? [manual.items, manual.showBuiltIn, Boolean(manual.onAdd)] : null]);

  return (
    <ReportPages
      settings={content.settings}
      mode={mode}
      measureKey={measureKey}
      pin={editing ? edit.pin : null}
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
      unitGroups={units.map((u) => u.group)}
      unitKeys={units.map((u) => u.key)}
      renderMeasureRow={(i) => (
        <tr key={units[i].key}>
          {showCompany && <td style={CELL} />}
          {studentCells(units[i], plainText)}
        </tr>
      )}
      groupCount={showCompany ? content.groups.length : 0}
      renderMeasureGroup={showCompany ? (gi, continued) => (
        <tr key={`${gi}-${continued ? "c" : "f"}`}>
          <td style={CELL}>{hteCell(gi, continued, plainText, false)}</td>
          {studentCols.map((k) => <td key={k} style={CELL} />)}
        </tr>
      ) : undefined}
      renderBody={(slice) => {
        const rows = [];
        for (let i = slice.start; i < slice.end; i++) {
          const u = units[i];
          const g = content.groups[u.group];
          const segmentStart = i === slice.start || units[i - 1].group !== u.group;
          let span = 1;
          if (segmentStart) {
            while (i + span < slice.end && units[i + span].group === u.group) span++;
          }
          const continued = i > (firstUnit.get(u.group) ?? 0);
          const s = u.student >= 0 ? g.students[u.student] : null;
          rows.push(
            <tr
              key={u.key}
              data-unit-key={u.key}
              data-row-kind={s ? "student" : "group"}
              data-group-id={g.id}
              data-student-id={s?.id}
              style={{
                breakInside: "avoid",
                ...(display.striped && u.number > 0 && u.number % 2 === 0 ? { background: STRIPE } : null),
                ...(editing && edit.selectedRow === u.key ? { background: "rgba(37,99,235,.07)" } : null),
              }}
            >
              {showCompany && segmentStart && (
                <td key="hte" style={CELL} rowSpan={span} data-row-kind="group" data-group-id={g.id}>
                  {hteCell(u.group, continued, text, editing)}
                </td>
              )}
              {studentCells(u, text)}
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
