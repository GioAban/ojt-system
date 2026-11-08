// Pag-download bilang Excel (.xlsx) sa browser: kung ano ang nasa screen (mga napiling column, filter, ayos at edit).
// Hiwalay na chunk ang ExcelJS: nilo-load lang kapag pinindot ang Download Excel.

import { annualColumns } from "@/lib/annualReport";
import { hteColumnsOf, resolveTitle } from "@/lib/hteCells";
import { cellOf, templateColumns, visibleUnits } from "@/lib/listTemplates";
import type {
  AnnualContent, HteContent, HteVariant, ListContent, ReportContext,
} from "@/types/reports";

export type ExcelKind = "text" | "number" | "date";

export interface ExcelColumn {
  label: string;
  kind?: ExcelKind;
}

export type ExcelRow = { group: string } | { cells: string[] };

export interface ExcelTable {
  heading?: string;
  columns: ExcelColumn[];
  rows: ExcelRow[];
}

export interface ExcelDocument {
  title: string;
  context: ReportContext;
  tables: ExcelTable[];
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "August 1, 2025" o "2025-08-01" -> petsa sa UTC (para hindi umusog ng isang araw); null kung hindi petsa */
export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(s);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  return month < 0 ? null : new Date(Date.UTC(+m[3], month, +m[2]));
}

