import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import type { CheckResult, MatchCompany } from "@/types/companyApplications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pwedeng may naka-prefill na company (galing sa listahan) */
  presetCompany?: { id: number; name: string } | null;
  onSent: () => void;
}

const EMPTY = {
  companyName: "",
  address: "",
  contactNumber: "",
  location: "",
  departmentName: "",
  supervisorFullname: "",
  supervisorPosition: "",
  supervisorEmail: "",
  supervisorContactNumber: "",
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function RequestCompanyDialog({ open, onOpenChange, presetCompany, onSent }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [existing, setExisting] = useState<{ id: number; name: string } | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [different, setDifferent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setCheck(null);
    setDifferent(false);
    setExisting(presetCompany ?? null);
  }, [open, presetCompany]);

  function set<K extends keyof typeof EMPTY>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Tingnan kung may kapareho na bago magpadala (naghihintay ng saglit habang nagta-type)
  useEffect(() => {
    if (!open) return;
    const name = existing ? existing.name : form.companyName.trim();
    if (name.length < 3) {
      setCheck(null);
      return;
    }
    const id = window.setTimeout(() => {
      api
        .post<CheckResult>("/student/company/check", {
          companyName: name,
          departmentName: form.departmentName.trim(),
        })
        .then((res) => setCheck(res.data))
        .catch(() => setCheck(null));
    }, 400);
    return () => window.clearTimeout(id);
  }, [open, existing, form.companyName, form.departmentName]);

  const matches: MatchCompany[] = existing
    ? (check?.matches ?? []).filter((m) => m.companyId === existing.id)
    : (check?.matches ?? []);
  const sameDept = matches.some((m) => m.sameDepartment);
  const similarCompany = !existing && matches.length > 0;

  const missing =
    !form.departmentName.trim() ||
    (!existing && (!form.companyName.trim() || !form.address.trim() || !form.contactNumber.trim()));
  const blocked = sameDept || (similarCompany && !different);

  async function submit() {
    setSending(true);
    try {
      await api.post("/student/company/requests", {
        existingCompanyId: existing?.id ?? null,
        ...form,
        confirmDifferent: different,
      });
      notify.success("Request sent. Your coordinator will review it.");
      onOpenChange(false);
      onSent();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't send your request."));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a company or department</DialogTitle>
          <DialogDescription>
            Can't find it in the list? Send the details to your coordinator. They'll review it before it shows up for
            everyone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {existing ? (
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
              <span>
                Company: <strong>{existing.name}</strong>
              </span>
              {!presetCompany && (
                <button type="button" className="text-xs text-primary underline" onClick={() => setExisting(null)}>
                  Change
                </button>
              )}
            </div>
          ) : (
            <>
              <Field label="Company name" required>
                <Input value={form.companyName} maxLength={255} onChange={(e) => set("companyName", e.target.value)} />
              </Field>
              <Field label="Address" required>
                <Input value={form.address} maxLength={255} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Company contact number" required>
                  <Input value={form.contactNumber} maxLength={50} onChange={(e) => set("contactNumber", e.target.value)} />
                </Field>
                <Field label="Location (optional)">
                  <Input value={form.location} maxLength={255} onChange={(e) => set("location", e.target.value)} />
                </Field>
              </div>
            </>
          )}

          <Field label="Department" required>
            <Input value={form.departmentName} maxLength={255} onChange={(e) => set("departmentName", e.target.value)} />
          </Field>

          <p className="mt-1 text-xs font-medium text-muted-foreground">Supervisor (optional)</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.supervisorFullname} onChange={(e) => set("supervisorFullname", e.target.value)} />
            </Field>
            <Field label="Position">
              <Input value={form.supervisorPosition} onChange={(e) => set("supervisorPosition", e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={form.supervisorEmail} onChange={(e) => set("supervisorEmail", e.target.value)} />
            </Field>
            <Field label="Contact number">
              <Input value={form.supervisorContactNumber} onChange={(e) => set("supervisorContactNumber", e.target.value)} />
            </Field>
          </div>

          {matches.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {sameDept
                  ? "This department already exists."
                  : existing
                    ? "Check the existing departments first."
                    : "A company with a similar name is already there."}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {matches.map((m) => (
                  <li key={m.companyId} className="rounded-md bg-background/60 p-2">
                    <p className="font-medium">
                      {m.name}
                      {!m.listed && <span className="ml-2 text-xs font-normal">(waiting for review)</span>}
                    </p>
                    <p className="text-xs opacity-80">{m.address}</p>
                    {m.departments.length > 0 && (
                      <p className="mt-1 text-xs">
                        Departments:{" "}
                        {m.departments
                          .map((d) => (d.status === "pending" ? `${d.name} (pending)` : d.name))
                          .join(", ")}
                      </p>
                    )}
                    {!existing && (
                      <button
                        type="button"
                        className="mt-1 text-xs font-medium underline"
                        onClick={() => setExisting({ id: m.companyId, name: m.name })}
                      >
                        It's this company — request a department here
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {sameDept && (
                <p className="mt-2 text-xs">
                  Pick it from the Companies list and apply, or wait for the coordinator if it's still pending.
                </p>
              )}
              {similarCompany && !sameDept && (
                <label className="mt-2 flex items-start gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={different}
                    onChange={(e) => setDifferent(e.target.checked)}
                  />
                  <span>This is a different company. I checked the list above.</span>
                </label>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={missing || blocked || sending} onClick={() => void submit()}>
            {sending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
