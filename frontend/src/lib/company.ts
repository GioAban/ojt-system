import { parseIsoDate, todayIso } from "@/lib/dates";

export const PHONE_PATTERN = /^[0-9+()\-\s]{7,20}$/;
export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type MoaState = "none" | "expired" | "soon" | "valid";

/** Kalagayan ng MOA: expired, malapit nang mag-expire (30 araw), o valid pa */
export function moaState(expiration: string | null): MoaState {
  if (!expiration) return "none";

  const end = parseIsoDate(expiration.slice(0, 10));
  if (Number.isNaN(end.getTime())) return "none";

  const today = parseIsoDate(todayIso());
  const days = Math.round((end.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "valid";
}

export function isApproved(status: string) {
  return status.trim().toUpperCase() === "APPROVED";
}
