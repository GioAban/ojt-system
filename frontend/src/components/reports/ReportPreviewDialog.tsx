import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Download, FileSpreadsheet, Loader2, Printer } from "lucide-react";
import { notify } from "@/lib/notify";
import { PAPERS, PRINT_ROOT_ID, pagesToPdf, paperSize, printCss } from "@/lib/paperExport";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PaperPreview } from "@/components/paper/PaperPreview";
import { PageSettingsPanel } from "@/components/reports/editor/PageSettingsPanel";
import type { SheetMode } from "@/components/reports/ReportPages";
import type { PageSettings } from "@/types/reports";

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fileName: string;
  settings: PageSettings;
  onSettings: (next: PageSettings) => void;
  /** Annual Report at mga listahan lang ang may pagpili ng patayo/pahiga */
  allowOrientation?: boolean;
  /** Bumubuo at nagda-download ng .xlsx */
  onExcel: () => Promise<void>;
  /** Ang papel sa anyong "preview" (sa dialog) o "print" (para sa Print/PDF) */
  renderSheet: (mode: Exclude<SheetMode, "edit">) => ReactNode;
}

/**
 * Preview ng huling mga pahina: Print, Download PDF, Close, at "Page settings (advanced)".
 * May hiwalay na kopya para sa pag-print/PDF (walang zoom o scale) sa labas ng dialog.
 */
export function ReportPreviewDialog({
  open, onOpenChange, title, fileName, settings, onSettings, allowOrientation = false, onExcel, renderSheet,
}: ReportPreviewDialogProps) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [excelBusy, setExcelBusy] = useState(false);
  const orientation = settings.orientation;
  const paper = settings.paper;
  const paperLabel = `${PAPERS[paper].label}, ${orientation}`;

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      await pagesToPdf(orientation, fileName, paper);
    } catch (err) {
      console.error("Report PDF failed", err);
      notify.error("Couldn't create the PDF. If you're offline, open this page online once first, or use Print and choose Save as PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  async function downloadExcel() {
    setExcelBusy(true);
    try {
      await onExcel();
    } catch (err) {
      console.error("Report Excel failed", err);
      notify.error("Couldn't create the Excel file. If you're offline, open this page online once first.");
    } finally {
      setExcelBusy(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] gap-3 p-3 sm:max-h-[92dvh] sm:max-w-5xl sm:p-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              This is how it will look on {paperLabel}. Print it or save it as a PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-popover px-1 py-1">
            <Button type="button" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" /> Print
            </Button>
            <Button type="button" variant="outline" disabled={pdfBusy} onClick={() => void downloadPdf()}>
              {pdfBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
              Download PDF
            </Button>
            <Button type="button" variant="outline" disabled={excelBusy} onClick={() => void downloadExcel()}>
              {excelBusy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-1 h-4 w-4" />}
              Download Excel
            </Button>
            <Button type="button" variant="ghost" className="sm:ml-auto" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>

          <details className="rounded-lg border bg-background p-3 text-sm">
            <summary className="cursor-pointer select-none font-medium">Page settings (advanced)</summary>
            <div className="mt-3">
              <PageSettingsPanel settings={settings} onChange={onSettings} allowOrientation={allowOrientation} />
            </div>
          </details>

          <PaperPreview paperWidth={paperSize(orientation, paper).width}>{renderSheet("preview")}</PaperPreview>
        </DialogContent>
      </Dialog>

      {open && (
        <>
          <style>{printCss(orientation, paper)}</style>
          {createPortal(
            <div id={PRINT_ROOT_ID} style={{ position: "fixed", left: -30000, top: 0 }}>
              {renderSheet("print")}
            </div>,
            document.body,
          )}
        </>
      )}
    </>
  );
}