/** Numero kung numero talaga; kung binago ng coordinator at naging teksto, teksto pa rin */
export function excelValue(raw: string, kind: ExcelKind = "text"): string | number | Date {
  if (kind === "number") {
    const s = raw.trim();
    if (s !== "" && /^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  }
  if (kind === "date") {
    const d = parseDate(raw);
    if (d) return d;
  }
  return raw;
}

const FORBIDDEN_FILE = /[\\/:*?"<>|]+/g;

export function excelFileName(title: string, semester: string) {
  const name = [title.trim() || "Report", semester.trim()].filter(Boolean).join(" - ");
  return `${name.replace(FORBIDDEN_FILE, " ").replace(/\s+/g, " ").trim()}.xlsx`;
}

const sheetName = (title: string) => (title.replace(/[\\/:*?"'[\]]+/g, " ").trim() || "Report").slice(0, 31);

const MIN_WIDTH = 8;
const MAX_WIDTH = 45;

export async function downloadExcel(doc: ExcelDocument) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const ws = book.addWorksheet(sheetName(doc.title));
  const ctx = doc.context;

  const headerLines = [
    ["", doc.title],
    ["College", ctx.collegeName],
    ["Program", ctx.programName],
    ["Semester", ctx.semesterName],
    ["Date generated", new Date().toLocaleDateString(undefined, { dateStyle: "long" })],
  ] as const;
  for (const [label, value] of headerLines) {
    if (!value) continue;
    const row = ws.addRow([label ? `${label}: ${value}` : value]);
    if (!label) row.font = { bold: true, size: 14 };
  }

  const widths: number[] = [];
  const grow = (i: number, text: string) => {
    const longest = text.split("\n").reduce((n, l) => Math.max(n, l.length), 0);
    widths[i] = Math.min(MAX_WIDTH, Math.max(widths[i] ?? MIN_WIDTH, longest + 2));
  };

  let firstHeaderRow = 0;
  for (const table of doc.tables) {
    ws.addRow([]);
    if (table.heading) ws.addRow([table.heading]).font = { bold: true };

    const header = ws.addRow(table.columns.map((c) => c.label));
    if (!firstHeaderRow) firstHeaderRow = header.number;
    header.font = { bold: true };
    header.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
    header.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
      cell.border = { bottom: { style: "thin" } };
    });
    table.columns.forEach((c, i) => grow(i, c.label));

    for (const r of table.rows) {
      if ("group" in r) {
        const row = ws.addRow([r.group]);
        row.font = { bold: true };
        ws.mergeCells(row.number, 1, row.number, table.columns.length);
        row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F3F3" } };
        continue;
      }
      const row = ws.addRow(r.cells.map((value, i) => excelValue(value, table.columns[i]?.kind)));
      row.alignment = { wrapText: true, vertical: "top" };
      r.cells.forEach((value, i) => {
        grow(i, value);
        if (row.getCell(i + 1).value instanceof Date) row.getCell(i + 1).numFmt = "mmmm d, yyyy";
      });
    }
  }
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Isang table lang ang may saysay na i-freeze ang header (ang Annual Report ay may dalawa)
  if (doc.tables.length === 1 && firstHeaderRow) {
    ws.views = [{ state: "frozen", ySplit: firstHeaderRow }];
  }

  const buffer = await book.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }));
  const a = document.createElement("a");
  a.href = url;
  a.download = excelFileName(doc.title, ctx.semesterName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Laman bawat uri ng report ---------------------------------------------

export function listExcel(c: ListContent, title: string, context: ReportContext): ExcelDocument {
  const columns = templateColumns(c.template).filter((col) => c.columns.includes(col.key));
  const rows: ExcelRow[] = visibleUnits(c).map((u) => (u.kind === "group"
    ? { group: `${u.label} (${u.count})` }
    : { cells: [String(u.number), ...columns.map((col) => cellOf(c, u.row, col.key))] }));
  return {
    title,
    context,
    tables: [{
      columns: [{ label: "NO.", kind: "number" }, ...columns.map((col) => ({ label: col.label, kind: col.kind }))],
      rows,
    }],
  };
}

export function hteExcel(c: HteContent, title: string, context: ReportContext, variant: HteVariant): ExcelDocument {
  const cols = hteColumnsOf(c);
  const showBullets = !cols.includes("department");
  const rows: ExcelRow[] = [];
  let n = 0;
  for (const g of c.groups) {
    // Inuulit ang company sa bawat row para gumana ang sort at filter sa Excel
    const company = g.noHte ? "" : [g.name, ...(showBullets ? g.departments.filter(Boolean).map((d) => `• ${d}`) : [])].join("\n");
    for (const s of g.students) {
      n++;
      const cells: string[] = [];
      for (const col of cols) {
        if (col === "company") cells.push(company);
        else if (col === "name") cells.push(s.name);
        else if (col === "program") cells.push(s.program);
        else if (col === "gender") cells.push(s.gender);
        else if (col === "period") cells.push(variant === "report" ? s.period : "");
        else if (col === "department") cells.push(s.department ?? "");
      }
      rows.push({ cells: [String(n), ...cells] });
    }
  }
  const LABELS: Record<string, string> = {
    company: "HOST TRAINING ESTABLISHMENT", name: "NAME OF STUDENT", program: "PROGRAM", gender: "GENDER",
    period: "PERIOD OF TRAINING", department: "DEPARTMENT",
  };
  return {
    title: title || resolveTitle(c, variant, context).lines.join(" "),
    context,
    tables: [{
      columns: [{ label: "NO.", kind: "number" }, ...cols.map((k) => ({ label: LABELS[k] }))],
      rows,
    }],
  };
}

export function annualExcel(c: AnnualContent, title: string, context: ReportContext): ExcelDocument {
  const { summary, issues } = annualColumns(c);
  return {
    title,
    context,
    tables: [
      {
        heading: "A. SUMMARY OF STUDENT INTERNS",
        columns: summary.map((col) => ({ label: col.label, kind: col.kind })),
        rows: c.summary.map((r) => ({ cells: summary.map((col) => r[col.key]) })),
      },
      {
        heading: "B. ISSUES AND CONCERNS, SOLUTIONS AND RECOMMENDATIONS",
        columns: issues.map((col) => ({ label: col.label })),
        rows: c.issues.map((r) => ({ cells: issues.map((col) => r[col.key]) })),
      },
    ],
  };
}
