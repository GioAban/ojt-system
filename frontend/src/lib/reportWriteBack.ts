// Pagsulat ng mga pagbabago mula sa Edit mode sa tunay na record. Tinitingnan muna (preview), saka isinusulat
// lahat o wala kapag kinumpirma. Ang server ang huling nagpapasya at naglalagay ng audit.

import api from "@/lib/api";
import type { PendingChange, ReportSource } from "@/types/reports";

export interface ApplyPreviewRow {
  /** Ang key ng pagbabago (para maipakita ang error sa tamang cell) */
  key: string | null;
  who: string;
  field: string;
  oldValue: string;
  newValue: string;
  affected: number;
  problem: string | null;
}

const toChange = (c: PendingChange) => ({
  key: c.key, target: c.target, id: c.id, field: c.field, value: c.value, expectedOld: c.expectedOld, refId: c.refId,
});

export async function previewApply(reportId: number, changes: PendingChange[]) {
  const res = await api.post<{ rows: ApplyPreviewRow[]; ok: boolean }>(
    `/coordinator/reports/saved/${reportId}/apply/preview`, { changes: changes.map(toChange) });
  return res.data;
}

export type ApplyOutcome = { kind: "done"; source: ReportSource } | { kind: "blocked"; rows: ApplyPreviewRow[] };

export async function commitApply(reportId: number, changes: PendingChange[]): Promise<ApplyOutcome> {
  try {
    const res = await api.post<{ source: ReportSource }>(
      `/coordinator/reports/saved/${reportId}/apply`, { changes: changes.map(toChange) });
    return { kind: "done", source: res.data.source };
  } catch (err) {
    const r = (err as { response?: { status?: number; data?: { rows?: ApplyPreviewRow[] } } }).response;
    if (r?.status === 409 && r.data?.rows) return { kind: "blocked", rows: r.data.rows };
    throw err;
  }
}

/** key -> mensahe ng problema, para sa mga cell */
export const problemsByKey = (rows: ApplyPreviewRow[]) =>
  Object.fromEntries(rows.filter((r) => r.key && r.problem).map((r) => [r.key as string, r.problem as string]));
