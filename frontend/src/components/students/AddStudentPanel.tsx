import { useState, type FormEvent } from "react";
import { UserPlus, X } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { EMPTY_FORM, GENDERS, YEARS, validateForm } from "@/lib/students";
import type { StudentForm, StudentRow } from "@/types/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

interface Props {
  semesterId: number;
  onClose: () => void;
  onCreated: (row: StudentRow) => void;
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

/** Inline na panel sa taas ng table, hindi modal */
export function AddStudentPanel({ semesterId, onClose, onCreated }: Props) {
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof StudentForm, string>>>({});
  const [saving, setSaving] = useState(false);

  function set<K extends keyof StudentForm>(key: K, value: StudentForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validateForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    try {
      const res = await api.post<StudentRow>("/coordinator/student-management", {
        semesterId,
        ...form,
      });
      onCreated(res.data);
      notify.success(`${res.data.firstname} ${res.data.lastname} was added.`);
      setForm(EMPTY_FORM);
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't add the student."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mb-4 rounded-xl border bg-card p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4" /> Add student
        </h2>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Student number *" error={errors.studentNumber}>
          <Input value={form.studentNumber} onChange={(e) => set("studentNumber", e.target.value)} autoFocus />
        </Field>
        <Field label="Last name *" error={errors.lastname}>
          <Input value={form.lastname} onChange={(e) => set("lastname", e.target.value)} />
        </Field>
        <Field label="First name *" error={errors.firstname}>
          <Input value={form.firstname} onChange={(e) => set("firstname", e.target.value)} />
        </Field>
        <Field label="Middle initial">
          <Input value={form.middleInitial} maxLength={3} onChange={(e) => set("middleInitial", e.target.value)} />
        </Field>
        <Field label="Gender *" error={errors.gender}>
          <NativeSelect value={form.gender} onChange={(e) => set("gender", e.target.value)}>
            <NativeSelectOption value="">Select</NativeSelectOption>
            {GENDERS.map((g) => (
              <NativeSelectOption key={g} value={g}>{g}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Course">
          <Input value={form.course} placeholder="e.g. BSIT" onChange={(e) => set("course", e.target.value)} />
        </Field>
        <Field label="Year">
          <NativeSelect value={form.year} onChange={(e) => set("year", e.target.value)}>
            <NativeSelectOption value="">Select</NativeSelectOption>
            {YEARS.map((y) => (
              <NativeSelectOption key={y} value={y}>{y}</NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          The student creates their own account by scanning your enrollment QR code.
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Done</Button>
          <Button type="submit" disabled={saving}>{saving ? "Adding..." : "Add student"}</Button>
        </div>
      </div>
    </form>
  );
}
