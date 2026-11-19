import { ShieldCheck } from "lucide-react";
import { SUPERVISOR_PRIVACY_NOTE } from "@/lib/privacy";
import { CONTACT_HINT, CONTACT_MAX, type SupervisorErrors, type SupervisorValue } from "@/lib/company";
import { Field } from "@/components/companies/parts";
import { Input } from "@/components/ui/input";

interface SupervisorFieldsProps {
  /** Para sa id ng mga input, hal. "co-sup" */
  idPrefix: string;
  title: string;
  description: string;
  value: SupervisorValue;
  errors: SupervisorErrors;
  onChange: (key: keyof SupervisorValue, value: string) => void;
  /** Kailangan lahat (immediate supervisor ng company): may asterisk */
  required?: boolean;
  /** Walang guhit at padding sa itaas (kapag nasa sariling section na) */
  bare?: boolean;
}

/**
 * Pinagsasaluhang section ng supervisor (pangalan, posisyon, contact, email) para sa
 * company form, department form at sa request ng student. Lahat opsyonal; may maikling privacy note.
 */
export function SupervisorFields({
  idPrefix,
  title,
  description,
  value,
  errors,
  onChange,
  required = false,
  bare = false,
}: SupervisorFieldsProps) {
  return (
    <section className={bare ? "flex flex-col gap-4" : "flex flex-col gap-4 border-t pt-5"}>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
        <p className="inline-flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            {SUPERVISOR_PRIVACY_NOTE}{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Privacy Notice
            </a>
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor={`${idPrefix}-name`} required={required} error={errors.name}>
          <Input
            id={`${idPrefix}-name`}
            maxLength={255}
            aria-invalid={Boolean(errors.name)}
            value={value.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </Field>

        <Field label="Position" htmlFor={`${idPrefix}-pos`} required={required} error={errors.position}>
          <Input
            id={`${idPrefix}-pos`}
            maxLength={255}
            aria-invalid={Boolean(errors.position)}
            value={value.position}
            onChange={(e) => onChange("position", e.target.value)}
          />
        </Field>

        <Field
          label="Contact number"
          htmlFor={`${idPrefix}-contact`}
          required={required}
          error={errors.contact}
          hint={CONTACT_HINT}
        >
          <Input
            id={`${idPrefix}-contact`}
            maxLength={CONTACT_MAX}
            aria-invalid={Boolean(errors.contact)}
            value={value.contact}
            onChange={(e) => onChange("contact", e.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor={`${idPrefix}-email`} required={required} error={errors.email}>
          <Input
            id={`${idPrefix}-email`}
            type="email"
            maxLength={255}
            aria-invalid={Boolean(errors.email)}
            value={value.email}
            onChange={(e) => onChange("email", e.target.value)}
          />
        </Field>
      </div>
    </section>
  );
}
