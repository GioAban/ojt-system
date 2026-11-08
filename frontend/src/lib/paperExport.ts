// Laki ng papel, margin at font ng mga report, at ang pag-print / pag-save bilang PDF.
// Sa 96 dpi ang px; sa mm ang laki para sa PDF.

import type { FontSize, Margins, Orientation, PaperKind } from "@/types/reports";

export const PAPERS: Record<PaperKind, {
  short: number; long: number; shortMm: number; longMm: number; cssShort: string; cssLong: string; label: string;
}> = {
  long: { short: 816, long: 1248, shortMm: 215.9, longMm: 330.2, cssShort: "8.5in", cssLong: "13in", label: "Long bond (8.5 x 13 in)" },
  a4: { short: 794, long: 1123, shortMm: 210, longMm: 297, cssShort: "210mm", cssLong: "297mm", label: "A4 (210 x 297 mm)" },
};

export function paperSize(orientation: Orientation, paper: PaperKind = "long") {
  const p = PAPERS[paper];
  return orientation === "portrait"
    ? { width: p.short, height: p.long }
    : { width: p.long, height: p.short };
}

/** Sa px. Ang itaas ay may puwang para sa letterhead (umuulit sa bawat pahina, gaya ng header sa Word). */
export const MARGINS: Record<Margins, { top: number; right: number; bottom: number; left: number; label: string }> = {
  narrow: { top: 124, right: 48, bottom: 48, left: 48, label: "Narrow (0.5 in)" },
  // Kapareho ng template: 1 in sa kaliwa, 1.13 in sa kanan, 1 in sa ibaba
  normal: { top: 128, right: 108, bottom: 96, left: 96, label: "Normal (as in the template)" },
  wide: { top: 140, right: 120, bottom: 120, left: 120, label: "Wide (1.25 in)" },
};

export const FONT_PX: Record<FontSize, { px: number; label: string }> = {
  small: { px: 13.33, label: "Small (10 pt)" },
  normal: { px: 14.67, label: "Normal (11 pt)" },
  large: { px: 16, label: "Large (12 pt)" },
};

export const PRINT_ROOT_ID = "report-print-root";
export const PAGE_CLASS = "rp-page";

/** CSS para sa pag-print: ang print root lang ang lalabas, tamang laki ng papel, isang pahina bawat .rp-page */
export function printCss(orientation: Orientation, paper: PaperKind = "long") {
  const p = PAPERS[paper];
  const size = orientation === "portrait" ? `${p.cssShort} ${p.cssLong}` : `${p.cssLong} ${p.cssShort}`;
  return `
    @media print {
      @page { size: ${size}; margin: 0; }
      body > *:not(#${PRINT_ROOT_ID}) { display: none !important; }
      #${PRINT_ROOT_ID} { position: static !important; left: 0 !important; display: block !important; }
      #${PRINT_ROOT_ID} .${PAGE_CLASS} { break-after: page; box-shadow: none !important; margin: 0 !important; }
      #${PRINT_ROOT_ID} .${PAGE_CLASS}:last-child { break-after: auto; }
    }
  `;
}

/** Isang canvas bawat pahina (html2canvas-pro + jsPDF), parehong paraan ng weekly report */
export async function pagesToPdf(orientation: Orientation, fileName: string, paper: PaperKind = "long") {
  const root = document.getElementById(PRINT_ROOT_ID);
  if (!root) throw new Error("Print root not found");
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const short = PAPERS[paper].shortMm;
  const long = PAPERS[paper].longMm;
  const pageW = orientation === "portrait" ? short : long;
  const pageH = orientation === "portrait" ? long : short;
  const pdf = new jsPDF({ unit: "mm", format: [short, long], orientation });
  const pages = Array.from(root.querySelectorAll<HTMLElement>(`.${PAGE_CLASS}`));
  for (let i = 0; i < pages.length; i++) {
    const canvas = await html2canvas(pages[i], {
      scale: 2, backgroundColor: "#ffffff", useCORS: true,
      onclone: (doc) => {
        const el = doc.getElementById(PRINT_ROOT_ID);
        if (el) { el.style.position = "static"; el.style.left = "0"; el.style.top = "0"; }
      },
    });
    if (i > 0) pdf.addPage([short, long], orientation);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, pageW, pageH);
  }
  pdf.save(fileName);
}
