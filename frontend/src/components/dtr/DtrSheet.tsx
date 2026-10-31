import type { DtrContent, DtrRow } from "@/lib/dtrDraftStore";
import { chunk, dayName, formatHours, formatTime, parseIso, rowHours, totalHours } from "@/components/dtr/dtrMath";

interface Props {
  content: DtrContent;
  collegeAbbreviation: string;
  collegeLogoSrc?: string;
  /** Hitsura ng papel (anino, hangganan, numero ng pahina) para sa preview sa screen */
  preview?: boolean;
}

/**
 * Ang mismong DTR na ipi-print / ida-download (long bond 8.5 x 13 in).
 * Inline ang mga style para pareho ang labas sa print at sa PDF.
 */
export function DtrSheet({ content, collegeAbbreviation, collegeLogoSrc, preview = false }: Props) {
  const pages = chunk(content.rows, content.rowsPerPage);
  const total = totalHours(content);
  const logo = collegeLogoSrc
    ? collegeLogoSrc
    : collegeAbbreviation ? `/logos/college-${collegeAbbreviation.toLowerCase()}.png` : "";

  const cell: React.CSSProperties = { border: "1px solid #000", padding: "3px 4px", textAlign: "center", height: 24 };
  const head: React.CSSProperties = { ...cell, background: "#d9dbd3", fontWeight: 700, height: "auto" };
  const label: React.CSSProperties = { width: 150, padding: "1px 0", verticalAlign: "top" };

  const dayLabel = (iso: string) => {
    const p = parseIso(iso);
    return p ? `${p.d}` : iso;
  };

  const table = (rows: DtrRow[], isLast: boolean) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>
          <th rowSpan={2} style={{ ...head, width: 70 }}>DATE</th>
          <th rowSpan={2} style={{ ...head, width: 50 }}>DAY</th>
          <th colSpan={2} style={head}>A.M.</th>
          <th colSpan={2} style={head}>P.M.</th>
          <th rowSpan={2} style={{ ...head, width: 70 }}>NO. OF<br />HOURS</th>
          <th rowSpan={2} style={{ ...head, width: 150 }}>SIGNATURE OF<br />SUPERVISOR</th>
        </tr>
        <tr>
          <th style={head}>IN</th><th style={head}>OUT</th>
          <th style={head}>IN</th><th style={head}>OUT</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const off = !r.worked;
          return (
            <tr key={r.id} style={{ breakInside: "avoid" }}>
              <td style={cell}>{dayLabel(r.date)}</td>
              <td style={cell}>{dayName(r.date)}</td>
              {off ? (
                <td colSpan={5} style={cell} />
              ) : (
                <>
                  <td style={cell}>{formatTime(r.amIn)}</td>
                  <td style={cell}>{formatTime(r.amOut)}</td>
                  <td style={cell}>{formatTime(r.pmIn)}</td>
                  <td style={cell}>{formatTime(r.pmOut)}</td>
                  <td style={cell}>{formatHours(rowHours(r))}</td>
                </>
              )}
              <td style={cell} />
            </tr>
          );
        })}
        {isLast && (
          <tr>
            <td colSpan={6} style={{ ...cell, textAlign: "right", fontWeight: 700, paddingRight: 8 }}>TOTAL HOURS</td>
            <td style={{ ...cell, fontWeight: 700 }}>{formatHours(total)}</td>
            <td style={cell} />
          </tr>
        )}
      </tbody>
    </table>
  );

  const firstHeader = (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "3px solid #2563a8", paddingBottom: 6 }}>
        <img src="/logos/ucu-logo-weekly-report.png" alt="Urdaneta City University" style={{ height: 64, objectFit: "contain" }} />
        {logo && (
          <img
            src={logo} alt={collegeAbbreviation} crossOrigin="anonymous" style={{ height: 64, objectFit: "contain" }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        )}
      </div>
      <div style={{ textAlign: "center", margin: "14px 0 10px", fontWeight: 700 }}>
        <div style={{ fontSize: 16 }}>DAILY TIME RECORD</div>
        {content.semester && <div style={{ fontSize: 12, fontWeight: 400 }}>{content.semester}</div>}
      </div>
      <table style={{ borderCollapse: "collapse", marginBottom: 10 }}>
        <tbody>
          {[
            ["Name of Student", content.studentName],
            ["Course and Year", content.courseYear],
            ["Name of Company/Office", content.company],
            ["Department Assigned", content.department],
            ["For the month of", content.monthLabel],
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
      <div style={{ fontSize: 14 }}>DAILY TIME RECORD (continued)</div>
      <div style={{ fontSize: 12, fontWeight: 400 }}>{content.studentName} · {content.monthLabel}</div>
    </div>
  );

  const footer = (
    <>
      <p style={{ margin: "12px 0 0", fontSize: 12, fontStyle: "italic", textAlign: "justify" }}>
        I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from the office.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 34, fontSize: 12 }}>
        <div style={{ width: 300, textAlign: "center" }}>
          <div style={{ textAlign: "left", marginBottom: 26 }}>Prepared by:</div>
          <div style={{ borderTop: "1px solid #000", paddingTop: 2 }}><b>{content.studentName.toUpperCase()}</b></div>
          <div style={{ fontSize: 11 }}>Student (Signature over printed name)</div>
        </div>
        <div style={{ width: 300, textAlign: "center" }}>
          <div style={{ textAlign: "left", marginBottom: 26 }}>Approved by:</div>
          <div style={{ borderTop: "1px solid #000", paddingTop: 2 }}><b>{(content.supervisorName ?? "").toUpperCase()}</b></div>
          <div style={{ fontSize: 11 }}>{content.supervisorPosition || "OJT Supervisor"}</div>
          <div style={{ fontSize: 11 }}>(Signature over printed name)</div>
        </div>
      </div>
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
              className="dtr-page"
              style={{
                minHeight: 1240, boxSizing: "border-box", padding: "40px 56px", background: "#fff",
                breakAfter: isLast ? "auto" : "page", ...paper,
              }}
            >
              {pi === 0 ? firstHeader : nextHeader}
              {table(pageRows, isLast)}
              {isLast && footer}
            </div>
          </div>
        );
      })}
    </div>
  );
}
