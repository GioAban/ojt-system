import { useEffect, useState } from "react";
import api from "@/lib/api";
import { formatLongDate } from "@/lib/dates";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { GENDERS, YEARS, defaultPassword, fullName, required, validNumber, validOptionalPhone } from "@/lib/students";
import { cn } from "@/lib/utils";
import { EditableCell } from "@/components/tracking/EditableCell";
import { SelectCell } from "@/components/students/SelectCell";
import type { ApprovalResult, StudentDetail, StudentRow } from "@/types/students";
import { CredentialsCard } from "@/components/students/CredentialsCard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ConfirmedEmailCell } from "./ConfirmedEmailCell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  studentId: number | null;
  onClose: () => void;
  onRowChange?: (row: StudentRow) => void;
}

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t pt-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </section>
  );
}

const LABELS: Record<string, string> = {
  studentNumber: "Student ID",
  lastname: "Last name",
  firstname: "First name",
  middleInitial: "Middle initial",
  gender: "Gender",
  year: "Year",
  course: "Course",
  contact: "Contact",
  email: "Email",
  birthday: "Birthday",
  parent: "Parent",
  guardian: "Guardian",
  address: "Address",
};

function EditItem({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", wide && "col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="-mx-2 text-sm">{children}</dd>
    </div>
  );
}

