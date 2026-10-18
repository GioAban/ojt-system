import { useRef, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { ImportCommitResult, ImportPreview } from "@/types/students";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const BASE = "/coordinator/student-management";

interface Props {
  open: boolean;
  semesterId: number;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportDialog({ open, semesterId, onOpenChange, onImported }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportCommitResult | null>(null);

  function reset() {
    setPreview(null);
    setFileName("");
    setResult(null);
    if (input.current) input.current.value = "";
  }

  function close(next: boolean) {
    if (busy) return;
    if (!next) reset();
    onOpenChange(next);
  }

  async function downloadTemplate() {
    try {
      const res = await api.get<Blob>(`${BASE}/import/template`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "students-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't download the template."));
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setResult(null);
    setFileName(file.name);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await api.post<ImportPreview>(`${BASE}/import/preview`, body, {
        params: { semesterId },
      });
      setPreview(res.data);
    } catch (err) {
      setPreview(null);
      notify.error(getErrorMessage(err, "Couldn't read that file."));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!preview) return;
    const rows = preview.rows.filter((r) => r.errors.length === 0);
    setBusy(true);
    try {
      const res = await api.post<ImportCommitResult>(BASE + "/import", { semesterId, rows });
      setResult(res.data);
      setPreview(null);
      notify.success(`${res.data.created} student${res.data.created === 1 ? "" : "s"} imported.`);
      onImported();
    } catch (err) {
      notify.error(getErrorMessage(err, "Import failed."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Import students</DialogTitle>
          <DialogDescription>
            Columns: No., Student ID, Lastname, Firstname, MI. (optional), Course, Student Year, Gender. The No. column is optional; students are sorted alphabetically by last name. You can review every row before anything is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void downloadTemplate()}>
            <Download className="h-4 w-4" /> Download template
          </Button>
          <Button type="button" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" /> {fileName ? "Choose another file" : "Choose file"}
          </Button>
          {fileName && <span className="text-sm text-muted-foreground">{fileName}</span>}
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </div>

        {busy && !preview && <p className="text-sm text-muted-foreground">Working...</p>}

        {preview && (
          <>
            <p className="text-sm">
              <strong>{preview.valid}</strong> ready to import
              {preview.invalid > 0 && (
                <>
                  , <strong className="text-destructive">{preview.invalid}</strong> with problems (these will be skipped)
                </>
              )}
              .
            </p>
            <div className="max-h-80 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Problems</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.line} className={cn(r.errors.length > 0 && "bg-destructive/5")}>
                      <TableCell>{r.line}</TableCell>
                      <TableCell>{r.studentNumber}</TableCell>
                      <TableCell>{r.lastname}, {r.firstname}{r.middleInitial ? ` ${r.middleInitial}.` : ""}</TableCell>
                      <TableCell>{r.course}</TableCell>
                      <TableCell>{r.year}</TableCell>
                      <TableCell>{r.gender}</TableCell>
                      <TableCell className="whitespace-normal text-xs text-destructive">
                        {r.errors.join(" ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {result && (
          <div className="rounded-lg border p-3 text-sm">
            <p>
              Imported <strong>{result.created}</strong>, skipped <strong>{result.skipped}</strong>.
            </p>
            {result.errors.map((e) => (
              <p key={e.line} className="text-xs text-destructive">Row {e.line}: {e.message}</p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>
            {result ? "Close" : "Cancel"}
          </Button>
          {preview && (
            <Button type="button" disabled={busy || preview.valid === 0} onClick={() => void commit()}>
              {busy ? "Importing..." : `Import ${preview.valid} student${preview.valid === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
