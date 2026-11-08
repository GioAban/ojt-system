import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FONT_PX, MARGINS, PAGE_CLASS, paperSize } from "@/lib/paperExport";
import { paginate, type PageSlice } from "@/components/reports/paging";
import type { PageSettings } from "@/types/reports";

const TABLE_STYLE: CSSProperties = { width: "100%", borderCollapse: "collapse", tableLayout: "fixed" };

/** Gap sa pagitan ng mga pahina sa screen (editor at preview) */
const PAGE_GAP = 20;

interface Measure {
  title: number;
  thead: number;
  rows: number[];
  groupFirst: number[];
  groupCont: number[];
  sign: number;
}

export type SheetMode = "edit" | "preview" | "print";

export interface ReportPagesProps {
  settings: PageSettings;
  /** edit = papel na tina-type-an; preview = sa dialog; print = para sa Print/PDF */
  mode: SheetMode;
  /** Umuulit sa bawat pahina */
  letterhead: ReactNode;
  /** Unang pahina lang (pamagat, HEI, atbp.) */
  title: ReactNode;
  /** Ang pamagat na gagamitin sa pagsukat (laging hindi nae-edit na anyo) */
  measureTitle: ReactNode;
  colgroup: ReactNode;
  /** Laman ng <thead> (isang <tr>) */
  headerRow: ReactNode;
  /** Pangkat ng bawat row (gamit sa paghahati) */
  unitGroups: number[];
  /** Matatag na susi ng bawat row (para hindi ma-remount ang row habang nagta-type) */
  unitKeys: string[];
  /** Isang <tr> bawat unit para sa pagsukat (walang pinagsamang cell) */
  renderMeasureRow: (index: number) => ReactNode;
  groupCount?: number;
  /** Isang <tr> na ang cell ng pangkat lang ang may laman, para malaman ang pinakamaliit na taas */
  renderMeasureGroup?: (group: number, continued: boolean) => ReactNode;
  /** Mga <tr> ng isang pahina */
  renderBody: (slice: PageSlice) => ReactNode;
  signatories: ReactNode | null;
  measureSignatories: ReactNode | null;
  /** Nagbabago kapag nagbago ang laman: muling susukatin */
  measureKey: string;
  /** Editor: ang row na ine-edit ay mananatili sa pahinang ito */
  pin?: { key: string; page: number } | null;
  /** Mga heading ng pangkat na dapat kasama ang susunod na row sa pahina */
  unitKeepNext?: boolean[];
  /** Editor: mga row na mas mahaba sa isang buong pahina (mapuputol sa print) */
  onOversized?: (keys: string[]) => void;
}

/** Inaantala nang kaunti ang muling pagsukat habang nagta-type */
function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Ang makina ng mga pahina: sinusukat ang bawat bahagi sa nakatagong kopya na kapareho ang lapad,
 * saka hinahati ang mga row nang hindi pinuputol. Ang pirmahan ay sa huling pahina at hindi hinahati.
 * Iisa ang pinanggagalingan ng editor, preview, print at PDF.
 */
