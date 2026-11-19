// Lahat ng nae-edit na teksto ng HTE report: id, label (para sa accessibility at bottom sheet), laman,
// at kung paano ito isinusulat pabalik sa draft. Iisang listahan para sa papel, Tab at bottom sheet.

import { departmentLabel, formatGender, formatPeriod, formatStudentName } from "@/lib/hteReport";
import type { HteContent, HteVariant, ReportContext, ReportSource, SignatoryRole, SignatorySet } from "@/types/reports";

export interface CellDef {
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
}

export interface HteTitle {
  /** null = walang annex label (List of HTEs) */
  annex: string | null;
  lines: string[];
  semester: string;
}

/** Salita ng template */
export function defaultTitle(variant: HteVariant, ctx: ReportContext): HteTitle {
  const sem = [ctx.term, ctx.schoolYear].filter(Boolean).join(" ");
  if (variant === "report") {
    return {
      annex: "ANNEX “D”",
      lines: [
        "REPORT ON THE",
        "LIST OF HOST TRAINING ESTABLISHMENTS (HTEs) AND STUDENTS’ INTERNS PARTICIPATING IN THE",
        "STUDENT INTERNSHIP PROGRAM IN THE PHILIPPINES (SIPP)",
      ],
      semester: `AY ${sem}`,
    };
  }
  return { annex: null, lines: ["LIST OF HOST TRAINING ESTABLISHMENTS (HTE)"], semester: sem };
}

/** Ang ipi-print: ang binago ng coordinator kung mayroon, kung wala ay ang sa template */
export function resolveTitle(content: HteContent, variant: HteVariant, ctx: ReportContext): HteTitle {
  const d = defaultTitle(variant, ctx);
  return {
    annex: d.annex === null ? null : (content.annexLabel ?? d.annex),
    lines: content.titleLines ?? d.lines,
    semester: content.semesterLine ?? d.semester,
  };
}

const STUDENT_FIELDS = { name: "Name of student", program: "Program", gender: "Gender", period: "Period of training", department: "Department" } as const;

/** Mga column ng table, sa ayos ng papel; gaya ng template kung walang pinili */
export const HTE_COLUMNS = [
  { key: "company", label: "Company" },
  { key: "name", label: "Name of student" },
  { key: "program", label: "Program" },
  { key: "gender", label: "Gender" },
  { key: "period", label: "Period of training" },
  { key: "department", label: "Department" },
] as const;

export const DEFAULT_HTE_COLUMNS = ["company", "name", "program", "gender", "period"];

/**
 * Mga napiling column sa ayos ng papel. Laging una ang Company (sakop nito ang mga row ng mga student nito);
 * ang iba ay sa ayos na pinili ng coordinator. Laging kasama ang pangalan.
 */
export function hteColumnsOf(content: HteContent): string[] {
  const known = new Set(HTE_COLUMNS.map((c) => c.key as string));
  const chosen = [...new Set((content.columns ?? DEFAULT_HTE_COLUMNS).filter((k) => known.has(k)))];
  if (!chosen.includes("name")) chosen.push("name");
  return [...(chosen.includes("company") ? ["company"] : []), ...chosen.filter((k) => k !== "company")];
}
type StudentField = keyof typeof STUDENT_FIELDS;

const SIG_LABEL: Record<SignatoryRole, string> = {
  prepared: "Prepared by",
  programHead: "Noted, program head",
  dean: "Noted, dean",
  chair: "Certified true and correct",
};

/** Ayos ng pagbasa: pamagat, HEI, table (bawat HTE at mga student), pirmahan */
export function hteCells(content: HteContent, ctx: ReportContext, variant: HteVariant, people: SignatorySet): CellDef[] {
  const t = resolveTitle(content, variant, ctx);
  const cells: CellDef[] = [];
  if (t.annex !== null) cells.push({ id: "h:annex", label: "Annex label", value: t.annex });
  t.lines.forEach((l, i) => cells.push({ id: `h:title:${i}`, label: `Title line ${i + 1}`, value: l }));
  cells.push({ id: "h:sem", label: "School year line", value: t.semester });
  cells.push({ id: "h:hei", label: "HEI", value: content.hei });
  cells.push({ id: "h:address", label: "Address", value: content.address });
  cells.push({ id: "h:degree", label: "Degree program", value: content.degreeProgram });

  const cols = hteColumnsOf(content);
  let n = 0;
  content.groups.forEach((g, gi) => {
    if (!g.noHte && cols.includes("company")) cells.push({ id: `g:${g.id}:name`, label: `Host training establishment, group ${gi + 1}`, value: g.name });
    if (cols.includes("company") && !cols.includes("department")) g.departments.forEach((d, di) =>
      cells.push({ id: `g:${g.id}:dept:${di}`, label: `Department ${di + 1}, group ${gi + 1}`, value: d }));
    for (const s of g.students) {
      n++;
      for (const f of Object.keys(STUDENT_FIELDS) as StudentField[]) {
        if (!cols.includes(f) || (f === "period" && variant === "list")) continue;
        cells.push({ id: `s:${s.id}:${f}`, label: `${STUDENT_FIELDS[f]}, row ${n}`, value: s[f] });
      }
    }
  });

  for (const role of Object.keys(SIG_LABEL) as SignatoryRole[]) {
    cells.push({ id: `sig:${role}:name`, label: `${SIG_LABEL[role]}, name`, value: people[role].name });
    cells.push({ id: `sig:${role}:title`, label: `${SIG_LABEL[role]}, title`, value: people[role].title });
  }
  return cells;
}

