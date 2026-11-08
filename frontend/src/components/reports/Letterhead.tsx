import { collegeLogoSrc } from "@/components/colleges/CollegeLogo";

const RED = "#C12035";

interface LetterheadProps {
  collegeName: string;
  collegeAbbreviation: string;
  collegeLogoPath: string;
}

/** "COLLEGE OF INFORMATION..." na naka-bold ang unang titik ng bawat salita, gaya ng template */
function CollegeName({ name }: { name: string }) {
  const words = name.toUpperCase().split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => {
        const small = ["OF", "AND", "THE", "IN", "FOR"].includes(w);
        return (
          <span key={i}>
            {small ? w : <><b>{w[0]}</b>{w.slice(1)}</>}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
  );
}

/**
 * Letterhead ng UCU (mula sa template): umuulit sa itaas ng bawat pahina, gaya ng header sa Word.
 * Logo ng college: ang na-upload ng admin; kung wala at CITE ang college, ang seal mula sa template.
 */
export function Letterhead({ collegeName, collegeAbbreviation, collegeLogoPath }: LetterheadProps) {
  const uploaded = collegeLogoSrc(collegeLogoPath);
  const logo = uploaded || (collegeAbbreviation.toUpperCase() === "CITE" ? "/logos/cite-letterhead-seal.png" : "");

  return (
    <>
      <div
        style={{
          position: "absolute", top: 24, left: 62, right: 52, height: 72,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src="/logos/ucu-letterhead.png" alt="Urdaneta City University" style={{ height: 62, width: "auto" }} />
          <div style={{ color: RED, fontFamily: "Arial, Helvetica, sans-serif" }}>
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0.3 }}>URDANETA CITY</div>
            <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.05, letterSpacing: 0.3 }}>UNIVERSITY</div>
            <div style={{ fontSize: 9, marginTop: 3, fontFamily: "Roboto, Arial, Helvetica, sans-serif" }}>
              Owned and operated by the City Government of Urdaneta
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {logo && (
            <img
              src={logo} alt={collegeAbbreviation} crossOrigin="anonymous" style={{ height: 60, width: 60, objectFit: "contain" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          )}
          {collegeName && (
            <div style={{ width: 140, fontSize: 11, lineHeight: 1.25, color: "#000", fontFamily: "Arial, Helvetica, sans-serif" }}>
              <CollegeName name={collegeName} />
            </div>
          )}
        </div>
      </div>
      <div style={{ position: "absolute", top: 104, left: 62, right: 52, borderTop: "2px solid #273F89" }} />
    </>
  );
}
