import type { EvaluationFormData } from "@/types/evaluation";

export const SIGNED_COPY_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp";

export function isSignedCopyName(name: string) {
  return /\.(pdf|png|jpe?g|webp)$/i.test(name);
}

export const RATINGS = [
  { value: 5, label: "Excellent" },
  { value: 4, label: "Very Good" },
  { value: 3, label: "Good" },
  { value: 2, label: "Fair" },
  { value: 1, label: "Poor" },
];

/** Ang pinakamababang grade ng bawat band; walang band ang mas mababa sa 65 */
export const FINAL_BANDS = [
  { min: 95, range: "95% – 100%", text: "Results achieved far exceed the requirements of the job in all areas." },
  { min: 86, range: "86% – 94%", text: "Results achieved consistently exceed the requirements of the job." },
  { min: 75, range: "75% – 85%", text: "Satisfactory work is achieved as expected of a beginner." },
  { min: 65, range: "65% – 74%", text: "Performance does not meet the minimum requirements." },
];

export function bandFor(grade: number) {
  return FINAL_BANDS.find((b) => grade >= b.min) ?? null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function pointsOf(score: number | null, weight: number | null) {
  if (score === null) return 0;
  return weight === null ? score : round2((score * weight) / 100);
}

/** Pareho ang kuwenta sa server; dito para makita agad habang nagta-type */
export function totalsOf(form: EvaluationFormData) {
  const sum = round2(form.criteria.reduce((total, c) => total + pointsOf(c.score, c.weight), 0));
  if (form.key === "MIDTERM_EVALUATION") {
    const max = form.criteria.length * 5;
    return { total: sum, max, percent: max === 0 ? 0 : round2((sum / max) * 100) };
  }
  return { total: sum, max: 100, percent: sum };
}

export function missingScores(form: EvaluationFormData) {
  return form.criteria.filter((c) => c.score === null).map((c) => c.name);
}

export function hasAnyScore(form: EvaluationFormData) {
  return form.criteria.some((c) => c.score !== null);
}

export function toUpdate(form: EvaluationFormData) {
  const scores: Record<string, number | null> = {};
  for (const c of form.criteria) scores[String(c.id)] = c.score;
  return {
    scores,
    strongPoints: form.strongPoints,
    needsImprovement: form.needsImprovement,
    discussed: form.discussed,
    supervisorName: form.supervisorName,
    supervisorPosition: form.supervisorPosition,
    date: form.date,
    periodFrom: form.periodFrom,
    periodTo: form.periodTo,
    contactNo: form.contactNo,
  };
}
