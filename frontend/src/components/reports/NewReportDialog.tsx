import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import api from "@/lib/api";
import { notify } from "@/lib/notify";
import { REPORT_TYPES, buildReportContent } from "@/lib/reportCatalog";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ReportSource, ReportType, SavedReportSummary } from "@/types/reports";

const GROUPS = ["Official reports", "Printable lists"] as const;

/** Pipili ng uri, bubuuin ang unang laman mula sa datos ng system, ise-save, at bubuksan sa editor */
export function NewReportDialog({ open, onOpenChange, semesterId, semesterName }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: number;
  semesterName: string;
}) {
  const navigate = useNavigate();
  const [type, setType] = useState<ReportType | null>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const choose = (next: ReportType, name: string) => {
    setType(next);
    setTitle(name);
  };

  async function create() {
    if (!type) return;
    setBusy(true);
    try {
      const source = (await api.get<ReportSource>("/coordinator/reports/source", { params: { semesterId } })).data;
      const res = await api.post<SavedReportSummary>("/coordinator/reports/saved", {
        semesterId,
        type,
        title,
        content: JSON.stringify(buildReportContent(type, source)),
        clientUpdatedAt: Date.now(),
      });
      navigate(`/coordinator/reports/${type}/${res.data.id}`);
    } catch {
      notify.error(navigator.onLine
        ? "Couldn't create the report. Please try again."
        : "You need to be online to create a report.");
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New report</DialogTitle>
          <DialogDescription>
            Choose what to make for {semesterName}. It starts with the current system data, and you can edit it after.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {GROUPS.map((group) => (
            <section key={group} className="flex flex-col gap-2" aria-label={group}>
              <h3 className="text-xs font-medium text-muted-foreground">{group}</h3>
              {REPORT_TYPES.filter((r) => r.group === group).map((r) => (
                <button
                  key={r.type}
                  type="button"
                  aria-pressed={type === r.type}
                  onClick={() => choose(r.type, r.title)}
                  className={cn(
                    "min-h-11 rounded-lg border p-3 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
                    type === r.type && "border-primary bg-primary/5",
                  )}
                >
                  <span className="block font-medium">{r.title}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{r.description}</span>
                </button>
              ))}
            </section>
          ))}

          {type && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-report-title">Title</Label>
              <Input
                id="new-report-title"
                value={title}
                maxLength={200}
                className="h-11 sm:h-9"
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" disabled={!type || busy} onClick={() => void create()}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
