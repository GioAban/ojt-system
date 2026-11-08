import type { CSSProperties, KeyboardEvent } from "react";
import { Letterhead } from "@/components/reports/Letterhead";
import { ReportPages, type SheetMode } from "@/components/reports/ReportPages";
import { SignatoriesSheet, type TextRenderer } from "@/components/reports/SignatoriesSheet";
import { SheetText, type TextControl } from "@/components/reports/editor/EditableText";
import { hteColumnsOf, resolveTitle } from "@/lib/hteCells";
import type { HteContent, HteVariant, ReportContext, SignatorySet } from "@/types/reports";

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
}

interface HteSheetProps {
  content: HteContent;
  context: ReportContext;
  variant: HteVariant;
  signatories: SignatorySet;
  mode: SheetMode;
  edit?: HteEditBindings;
}

const plainText: TextRenderer = (_id, value, style) => (
  <div style={{ minHeight: "1.3em", whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>{value}</div>
);

/**
 * Ang mismong papel ng Report on the List of HTEs (Annex D) at ng List of HTEs.
 * Iisang component para sa editor, preview, print at PDF. Sa "list" ay walang laman ang Period of Training.
 */
export function HteSheet({ content, context, variant, signatories, mode, edit }: HteSheetProps) {
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

  const live: TextRenderer = (id, value, style, placeholder) => (
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
  const text: TextRenderer = editing ? live : plainText;

  const titleBlock = (tx: TextRenderer) => (
    <div style={{ marginBottom: 12 }}>
      {t.annex !== null && tx("h:annex", t.annex, { textAlign: "right", fontWeight: 700 }, "Annex label")}
      <div style={{ textAlign: "center", fontWeight: variant === "report" ? 700 : 400, marginTop: 6 }}>
        {t.lines.map((line, i) => (
          <div key={i}>{tx(`h:title:${i}`, line, { fontWeight: 700 }, "Title")}</div>
        ))}
        {tx("h:sem", t.semester, variant === "report" ? { fontWeight: 700 } : undefined, "School year")}
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
                {live ? (
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
                    <span style={{ whiteSpace: "pre" }}>{u.number}. </span>
                    <div style={{ flex: 1, minWidth: 0 }}>{tx(`s:${s.id}:name`, s.name, undefined, "LASTNAME,FIRSTNAME M.")}</div>
                  </div>
                </td>
              );
            case "program":
              return <td key={k} style={{ ...CELL, textAlign: "center" }}>{tx(`s:${s.id}:program`, s.program, undefined, "Program")}</td>;
            case "gender":
              return <td key={k} style={{ ...CELL, textAlign: "center" }}>{tx(`s:${s.id}:gender`, s.gender, undefined, "Gender")}</td>;
            case "period":
              return (
                <td key={k} style={CELL}>
                  {variant === "report" ? tx(`s:${s.id}:period`, s.period, undefined, "Period") : plainText("", "")}
                </td>
              );
            default:
              return <td key={k} style={CELL}>{tx(`s:${s.id}:department`, s.department, undefined, " ")}</td>;
          }
        })}
      </>
    );
  };

  const measureKey = JSON.stringify([content, variant, signatories, context.semesterId, t]);

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
      signatories={<SignatoriesSheet people={signatories} text={text} />}
      measureSignatories={<SignatoriesSheet people={signatories} />}
    />
  );
}
