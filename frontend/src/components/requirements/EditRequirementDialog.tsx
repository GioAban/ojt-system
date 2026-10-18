import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Link2, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import type { RequirementKind } from "@/types/requirements";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Material {
  id: number;
  kind: "FILE" | "LINK";
  name: string;
  url?: string | null;
}

interface Props {
  kind: RequirementKind;
  requirementId: number;
  /** Kasalukuyang laman ng requirement */
  title: string;
  instructions?: string | null;
  dueDate?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  onOpenChange: (open: boolean) => void;
  /** Tinatawag pagkatapos mag-save (o kapag may binago sa attachments), para mag-reload ang page */
  onSaved: () => void;
}

/** yyyy-MM-dd sa oras ng browser, para sa <input type="date"> */
function toDateInput(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function onlyDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

const FIELD_LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

/** Baguhin ang requirement mula mismo sa page ng Student work */
export function EditRequirementDialog({
  kind,
  requirementId,
  title,
  instructions,
  dueDate,
  dateFrom,
  dateTo,
  onOpenChange,
  onSaved,
}: Props) {
  const [name, setName] = useState(title);
  const [text, setText] = useState(instructions ?? "");
  const [due, setDue] = useState(toDateInput(dueDate));
  const [from, setFrom] = useState(onlyDate(dateFrom));
  const [to, setTo] = useState(onlyDate(dateTo));
  const [month, setMonth] = useState(
    MONTHS.find((m) => m.toLowerCase() === title.trim().toLowerCase()) ?? MONTHS[0],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Attachments (requirement lang)
  const [materials, setMaterials] = useState<Material[] | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const base =
    kind === "document"
      ? `/coordinator/requirements/${requirementId}`
      : `/coordinator/requirements/${kind}/${requirementId}`;

  const loadMaterials = useCallback(() => {
    if (kind !== "document") return;
    api
      .get<Material[]>(`/coordinator/requirements/${requirementId}/materials`)
      .then((res) => setMaterials(res.data))
      .catch(() => setMaterials([]));
  }, [kind, requirementId]);

  useEffect(() => { loadMaterials(); }, [loadMaterials]);

  function close(open: boolean) {
    if (saving || busy) return;
    if (!open && changed) onSaved();
    onOpenChange(open);
  }

  async function save() {
    setError("");

    let body: Record<string, unknown>;
    if (kind === "document") {
      if (!name.trim()) { setError("Title is required."); return; }
      body = { title: name.trim(), instructions: text.trim(), dueDate: due || null };
    } else if (kind === "weekly") {
      if (!from || !to) { setError("Choose the start and end dates."); return; }
      if (to < from) { setError("The end date can't be before the start date."); return; }
      body = { dateFrom: from, dateTo: to, dueDate: due || null };
    } else {
      body = { month, dueDate: due || null };
    }

    setSaving(true);
    try {
      await api.put(base, body);
      notify.success("Requirement updated.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the changes."));
    } finally {
      setSaving(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    setBusy(true);
    try {
      await api.post(`/coordinator/requirements/${requirementId}/materials`, form);
      setChanged(true);
      loadMaterials();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't upload the files."));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addLink() {
    setBusy(true);
    try {
      await api.post(`/coordinator/requirements/${requirementId}/materials/link`, {
        url: linkUrl.trim(),
        name: linkName.trim() || null,
      });
      setLinkUrl("");
      setLinkName("");
      setChanged(true);
      loadMaterials();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't add the link."));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    try {
      await api.delete(`/coordinator/requirements/${requirementId}/materials/${id}`);
      setChanged(true);
      loadMaterials();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't remove the attachment."));
    } finally {
      setBusy(false);
    }
  }

  const heading =
    kind === "document" ? "Edit requirement" : kind === "weekly" ? "Edit weekly report" : "Edit DTR";

  return (
    <Dialog open onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            Changes show up for your students right away. Their work stays as it is.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {kind === "document" && (
            <>
              <div>
                <label className={FIELD_LABEL} htmlFor="req-title">Title</label>
                <Input id="req-title" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="req-instructions">Instructions</label>
                <Textarea
                  id="req-instructions"
                  rows={5}
                  maxLength={5000}
                  value={text}
                  placeholder="Tell your students what to submit and how."
                  onChange={(e) => setText(e.target.value)}
                />
              </div>
            </>
          )}

          {kind === "weekly" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL} htmlFor="req-from">Week starts</label>
                <Input id="req-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="req-to">Week ends</label>
                <Input id="req-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </div>
          )}

          {kind === "dtr" && (
            <div>
              <label className={FIELD_LABEL} htmlFor="req-month">Month</label>
              <NativeSelect id="req-month" value={month} onChange={(e) => setMonth(e.target.value)}>
                {MONTHS.map((m) => (
                  <NativeSelectOption key={m} value={m}>{m}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}

          <div>
            <label className={FIELD_LABEL} htmlFor="req-due">Due date (optional)</label>
            <div className="flex items-center gap-2">
              <Input id="req-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="max-w-48" />
              {due && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setDue("")}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          {kind === "document" && (
            <div className="border-t pt-4">
              <p className={FIELD_LABEL}>Attachments</p>

              {materials === null ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : materials.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attachments yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {materials.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      {m.kind === "LINK" ? (
                        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${m.name}`}
                        disabled={busy}
                        onClick={() => void remove(m.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => void upload(e.target.files)}
                />
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> Upload files
                </Button>
              </div>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="https://… (link)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <Input
                  placeholder="Name (optional)"
                  value={linkName}
                  onChange={(e) => setLinkName(e.target.value)}
                  className="sm:max-w-40"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !/^https?:\/\/\S+$/i.test(linkUrl.trim())}
                  onClick={() => void addLink()}
                >
                  <Paperclip className="mr-1 h-3.5 w-3.5" /> Add
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={saving || busy} onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || busy} onClick={() => void save()}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
