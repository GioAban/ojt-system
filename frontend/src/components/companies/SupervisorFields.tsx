import { ShieldCheck } from "lucide-react";
import { SUPERVISOR_PRIVACY_NOTE } from "@/lib/privacy";
import type { SupervisorErrors, SupervisorValue } from "@/lib/company";
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
}: SupervisorFieldsProps) {
  return (
    <section className="flex flex-col gap-4 border-t pt-5">
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
        <Field label="Full name" htmlFor={`${idPrefix}-name`} error={errors.name}>
          <Input
            id={`${idPrefix}-name`}
            maxLength={255}
            aria-invalid={Boolean(errors.name)}
            value={value.name}
            onChange={(e) => onChange("name", e.target.value)}
          />
        </Field>

        <Field label="Position" htmlFor={`${idPrefix}-pos`} error={errors.position}>
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
          error={errors.contact}
        >
          <Input
            id={`${idPrefix}-contact`}
            inputMode="tel"
            maxLength={20}
            aria-invalid={Boolean(errors.contact)}
            value={value.contact}
            onChange={(e) => onChange("contact", e.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor={`${idPrefix}-email`} error={errors.email}>
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
