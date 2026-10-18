import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EditableCell } from "@/components/tracking/EditableCell";
import { validEmail } from "@/lib/students";

interface Props {
  value: string | null;
  /** Pangalan ng student para sa mensahe ng kumpirmasyon */
  name: string;
  onSave: (email: string) => Promise<void>;
}

interface Pending {
  value: string;
  resolve: () => void;
  reject: (e: Error) => void;
}

/** Email cell na may kumpirmasyon bago ma-save ang pagbabago */
export function ConfirmedEmailCell({ value, name, onSave }: Props) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [saving, setSaving] = useState(false);

  function request(input: string) {
    const next = input.trim().toLowerCase();
    if (next === (value ?? "").trim().toLowerCase()) return Promise.resolve();
    return new Promise<void>((resolve, reject) => setPending({ value: next, resolve, reject }));
  }

  async function confirm() {
    if (!pending) return;
    const current = pending;
    setSaving(true);
    try {
      await onSave(current.value);
      current.resolve();
    } catch (err) {
      current.reject(err instanceof Error ? err : new Error("Couldn't update the email."));
    } finally {
      setSaving(false);
      setPending(null);
    }
  }

  function cancel() {
    pending?.reject(new Error("Email not changed."));
    setPending(null);
  }

  return (
    <>
      <EditableCell value={value} label="Email" maxLength={255} validate={validEmail} onSave={request} />
      <ConfirmDialog
        open={pending !== null}
        title="Change this email?"
        description={
          pending
            ? `${name}'s login email changes from ${value ?? "(none)"} to ${pending.value}. Their password stays the same, and they must use the new email to log in.`
            : ""
        }
        confirmLabel="Change email"
        loading={saving}
        onConfirm={() => void confirm()}
        onCancel={cancel}
      />
    </>
  );
}
