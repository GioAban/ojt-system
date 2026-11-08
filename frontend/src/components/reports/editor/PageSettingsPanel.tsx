import { FONT_PX, MARGINS, PAPERS } from "@/lib/paperExport";
import type { FontSize, Margins, Orientation, PageSettings, PaperKind } from "@/types/reports";

const ROWS_OPTIONS = [0, 5, 8, 10, 12, 15, 20, 25];

const SELECT =
  "mt-1 block h-9 w-full rounded-md border bg-background px-3 text-base outline-none pointer-coarse:h-11 md:text-sm focus-visible:ring-2 focus-visible:ring-ring";

interface PageSettingsPanelProps {
  settings: PageSettings;
  onChange: (next: PageSettings) => void;
  /** Annual Report at mga listahan lang ang may pagpili ng patayo/pahiga */
  allowOrientation?: boolean;
  /** Mas makitid na anyo (sa popover ng toolbar) */
  compact?: boolean;
}

/** Mga setting ng pahina; agad nagbabago ang papel */
export function PageSettingsPanel({ settings, onChange, allowOrientation = false, compact = false }: PageSettingsPanelProps) {
  const set = <K extends keyof PageSettings>(k: K, v: PageSettings[K]) => onChange({ ...settings, [k]: v });
  return (
    <div>
      <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
        <label className="text-xs font-medium text-muted-foreground">
          Paper size
          <select className={SELECT} value={settings.paper} onChange={(e) => set("paper", e.target.value as PaperKind)}>
            {(Object.keys(PAPERS) as PaperKind[]).map((k) => <option key={k} value={k}>{PAPERS[k].label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Rows per page
          <select className={SELECT} value={settings.rowsPerPage} onChange={(e) => set("rowsPerPage", Number(e.target.value))}>
            {ROWS_OPTIONS.map((n) => (
              <option key={n} value={n}>{n === 0 ? "Fit automatically (default)" : `At most ${n} rows`}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Font size
          <select className={SELECT} value={settings.fontSize} onChange={(e) => set("fontSize", e.target.value as FontSize)}>
            {(Object.keys(FONT_PX) as FontSize[]).map((k) => <option key={k} value={k}>{FONT_PX[k].label}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Page margins
          <select className={SELECT} value={settings.margins} onChange={(e) => set("margins", e.target.value as Margins)}>
            {(Object.keys(MARGINS) as Margins[]).map((k) => <option key={k} value={k}>{MARGINS[k].label}</option>)}
          </select>
        </label>
        {allowOrientation && (
          <label className="text-xs font-medium text-muted-foreground">
            Orientation
            <select className={SELECT} value={settings.orientation} onChange={(e) => set("orientation", e.target.value as Orientation)}>
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </label>
        )}
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox" className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5"
            checked={settings.repeatHeader} onChange={(e) => set("repeatHeader", e.target.checked)}
          />
          Repeat the table header on every page
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox" className="h-4 w-4 pointer-coarse:h-5 pointer-coarse:w-5"
            checked={settings.pageNumbers} onChange={(e) => set("pageNumbers", e.target.checked)}
          />
          Show page numbers (Page 1 of N)
        </label>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Rows are never cut in half: a row that doesn't fit moves to the next page. The signatures always stay
        together on the last page.
      </p>
    </div>
  );
}
