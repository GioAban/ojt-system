import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CollegeLogo } from "@/components/colleges/CollegeLogo";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  college: { id: number; name: string; abbreviation: string; logo: string | null } | null;
  onChanged: (message: string) => void;
}

export function CollegeLogoDialog({ open, onOpenChange, college, onChanged }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Linisin tuwing bubuksan para sa ibang college
  useEffect(() => {
    if (open) { setFile(null); setError(""); setBusy(false); }
  }, [open, college?.id]);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(list: FileList | File[] | null) {
    const f = list && list.length ? Array.from(list)[0] : null;
    if (!f) return;
    if (!TYPES.includes(f.type)) { setError("Use a PNG, JPG or WebP image."); return; }
    if (f.size > MAX_BYTES) { setError("The image is larger than 2 MB."); return; }
    setError("");
    setFile(f);
  }

  async function upload() {
    if (!college || !file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post(`/colleges/${college.id}/logo`, form);
      onChanged(`${college.abbreviation} logo was updated.`);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't upload the logo. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!college) return;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/colleges/${college.id}/logo`);
      onChanged(`${college.abbreviation} logo was removed.`);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove the logo. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>College logo</DialogTitle>
          <DialogDescription>
            {college ? `${college.name} (${college.abbreviation})` : ""} The logo appears in the header of reports, like the Weekly Report.
          </DialogDescription>
        </DialogHeader>

        {college && (
          <div className="flex items-center gap-4">
            <div className="text-center">
              <CollegeLogo path={college.logo} label={college.abbreviation} className="h-20 w-20 text-xs" />
              <p className="mt-1 text-xs text-muted-foreground">Current</p>
            </div>
            {preview && (
              <>
                <span aria-hidden="true" className="text-muted-foreground">→</span>
                <div className="text-center">
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-md border bg-white">
                    <img src={preview} alt="New logo preview" className="h-full w-full object-contain" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">New</p>
                </div>
              </>
            )}
          </div>
        )}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files); }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-5 text-center transition",
            dragging ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          <ImagePlus className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Drag an image here, or</p>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Choose image
          </Button>
          <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB. A square or wide logo with a transparent background works best.</p>
          <input
            ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => {
              const list: File[] = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = "";
              pick(list);
            }}
          />
        </div>

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

        <DialogFooter className="gap-2 sm:justify-between">
          {college?.logo ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="mr-1 h-4 w-4" /> Remove logo
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" disabled={busy || !file} onClick={() => void upload()}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Save logo
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
