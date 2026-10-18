import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, KeyRound, Search, UserPlus, X } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { DEFAULT_PASSWORD_RULE, defaultPassword, validEmail } from "@/lib/students";
import type { AcceptAllResult, AccountRow, AccountStatus, EnrollmentLinkState } from "@/types/students";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConfirmedEmailCell } from "./ConfirmedEmailCell";
import { EnrollmentLinkCard } from "@/components/students/EnrollmentLinkCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const LINK = "/coordinator/student-management/enrollment";
const SM = "/coordinator/student-management";

type Filter = "all" | AccountStatus;

interface Props {
  semesterId: number;
  /** Nakikita ba ang tab ngayon (mas madalas mag-refresh kapag nakikita) */
  visible: boolean;
  onPendingChange: (count: number) => void;
  /** Nagbago ang account ng isang student; i-refresh ang Students list */
  onChanged: () => void;
}

const ORDER: Record<AccountStatus, number> = { pending: 0, active: 1, none: 2 };

const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: "Waiting for you",
  active: "Has account",
  none: "Not enrolled",
};

const STATUS_CLASS: Record<AccountStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  none: "bg-muted text-muted-foreground",
};

function displayName(r: Pick<AccountRow, "lastname" | "firstname" | "middleInitial">) {
  const mi = r.middleInitial ? ` ${r.middleInitial.replace(/\.$/, "")}.` : "";
  return `${r.lastname}, ${r.firstname}${mi}`;
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

type Action = "accept" | "reject" | "reset" | "remove";

interface PendingAction {
  action: Action;
  rows: AccountRow[];
}

function RowCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

function namesOf(rows: AccountRow[], max = 5) {
  const names = rows.slice(0, max).map(displayName).join("; ");
  return rows.length > max ? `${names}; and ${rows.length - max} more` : names;
}

function confirmText(p: PendingAction): { title: string; description: string; label: string } {
  const n = p.rows.length;
  const one = n === 1 ? p.rows[0] : null;
  switch (p.action) {
    case "accept":
      return one
        ? {
            title: `Accept ${displayName(one)}?`,
            description: `An account is created with ${one.email}. The default password is ${defaultPassword(one.studentNumber, one.lastname, one.firstname)} and they must change it after logging in.`,
            label: "Accept",
          }
        : {
            title: `Accept ${n} requests?`,
            description: `Each student gets an account with the email they submitted and the default password. ${namesOf(p.rows)}.`,
            label: `Accept ${n}`,
          };
    case "reject":
      return one
        ? {
            title: `Reject ${displayName(one)}?`,
            description: "No account is created. They can send a new request with the enrollment link.",
            label: "Reject",
          }
        : {
            title: `Reject ${n} requests?`,
            description: `No accounts are created. They can send new requests with the link. ${namesOf(p.rows)}.`,
            label: `Reject ${n}`,
          };
    case "reset":
      return one
        ? {
            title: "Reset password to default?",
            description: `${displayName(one)}'s password becomes ${defaultPassword(one.studentNumber, one.lastname, one.firstname)}. They must change it again after logging in.`,
            label: "Reset password",
          }
        : {
            title: `Reset ${n} passwords to default?`,
            description: `Each password becomes the Student ID plus the first letter of the last name and the last letter of the first name. They must change it after logging in. ${namesOf(p.rows)}.`,
            label: `Reset ${n}`,
          };
    default:
      return one
        ? {
            title: "Remove this account?",
            description: `The email and password of ${displayName(one)} will be removed and they can't log in. They can enroll again with the link.`,
            label: "Remove account",
          }
        : {
            title: `Remove ${n} accounts?`,
            description: `Their emails and passwords will be removed and they can't log in. They can enroll again with the link. ${namesOf(p.rows)}.`,
            label: `Remove ${n}`,
          };
  }
}

/** Accounts: link ng enrollment, mga nag-enroll, at kontrol ng coordinator sa bawat account */
export function AccountsTab({ semesterId, visible, onPendingChange, onChanged }: Props) {
  const [link, setLink] = useState<EnrollmentLinkState | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<number | "all" | null>(null);
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState<number | null>(null);
  const [createEmail, setCreateEmail] = useState("");
  const [createError, setCreateError] = useState("");

  const lastPending = useRef<number | null>(null);
  const pendingCb = useRef(onPendingChange);
  pendingCb.current = onPendingChange;

  const load = useCallback(async () => {
    try {
      const [state, list] = await Promise.all([
        api.get<EnrollmentLinkState>(LINK, { params: { semesterId } }),
        api.get<AccountRow[]>(`${LINK}/accounts`, { params: { semesterId } }),
      ]);
      setLink(state.data);
      setRows(list.data);
      setLinkFailed(false);
      setLoaded(true);
      const pending = list.data.filter((r) => r.status === "pending").length;
      if (lastPending.current !== null && pending > lastPending.current) {
        const n = pending - lastPending.current;
        notify.success(`${n} new enrollment${n === 1 ? "" : "s"} waiting for you.`);
      }
      lastPending.current = pending;
      pendingCb.current(pending);
    } catch {
      setLinkFailed(true);
    }
  }, [semesterId]);

  useEffect(() => {
    lastPending.current = null;
    setLoaded(false);
    setLink(null);
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), visible ? 6000 : 20000);
    return () => window.clearInterval(id);
  }, [load, visible]);

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, active: 0, none: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const q = search.trim().toLowerCase();
  const shown = useMemo(() => {
    return rows
      .filter((r) => (filter === "all" ? true : r.status === filter))
      .filter((r) => !q || [r.studentNumber, r.lastname, r.firstname, r.email].filter(Boolean).join(" ").toLowerCase().includes(q))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  }, [rows, filter, q]);

  const selectable = useMemo(() => shown.filter((r) => r.status !== "none"), [shown]);
  const selectedRows = useMemo(() => rows.filter((r) => selected.has(r.studentId)), [rows, selected]);
  const selectedPending = selectedRows.filter((r) => r.status === "pending");
  const selectedActive = selectedRows.filter((r) => r.status === "active");
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.studentId));
  const someSelected = selectable.some((r) => selected.has(r.studentId));

  function toggleAll(on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      selectable.forEach((r) => (on ? next.add(r.studentId) : next.delete(r.studentId)));
      return next;
    });
  }

  function toggleOne(id: number, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function run(id: number | "all", action: () => Promise<void>, failMessage: string) {
    setBusy(id);
    try {
      await action();
      await load();
      onChanged();
    } catch (err) {
      notify.error(getErrorMessage(err, failMessage));
      await load();
    } finally {
      setBusy(null);
    }
  }

  /** Isinasagawa ang kumpirmadong aksyon para sa isa o maraming student */
  function execute() {
    if (!confirm) return;
    const { action, rows: targets } = confirm;
    setConfirm(null);
    const single = targets.length === 1 ? displayName(targets[0]) : null;
    void run("all", async () => {
      let done = 0;
      let skipped = 0;
      if (action === "accept" || action === "reject") {
        const ids = targets.map((r) => r.requestId).filter((id): id is number => id !== null);
        const res = await api.post<AcceptAllResult>(`${LINK}/requests/bulk-${action}`, { requestIds: ids });
        done = res.data.accepted;
        skipped = res.data.skipped;
      } else {
        const path = action === "reset" ? "reset-password" : "reset-account";
        for (const r of targets) {
          try {
            await api.post(`${SM}/${r.studentId}/${path}`);
            done++;
          } catch {
            skipped++;
          }
        }
      }
      setSelected((prev) => {
        const next = new Set(prev);
        targets.forEach((t) => next.delete(t.studentId));
        return next;
      });

      const verb = { accept: "accepted", reject: "rejected", reset: "reset to the default password", remove: "removed" }[action];
      if (done === 0) {
        notify.error(single ? `Couldn't update ${single}.` : "Nothing was changed.");
      } else if (single) {
        notify.success(`${single} was ${verb}.`);
      } else {
        notify.success(
          skipped > 0
            ? `${done} ${verb}, ${skipped} skipped (already handled, email in use, or archived).`
            : `${done} account${done === 1 ? "" : "s"} ${verb}.`,
        );
      }
    }, "Couldn't complete the action.");
  }

  function createAccount(r: AccountRow) {
    const problem = validEmail(createEmail);
    if (problem) {
      setCreateError(problem);
      return;
    }
    void run(r.studentId, async () => {
      try {
        await api.post(`${SM}/${r.studentId}/create-account`, { email: createEmail });
      } catch (err) {
        setCreateError(getErrorMessage(err, "Couldn't create the account."));
        throw err;
      }
      setCreating(null);
      setCreateEmail("");
      notify.success(`Account created for ${displayName(r)}.`);
    }, "Couldn't create the account.");
  }

  async function saveEmail(r: AccountRow, value: string) {
    await api.patch(`${SM}/${r.studentId}`, { field: "email", value });
    setRows((cur) => cur.map((x) => (x.studentId === r.studentId ? { ...x, email: value.trim().toLowerCase() } : x)));
    notify.success(`Email updated for ${displayName(r)}.`);
    onChanged();
  }

  const FILTERS: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "pending", label: "Waiting for you", count: counts.pending },
    { value: "active", label: "Has account", count: counts.active },
    { value: "none", label: "Not enrolled", count: counts.none },
  ];

  return (
    <div className="flex flex-col gap-4">
      <EnrollmentLinkCard semesterId={semesterId} state={link} failed={linkFailed} onChange={setLink} />

      <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">Default password:</strong> {DEFAULT_PASSWORD_RULE} Students log in with
        their email and this password, then must set their own.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Filter accounts">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
                filter === f.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-xs",
                  filter === f.value ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
                  f.value === "pending" && f.count > 0 && filter !== "pending" && "bg-amber-200 text-amber-900",
                )}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, ID, email..."
              aria-label="Search accounts"
              className="w-60 pl-8"
            />
          </div>
          {counts.pending > 0 && (
            <Button type="button" disabled={busy !== null} onClick={() => setConfirm({ action: "accept", rows: rows.filter((r) => r.status === "pending") })}>
              <Check className="h-4 w-4" /> Accept all ({counts.pending})
            </Button>
          )}
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-sm font-medium">{selectedRows.length} selected</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedPending.length > 0 && (
              <>
                <Button type="button" size="sm" disabled={busy !== null} onClick={() => setConfirm({ action: "accept", rows: selectedPending })}>
                  <Check className="h-4 w-4" /> Accept ({selectedPending.length})
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => setConfirm({ action: "reject", rows: selectedPending })}>
                  <X className="h-4 w-4" /> Reject ({selectedPending.length})
                </Button>
              </>
            )}
            {selectedActive.length > 0 && (
              <>
                <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => setConfirm({ action: "reset", rows: selectedActive })}>
                  <KeyRound className="h-4 w-4" /> Reset password ({selectedActive.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={busy !== null}
                  onClick={() => setConfirm({ action: "remove", rows: selectedActive })}
                >
                  Remove ({selectedActive.length})
                </Button>
              </>
            )}
          </div>
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      {!loaded ? (
        <p className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
          {linkFailed ? "Couldn't load the accounts. Retrying..." : "Loading..."}
        </p>
      ) : shown.length === 0 ? (
        <p className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No students yet. Add or import students first, then share the link."
            : filter === "pending"
              ? "Nobody is waiting. New enrollments show up here automatically."
              : "No accounts match your filters."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table style={{ minWidth: 880 }}>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 px-3">
                  <RowCheckbox
                    label="Select all"
                    checked={allSelected}
                    indeterminate={someSelected}
                    disabled={selectable.length === 0}
                    onChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="px-3">Student</TableHead>
                <TableHead className="px-3">Email</TableHead>
                <TableHead className="px-3">Status</TableHead>
                <TableHead className="px-3">Requested</TableHead>
                <TableHead className="px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const working = busy === r.studentId || busy === "all";
                return (
                  <TableRow
                    key={r.studentId}
                    className={cn(
                      r.status === "pending" && "bg-amber-50/60 dark:bg-amber-950/20",
                      selected.has(r.studentId) && "bg-primary/5",
                    )}
                  >
                    <TableCell className="w-10 px-3 py-2 align-middle">
                      <RowCheckbox
                        label={`Select ${displayName(r)}`}
                        checked={selected.has(r.studentId)}
                        disabled={r.status === "none"}
                        onChange={(on) => toggleOne(r.studentId, on)}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2 align-middle">
                      <div className="font-medium">{displayName(r)}</div>
                      <div className="text-xs text-muted-foreground">{r.studentNumber}{r.year ? ` · ${r.year}` : ""}</div>
                    </TableCell>
                    <TableCell className="px-1 py-1 align-middle">
                      {r.status === "active" ? (
                        <ConfirmedEmailCell value={r.email} name={displayName(r)} onSave={(v) => saveEmail(r, v)} />
                      ) : r.status === "none" && creating === r.studentId ? (
                        <div className="flex flex-col gap-1 px-2">
                          <Input
                            type="email"
                            autoFocus
                            placeholder="Student email"
                            value={createEmail}
                            aria-label="Student email"
                            aria-invalid={Boolean(createError)}
                            onChange={(e) => {
                              setCreateEmail(e.target.value);
                              setCreateError("");
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") createAccount(r);
                              if (e.key === "Escape") setCreating(null);
                            }}
                          />
                          {createError && <span className="text-xs text-destructive">{createError}</span>}
                        </div>
                      ) : (
                        <span className="px-2 text-sm">{r.email ?? <span className="text-muted-foreground">—</span>}</span>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-middle">
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_CLASS[r.status])}>
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.status === "active" && r.mustChangePassword && (
                        <div className="mt-0.5 text-xs text-muted-foreground">Still on default password</div>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2 align-middle text-xs text-muted-foreground">{formatWhen(r.requestedAt)}</TableCell>
                    <TableCell className="px-3 py-2 align-middle">
                      <div className="flex justify-end gap-1.5">
                        {r.status === "pending" && (
                          <>
                            <Button type="button" size="sm" disabled={working} onClick={() => setConfirm({ action: "accept", rows: [r] })}>
                              <Check className="h-4 w-4" /> Accept
                            </Button>
                            <Button type="button" size="sm" variant="ghost" disabled={working} onClick={() => setConfirm({ action: "reject", rows: [r] })}>
                              <X className="h-4 w-4" /> Reject
                            </Button>
                          </>
                        )}
                        {r.status === "active" && (
                          <>
                            <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => setConfirm({ action: "reset", rows: [r] })}>
                              <KeyRound className="h-4 w-4" /> Reset password
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              disabled={working}
                              onClick={() => setConfirm({ action: "remove", rows: [r] })}
                            >
                              Remove
                            </Button>
                          </>
                        )}
                        {r.status === "none" && creating !== r.studentId && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={working}
                            onClick={() => {
                              setCreating(r.studentId);
                              setCreateEmail("");
                              setCreateError("");
                            }}
                          >
                            <UserPlus className="h-4 w-4" /> Create account
                          </Button>
                        )}
                        {r.status === "none" && creating === r.studentId && (
                          <>
                            <Button type="button" size="sm" disabled={working || !createEmail.trim()} onClick={() => createAccount(r)}>
                              Create
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(null)}>
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm ? confirmText(confirm).title : ""}
        description={confirm ? confirmText(confirm).description : ""}
        confirmLabel={confirm ? confirmText(confirm).label : ""}
        loading={busy === "all"}
        onConfirm={execute}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
