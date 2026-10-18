import api from "@/lib/api";
import { notify } from "@/lib/notify";

export interface BulkResult {
  updated: number;
  skipped: number;
  reasons: string[];
}

/** Nagpapadala ng bulk na aksyon at nagpapakita ng toast na may bilang ng na-update at nilaktawan */
export async function postBulk(path: string, body: object, what: string) {
  const res = await api.post<BulkResult>(`/coordinator/bulk/${path}`, body);
  const r = res.data;

  const students = r.updated === 1 ? "1 student" : `${r.updated} students`;
  let text = `${what} for ${students}.`;
  if (r.skipped > 0) text += ` ${r.skipped} skipped (${r.reasons.join(", ")}).`;

  if (r.updated > 0) notify.success(text);
  else notify.error(text);

  return r;
}
