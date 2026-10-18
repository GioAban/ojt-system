import { useEffect, useState, type FormEvent } from "react";
import api from "@/lib/api";
import { addDays, formatPeriod, toLocalDateInput } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import type { RequirementType } from "@/types/tracking";
import type {
  DocumentItem,
  DtrItem,
  MaterialItem,
  PendingLink,
  RequirementKind,
  WeeklyItem,
} from "@/types/requirements";
import { AttachmentPicker } from "@/components/requirements/AttachmentPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const NOUN: Record<RequirementKind, string> = {
  document: "requirement",
  weekly: "weekly report period",
  dtr: "DTR month",
};

const TYPE_LABELS: Record<RequirementType, string> = {
  initial: "Initial",
  pre: "Pre-deployment",
  post: "Post-deployment",
};

interface RequirementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: RequirementKind;
  type: RequirementType;
  semesterId: number;
  semesterName: string;
  item: DocumentItem | WeeklyItem | DtrItem | null; // null = create
  existingMonths: string[];
  onSaved: (message: string) => void;
}

export function RequirementFormDialog({
  open,
  onOpenChange,
  kind,
  type,
  semesterId,
  semesterName,
  item,
  existingMonths,
  onSaved,
}: RequirementFormDialogProps) {
  const doc = kind === "document" ? (item as DocumentItem | null) : null;
  const week = kind === "weekly" ? (item as WeeklyItem | null) : null;
  const dtr = kind === "dtr" ? (item as DtrItem | null) : null;
  const isEdit = item !== null;
  const docId = doc?.id;

  const [title, setTitle] = useState(doc?.title ?? "");
  const [instructions, setInstructions] = useState(doc?.instructions ?? "");
  const [dateFrom, setDateFrom] = useState(week?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(week?.dateTo ?? "");
  const [monthName, setMonthName] = useState(dtr?.month ?? "");
  const [dueDate, setDueDate] = useState(
    toLocalDateInput(item?.dueDate ?? null),
  );

  const [existing, setExisting] = useState<MaterialItem[]>([]);
  const [removedIds, setRemovedIds] = useState<number[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<PendingLink[]>([]);
  const [createdId, setCreatedId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (docId === undefined) return;
    let cancelled = false;

    api
      .get<MaterialItem[]>(`/coordinator/requirements/${docId}/materials`)
      .then((res) => {
        if (!cancelled) setExisting(res.data);
      })
      .catch(() => {
        // hindi lumabas ang mga attachment; pwede pa ring mag-edit
      });

    return () => {
      cancelled = true;
    };
  }, [docId]);

  function handleFromChange(value: string) {
    setDateFrom(value);
    // Mungkahi: Lunes hanggang Sabado
    if (value && (!dateTo || dateTo < value)) setDateTo(addDays(value, 5));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (kind === "document" && !title.trim()) {
      setError("Please enter a title.");
      return;
    }
    if (kind === "weekly") {
      if (!dateFrom || !dateTo) {
        setError("Please enter the start and end dates.");
        return;
      }
      if (dateTo < dateFrom) {
        setError("The end date can't be before the start date.");
        return;
      }
    }
    if (kind === "dtr" && !monthName) {
      setError("Please select a month.");
      return;
    }

    setSaving(true);
    let created = createdId !== null;

    try {
      let label: string;

      if (kind === "document") {
        const body = {
          title: title.trim(),
          instructions: instructions.trim(),
          dueDate: dueDate || null,
        };

        let id: number | null = item ? item.id : createdId;
        if (id !== null) {
          await api.put(`/coordinator/requirements/${id}`, body);
        } else {
          const res = await api.post<{ id: number }>(
            "/coordinator/requirements",
            {
              ...body,
              semesterId,
              type,
            },
          );
          id = res.data.id;
          created = true;
          setCreatedId(id);
        }

        for (const materialId of removedIds) {
          await api.delete(
            `/coordinator/requirements/${id}/materials/${materialId}`,
          );
          setExisting((prev) => prev.filter((m) => m.id !== materialId));
          setRemovedIds((prev) => prev.filter((x) => x !== materialId));
        }

        if (files.length > 0) {
          const form = new FormData();
          files.forEach((f) => form.append("files", f));
          await api.post(`/coordinator/requirements/${id}/materials`, form);
          setFiles([]);
        }

        for (const link of [...links]) {
          await api.post(
            `/coordinator/requirements/${id}/materials/link`,
            link,
          );
          setLinks((prev) => prev.filter((l) => l !== link));
        }

        label = title.trim();
      } else if (kind === "weekly") {
        const body = { dateFrom, dateTo, dueDate: dueDate || null };
        if (item)
          await api.put(`/coordinator/requirements/weekly/${item.id}`, body);
        else
          await api.post("/coordinator/tracking/weekly/periods", {
            ...body,
            semesterId,
          });
        label = formatPeriod(dateFrom, dateTo);
      } else {
        const body = { month: monthName, dueDate: dueDate || null };
        if (item)
          await api.put(`/coordinator/requirements/dtr/${item.id}`, body);
        else
          await api.post("/coordinator/tracking/dtr/months", {
            ...body,
            semesterId,
          });
        label = monthName;
      }

      onSaved(`${label} was ${isEdit ? "updated" : "created"}.`);
      onOpenChange(false);
    } catch (err) {
      const base = getErrorMessage(err, "Failed to save.");
      setError(
        created && !isEdit
          ? `${base} The requirement was already created. Fix this and press Save again to finish the attachments.`
          : base,
      );
    } finally {
      setSaving(false);
    }
  }

  const visibleExisting = existing.filter((m) => !removedIds.includes(m.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit" : "Create"} {NOUN[kind]}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? `Changes apply to all of your students in ${semesterName}.`
                : `This will be added for all of your students in ${semesterName}.`}
            </DialogDescription>
          </DialogHeader>

          {kind === "document" && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Type</span>
                <Badge variant="secondary">{TYPE_LABELS[type]}</Badge>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="req-title">Title</Label>
                <Input
                  id="req-title"
                  maxLength={255}
                  placeholder="e.g. Barangay Clearance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="req-instructions">
                  Instructions{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="req-instructions"
                  rows={5}
                  maxLength={5000}
                  placeholder="Tell students what to submit and how."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
            </>
          )}

          {kind === "weekly" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="req-from">From</Label>
                <Input
                  id="req-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleFromChange(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="req-to">To</Label>
                <Input
                  id="req-to"
                  type="date"
                  min={dateFrom || undefined}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          )}

          {kind === "dtr" && (
            <div className="flex flex-col gap-2 [&>div]:w-full">
              <Label htmlFor="req-month">Month</Label>
              <NativeSelect
                id="req-month"
                className="w-full"
                value={monthName}
                onChange={(e) => setMonthName(e.target.value)}
              >
                <NativeSelectOption value="">Select a month</NativeSelectOption>
                {MONTHS.map((m) => {
                  const taken = existingMonths.includes(m) && m !== dtr?.month;
                  return (
                    <NativeSelectOption key={m} value={m} disabled={taken}>
                      {m}
                      {taken ? " (already added)" : ""}
                    </NativeSelectOption>
                  );
                })}
              </NativeSelect>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="req-due">
              Due date <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="req-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {kind === "document" && (
            <AttachmentPicker
              existing={visibleExisting}
              files={files}
              links={links}
              onFilesChange={setFiles}
              onLinksChange={setLinks}
              onRemoveExisting={(id) => setRemovedIds((prev) => [...prev, id])}
              onProblem={setError}
            />
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving..."
                : isEdit || createdId !== null
                  ? "Save changes"
                  : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