export function ReportPages(props: ReportPagesProps) {
  const {
    settings, mode, letterhead, title, measureTitle, colgroup, headerRow, unitGroups, unitKeys, renderMeasureRow,
    groupCount = 0, renderMeasureGroup, renderBody, signatories, measureSignatories, measureKey, pin,
    unitKeepNext, onOversized,
  } = props;
  const { width, height } = paperSize(settings.orientation, settings.paper);
  const margin = MARGINS[settings.margins];
  const fontPx = FONT_PX[settings.fontSize].px;
  const contentWidth = width - margin.left - margin.right;
  const [measure, setMeasure] = useState<Measure | null>(null);
  const debouncedKey = useDebounced(measureKey, mode === "edit" ? 120 : 0);
  const onScreen = mode !== "print";

  const pageStyle: CSSProperties = {
    width, height, position: "relative", boxSizing: "border-box", overflow: mode === "edit" ? "visible" : "hidden",
    padding: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`,
    background: "#fff", color: "#000", fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: fontPx, lineHeight: 1.3,
  };

  let pages: PageSlice[] = [];
  if (measure) {
    const body = height - margin.top - margin.bottom;
    const pinIndex = pin ? unitKeys.indexOf(pin.key) : -1;
    pages = paginate({
      units: unitGroups.map((g, i) => ({ group: g, height: measure.rows[i] ?? 0, keepNext: unitKeepNext?.[i] })),
      groupMin: Array.from({ length: groupCount }, (_, g) => ({ first: measure.groupFirst[g] ?? 0, cont: measure.groupCont[g] ?? 0 })),
      firstAvailable: body - measure.title - measure.thead,
      nextAvailable: body - (settings.repeatHeader ? measure.thead : 0),
      rowsPerPage: settings.rowsPerPage,
      signHeight: signatories ? measure.sign : 0,
      pin: mode === "edit" && pin && pinIndex >= 0 ? { unit: pinIndex, page: pin.page } : null,
    });
  }

  const nextAvailable = height - margin.top - margin.bottom - (measure && settings.repeatHeader ? measure.thead : 0);
  const oversized = measure ? unitKeys.filter((_, i) => (measure.rows[i] ?? 0) > nextAvailable).join("\n") : "";
  const oversizedRef = useRef(onOversized);
  useEffect(() => {
    oversizedRef.current = onOversized;
  });
  useEffect(() => {
    oversizedRef.current?.(oversized ? oversized.split("\n") : []);
  }, [oversized]);

  return (
    <>
      <Measurer measureKey={debouncedKey} width={contentWidth} fontPx={fontPx} onMeasure={setMeasure}>
        <div data-m="title">{measureTitle}</div>
        <table style={TABLE_STYLE}>
          {colgroup}
          <thead data-m="thead">{headerRow}</thead>
          <tbody data-m="rows">{unitGroups.map((_, i) => renderMeasureRow(i))}</tbody>
          {renderMeasureGroup && (
            <tbody data-m="groups">
              {Array.from({ length: groupCount }, (_, g) => [renderMeasureGroup(g, false), renderMeasureGroup(g, true)])}
            </tbody>
          )}
        </table>
        <div data-m="sign">{measureSignatories}</div>
      </Measurer>

      {pages.map((p, i) => {
        const grow = mode === "edit" && p.overflow;
        const numberOffset = Math.max(12, margin.bottom / 2 - 8);
        return (
          <div
            key={i}
            className={PAGE_CLASS}
            data-page-index={i}
            style={{
              ...pageStyle,
              ...(grow ? { height: "auto", minHeight: height } : null),
              ...(onScreen ? { marginBottom: i < pages.length - 1 ? PAGE_GAP : 0, boxShadow: "0 1px 4px rgba(0,0,0,.25)" } : null),
            }}
          >
            {letterhead}
            {i === 0 && title}
            {p.end > p.start && (
              <table style={TABLE_STYLE}>
                {colgroup}
                {(i === 0 || settings.repeatHeader) && <thead>{headerRow}</thead>}
                <tbody>{renderBody(p)}</tbody>
              </table>
            )}
            {p.signatories && signatories}
            {settings.pageNumbers && (
              <div
                style={{
                  position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 11,
                  ...(grow ? { top: height - numberOffset - 14 } : { bottom: numberOffset }),
                }}
              >
                Page {i + 1} of {pages.length}
              </div>
            )}
            {grow && (
              <div
                aria-hidden
                title="This page is full. The row moves to the next page when you leave the cell."
                style={{ position: "absolute", left: 0, right: 0, top: height - margin.bottom, borderTop: "2px dashed #dc2626" }}
              />
            )}
          </div>
        );
      })}
    </>
  );
}

/** Nakatagong kopya (sa labas ng anumang zoom o scale) na sinusukat tuwing nagbabago ang laman */
function Measurer({ measureKey, width, fontPx, onMeasure, children }: {
  measureKey: string;
  width: number;
  fontPx: number;
  onMeasure: (m: Measure) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onMeasure);

  useEffect(() => {
    callback.current = onMeasure;
  });

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const read = () => {
      // Walang layout (natanggal na ang lumang kopya, o nakatago habang nagpi-print): sero lahat ang sukat
      if (root.getClientRects().length === 0) return;
      const h = (el: Element | null | undefined) => (el ? el.getBoundingClientRect().height : 0);
      const rows = Array.from(root.querySelectorAll('tbody[data-m="rows"] > tr')).map(h);
      const groupRows = Array.from(root.querySelectorAll('tbody[data-m="groups"] > tr')).map(h);
      callback.current({
        title: h(root.querySelector('[data-m="title"]')),
        thead: h(root.querySelector('thead[data-m="thead"]')),
        rows,
        groupFirst: groupRows.filter((_, i) => i % 2 === 0),
        groupCont: groupRows.filter((_, i) => i % 2 === 1),
        sign: h(root.querySelector('[data-m="sign"]')),
      });
    };
    const ro = new ResizeObserver(read);
    ro.observe(root);
    // Hintayin ang mga larawan (hal. logo) bago sumukat ulit
    const imgs = Array.from(root.querySelectorAll("img"));
    imgs.forEach((img) => img.addEventListener("load", read));
    return () => {
      ro.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", read));
    };
  }, [measureKey, width, fontPx]);

  return createPortal(
    <div
      key={measureKey}
      ref={ref}
      aria-hidden
      style={{
        position: "fixed", left: -20000, top: 0, width, visibility: "hidden", pointerEvents: "none",
        fontFamily: "Arial, Helvetica, sans-serif", fontSize: fontPx, lineHeight: 1.3, color: "#000",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
