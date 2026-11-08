import { useEffect, useRef, useState, type FormEvent } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { College } from "@/types/college";
import { CollegeLogo, collegeLogoSrc } from "@/components/colleges/CollegeLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

interface CollegeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  college: College | null; // null = add, may laman = edit
  onSaved: (message: string) => void;
}

export function CollegeFormDialog({
  open,
  onOpenChange,
  college,
  onSaved,
}: CollegeFormDialogProps) {
  const [name, setName] = useState(college?.name ?? "");
  const [abbreviation, setAbbreviation] = useState(college?.abbreviation ?? "");
  const [dean, setDean] = useState(college?.dean ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Logo: bagong file na napili, o hiling na tanggalin ang kasalukuyan
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const hasCurrentLogo = Boolean(college?.logo) && !removeLogo;

  function pickLogo(files: File[]) {
    const f = files[0];
    if (!f) return;
    if (!TYPES.includes(f.type)) {
      setError("Use a PNG, JPG or WebP image for the logo.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("The logo is larger than 2 MB.");
      return;
    }
    setError("");
    setLogoFile(f);
    setRemoveLogo(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!name.trim() || !abbreviation.trim() || !dean.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: name.trim(),
      abbreviation: abbreviation.trim(),
      dean: dean.trim(),
    };

    let saved: College;
    try {
      saved = college
        ? (await api.put<College>(`/colleges/${college.id}`, payload)).data
        : (await api.post<College>("/colleges", payload)).data;
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save college."));
      setSaving(false);
      return;
    }

    const done = college ? "was updated" : "was added";
    try {
      if (logoFile) {
        const form = new FormData();
        form.append("file", logoFile);
        await api.post(`/colleges/${saved.id}/logo`, form);
      } else if (removeLogo && college?.logo) {
        await api.delete(`/colleges/${saved.id}/logo`);
      }
      onSaved(`${saved.abbreviation} ${done}.`);
    } catch (err) {
      // Na-save na ang college; ang logo lang ang pumalya
      onSaved(
        `${saved.abbreviation} ${done}, but the logo couldn't be saved (${getErrorMessage(err, "upload failed")}). Open Edit to try again.`,
      );
    } finally {
      setSaving(false);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent size="xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>
              {college ? "Edit College" : "Add College"}
            </DialogTitle>
            <DialogDescription>
              Enter the college details. The abbreviation must be unique.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="college-name">College name</Label>
              <Input
                id="college-name"
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="college-abbreviation">Abbreviation</Label>
              <Input
                id="college-abbreviation"
                maxLength={20}
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="college-dean">Dean</Label>
              <Input
                id="college-dean"
                maxLength={45}
                value={dean}
                onChange={(e) => setDean(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>
                Logo <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  aria-label="Choose a logo"
                  onClick={() => fileInput.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    pickLogo(Array.from(e.dataTransfer.files));
                  }}
                  className={cn(
                    "flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-white transition",
                    dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="New logo preview" className="h-full w-full object-contain" />
                  ) : hasCurrentLogo && college?.logo && collegeLogoSrc(college.logo) ? (
                    <CollegeLogo path={college.logo} label={college.abbreviation} className="h-full w-full border-0" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  )}
                </button>

                <div className="flex min-w-0 flex-col items-start gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => fileInput.current?.click()}>
                    <Upload className="mr-1 h-4 w-4" />
                    {logoPreview || hasCurrentLogo ? "Replace logo" : "Upload logo"}
                  </Button>
                  {(logoPreview || hasCurrentLogo) && (
                    <Button
                      type="button" variant="ghost" size="sm" disabled={saving}
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        setLogoFile(null);
                        setRemoveLogo(Boolean(college?.logo));
                      }}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      {logoPreview ? "Discard new logo" : "Remove logo"}
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG or WebP, up to 2 MB. Shown on reports like the Weekly Report.
                  </p>
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
                    e.target.value = "";
                    pickLogo(files);
                  }}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : college ? "Save changes" : "Add college"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
