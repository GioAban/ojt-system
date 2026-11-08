import { useState } from "react";
import { cn } from "@/lib/utils";
import { FINAL_BANDS, RATINGS, bandFor, pointsOf, totalsOf } from "@/lib/evaluationForm";
import type { EvaluationCriterion, EvaluationFormData } from "@/types/evaluation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: EvaluationFormData;
  onChange: (next: EvaluationFormData) => void;
  readOnly: boolean;
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}

interface RatingRowProps {
  criterion: EvaluationCriterion;
  index: number;
  readOnly: boolean;
  onScore: (score: number | null) => void;
}

/** Midterm: limang malalaking button. Kapag pinindot ulit ang napili, mabubura ito. */
function RatingRow({ criterion, index, readOnly, onScore }: RatingRowProps) {
  return (
    <li className="flex flex-col gap-2 border-b py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 text-sm">
        {index}. {criterion.name}
      </span>
      <div role="group" aria-label={criterion.name} className="grid shrink-0 grid-cols-5 gap-1.5 sm:w-64">
        {RATINGS.map((r) => {
          const active = criterion.score === r.value;
          return (
            <button
              key={r.value}
              type="button"
              disabled={readOnly}
              aria-pressed={active}
              aria-label={`${r.value} ${r.label}`}
              title={r.label}
              onClick={() => onScore(active ? null : r.value)}
              className={cn(
                "h-11 rounded-lg border text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                readOnly && !active && "opacity-50",
                readOnly && "cursor-not-allowed hover:bg-background",
                readOnly && active && "hover:bg-primary",
              )}
            >
              {r.value}
            </button>
          );
        })}
      </div>
    </li>
  );
}

interface GradeRowProps {
  criterion: EvaluationCriterion;
  index: number;
  readOnly: boolean;
  onScore: (score: number | null) => void;
}

/** Final: grade na 0 hanggang 100. May sariling teksto para magawang i-type ang "90." at iba pa. */
function GradeRow({ criterion, index, readOnly, onScore }: GradeRowProps) {
  const shown = criterion.score === null ? "" : String(criterion.score);
  const [text, setText] = useState(shown);
  const [prevShown, setPrevShown] = useState(shown);
  if (prevShown !== shown) {
    setPrevShown(shown);
    if (text === "" || Number(text) !== criterion.score) setText(shown);
  }

  const parsed = text.trim() === "" ? null : Number(text);
  const invalid = parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100 || !/^\d+(\.\d{0,2})?$/.test(text.trim()));

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_5.5rem_4rem] items-center gap-2 border-b py-2.5 last:border-b-0">
      <label htmlFor={`grade-${criterion.id}`} className="min-w-0 text-sm">
        {index}. {criterion.name} <span className="text-muted-foreground">({criterion.weight}%)</span>
      </label>
      <Input
        id={`grade-${criterion.id}`}
        inputMode="decimal"
        disabled={readOnly}
        aria-invalid={invalid}
        value={text}
        placeholder="0–100"
        className="h-11 text-center"
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const n = next.trim() === "" ? null : Number(next);
          if (n === null) onScore(null);
          else if (Number.isFinite(n) && n >= 0 && n <= 100 && /^\d+(\.\d{0,2})?$/.test(next.trim())) onScore(n);
        }}
      />
      <span className="text-right text-sm tabular-nums text-muted-foreground">
        {pointsOf(criterion.score, criterion.weight).toFixed(2)}
      </span>
      {invalid && (
        <p role="alert" className="col-span-3 text-xs text-destructive">
          Enter a grade from 0 to 100, with up to 2 decimals. This value isn't saved.
        </p>
      )}
    </li>
  );
}