export function StudentDrawer({ studentId, onClose, onRowChange }: Props) {
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [error, setError] = useState("");
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createError, setCreateError] = useState("");
  const [credentials, setCredentials] = useState<ApprovalResult | null>(null);

  useEffect(() => {
    if (studentId === null) return;
    setCredentials(null);
    setCreateEmail("");
    setCreateError("");
    setPassword("");
    let cancelled = false;
    api
      .get<StudentDetail>(`/coordinator/student-management/${studentId}`)
      .then((res) => {
        if (cancelled) return;
        setDetail(res.data);
        setError("");
        setLoadedId(studentId);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(getErrorMessage(err, "Couldn't load the student."));
        setLoadedId(studentId);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const loading = studentId !== null && loadedId !== studentId;
  const d = !loading && detail?.student.id === studentId ? detail : null;

  async function savePassword() {
    if (studentId === null) return;
    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    setSaving(true);
    setPasswordError("");
    try {
      await api.post(`/coordinator/student-management/${studentId}/password`, { password });
      setPassword("");
      notify.success(`Password changed for ${d ? d.student.firstname + " " + d.student.lastname : "the student"}.`);
    } catch (err) {
      setPasswordError(getErrorMessage(err, "Couldn't change the password."));
    } finally {
      setSaving(false);
    }
  }

  /** Nagse-save ng isang field ng student; may toast sa bawat update */
  async function saveField(field: string, value: string) {
    if (studentId === null) return;
    const res = await api.patch<StudentRow>(`/coordinator/student-management/${studentId}`, { field, value });
    const clean = value.trim() || null;
    setDetail((cur) =>
      cur
        ? {
            ...cur,
            student: res.data,
            parent: field === "parent" ? clean : cur.parent,
            guardian: field === "guardian" ? clean : cur.guardian,
          }
        : cur,
    );
    onRowChange?.(res.data);
    notify.success(`${LABELS[field] ?? "Field"} updated.`);
  }

  function applyRowChange(email: string) {
    if (!detail) return;
    const row: StudentRow = { ...detail.student, email, registered: true };
    setDetail({ ...detail, student: row });
    onRowChange?.(row);
  }

  async function createAccount() {
    if (studentId === null) return;
    setSaving(true);
    setCreateError("");
    try {
      const res = await api.post<ApprovalResult>(`/coordinator/student-management/${studentId}/create-account`, {
        email: createEmail,
      });
      setCredentials(res.data);
      setCreateEmail("");
      applyRowChange(res.data.email);
      notify.success("Account created.");
    } catch (err) {
      setCreateError(getErrorMessage(err, "Couldn't create the account."));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    if (studentId === null) return;
    setSaving(true);
    try {
      const res = await api.post<ApprovalResult>(`/coordinator/student-management/${studentId}/reset-password`);
      setCredentials(res.data);
      notify.success("Password reset to the default.");
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't reset the password."));
    } finally {
      setSaving(false);
    }
  }

  async function resetAccount() {
    if (studentId === null) return;
    setSaving(true);
    try {
      const res = await api.post<StudentRow>(`/coordinator/student-management/${studentId}/reset-account`);
      setDetail((cur) => (cur ? { ...cur, student: res.data } : cur));
      onRowChange?.(res.data);
      setConfirmReset(false);
      setCredentials(null);
      notify.success("Account reset. The student can request an account again with the enrollment link.");
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't reset the account."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={studentId !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{d ? fullName(d.student) : "Student"}</SheetTitle>
          <SheetDescription>
            {d ? `${d.student.studentNumber} · ${d.student.subjectCode}` : "Student profile"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          {loading && (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!loading && error && <p className="text-sm text-destructive">{error}</p>}

          {d && (
            <>
              <Section title="Placement">
                <Item label="Status" value={d.student.status} />
                <Item label="MOA" value={d.moaStatus} />
                <Item label="Company" value={d.student.companyName} />
                <Item label="Department" value={d.student.departmentName} />
                <Item label="Supervisor" value={d.supervisorName} />
                <Item label="Position" value={d.supervisorPosition} />
                <div className="col-span-2"><Item label="Company address" value={d.companyAddress} /></div>
              </Section>

              <Section title="Training">
                <Item label="Deployed" value={d.deployedDate ? formatLongDate(d.deployedDate.slice(0, 10)) : null} />
                <Item label="Started" value={d.startTrainingDate ? formatLongDate(d.startTrainingDate.slice(0, 10)) : null} />
                <Item label="Completed" value={d.completedDate ? formatLongDate(d.completedDate.slice(0, 10)) : null} />
                <Item label="Hours" value={d.trainingDuration != null ? `${d.renderedHours ?? 0} / ${d.trainingDuration}` : d.renderedHours != null ? String(d.renderedHours) : null} />
                <Item label="Employability" value={d.employabilityLevel} />
              </Section>

              <Section title="Student info">
                <EditItem label="Student ID">
                  <EditableCell value={d.student.studentNumber} label="Student ID" maxLength={50} validate={(v) => validNumber(v)} onSave={(v) => saveField("studentNumber", v)} />
                </EditItem>
                <EditItem label="Course">
                  <EditableCell value={d.student.subjectCode} label="Course" maxLength={50} validate={required("Course")} onSave={(v) => saveField("course", v)} />
                </EditItem>
                <EditItem label="Last name">
                  <EditableCell value={d.student.lastname} label="Last name" maxLength={100} validate={required("Last name")} onSave={(v) => saveField("lastname", v)} />
                </EditItem>
                <EditItem label="First name">
                  <EditableCell value={d.student.firstname} label="First name" maxLength={100} validate={required("First name")} onSave={(v) => saveField("firstname", v)} />
                </EditItem>
                <EditItem label="Middle initial">
                  <EditableCell value={d.student.middleInitial} label="Middle initial" maxLength={3} onSave={(v) => saveField("middleInitial", v)} />
                </EditItem>
                <EditItem label="Gender">
                  <SelectCell value={d.student.gender} label="Gender" options={GENDERS} onSave={(v) => saveField("gender", v)} />
                </EditItem>
                <EditItem label="Year">
                  <SelectCell value={d.student.year} label="Year" options={YEARS} onSave={(v) => saveField("year", v)} />
                </EditItem>
              </Section>

              <Section title="Contact and personal">
                <EditItem label="Email">
                  {d.student.registered ? (
                    <ConfirmedEmailCell value={d.student.email} name={`${d.student.firstname} ${d.student.lastname}`} onSave={(v) => saveField("email", v)} />
                  ) : (
                    <span className="px-2 text-muted-foreground">No account yet</span>
                  )}
                </EditItem>
                <EditItem label="Contact">
                  <EditableCell value={d.student.contact} label="Contact" maxLength={20} validate={validOptionalPhone} onSave={(v) => saveField("contact", v)} />
                </EditItem>
                <EditItem label="Birthday (YYYY-MM-DD)">
                  <EditableCell value={d.student.birthday ? d.student.birthday.slice(0, 10) : ""} label="Birthday" maxLength={10} onSave={(v) => saveField("birthday", v)} />
                </EditItem>
                <EditItem label="Parent">
                  <EditableCell value={d.parent} label="Parent" maxLength={255} onSave={(v) => saveField("parent", v)} />
                </EditItem>
                <EditItem label="Guardian">
                  <EditableCell value={d.guardian} label="Guardian" maxLength={255} onSave={(v) => saveField("guardian", v)} />
                </EditItem>
                <EditItem label="Address" wide>
                  <EditableCell value={d.student.address} label="Address" maxLength={255} onSave={(v) => saveField("address", v)} />
                </EditItem>
              </Section>

              {Object.keys(d.requirements).length > 0 && (
                <Section title="Requirements">
                  {Object.entries(d.requirements).map(([k, v]) => (
                    <Item key={k} label={k} value={String(v)} />
                  ))}
                </Section>
              )}

              <section className="border-t pt-4">
                <h3 className="mb-2 text-sm font-semibold">Account</h3>
                {credentials && (
                  <div className="mb-3">
                    <CredentialsCard result={credentials} onDone={() => setCredentials(null)} />
                  </div>
                )}
                {d.student.registered ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                      Registered with {d.student.email}. Reset the password to the default
                      ({defaultPassword(d.student.studentNumber, d.student.lastname, d.student.firstname)}), or type one yourself.
                      The student must change it after logging in.
                    </p>
                    <div className="flex flex-col gap-1">
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder="New password (min. 8 characters)"
                        value={password}
                        maxLength={72}
                        aria-label="New password"
                        aria-invalid={Boolean(passwordError)}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError("");
                        }}
                      />
                      {passwordError && <p className="text-xs text-destructive">{passwordError}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" disabled={saving || !password} onClick={() => void savePassword()}>
                        {saving ? "Saving..." : "Set password"}
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void resetPassword()}>
                        Reset to default password
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => setConfirmReset(true)}>
                        Reset account
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs text-muted-foreground">
                      No account yet. Create one here with the student's email (the password will be{" "}
                      {defaultPassword(d.student.studentNumber, d.student.lastname, d.student.firstname)}), or let the
                      student enroll from the Accounts tab.
                    </p>
                    <div className="flex flex-col gap-1">
                      <Input
                        type="email"
                        autoComplete="off"
                        placeholder="Student email"
                        value={createEmail}
                        aria-label="Student email"
                        aria-invalid={Boolean(createError)}
                        onChange={(e) => {
                          setCreateEmail(e.target.value);
                          setCreateError("");
                        }}
                      />
                      {createError && <p className="text-xs text-destructive">{createError}</p>}
                    </div>
                    <div>
                      <Button type="button" size="sm" disabled={saving || !createEmail.trim()} onClick={() => void createAccount()}>
                        {saving ? "Creating..." : "Create account"}
                      </Button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>

      <ConfirmDialog
        open={confirmReset}
        title="Reset this account?"
        description="The email and password will be removed. The student will have to request an account again."
        confirmLabel="Reset account"
        loading={saving}
        onConfirm={() => void resetAccount()}
        onCancel={() => setConfirmReset(false)}
      />
    </Sheet>
  );
}