/** Ang mga default na pangalan sa pirmahan */
export function signatoryLive(ctx: ReportContext, live: Map<string, string>) {
  for (const role of Object.keys(SIG_LABEL) as SignatoryRole[]) {
    const person = ctx.defaults[role] ?? { name: "", title: "" };
    live.set(`sig:${role}:name`, person.name);
    live.set(`sig:${role}:title`, person.title);
  }
}

/** Ang halaga sa system o template ng bawat cell na mayroon nito; ang mga idinagdag sa report ay wala */
export function hteLiveIndex(content: HteContent, source: ReportSource, variant: HteVariant): Map<string, string> {
  const ctx = source.context;
  const live = new Map<string, string>();
  const t = defaultTitle(variant, ctx);
  if (t.annex !== null) live.set("h:annex", t.annex);
  t.lines.forEach((l, i) => live.set(`h:title:${i}`, l));
  live.set("h:sem", t.semester);
  live.set("h:hei", ctx.hei);
  live.set("h:address", ctx.address);
  live.set("h:degree", ctx.programName);

  const companies = new Map(source.data.companies.map((c) => [c.id, c.name]));
  const departments = new Map(source.data.departments.map((d) => [d.id, d.name]));
  const students = new Map(source.data.students.map((s) => [s.id, s]));
  for (const g of content.groups) {
    if (g.companyId !== null && companies.has(g.companyId)) live.set(`g:${g.id}:name`, companies.get(g.companyId) as string);
    for (const s of g.students) {
      const row = s.studentId === null ? undefined : students.get(s.studentId);
      if (!row) continue;
      live.set(`s:${s.id}:name`, formatStudentName(row));
      live.set(`s:${s.id}:program`, row.program);
      live.set(`s:${s.id}:gender`, formatGender(row.gender));
      live.set(`s:${s.id}:period`, formatPeriod(row.startDate, row.endDate));
      live.set(`s:${s.id}:department`, row.departmentId === null ? "" : departmentLabel(departments.get(row.departmentId)));
    }
  }
  signatoryLive(ctx, live);
  return live;
}

export function cellLabel(cells: CellDef[], id: string) {
  return cells.find((c) => c.id === id)?.label ?? "Text";
}

/** Signatory na cell: ibinabalik ang role at field; null kung hindi */
export function signatoryOf(id: string): { role: SignatoryRole; field: "name" | "title" } | null {
  const m = /^sig:(\w+):(name|title)$/.exec(id);
  if (!m || !(m[1] in SIG_LABEL)) return null;
  return { role: m[1] as SignatoryRole, field: m[2] as "name" | "title" };
}

/** Isinusulat ang teksto ng isang cell sa draft (hindi kasama ang pirmahan); ibinabalik ang parehong object kung walang nagbago */
export function applyCell(content: HteContent, id: string, value: string, variant: HteVariant, ctx: ReportContext): HteContent {
  const parts = id.split(":");
  if (parts[0] === "h") {
    switch (parts[1]) {
      case "annex": return { ...content, annexLabel: value };
      case "sem": return { ...content, semesterLine: value };
      case "hei": return { ...content, hei: value };
      case "address": return { ...content, address: value };
      case "degree": return { ...content, degreeProgram: value };
      case "title": {
        const lines = [...resolveTitle(content, variant, ctx).lines];
        lines[Number(parts[2])] = value;
        return { ...content, titleLines: lines };
      }
      default: return content;
    }
  }
  if (parts[0] === "g") {
    const [, gid, field, idx] = parts;
    return {
      ...content,
      groups: content.groups.map((g) => {
        if (g.id !== gid) return g;
        if (field === "name") return { ...g, name: value };
        if (field === "dept") return { ...g, departments: g.departments.map((d, i) => (i === Number(idx) ? value : d)) };
        return g;
      }),
    };
  }
  if (parts[0] === "s") {
    const [, sid, field] = parts;
    if (!(field in STUDENT_FIELDS)) return content;
    return {
      ...content,
      groups: content.groups.map((g) =>
        g.students.some((s) => s.id === sid)
          ? { ...g, students: g.students.map((s) => (s.id === sid ? { ...s, [field]: value } : s)) }
          : g),
    };
  }
  return content;
}