/** Ang form na kapareho ng papel: ginagamit ng student at ng coordinator */
export function EvaluationForm({ value, onChange, readOnly }: Props) {
  const midterm = value.key === "MIDTERM_EVALUATION";
  const totals = totalsOf(value);
  const band = midterm ? null : bandFor(totals.total);

  function set(patch: Partial<EvaluationFormData>) {
    onChange({ ...value, ...patch });
  }

  function setScore(id: number, score: number | null) {
    onChange({
      ...value,
      criteria: value.criteria.map((c) => (c.id === id ? { ...c, score } : c)),
    });
  }

  const categories = [...new Set(value.criteria.map((c) => c.category ?? ""))];

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h2 className="text-sm font-bold tracking-wide">
          {midterm ? "EVALUATION SHEET FOR STUDENT TRAINEE" : "INTERNSHIP/PRACTICUM PERFORMANCE APPRAISAL"}
        </h2>
        {value.info.semester && <p className="mt-1 text-xs text-muted-foreground">{value.info.semester}</p>}
      </header>

      <dl className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
        <InfoRow label={midterm ? "Name of OJT Student" : "Name of Trainee"} value={value.info.studentName} />
        <InfoRow label="Course" value={value.info.course} />
        <InfoRow label={midterm ? "Company Name" : "Name of Company/Office"} value={value.info.companyName} />
        <InfoRow label="Department Assigned" value={value.info.department} />
        <InfoRow label={midterm ? "Company Address" : "Address"} value={value.info.companyAddress} />
      </dl>

      {!midterm && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-from">Period of Training: From</Label>
            <Input
              id="eval-from"
              type="date"
              disabled={readOnly}
              value={value.periodFrom ?? ""}
              onChange={(e) => set({ periodFrom: e.target.value || null })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-to">To</Label>
            <Input
              id="eval-to"
              type="date"
              disabled={readOnly}
              value={value.periodTo ?? ""}
              onChange={(e) => set({ periodTo: e.target.value || null })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-contact">
              Contact No. <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="eval-contact"
              maxLength={255}
              disabled={readOnly}
              value={value.contactNo ?? ""}
              onChange={(e) => set({ contactNo: e.target.value })}
            />
          </div>
        </div>
      )}

      <section>
        <p className="mb-2 text-sm text-muted-foreground">
          {midterm
            ? "Please rate and evaluate the student based on the given areas. Encircle the numeric value."
            : "Please indicate the numerical grade for each criterion."}
        </p>
        {midterm && (
          <p className="mb-3 text-xs text-muted-foreground">
            {RATINGS.map((r) => `${r.value} ${r.label}`).join(" · ")}
          </p>
        )}

        {categories.map((category) => {
          const rows = value.criteria.filter((c) => (c.category ?? "") === category);
          return (
            <div key={category} className="mb-4">
              {category && <h3 className="text-sm font-semibold">{category}</h3>}
              {!midterm && (
                <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_4rem] gap-2 border-b pb-1 text-xs text-muted-foreground">
                  <span>Criterion (weight)</span>
                  <span className="text-center">Grade %</span>
                  <span className="text-right">Points</span>
                </div>
              )}
              <ol>
                {rows.map((c, i) =>
                  midterm ? (
                    <RatingRow
                      key={c.id}
                      criterion={c}
                      index={i + 1}
                      readOnly={readOnly}
                      onScore={(score) => setScore(c.id, score)}
                    />
                  ) : (
                    <GradeRow
                      key={c.id}
                      criterion={c}
                      index={i + 1}
                      readOnly={readOnly}
                      onScore={(score) => setScore(c.id, score)}
                    />
                  ),
                )}
              </ol>
            </div>
          );
        })}
      </section>

      <section aria-label="Total" aria-live="polite" className="rounded-lg border bg-muted/30 p-4">
        {midterm ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="text-sm font-semibold">Total</p>
            <p className="text-lg font-semibold tabular-nums">
              {totals.total} / {totals.max}
              <span className="ml-3 text-sm font-medium text-muted-foreground">{totals.percent.toFixed(2)}%</span>
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-6">
              <p className="text-sm font-semibold">Final grade</p>
              <p className="text-lg font-semibold tabular-nums">{totals.total.toFixed(2)}%</p>
            </div>
            <ul className="mt-3 flex flex-col gap-1">
              {FINAL_BANDS.map((b) => (
                <li
                  key={b.min}
                  aria-current={band?.min === b.min ? "true" : undefined}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-xs",
                    band?.min === b.min
                      ? "border-primary bg-primary/10 font-medium text-foreground"
                      : "border-transparent text-muted-foreground",
                  )}
                >
                  <span className="font-semibold">{b.range}:</span> {b.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {midterm && (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-strong">Describe the student's strong points:</Label>
            <Textarea
              id="eval-strong"
              rows={3}
              maxLength={5000}
              disabled={readOnly}
              value={value.strongPoints ?? ""}
              onChange={(e) => set({ strongPoints: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-improve">Describe the student's areas that need improvements:</Label>
            <Textarea
              id="eval-improve"
              rows={3}
              maxLength={5000}
              disabled={readOnly}
              value={value.needsImprovement ?? ""}
              onChange={(e) => set({ needsImprovement: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">This report has been discussed with the student:</span>
            <div role="group" aria-label="Discussed with the student" className="grid w-40 grid-cols-2 gap-1.5">
              {[true, false].map((option) => (
                <button
                  key={String(option)}
                  type="button"
                  disabled={readOnly}
                  aria-pressed={value.discussed === option}
                  onClick={() => set({ discussed: option })}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    value.discussed === option ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                    readOnly && "cursor-not-allowed opacity-70",
                  )}
                >
                  {option ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">{midterm ? "Supervisor" : "Certified True and Correct"}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-supervisor">Name</Label>
            <Input
              id="eval-supervisor"
              maxLength={255}
              disabled={readOnly}
              value={value.supervisorName ?? ""}
              onChange={(e) => set({ supervisorName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-position">Position</Label>
            <Input
              id="eval-position"
              maxLength={255}
              disabled={readOnly}
              value={value.supervisorPosition ?? ""}
              onChange={(e) => set({ supervisorPosition: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="eval-date">Date</Label>
            <Input
              id="eval-date"
              type="date"
              disabled={readOnly}
              value={value.date ?? ""}
              onChange={(e) => set({ date: e.target.value || null })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">The signature is on the uploaded signed copy.</p>
      </section>
    </div>
  );
}
