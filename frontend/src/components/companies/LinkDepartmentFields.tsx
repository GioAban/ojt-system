import { useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import type { LinkDepartmentForm } from "@/types/companyRequest";
import { cn } from "@/lib/utils";
import { CONTACT_HINT, CONTACT_MAX } from "@/lib/company";
import { Field } from "@/components/companies/parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  index: number;
  /** Walang department ang company: N/A (walang pangalan) */
  na: boolean;
  value: LinkDepartmentForm;
  errors: Record<string, string>;
  onChange: (patch: Partial<LinkDepartmentForm>) => void;
  onRemove?: () => void;
  /**
   * Review ng coordinator lang: kontrol ng MOA file (MoaFilesController). Kapag may laman ito, lumalabas ang
   * opsyonal na MOA section (file, simula at pagtatapos). Ang public na form ay walang MOA.
   */
  moaSlot?: ReactNode;
}

/**
 * Isang department (o ang N/A) sa form ng company link: pangalan, slots, opsyonal na supervisor ng department,
 * at (sa review ng coordinator lang) opsyonal na MOA. Walang larawan, walang file mula sa company, walang account.
 */
export function LinkDepartmentFields({ index, na, value, errors, onChange, onRemove, moaSlot }: Props) {
  const at = (k: string) => errors[`departments[${index}].${k}`];
  const id = (k: string) => `dept-${index}-${k}`;
  const supError = at("supervisorName") || at("supervisorPosition") || at("supervisorContactNumber") || at("supervisorEmail");
  const moaError = at("moaStart") || at("moaExpiration");
  const supFilled = Boolean(value.supervisorFullname || value.supervisorPosition || value.supervisorContactNumber || value.supervisorEmail);
  const moaFilled = Boolean(value.moaStart || value.moaExpiration);
  const [supOpen, setSupOpen] = useState(supFilled);
  const [moaOpen, setMoaOpen] = useState(moaFilled);

  // Bumubukas kapag may error sa loob para makita agad
  const showSup = supOpen || Boolean(supError);
  const showMoa = moaOpen || Boolean(moaError);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4" data-dept={index}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{na ? "N/A (no departments)" : `Department ${index + 1}`}</p>
        {onRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove department ${index + 1}`}>
            <X className="h-4 w-4" /> Remove
          </Button>
        )}
      </div>

      <div className={cn("grid gap-3", !na && "grid-cols-[1fr_6rem]")}>
        {!na && (
          <Field label="Department name" htmlFor={id("name")} required error={at("name")}>
            <Input id={id("name")} value={value.name} maxLength={255} placeholder="e.g. IT Department"
              aria-invalid={Boolean(at("name"))} onChange={(e) => onChange({ name: e.target.value })} />
          </Field>
        )}
        <Field label={na ? "How many trainees can you accept?" : "Slots"} htmlFor={id("slots")} required error={at("slots")}>
          <Input id={id("slots")} inputMode="numeric" value={value.slots} className={na ? "sm:max-w-32" : undefined}
            aria-invalid={Boolean(at("slots"))} onChange={(e) => onChange({ slots: e.target.value.replace(/\D/g, "").slice(0, 3) })} />
        </Field>
      </div>

      {/* Supervisor ng department: opsyonal. Ang N/A ay walang sariling supervisor (ang immediate supervisor ang gamit). */}
      {na ? (
        <p className="text-xs text-muted-foreground">Trainees will use the immediate supervisor above.</p>
      ) : (
      <div className="rounded-lg border">
        <button type="button" onClick={() => setSupOpen((v) => !v)} aria-expanded={showSup}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm pointer-coarse:py-3">
          <span>
            <span className="font-medium">Department supervisor</span>{" "}
            <span className="text-muted-foreground">(optional)</span>
            {supFilled && !showSup && <span className="ml-1 text-muted-foreground">· {value.supervisorFullname || "added"}</span>}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", showSup && "rotate-180")} />
        </button>
        {showSup && (
          <div className="flex flex-col gap-3 border-t p-3">
            <p className="text-xs text-muted-foreground">
              Leave blank to use the company&apos;s immediate supervisor. If you enter a name, enter the position too.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" htmlFor={id("supName")} error={at("supervisorName")}>
                <Input id={id("supName")} value={value.supervisorFullname} maxLength={255} aria-invalid={Boolean(at("supervisorName"))}
                  onChange={(e) => onChange({ supervisorFullname: e.target.value })} />
              </Field>
              <Field label="Position" htmlFor={id("supPos")} error={at("supervisorPosition")}>
                <Input id={id("supPos")} value={value.supervisorPosition} maxLength={255} aria-invalid={Boolean(at("supervisorPosition"))}
                  onChange={(e) => onChange({ supervisorPosition: e.target.value })} />
              </Field>
              <Field label="Contact number" htmlFor={id("supPhone")} error={at("supervisorContactNumber")} hint={CONTACT_HINT}>
                <Input id={id("supPhone")} value={value.supervisorContactNumber} maxLength={CONTACT_MAX}
                  aria-invalid={Boolean(at("supervisorContactNumber"))} onChange={(e) => onChange({ supervisorContactNumber: e.target.value })} />
              </Field>
              <Field label="Email" htmlFor={id("supEmail")} error={at("supervisorEmail")}>
                <Input id={id("supEmail")} type="email" inputMode="email" value={value.supervisorEmail} maxLength={255}
                  aria-invalid={Boolean(at("supervisorEmail"))} onChange={(e) => onChange({ supervisorEmail: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </div>
      )}

      {/* MOA: opsyonal, sa review ng coordinator lang */}
      {moaSlot !== undefined && (
      <div className="rounded-lg border">
        <button type="button" onClick={() => setMoaOpen((v) => !v)} aria-expanded={showMoa}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm pointer-coarse:py-3">
          <span>
            <span className="font-medium">MOA</span> <span className="text-muted-foreground">(optional)</span>
            {moaFilled && !showMoa && <span className="ml-1 text-muted-foreground">· dates set</span>}
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", showMoa && "rotate-180")} />
        </button>
        {showMoa && (
          <div className="flex flex-col gap-3 border-t p-3">
            {moaSlot}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date" htmlFor={id("moaStart")} error={at("moaStart")}>
                <Input id={id("moaStart")} type="date" min="2000-01-01" max="2100-12-31" value={value.moaStart}
                  aria-invalid={Boolean(at("moaStart"))} onChange={(e) => onChange({ moaStart: e.target.value })} />
              </Field>
              <Field label="Expiration date" htmlFor={id("moaEnd")} error={at("moaExpiration")}>
                <Input id={id("moaEnd")} type="date" min={value.moaStart || "2000-01-01"} max="2100-12-31" value={value.moaExpiration}
                  aria-invalid={Boolean(at("moaExpiration"))} onChange={(e) => onChange({ moaExpiration: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
