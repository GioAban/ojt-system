import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Inbox, MailWarning, RotateCw, Search, ShieldOff, X } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { GENDERS, YEARS, required, validEmail, validNumber } from "@/lib/students";
import { cn } from "@/lib/utils";
import type { BulkResult, EnrollmentLinkState, RegistrationRow, RegistrationStatus } from "@/types/students";
import { EnrollmentLinkCard } from "@/components/students/EnrollmentLinkCard";
import { EditableCell } from "@/components/tracking/EditableCell";
import { SelectCell } from "@/components/students/SelectCell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LINK = "/coordinator/student-management/enrollment";
const REG = "/coordinator/student-management/registrations";

type Filter = "EMAIL" | "APPROVAL" | "CREATED" | "CLOSED";
type EditField = "studentNumber" | "lastname" | "firstname" | "middleInitial" | "year" | "gender" | "course" | "email";

const FILTERS: { key: Filter; label: string; statuses: RegistrationStatus[] }[] = [
  { key: "APPROVAL", label: "Needs approval", statuses: ["PENDING"] },
  { key: "EMAIL", label: "Awaiting email", statuses: ["EMAIL_PENDING"] },
  { key: "CREATED", label: "Accounts created", statuses: ["VERIFIED"] },
  { key: "CLOSED", label: "Rejected / revoked", statuses: ["REJECTED", "REVOKED"] },
];

