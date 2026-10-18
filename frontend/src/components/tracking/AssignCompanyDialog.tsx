import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  MapPin,
  Phone,
  Search,
  UserMinus,
  UserRound,
} from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { AssignmentResult, CompanyOption } from "@/types/assignment";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AssignCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Sa bulk mode, ang una sa mga napili (para makuha ang listahan ng companies ng semester) */
  studentId: number;
  studentName: string;
  currentLabel: string | null;
  onAssigned?: (result: AssignmentResult) => void;
  onRemoved?: () => void;
  bulk?: { count: number; onSubmit: (departmentId: number) => Promise<void> };
}

export function AssignCompanyDialog({
  open,
  onOpenChange,
  studentId,
  studentName,
  currentLabel,
  onAssigned,
  onRemoved,
  bulk,
}: AssignCompanyDialogProps) {
  const isBulk = Boolean(bulk);

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    api
      .get<CompanyOption[]>(
        `/coordinator/students/${studentId}/company-options`,
      )
      .then((res) => {
        if (cancelled) return;
        setCompanies(res.data);
        if (!isBulk) {
          const withCurrent = res.data.find((c) =>
            c.departments.some((d) => d.current),
          );
          if (withCurrent) setCompanyId(withCurrent.id);
        }
      })
      .catch((err) => {
        if (!cancelled)
          setLoadError(getErrorMessage(err, "Failed to load companies."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studentId, isBulk]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.supervisorName.toLowerCase().includes(q) ||
        c.departments.some((d) => (d.name ?? "").toLowerCase().includes(q)),
    );
  }, [companies, search]);

  const selectedCompany = companies.find((c) => c.id === companyId) ?? null;
  const selectedDepartment =
    selectedCompany?.departments.find((d) => d.id === departmentId) ?? null;

  const busy = saving || removing;

  async function handleAssign() {
    if (departmentId === null) return;

    setSaving(true);
    setError("");

    try {
      if (bulk) {
        await bulk.onSubmit(departmentId);
      } else {
        const res = await api.patch<AssignmentResult>(
          `/coordinator/students/${studentId}/department`,
          { departmentId },
        );
        onAssigned?.(res.data);
      }
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to assign."));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setError("");

    try {
      await api.delete(`/coordinator/students/${studentId}/department`);
      onRemoved?.();
      onOpenChange(false);
    } catch (err) {
      setError(
        getErrorMessage(err, "Failed to remove the student from the company."),
      );
      setConfirmRemove(false);
    } finally {
      setRemoving(false);
    }
  }

  const title = bulk
    ? `Assign ${bulk.count} student${bulk.count === 1 ? "" : "s"} to company`
    : currentLabel
      ? "Edit company assignment"
      : "Assign to company";

  const description = bulk
    ? "Choose a department. Students who aren't in this semester are skipped, and the department must have enough slots for everyone."
    : currentLabel
      ? `${studentName} is currently assigned to ${currentLabel}.`
      : `Choose a company and department for ${studentName}.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        <div className="grid gap-4 md:grid-cols-[250px_1fr]">
          {/* Listahan ng companies */}
          <div className="flex min-w-0 flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search company..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="max-h-72 overflow-y-auto rounded-md border">
              {loading && (
                <div className="flex flex-col gap-2 p-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  {companies.length === 0
                    ? "No companies have been added for this semester yet."
                    : "No companies match your search."}
                </p>
              )}

              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCompanyId(c.id);
                    setDepartmentId(null);
                    setError("");
                  }}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted",
                    c.id === companyId && "bg-muted",
                  )}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.nature ?? "—"} · {c.departments.length} department(s)
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Detalye ng napiling company */}
          <div className="max-h-[22rem] min-w-0 overflow-y-auto rounded-md border p-4">
            {!selectedCompany && (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Select a company to see its details and departments.
              </p>
            )}

            {selectedCompany && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">
                      {selectedCompany.name}
                    </h3>
                    {selectedCompany.nature && (
                      <Badge variant="secondary">
                        {selectedCompany.nature}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      {selectedCompany.address}
                      {selectedCompany.location
                        ? ` · ${selectedCompany.location}`
                        : ""}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0" />
                      {selectedCompany.contactNumber}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <UserRound className="h-4 w-4 shrink-0" />
                      Immediate supervisor: {
                        selectedCompany.supervisorName
                      } · {selectedCompany.supervisorPosition}
                    </span>
                  </div>

                  {selectedCompany.description && (
                    <p className="text-sm text-muted-foreground">
                      {selectedCompany.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Departments</p>

                  {selectedCompany.departments.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      This company has no departments yet.
                    </p>
                  )}

                  {selectedCompany.departments.map((d) => {
                    const current = !isBulk && d.current;
                    const approved = d.status.toLowerCase() === "approved";
                    const left = Math.max(0, d.slots - d.filled);
                    const full = left === 0 && !current;
                    const disabled = !approved || full;
                    const selected = d.id === departmentId;
                    const notEnough = bulk && !full && left < bulk.count;

                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          setDepartmentId(d.id);
                          setError("");
                        }}
                        className={cn(
                          "flex flex-col gap-1 rounded-md border p-3 text-left text-sm",
                          selected
                            ? "border-primary ring-1 ring-primary"
                            : "hover:bg-muted",
                          disabled &&
                            "cursor-not-allowed opacity-60 hover:bg-transparent",
                        )}
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {d.name ?? "Unnamed department"}
                          </span>
                          {current && <Badge>Current</Badge>}
                          {!approved && (
                            <Badge variant="outline">Pending approval</Badge>
                          )}
                          {approved && full && (
                            <Badge variant="outline">Full</Badge>
                          )}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {d.filled}/{d.slots} slots
                          </span>
                        </span>

                        {notEnough && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">
                            Only {left} slot{left === 1 ? "" : "s"} left for{" "}
                            {bulk.count} students.
                          </span>
                        )}

                        <span className="text-xs text-muted-foreground">
                          Supervisor: {d.supervisorFullname ?? "—"}
                          {d.supervisorPosition
                            ? ` · ${d.supervisorPosition}`
                            : ""}
                        </span>

                        {(d.supervisorContactNumber || d.supervisorEmail) && (
                          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {d.supervisorContactNumber && (
                              <span className="inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {d.supervisorContactNumber}
                              </span>
                            )}
                            {d.supervisorEmail && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {d.supervisorEmail}
                              </span>
                            )}
                          </span>
                        )}

                        {(d.moaStart || d.moaExpiration) && (
                          <span className="text-xs text-muted-foreground">
                            MOA: {d.moaStart ?? "—"} to {d.moaExpiration ?? "—"}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {confirmRemove ? (
          <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm">
              Remove {studentName} from {currentLabel}? The department slot will
              be freed.
            </p>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={removing}
                onClick={() => setConfirmRemove(false)}
              >
                Keep
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={removing}
                onClick={() => void handleRemove()}
              >
                {removing ? "Removing..." : "Yes, remove"}
              </Button>
            </div>
          </div>
        ) : (
          <DialogFooter className="sm:justify-between">
            {!isBulk && currentLabel ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => setConfirmRemove(true)}
              >
                <UserMinus className="h-4 w-4" />
                Remove from company
              </Button>
            ) : (
              <span />
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  busy ||
                  !selectedDepartment ||
                  (!isBulk && selectedDepartment.current)
                }
                onClick={() => void handleAssign()}
              >
                {saving
                  ? "Assigning..."
                  : bulk
                    ? `Assign ${bulk.count} student${bulk.count === 1 ? "" : "s"}`
                    : currentLabel
                      ? "Move to department"
                      : "Assign to department"}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
