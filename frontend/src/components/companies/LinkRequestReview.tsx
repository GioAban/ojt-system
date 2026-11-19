import { useMemo, useState } from "react";
import { AlertTriangle, Building2, Check, FileText, GitMerge, Paperclip, Plus, X } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { CONTACT_HINT, CONTACT_MAX, NATURE_OTHER_LABEL, NATURE_OTHER_MAX, isOtherNature } from "@/lib/company";
import { cn } from "@/lib/utils";
import {
  emptyLinkDepartment,
  linkDepartmentPayload,
  type LinkDepartment,
  type LinkDepartmentForm,
  type LinkRequest,
} from "@/types/companyRequest";
import type { DepartmentItem } from "@/types/company";
import { Field } from "@/components/companies/parts";
import { LinkDepartmentFields } from "@/components/companies/LinkDepartmentFields";
import { MoaFilesDialog } from "@/components/companies/MoaFilesDialog";
import { SkillsInput } from "@/components/skills/SkillsInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const BASE = "/coordinator/company-requests/link-requests";

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function when(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

// =====================================================================
// Card sa Requests panel
// =====================================================================

export function LinkRequestCard({ request, onOpen }: { request: LinkRequest; onOpen: () => void }) {
  const r = request;
  const slots = r.departments.reduce((sum, d) => sum + (d.slots ?? 0), 0);
  const moaCount = r.departments.reduce((sum, d) => sum + d.moaFiles.length, 0);
  const companyDupes = r.duplicates.filter((d) => d.kind === "company");
  const requestDupes = r.duplicates.filter((d) => d.kind === "request");

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold leading-snug">{r.companyName}</h3>
            <span className="inline-flex h-5 items-center rounded-md border border-sky-300 bg-sky-50 px-1.5 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300">
              From company link
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {[r.nature, r.location || r.address].filter(Boolean).join(" · ")} · Sent {when(r.submittedAt)}
          </p>
        </div>
        <Button type="button" size="sm" onClick={onOpen} className="pointer-coarse:h-10">
          Review
        </Button>
      </div>

      {companyDupes.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Possible duplicate of <span className="font-semibold">{companyDupes.map((d) => d.name).join(", ")}</span>. You
            can merge it as a new department instead.
          </span>
        </p>
      )}
      {requestDupes.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Another pending request has a similar name: {requestDupes.map((d) => d.name).join(", ")}.
        </p>
      )}

      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Immediate supervisor</dt>
          <dd>
            {r.supervisorName}
            {r.supervisorPosition ? `, ${r.supervisorPosition}` : ""}
          </dd>
          <dd className="break-all text-xs text-muted-foreground">
            {[r.supervisorContactNumber, r.supervisorEmail].filter(Boolean).join(" · ")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Departments</dt>
          <dd>
            {r.hasDepartments ? r.departments.map((d) => `${d.name} (${d.slots})`).join(", ") : `N/A (${slots} slots)`}
          </dd>
          <dd className="text-xs text-muted-foreground">
            {slots} slot{slots === 1 ? "" : "s"}
            {moaCount > 0 && ` · ${moaCount} MOA file${moaCount === 1 ? "" : "s"}`}
            {r.skills.length > 0 && ` · ${r.skills.length} skill${r.skills.length === 1 ? "" : "s"}`}
          </dd>
        </div>
      </dl>
    </article>
  );
}

