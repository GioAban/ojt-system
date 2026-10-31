import type { WeeklyContent, WeeklyRow } from "@/lib/weeklyDraftStore";

/** MM-DD-YYYY mula sa YYYY-MM-DD */
export function formatSheetDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[2]}-${m[3]}-${m[1]}` : iso;
}

function activityLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.startsWith("-") ? l : `-${l}`));
}

const RATINGS = ["Excellent", "Very Good", "Good", "Fair", "Poor"];

/** Ang mga araw na may isinulat lang ang ilalabas; kung wala pang laman, lahat ng araw */
export function printableRows(content: WeeklyContent): WeeklyRow[] {
  const filled = content.rows.filter((r) => r.text.trim() !== "");
  return filled.length ? filled : content.rows;
}

/** Hinahati ang mga araw ayon sa pinili ng student (0 = lahat sa isang pahina) */
export function chunkRows(rows: WeeklyRow[], perPage: number | undefined): WeeklyRow[][] {
  const n = perPage && perPage > 0 ? perPage : Math.max(rows.length, 1);
  const pages: WeeklyRow[][] = [];
  for (let i = 0; i < rows.length; i += n) pages.push(rows.slice(i, i + n));
  return pages.length ? pages : [[]];
}

interface Props {
  content: WeeklyContent;
  collegeAbbreviation: string;
  /** Buong URL ng na-upload na logo ng college; kung wala, hahanapin ang /logos/college-<abbr>.png */
  collegeLogoSrc?: string;
  /** Hitsura ng papel (anino, hangganan, numero ng pahina) para sa preview sa screen */
  preview?: boolean;
}

/**
 * Ang mismong form na ipi-print / ida-download: kapareho ng opisyal na template
 * (long bond 8.5 x 13 in). Inline ang mga style para pareho ang labas sa print at sa PDF.
 * Ang student ang pumipili kung ilang araw ang bawat pahina (Page settings sa editor).
 */
export function WeeklyReportSheet({ content, collegeAbbreviation, collegeLogoSrc, preview = false }: Props) {
  const pages = chunkRows(printableRows(content), content.rowsPerPage);

  const cell: React.CSSProperties = { border: "1px solid #000", padding: "4px 8px", verticalAlign: "top" };
  const label: React.CSSProperties = { width: 190, padding: "1px 0" };
  const collegeLogo = collegeLogoSrc
    ? collegeLogoSrc
    : collegeAbbreviation ? `/logos/college-${collegeAbbreviation.toLowerCase()}.png` : "";

  const table = (pageRows: WeeklyRow[]) => (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#d9dbd3" }}>
          <th style={{ ...cell, width: 150, textAlign: "center" }}>Date</th>
          <th style={{ ...cell, textAlign: "center" }}>Activities</th>
        </tr>
      </thead>
      <tbody>
        {pageRows.map((r, i) => (
          <tr key={i} style={{ breakInside: "avoid" }}>
            <td style={cell}>{formatSheetDate(r.date)}</td>
            <td style={{ ...cell, textAlign: "justify" }}>
              {activityLines(r.text).map((line, j) => <div key={j}>{line}</div>)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const firstHeader = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #2563a8", paddingBottom: 6 }}>
        <img src="/logos/ucu-logo-weekly-report.png" alt="Urdaneta City University" style={{ height: 64, objectFit: "contain" }} />
        {collegeLogo && (
          <img
            src={collegeLogo} alt={collegeAbbreviation} crossOrigin="anonymous" style={{ height: 64, objectFit: "contain" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>

      <div style={{ textAlign: "center", margin: "14px 0 10px", fontWeight: 700 }}>
        <div style={{ fontSize: 15 }}>INTERNSHIP/PRACTICUM WEEKLY REPORT</div>
        {content.semester && <div style={{ fontSize: 13 }}>{content.semester}</div>}
      </div>

      <table style={{ borderCollapse: "collapse", marginBottom: 8 }}>
        <tbody>
          {[
            ["Name of Student", content.studentName],
            ["Course", content.course],
            ["Name of Company/Office", content.company],
            ["Department Assigned", content.department],
          ].map(([k, v]) => (
            <tr key={k}>
              <td style={label}>{k}</td>
              <td style={{ padding: "1px 0" }}>: <b style={{ textDecoration: "underline" }}>{v}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const nextHeader = (
    <div style={{ textAlign: "center", fontWeight: 700, margin: "0 0 12px", borderBottom: "3px solid #2563a8", paddingBottom: 8 }}>
      <div style={{ fontSize: 14 }}>INTERNSHIP/PRACTICUM WEEKLY REPORT (continued)</div>
      <div style={{ fontSize: 12, fontWeight: 400 }}>{content.studentName}</div>
    </div>
  );

  const footer = (
    <>
      <p style={{ margin: "6px 0 18px", fontStyle: "italic" }}>I hereby certify that the above statements are true and correct.</p>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginBottom: 4 }}>
        <b style={{ width: 190 }}>Name of Student:</b>
        <div style={{ textAlign: "center", minWidth: 240 }}>
          <div style={{ height: 34 }} />
          <b style={{ textDecoration: "underline" }}>{content.studentName.toUpperCase()}</b>
          <div style={{ fontSize: 12 }}>(Student Signature over printed name)</div>
        </div>
      </div>

      <div style={{ marginTop: 22 }}>
        <b>Supervisor's Evaluation:</b>
        <div style={{ fontSize: 11, fontStyle: "italic", margin: "6px 0" }}>(Please check [✓] to rate the student based on his/her weekly performance.)</div>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
          <thead>
            <tr style={{ background: "#d9dbd3" }}>
              {RATINGS.map((r) => <th key={r} style={{ ...cell, fontWeight: 400 }}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>{RATINGS.map((r) => <td key={r} style={{ ...cell, height: 34 }} />)}</tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24 }}>
        <b>Comments and Suggestions (Optional):</b>
        <div style={{ borderBottom: "1px solid #000", height: 26 }} />
        <div style={{ borderBottom: "1px solid #000", height: 26 }} />
      </div>

      <table style={{ marginTop: 22, borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ width: 190, padding: "6px 0", verticalAlign: "bottom" }}>Name of Supervisor</td>
            <td style={{ verticalAlign: "bottom" }}>:</td>
            <td style={{ paddingLeft: 24, textAlign: "center" }}>
              <div style={{ height: 30 }} />
              <div style={{ borderTop: "1px solid #000", width: 260, paddingTop: 2 }}>
                <b>{(content.supervisorName ?? "").toUpperCase()}</b>
              </div>
              <div style={{ fontSize: 11 }}>(Signature over Printed name)</div>
              <div style={{ fontSize: 11 }}>OJT Supervisor</div>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "6px 0" }}>Position</td>
            <td>:</td>
            <td style={{ paddingLeft: 24 }}>
              <div style={{ borderBottom: "1px solid #000", width: 260, minHeight: 20 }}>{content.supervisorPosition ?? ""}</div>
            </td>
          </tr>
          <tr>
            <td style={{ padding: "6px 0" }}>Date</td>
            <td>:</td>
            <td style={{ paddingLeft: 24 }}>
              <div style={{ borderBottom: "1px solid #000", width: 260, minHeight: 20 }}>
                {content.supervisorDate ? formatSheetDate(content.supervisorDate) : ""}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );

  const paper: React.CSSProperties = preview
    ? { background: "#fff", border: "1px solid #d4d4d8", boxShadow: "0 2px 10px rgba(0,0,0,0.22)" }
    : {};

  return (
    <div style={{ width: 816, background: preview ? "transparent" : "#fff", color: "#000", fontFamily: "Arial, Helvetica, sans-serif", fontSize: 13 }}>
      {pages.map((pageRows, pi) => {
        const isLast = pi === pages.length - 1;
        return (
          <div key={pi} style={preview ? { marginBottom: isLast ? 0 : 20 } : undefined}>
            {preview && (
              <div style={{ textAlign: "center", fontSize: 11, color: "#71717a", marginBottom: 6 }}>
                Page {pi + 1} of {pages.length}
              </div>
            )}
            <div
              className="wk-page"
              style={{
                minHeight: 1240, boxSizing: "border-box", padding: "48px 56px", background: "#fff",
                breakAfter: isLast ? "auto" : "page", ...paper,
              }}
            >
              {pi === 0 ? firstHeader : nextHeader}
              {table(pageRows)}
              {isLast && footer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
