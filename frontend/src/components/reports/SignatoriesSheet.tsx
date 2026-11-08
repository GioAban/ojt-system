import type { CSSProperties, ReactNode } from "react";
import type { Signatory, SignatoryRole, SignatorySet } from "@/types/reports";

/** Paano isusulat ang isang teksto (sa editor: nae-edit; sa print: payak) */
export type TextRenderer = (id: string, value: string, style?: CSSProperties, placeholder?: string) => ReactNode;

const plain: TextRenderer = (_id, value, style) => (
  <div style={{ minHeight: "1.3em", whiteSpace: "pre-wrap", overflowWrap: "anywhere", ...style }}>{value}</div>
);

/** Pangalan (malaking titik, gaya ng template) o blangkong linya kung walang pangalan */
function Signer({ role, person, text }: { role: SignatoryRole; person: Signatory; text: TextRenderer }) {
  const blank = !person.name.trim();
  return (
    <div>
      <div style={{ height: 30 }} />
      {text(
        `sig:${role}:name`,
        person.name,
        blank
          ? { width: 260, maxWidth: "100%", borderBottom: "1px solid #000" }
          : { fontWeight: 700, textTransform: "uppercase" },
        "Name",
      )}
      {text(`sig:${role}:title`, person.title, undefined, "Title")}
    </div>
  );
}

/**
 * Pirmahan sa dulo ng report: Prepared by at Noted (dalawang pangalan) sa iisang hanay,
 * Certified True and Correct sa ilalim, gaya ng template. Hindi ito hinahati sa dalawang pahina.
 */
export function SignatoriesSheet({ people, text = plain }: { people: SignatorySet; text?: TextRenderer }) {
  return (
    <div style={{ paddingTop: 28, breakInside: "avoid" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", columnGap: 32 }}>
        <div>
          <div>Prepared by:</div>
          <Signer role="prepared" person={people.prepared} text={text} />
        </div>
        <div>
          <div>Noted:</div>
          <Signer role="programHead" person={people.programHead} text={text} />
        </div>
        <div>
          <div>&nbsp;</div>
          <Signer role="dean" person={people.dean} text={text} />
        </div>
      </div>
      <div style={{ marginTop: 26, maxWidth: "33%" }}>
        <div>Certified True and Correct:</div>
        <Signer role="chair" person={people.chair} text={text} />
      </div>
    </div>
  );
}
