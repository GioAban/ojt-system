import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Download, Link2, Share2 } from "lucide-react";
import api from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { EnrollmentLinkState } from "@/types/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = "/coordinator/student-management/enrollment";

interface Props {
  semesterId: number;
  state: EnrollmentLinkState | null;
  failed: boolean;
  onChange: (state: EnrollmentLinkState) => void;
}

function todayIso() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** "Also require my approval": switch na may maikling paliwanag */
function ApprovalSwitch({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="min-w-0 flex-1">
        <p id="approval-switch-label" className="text-sm font-medium">Also require my approval</p>
        <p id="approval-switch-hint" className="mt-0.5 text-xs text-muted-foreground">
          {checked
            ? "On: after a student verifies their email, you approve the account in Needs approval."
            : "Off: the account is created as soon as the student verifies their email. You can still revoke it."}{" "}
          Turning this on is recommended when the link is shared in public groups.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby="approval-switch-label"
        aria-describedby="approval-switch-hint"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 rounded-full bg-background shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

/** Registration link at QR ng coordinator para sa semester na ito: bukas/sarado, due date, at bilang ng nag-register */
export function EnrollmentLinkCard({ semesterId, state, failed, onChange }: Props) {
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const qrBox = useRef<HTMLDivElement>(null);

  // Habang hindi pa ginagalaw ng coordinator ang petsa, sundan ang galing sa server
  const dueValue = dueDate ?? state?.dueDate ?? "";
  const dueChanged = dueDate !== null && dueDate !== (state?.dueDate ?? "");

  async function save(next: { open?: boolean; due?: string; requireApproval?: boolean }, message: string) {
    setSaving(true);
    try {
      const res = await api.put<EnrollmentLinkState>(BASE, {
        semesterId,
        dueDate: (next.due ?? dueValue) || null,
        open: next.open ?? state?.open ?? true,
        requireApproval: next.requireApproval ?? null,
      });
      onChange(res.data);
      setDueDate(null);
      notify.success(message);
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't save the changes."));
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    setSaving(true);
    try {
      const res = await api.post<EnrollmentLinkState>(`${BASE}/regenerate`, null, { params: { semesterId } });
      onChange(res.data);
      setConfirmRegen(false);
      notify.success("New link created. The old link and QR no longer work.");
    } catch (err) {
      notify.error(getErrorMessage(err, "Couldn't create a new link."));
    } finally {
      setSaving(false);
    }
  }

  const url = state?.token ? `${window.location.origin}/join?token=${state.token}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      notify.success("Link copied.");
    } catch {
      notify.error("Couldn't copy. Select the link and copy it manually.");
    }
  }

  // Sa phone: share sheet (Messenger, SMS...). Kung wala, kopyahin na lang.
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function share() {
    try {
      await navigator.share({ title: "OJT student registration", text: "Register for your OJT account here:", url });
    } catch (err) {
      // Kinansela ng user: walang gagawin
      if (err instanceof DOMException && err.name === "AbortError") return;
      void copy();
    }
  }

  function downloadQr() {
    const svg = qrBox.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "registration-qr.svg";
    a.click();
    URL.revokeObjectURL(href);
  }

  if (!state) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        {failed ? "Couldn't load the registration link. Retrying..." : "Loading..."}
      </div>
    );
  }

  if (!state.exists) {
    return (
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Link2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Let your students register</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Create a link and QR code for this semester. Students fill in a short form, make their own password and
              verify their email. Their account is then created, and you can review or revoke it below.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Due date (optional)</span>
                <Input type="date" min={todayIso()} value={dueValue} onChange={(e) => setDueDate(e.target.value)} className="w-44" />
              </label>
              <Button type="button" disabled={saving} onClick={() => void save({ open: true }, "Registration link created.")}>
                {saving ? "Creating..." : "Create registration link"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const label = !state.open ? "Stopped" : state.active ? "Accepting registrations" : "Past due date";
  const pill = state.active
    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    : "bg-muted text-muted-foreground";

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div ref={qrBox} className={cn("rounded-xl border bg-white p-3", !state.active && "opacity-40")}>
            <QRCodeSVG value={url} size={148} level="M" />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={downloadQr}>
            <Download className="h-4 w-4" /> Download QR
          </Button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Registration link</h2>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", pill)}>{label}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant={state.open ? "outline" : "default"}
              disabled={saving}
              onClick={() =>
                void save({ open: !state.open }, state.open ? "Registration stopped. The link won't accept new students." : "Registration is open again.")
              }
            >
              {state.open ? "Stop accepting" : "Start accepting"}
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={url} aria-label="Registration link" onFocus={(e) => e.currentTarget.select()} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => void copy()}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
              {canShare && (
                <Button type="button" variant="outline" className="flex-1 sm:flex-none" onClick={() => void share()}>
                  <Share2 className="h-4 w-4" /> Share
                </Button>
              )}
            </div>
          </div>

          <ApprovalSwitch
            checked={state.requireApproval}
            disabled={saving}
            onChange={(on) =>
              void save(
                { requireApproval: on },
                on
                  ? "Approval turned on. Verified students will wait for you in Needs approval."
                  : "Approval turned off. Accounts are created once students verify their email.",
              )
            }
          />

          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Awaiting email", value: state.awaitingEmail ?? 0, tone: "" },
              { label: "Needs approval", value: state.pending, tone: state.pending > 0 ? "text-amber-600 dark:text-amber-400" : "" },
              { label: "Accounts", value: state.verified, tone: "" },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border bg-muted/30 px-2 py-1.5">
                <dt className="text-[11px] text-muted-foreground">{c.label}</dt>
                <dd className={cn("text-lg font-semibold tabular-nums", c.tone)}>{c.value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Due date</span>
              <Input type="date" min={todayIso()} value={dueValue} onChange={(e) => setDueDate(e.target.value)} className="w-44" />
            </label>
            {dueChanged && (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => void save({ due: dueValue }, dueValue ? "Due date saved." : "Due date removed.")}
                >
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setDueDate(null)}>
                  Cancel
                </Button>
              </>
            )}
            {!dueChanged && dueValue && (
              <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => void save({ due: "" }, "Due date removed.")}>
                Clear
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
            {!confirmRegen ? (
              <>
                <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => setConfirmRegen(true)}>
                  Create new link
                </Button>
                <span className="text-xs text-muted-foreground">Use this if the link was shared with the wrong people. The old link stops working.</span>
              </>
            ) : (
              <>
                <span>The old link and QR will stop working.</span>
                <Button type="button" size="sm" disabled={saving} onClick={() => void regenerate()}>Confirm</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRegen(false)}>Cancel</Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