const BADGE: Record<RegistrationStatus, { label: string; className: string }> = {
  EMAIL_PENDING: { label: "Awaiting email", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300" },
  PENDING: { label: "Awaiting my approval", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  VERIFIED: { label: "Account created", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  REJECTED: { label: "Rejected", className: "bg-muted text-muted-foreground" },
  REVOKED: { label: "Revoked", className: "bg-destructive/10 text-destructive" },
};

interface Props {
  semesterId: number;
  visible: boolean;
  onPendingChange: (count: number) => void;
  /** May nagbago sa mga account (approve o revoke): i-refresh ang Students list */
  onVerified: () => void;
}

function displayName(r: Pick<RegistrationRow, "lastname" | "firstname" | "middleInitial">) {
  return `${r.lastname}, ${r.firstname}${r.middleInitial ? ` ${r.middleInitial}.` : ""}`;
}

function when(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function validInitial(v: string) {
  return !v.trim() || /^[A-Za-zÑñ]\.?$/.test(v.trim()) ? null : "One letter only.";
}

const editable = (r: RegistrationRow) => r.status === "EMAIL_PENDING" || r.status === "PENDING";

/** Lahat ng nag-register sa link: ayusin, resend, approve (isa o marami), reject, at revoke ng nagawang account */
export function PendingRegistrationsTab({ semesterId, visible, onPendingChange, onVerified }: Props) {
  const [link, setLink] = useState<EnrollmentLinkState | null>(null);
  const [failed, setFailed] = useState(false);
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("APPROVAL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | "bulk" | null>(null);
  const [closing, setClosing] = useState<{ row: RegistrationRow; kind: "reject" | "revoke" } | null>(null);
  const [reason, setReason] = useState("");

  const lastPending = useRef<number | null>(null);
  const pickedFilter = useRef(false);
  const pendingCb = useRef(onPendingChange);
  useEffect(() => {
    pendingCb.current = onPendingChange;
  });

  const load = useCallback(
    () =>
      Promise.all([
        api.get<EnrollmentLinkState>(LINK, { params: { semesterId } }),
        api.get<RegistrationRow[]>(REG, { params: { semesterId } }),
      ])
        .then(([state, list]) => {
          setLink(state.data);
          setRows(list.data);
          setFailed(false);
          setLoaded(true);
          const pending = list.data.filter((r) => r.status === "PENDING").length;
          // Unang bukas: ipakita ang may kailangang gawin; kung wala, ang mga bagong account
          if (!pickedFilter.current) {
            pickedFilter.current = true;
            if (pending === 0) setFilter("CREATED");
          }
          if (lastPending.current !== null && pending > lastPending.current) {
            const n = pending - lastPending.current;
            notify.success(`${n} new registration${n === 1 ? "" : "s"} waiting for your approval.`);
          }
          lastPending.current = pending;
          pendingCb.current(pending);
        })
        .catch(() => setFailed(true)),
    [semesterId],
  );

  // Bagong semester = bagong component (key sa Students page), kaya walang kailangang i-reset dito
  useEffect(() => {
    void load();
  }, [load]);

  // Mas madalas habang nakabukas ang tab (habang nag-i-scan ng QR ang klase)
  useEffect(() => {
    const id = window.setInterval(() => void load(), visible ? 8000 : 30000);
    return () => window.clearInterval(id);
  }, [load, visible]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { EMAIL: 0, APPROVAL: 0, CREATED: 0, CLOSED: 0 };
    for (const r of rows) {
      const f = FILTERS.find((x) => x.statuses.includes(r.status));
      if (f) c[f.key]++;
    }
    return c;
  }, [rows]);

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => {
    const statuses = FILTERS.find((f) => f.key === filter)?.statuses ?? [];
    const list = rows
      .filter((r) => statuses.includes(r.status))
      .filter((r) => !q || [r.studentNumber, r.lastname, r.firstname, r.email].join(" ").toLowerCase().includes(q));
    // Mga account at sarado: pinakabago ang una. Ang naghihintay: pinakaluma ang una (pila).
    return filter === "CREATED" || filter === "CLOSED" ? [...list].reverse() : list;
  }, [rows, filter, q]);

  const approvalShown = filter === "APPROVAL" ? shown : [];
  const allSelected = approvalShown.length > 0 && approvalShown.every((r) => selected.has(r.id));
  const selectedIds = approvalShown.filter((r) => selected.has(r.id)).map((r) => r.id);

  function toggle(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      approvalShown.forEach((r) => (on ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  }

  async function save(r: RegistrationRow, field: EditField, value: string) {
    const res = await api.patch<RegistrationRow>(`${REG}/${r.id}`, { [field]: value });
    setRows((cur) => cur.map((x) => (x.id === r.id ? res.data : x)));
    if (field === "email") notify.success(`Email changed. We sent a new verification link to ${res.data.email}.`);
  }

  async function approve(r: RegistrationRow) {
    setBusy(r.id);
    try {
      await api.post(`${REG}/${r.id}/verify`);
      notify.success(`${displayName(r)} is approved and added to your students.`);
      toggle(r.id, false);
      onVerified();
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't approve this registration."));
    } finally {
      setBusy(null);
      void load();
    }
  }

  async function bulkApprove() {
    if (selectedIds.length === 0) return;
    setBusy("bulk");
    try {
      const res = await api.post<BulkResult>(`${REG}/bulk-verify`, { ids: selectedIds });
      const { done, skipped, problems } = res.data;
      if (done > 0) onVerified();
      if (skipped === 0) {
        notify.success(`${done} student${done === 1 ? "" : "s"} approved.`);
      } else {
        notify.error(`${done} approved, ${skipped} skipped. ${problems.slice(0, 2).join(" ")}`);
      }
      setSelected(new Set());
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't approve the selected registrations."));
    } finally {
      setBusy(null);
      void load();
    }
  }

  async function resend(r: RegistrationRow) {
    setBusy(r.id);
    try {
      const res = await api.post<{ sent: boolean; message: string }>(`${REG}/${r.id}/resend`);
      if (res.data.sent) notify.success(res.data.message);
      else notify.error(res.data.message);
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't send the link."));
    } finally {
      setBusy(null);
      void load();
    }
  }

  async function close() {
    if (!closing) return;
    const { row: r, kind } = closing;
    setBusy(r.id);
    try {
      await api.post(`${REG}/${r.id}/${kind}`, { reason: reason.trim() || null });
      notify.success(
        kind === "reject"
          ? `${displayName(r)}'s registration was rejected.`
          : `${displayName(r)}'s access was removed. We emailed them.`,
      );
      toggle(r.id, false);
      setClosing(null);
      setReason("");
      if (kind === "revoke") onVerified();
    } catch (err) {
      notify.error(getErrorMessage(err, kind === "reject" ? "Couldn't reject this registration." : "Couldn't revoke this account."));
    } finally {
      setBusy(null);
      void load();
    }
  }

  /** Mga field na puwedeng ayusin ng coordinator (hindi pa tapos na registration lang) */
  function editors(r: RegistrationRow) {
    if (!editable(r)) {
      return {
        number: <span className="px-1 text-sm">{r.studentNumber}</span>,
        last: <span className="px-1 text-sm">{r.lastname}</span>,
        first: <span className="px-1 text-sm">{r.firstname}</span>,
        mi: <span className="px-1 text-sm">{r.middleInitial ?? ""}</span>,
        year: <span className="px-1 text-sm">{r.year ?? ""}</span>,
        gender: <span className="px-1 text-sm">{r.gender}</span>,
        course: <span className="px-1 text-sm">{r.course}</span>,
        email: <span className="block truncate px-1 text-sm" title={r.email}>{r.email}</span>,
      };
    }
    return {
      number: (
        <EditableCell value={r.studentNumber} label="Student ID" maxLength={50} validate={validNumber}
          onSave={(v) => save(r, "studentNumber", v)} />
      ),
      last: (
        <EditableCell value={r.lastname} label="Last name" maxLength={100} validate={required("Last name")}
          onSave={(v) => save(r, "lastname", v)} />
      ),
      first: (
        <EditableCell value={r.firstname} label="First name" maxLength={100} validate={required("First name")}
          onSave={(v) => save(r, "firstname", v)} />
      ),
      mi: (
        <EditableCell value={r.middleInitial} label="Middle initial" maxLength={2} validate={validInitial}
          onSave={(v) => save(r, "middleInitial", v)} />
      ),
      year: <SelectCell value={r.year} label="Year" options={YEARS} onSave={(v) => save(r, "year", v)} />,
      gender: <SelectCell value={r.gender} label="Sex at birth" options={GENDERS} onSave={(v) => save(r, "gender", v)} />,
      course: (
        <EditableCell value={r.course} label="Course / section" maxLength={50} validate={required("Course / section")}
          onSave={(v) => save(r, "course", v)} />
      ),
      // Email: puwedeng ayusin habang hindi pa ito na-verify ng student (magpapadala ng bagong link)
      email:
        r.status === "EMAIL_PENDING" ? (
          <EditableCell value={r.email} label="Email" maxLength={255} validate={validEmail}
            onSave={(v) => save(r, "email", v)} />
        ) : (
          <span className="block truncate px-1 text-sm" title={r.email}>{r.email}</span>
        ),
    };
  }

  /** Status at maikling detalye (kailan, dahilan) */
  function status(r: RegistrationRow) {
    const b = BADGE[r.status];
    let detail = "";
    if (r.status === "EMAIL_PENDING") detail = r.linkSentAt ? `Link sent ${when(r.linkSentAt)}` : "No link sent yet";
    else if (r.status === "VERIFIED") detail = when(r.decidedAt);
    else if (r.status === "REJECTED" || r.status === "REVOKED") {
      detail = [when(r.decidedAt), r.rejectReason].filter(Boolean).join(" · ");
    }
    return (
      <div className="flex flex-col items-start gap-1">
        <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", b.className)}>{b.label}</span>
        {r.status === "PENDING" && !r.emailVerified && (
          <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400" title="This registration was made before email verification existed.">
            <MailWarning className="h-3.5 w-3.5" /> Email not checked
          </span>
        )}
        {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
      </div>
    );
  }

  function actions(r: RegistrationRow, wide = false) {
    const btn = cn(!wide && "flex-1");
    const off = busy !== null;
    const rejectBtn = (
      <Button type="button" size="sm" variant="outline" disabled={off} className={btn}
        onClick={() => { setReason(""); setClosing({ row: r, kind: "reject" }); }}>
        <X className="h-4 w-4" /> Reject
      </Button>
    );
    switch (r.status) {
      case "PENDING":
        return (
          <div className={cn("flex gap-2", wide && "justify-end")}>
            <Button type="button" size="sm" disabled={off} onClick={() => void approve(r)} className={btn}>
              <Check className="h-4 w-4" /> {busy === r.id ? "Approving..." : "Approve"}
            </Button>
            {rejectBtn}
          </div>
        );
      case "EMAIL_PENDING":
        return (
          <div className={cn("flex gap-2", wide && "justify-end")}>
            <Button type="button" size="sm" variant="outline" disabled={off} onClick={() => void resend(r)} className={btn}>
              <RotateCw className={cn("h-4 w-4", busy === r.id && "animate-spin")} /> Resend link
            </Button>
            {rejectBtn}
          </div>
        );
      case "VERIFIED":
        return (
          <div className={cn("flex gap-2", wide && "justify-end")}>
            <Button type="button" size="sm" variant="outline" disabled={off || r.studentId === null}
              className={cn(btn, "text-destructive hover:text-destructive")}
              onClick={() => { setReason(""); setClosing({ row: r, kind: "revoke" }); }}>
              <ShieldOff className="h-4 w-4" /> Revoke
            </Button>
          </div>
        );
      default:
        return null;
    }
  }

  const emptyText: Record<Filter, string> = {
    APPROVAL: "No one is waiting for your approval.",
    EMAIL: "No one is waiting to verify their email.",
    CREATED: "No accounts yet. Share the link or QR code with your students.",
    CLOSED: "No rejected or revoked registrations.",
  };

  return (
    <div className="flex flex-col gap-4">
      <EnrollmentLinkCard semesterId={semesterId} state={link} failed={failed} onChange={setLink} />

      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        Students verify their email first. {link?.requireApproval
          ? "Then they wait in Needs approval: check their details (tap a value to fix it) and approve."
          : "Their account is then created automatically and shows in Accounts created, where you can revoke it."}{" "}
        New accounts complete their profile on their first login. Unverified registrations are removed after 7 days.
      </p>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Registration status">
          {FILTERS.map((f) => (
            <Button key={f.key} type="button" size="sm" role="tab" aria-selected={filter === f.key}
              variant={filter === f.key ? "default" : "outline"} className="shrink-0"
              onClick={() => setFilter(f.key)}>
              {f.label}
              <span className="ml-1 tabular-nums opacity-80">{counts[f.key]}</span>
            </Button>
          ))}
        </div>
        <div className="relative w-full lg:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID, email..."
            aria-label="Search registrations" className="pl-8" />
        </div>
      </div>

      {filter === "APPROVAL" && approvalShown.length > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={allSelected}
              onChange={(e) => toggleAll(e.target.checked)} aria-label="Select all shown" />
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select all"}
          </label>
          <Button type="button" size="sm" disabled={selectedIds.length === 0 || busy !== null}
            onClick={() => void bulkApprove()}>
            <Check className="h-4 w-4" />
            {busy === "bulk" ? "Approving..." : `Approve selected${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
          </Button>
        </div>
      )}

      {!loaded && <p className="py-10 text-center text-sm text-muted-foreground">Loading registrations...</p>}

      {loaded && shown.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-12 text-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="px-4 text-sm text-muted-foreground">{q ? "No registrations match your search." : emptyText[filter]}</p>
        </div>
      )}

      {loaded && shown.length > 0 && (
        <>
          {/* Phone: cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {shown.map((r) => {
              const e = editors(r);
              return (
                <li key={r.id} className="rounded-xl border bg-card p-3">
                  <div className="mb-2 flex items-start gap-3">
                    {r.status === "PENDING" && (
                      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-primary"
                        checked={selected.has(r.id)} onChange={(ev) => toggle(r.id, ev.target.checked)}
                        aria-label={`Select ${displayName(r)}`} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{displayName(r)}</p>
                      <p className="text-xs text-muted-foreground">Registered {when(r.createdAt)}</p>
                    </div>
                  </div>
                  <div className="mb-3">{status(r)}</div>
                  <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {[
                      ["Student ID", e.number], ["Course / section", e.course],
                      ["Last name", e.last], ["First name", e.first],
                      ["M.I.", e.mi], ["Year", e.year], ["Sex at birth", e.gender],
                    ].map(([label, node]) => (
                      <div key={label as string} className="min-w-0">
                        <dt className="px-1 text-muted-foreground">{label}</dt>
                        <dd>{node}</dd>
                      </div>
                    ))}
                    <div className="col-span-2 min-w-0">
                      <dt className="px-1 text-muted-foreground">Email</dt>
                      <dd>{e.email}</dd>
                    </div>
                  </dl>
                  {actions(r)}
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full min-w-[1080px] text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr>
                  {filter === "APPROVAL" && <th className="w-10 px-3 py-2" />}
                  <th className="px-2 py-2 font-medium">Student ID</th>
                  <th className="px-2 py-2 font-medium">Last name</th>
                  <th className="px-2 py-2 font-medium">First name</th>
                  <th className="w-16 px-2 py-2 font-medium">M.I.</th>
                  <th className="px-2 py-2 font-medium">Year</th>
                  <th className="px-2 py-2 font-medium">Sex</th>
                  <th className="px-2 py-2 font-medium">Course / section</th>
                  <th className="px-2 py-2 font-medium">Email</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const e = editors(r);
                  return (
                    <tr key={r.id} className="border-b align-top last:border-0">
                      {filter === "APPROVAL" && (
                        <td className="px-3 py-2">
                          <input type="checkbox" className="h-4 w-4 accent-primary" checked={selected.has(r.id)}
                            onChange={(ev) => toggle(r.id, ev.target.checked)} aria-label={`Select ${displayName(r)}`} />
                        </td>
                      )}
                      <td className="px-1 py-1">{e.number}</td>
                      <td className="px-1 py-1">{e.last}</td>
                      <td className="px-1 py-1">{e.first}</td>
                      <td className="px-1 py-1">{e.mi}</td>
                      <td className="px-1 py-1">{e.year}</td>
                      <td className="px-1 py-1">{e.gender}</td>
                      <td className="px-1 py-1">{e.course}</td>
                      <td className="px-1 py-1">
                        <div className="max-w-[220px]">{e.email}</div>
                        <div className="px-1 text-xs text-muted-foreground">{when(r.createdAt)}</div>
                      </td>
                      <td className="px-2 py-2">{status(r)}</td>
                      <td className="px-3 py-2">{actions(r, true)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Dialog open={closing !== null} onOpenChange={(open) => { if (!open && busy === null) setClosing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{closing?.kind === "revoke" ? "Revoke this account?" : "Reject this registration?"}</DialogTitle>
            <DialogDescription>
              {closing?.kind === "revoke"
                ? `${displayName(closing.row)} won't be able to log in anymore, and we'll email them that their access was removed. They'll see your reason if they try to log in. You can restore them later from your archived students.`
                : `${closing ? displayName(closing.row) : ""} won't get an account. They'll see your reason when they try to log in, and they can register again with the correct details.`}
            </DialogDescription>
          </DialogHeader>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">
              Reason <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <Textarea value={reason} maxLength={300} rows={3} onChange={(e) => setReason(e.target.value)}
              placeholder="For example: Not in my class list this semester." />
            <span className="text-right text-xs text-muted-foreground">{reason.length}/300</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => setClosing(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy !== null} onClick={() => void close()}>
              {busy !== null
                ? closing?.kind === "revoke" ? "Revoking..." : "Rejecting..."
                : closing?.kind === "revoke" ? "Revoke access" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