/** Mga tapos nang hiling (rejected o merged), maikli lang */
export function LinkRequestHistory({ requests }: { requests: LinkRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <details className="rounded-xl border bg-card">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium pointer-coarse:py-4">
        Reviewed company link requests ({requests.length})
      </summary>
      <ul className="divide-y border-t">
        {requests.map((r) => (
          <li key={r.companyId} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
            <span className="font-medium">{r.companyName}</span>
            <span className="text-xs text-muted-foreground">
              {r.status === "merged" ? r.reason ?? "Merged" : `Rejected${r.reason ? `: ${r.reason}` : ""}`} · {when(r.reviewedAt)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// =====================================================================
// Review sheet: i-edit, Approve, Merge, Reject
// =====================================================================

interface Form {
  companyName: string;
  natureId: string;
  /** Paliwanag kapag "Other" ang nature */
  natureOther: string;
  address: string;
  location: string;
  companyContactNumber: string;
  description: string;
  contactFullname: string;
  contactPosition: string;
  contactNumber: string;
  contactEmail: string;
  idType: string;
  idNumber: string;
  hasDepartments: boolean;
  departments: LinkDepartmentForm[];
  skills: string[];
}

function deptForm(d: LinkDepartment): LinkDepartmentForm {
  return {
    id: d.id,
    name: d.na ? "" : d.name,
    slots: String(d.slots ?? ""),
    supervisorFullname: d.supervisorFullname ?? "",
    supervisorPosition: d.supervisorPosition ?? "",
    supervisorContactNumber: d.supervisorContactNumber ?? "",
    supervisorEmail: d.supervisorEmail ?? "",
    moaStart: d.moaStart ?? "",
    moaExpiration: d.moaExpiration ?? "",
  };
}

function formOf(r: LinkRequest): Form {
  const departments = r.departments.map(deptForm);
  return {
    companyName: r.companyName ?? "",
    natureId: r.natureId ? String(r.natureId) : "",
    natureOther: r.natureOther ?? "",
    address: r.address ?? "",
    location: r.location ?? "",
    companyContactNumber: r.contactNumber ?? "",
    description: r.description ?? "",
    contactFullname: r.supervisorName ?? "",
    contactPosition: r.supervisorPosition ?? "",
    contactNumber: r.supervisorContactNumber ?? "",
    contactEmail: r.supervisorEmail ?? "",
    idType: r.idType ?? "",
    idNumber: r.idNumber ?? "",
    hasDepartments: r.hasDepartments,
    departments: departments.length > 0 ? departments : [emptyLinkDepartment()],
    skills: r.skills,
  };
}

/** Para sa MoaFilesDialog (iisang hugis ng department sa Companies tab) */
function asDepartmentItem(d: LinkDepartment): DepartmentItem {
  return {
    id: d.id, name: d.name, slots: d.slots, filled: 0,
    supervisorFullname: d.supervisorFullname, supervisorPosition: d.supervisorPosition,
    supervisorContactNumber: d.supervisorContactNumber, supervisorEmail: d.supervisorEmail,
    status: d.status, moaStart: d.moaStart, moaExpiration: d.moaExpiration, archived: false,
    moaFiles: d.moaFiles.map((f) => ({ ...f, uploadedAt: null })),
  };
}

interface SheetProps {
  request: LinkRequest | null;
  natures: { id: number; name: string }[];
  onClose: () => void;
  /** May binago, in-approve, in-merge o in-reject: i-reload ang listahan */
  onChanged: () => Promise<void> | void;
}

type Mode = "edit" | "reject" | "merge";

export function LinkRequestSheet({ request, natures, onClose, onChanged }: SheetProps) {
  return (
    <Sheet open={request !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        {request && (
          <ReviewBody key={request.companyId}
            request={request} natures={natures} onClose={onClose} onChanged={onChanged} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ReviewBody({ request, natures, onClose, onChanged }: SheetProps & { request: LinkRequest }) {
  const initial = useMemo(() => formOf(request), [request]);
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"save" | "approve" | "merge" | "reject" | null>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const [reason, setReason] = useState("");
  const companyDupes = request.duplicates.filter((d) => d.kind === "company");
  const [mergeInto, setMergeInto] = useState<string>(companyDupes[0] ? String(companyDupes[0].id) : "");
  // Id lang ang itinatabi para laging bago ang listahan ng file pagkatapos mag-upload
  const [moaForId, setMoaForId] = useState<number | null>(null);
  const moaFor = moaForId === null ? null : request.departments.find((d) => d.id === moaForId) ?? null;

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function set<K extends keyof Form>(key: K, value: Form[K], errorKey?: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errorKey && errors[errorKey]) setErrors((e) => ({ ...e, [errorKey]: "" }));
  }

  function patchDept(i: number, patch: Partial<LinkDepartmentForm>) {
    setForm((f) => ({ ...f, departments: f.departments.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) }));
  }

  function payload() {
    const rows = form.hasDepartments ? form.departments : form.departments.slice(0, 1);
    return {
      companyName: form.companyName, natureId: form.natureId ? Number(form.natureId) : null,
      natureOther: isOtherNature(natures, form.natureId) ? form.natureOther.trim() : null,
      address: form.address, location: form.location, companyContactNumber: form.companyContactNumber,
      description: form.description,
      contactFullname: form.contactFullname, contactPosition: form.contactPosition,
      contactNumber: form.contactNumber, contactEmail: form.contactEmail,
      idType: form.idType, idNumber: form.idNumber,
      hasDepartments: form.hasDepartments,
      departments: rows.map(linkDepartmentPayload),
      skills: form.skills,
    };
  }

  /** Sine-save ang mga binago; false kapag may mali (ipinapakita sa form) */
  async function save(): Promise<boolean> {
    if (!dirty) return true;
    try {
      await api.put(`${BASE}/${request.companyId}`, payload());
      setErrors({});
      return true;
    } catch (err) {
      const fields = getFieldErrors(err);
      setErrors(fields);
      setMode("edit");
      notify.error(getErrorMessage(err, "Couldn't save the changes."));
      return false;
    }
  }

  async function run(kind: "save" | "approve" | "merge" | "reject") {
    setBusy(kind);
    try {
      if (!(await save())) return;
      if (kind === "save") {
        notify.success("Changes saved.");
      } else if (kind === "approve") {
        await api.post(`${BASE}/${request.companyId}/approve`);
        notify.success(`${form.companyName} was approved and added to your companies.`);
      } else if (kind === "merge") {
        const target = companyDupes.find((d) => String(d.id) === mergeInto);
        await api.post(`${BASE}/${request.companyId}/merge`, null, { params: { into: mergeInto } });
        notify.success(`Merged into ${target?.name ?? "the company"} as new department${form.departments.length === 1 ? "" : "s"}.`);
      } else {
        await api.post(`${BASE}/${request.companyId}/reject`, { reason: reason.trim() || null });
        notify.success("The request was rejected. The company can send a new request.");
      }
      await onChanged();
      if (kind !== "save") onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't complete the action."));
    } finally {
      setBusy(null);
    }
  }

  const err = (k: string) => errors[k] || undefined;
  const totalSlots = (form.hasDepartments ? form.departments : form.departments.slice(0, 1))
    .reduce((sum, d) => sum + (Number(d.slots) || 0), 0);

  return (
    <>
      <SheetHeader className="border-b p-4">
        <SheetTitle className="pr-8">{request.companyName}</SheetTitle>
        <SheetDescription>
          Sent {when(request.submittedAt)} through your company link
          {request.consentAt ? ` · Privacy consent ${when(request.consentAt)}` : ""}. Fix anything that needs fixing, then
          approve.
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto overscroll-contain p-4">
        {companyDupes.length > 0 && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              Possible duplicate of <span className="font-semibold">{companyDupes.map((d) => d.name).join(", ")}</span>.
              Use <span className="font-medium">Merge</span> to add these departments to the existing company instead of
              creating a second one.
            </div>
          </div>
        )}

        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4" /> Company</h3>
            <Field label="Company name" htmlFor="lr-name" required error={err("companyName")}>
              <Input id="lr-name" value={form.companyName} maxLength={255} aria-invalid={Boolean(err("companyName"))}
                onChange={(e) => set("companyName", e.target.value, "companyName")} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                <Field label="Nature" htmlFor="lr-nature" required error={err("natureId")}>
                  <NativeSelect id="lr-nature" className="w-full" value={form.natureId} aria-invalid={Boolean(err("natureId"))}
                    onChange={(e) => set("natureId", e.target.value, "natureId")}>
                    <NativeSelectOption value="">Select...</NativeSelectOption>
                    {natures.map((n) => <NativeSelectOption key={n.id} value={String(n.id)}>{n.name}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
                {isOtherNature(natures, form.natureId) && (
                  <Field label={NATURE_OTHER_LABEL} htmlFor="lr-nature-other" required error={err("natureOther")}>
                    <Input id="lr-nature-other" value={form.natureOther} maxLength={NATURE_OTHER_MAX} placeholder="e.g. Hospitality"
                      aria-invalid={Boolean(err("natureOther"))}
                      onChange={(e) => set("natureOther", e.target.value, "natureOther")} />
                  </Field>
                )}
              </div>
              <Field label="Contact number" htmlFor="lr-phone" required error={err("companyContactNumber")} hint={CONTACT_HINT}>
                <Input id="lr-phone" value={form.companyContactNumber} maxLength={CONTACT_MAX}
                  aria-invalid={Boolean(err("companyContactNumber"))}
                  onChange={(e) => set("companyContactNumber", e.target.value, "companyContactNumber")} />
              </Field>
            </div>
            <Field label="Address" htmlFor="lr-address" required error={err("address")}>
              <Input id="lr-address" value={form.address} maxLength={255} aria-invalid={Boolean(err("address"))}
                onChange={(e) => set("address", e.target.value, "address")} />
            </Field>
            <Field label="City / Province" htmlFor="lr-location" error={err("location")}>
              <Input id="lr-location" value={form.location} maxLength={255} onChange={(e) => set("location", e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="lr-desc" error={err("description")}>
              <Textarea id="lr-desc" rows={3} maxLength={5000} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
          </section>

          <section className="flex flex-col gap-3 border-t pt-5">
            <h3 className="text-sm font-semibold">Immediate supervisor</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" htmlFor="lr-sup" required error={err("contactName")}>
                <Input id="lr-sup" value={form.contactFullname} maxLength={255} aria-invalid={Boolean(err("contactName"))}
                  onChange={(e) => set("contactFullname", e.target.value, "contactName")} />
              </Field>
              <Field label="Position" htmlFor="lr-pos" required error={err("contactPosition")}>
                <Input id="lr-pos" value={form.contactPosition} maxLength={255} aria-invalid={Boolean(err("contactPosition"))}
                  onChange={(e) => set("contactPosition", e.target.value, "contactPosition")} />
              </Field>
              <Field label="Contact number" htmlFor="lr-supphone" required error={err("contactContactNumber")} hint={CONTACT_HINT}>
                <Input id="lr-supphone" value={form.contactNumber} maxLength={CONTACT_MAX}
                  aria-invalid={Boolean(err("contactContactNumber"))}
                  onChange={(e) => set("contactNumber", e.target.value, "contactContactNumber")} />
              </Field>
              <Field label="Email" htmlFor="lr-supemail" required error={err("contactEmail")}>
                <Input id="lr-supemail" type="email" value={form.contactEmail} maxLength={255}
                  aria-invalid={Boolean(err("contactEmail"))} onChange={(e) => set("contactEmail", e.target.value, "contactEmail")} />
              </Field>
              <Field label="ID type" htmlFor="lr-idtype" error={err("idType")}>
                <Input id="lr-idtype" value={form.idType} maxLength={255} onChange={(e) => set("idType", e.target.value)} />
              </Field>
              <Field label="ID number" htmlFor="lr-idno" error={err("idNumber")}>
                <Input id="lr-idno" value={form.idNumber} maxLength={255} onChange={(e) => set("idNumber", e.target.value)} />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Departments · {totalSlots} slot{totalSlots === 1 ? "" : "s"}</h3>
              <div role="radiogroup" aria-label="Does this company have departments?" className="inline-flex overflow-hidden rounded-lg border">
                {[{ v: false, label: "No (N/A)" }, { v: true, label: "Yes" }].map((o) => (
                  <button key={o.label} type="button" role="radio" aria-checked={form.hasDepartments === o.v}
                    onClick={() => set("hasDepartments", o.v)}
                    className={cn("min-h-9 px-3 text-sm font-medium pointer-coarse:min-h-11",
                      form.hasDepartments === o.v ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            {(form.hasDepartments ? form.departments : form.departments.slice(0, 1)).map((d, i) => {
              const saved = d.id ? request.departments.find((x) => x.id === d.id) : undefined;
              return (
                <LinkDepartmentFields key={d.id ?? `new-${i}`} index={i} na={!form.hasDepartments} value={d} errors={errors}
                  onChange={(patch) => patchDept(i, patch)}
                  onRemove={form.hasDepartments && form.departments.length > 1
                    ? () => setForm((f) => ({ ...f, departments: f.departments.filter((_, idx) => idx !== i) }))
                    : undefined}
                  moaSlot={saved ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {saved.moaFiles.length === 0 ? (
                        <span className="text-muted-foreground">No MOA file uploaded.</span>
                      ) : saved.moaFiles.map((f) => (
                        <span key={f.id} className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                          <FileText className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                        </span>
                      ))}
                      <Button type="button" variant="outline" size="sm" onClick={() => setMoaForId(saved.id)}>
                        <Paperclip className="h-4 w-4" /> {saved.moaFiles.length ? "Open or manage files" : "Upload file"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Save first to upload an MOA file for a new department.</p>
                  )} />
              );
            })}
            {form.hasDepartments && (
              <Button type="button" variant="outline" size="sm" className="self-start"
                onClick={() => setForm((f) => ({ ...f, departments: [...f.departments, emptyLinkDepartment()] }))}>
                <Plus className="h-4 w-4" /> Add department
              </Button>
            )}
            {err("departments") && <p className="text-xs text-destructive">{err("departments")}</p>}
          </section>

          <section className="flex flex-col gap-2 border-t pt-5">
            <h3 className="text-sm font-semibold">Skills needed</h3>
            <p className="text-xs text-muted-foreground">
              These are added to the skills list only when you approve or merge. Fix spelling here first.
            </p>
            <SkillsInput id="lr-skills" value={form.skills} onChange={(next) => set("skills", next, "skills")}
              searchUrl="/coordinator/skills/search" invalid={Boolean(err("skills"))} />
            {err("skills") && <p className="text-xs text-destructive">{err("skills")}</p>}
          </section>
        </div>
      </div>

      {/* Mga aksyon */}
      <div className="border-t bg-background p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {mode === "reject" && (
          <div className="mb-3 flex flex-col gap-2">
            <label htmlFor="lr-reason" className="text-sm font-medium">
              Reason <span className="font-normal text-muted-foreground">(optional, kept in your records)</span>
            </label>
            <Textarea id="lr-reason" rows={2} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="For example: Not a fit for our program this semester." />
            <div className="flex gap-2">
              <Button type="button" variant="destructive" className="flex-1" disabled={busy !== null} onClick={() => void run("reject")}>
                {busy === "reject" ? "Rejecting..." : "Reject request"}
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setMode("edit")}>Cancel</Button>
            </div>
          </div>
        )}
        {mode === "merge" && (
          <div className="mb-3 flex flex-col gap-2">
            <label htmlFor="lr-merge" className="text-sm font-medium">Merge into</label>
            <NativeSelect id="lr-merge" className="w-full" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
              {companyDupes.map((d) => <NativeSelectOption key={d.id} value={String(d.id)}>{d.name}</NativeSelectOption>)}
            </NativeSelect>
            <p className="text-xs text-muted-foreground">
              The departments in this request are added to that company as approved. No second company is created.
            </p>
            <div className="flex gap-2">
              <Button type="button" className="flex-1" disabled={busy !== null || !mergeInto} onClick={() => void run("merge")}>
                <GitMerge className="h-4 w-4" /> {busy === "merge" ? "Merging..." : "Merge"}
              </Button>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setMode("edit")}>Cancel</Button>
            </div>
          </div>
        )}
        {mode === "edit" && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="flex-1" disabled={busy !== null} onClick={() => void run("approve")}>
              <Check className="h-4 w-4" /> {busy === "approve" ? "Approving..." : dirty ? "Save and approve" : "Approve"}
            </Button>
            {companyDupes.length > 0 && (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setMode("merge")}>
                <GitMerge className="h-4 w-4" /> Merge
              </Button>
            )}
            {dirty && (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void run("save")}>
                {busy === "save" ? "Saving..." : "Save"}
              </Button>
            )}
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy !== null}
              onClick={() => setMode("reject")}>
              <X className="h-4 w-4" /> Reject
            </Button>
          </div>
        )}
      </div>

      {moaFor && (
        <MoaFilesDialog open companyName={request.companyName} department={asDepartmentItem(moaFor)} readOnly={false}
          onOpenChange={(open) => { if (!open) setMoaForId(null); }}
          onChanged={async () => { await onChanged(); }} />
      )}
    </>
  );
}
