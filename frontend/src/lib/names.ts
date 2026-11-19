/**
 * Parehong tuntunin ng server (RegistrationService.name): trim, isang espasyo lang, at kapag puro
 * maliit o puro malaking titik ang tinype ay ginagawang "Juan Dela Cruz". Ang may halong laki ay iniiwan.
 */
export function tidyName(raw: string): string {
  const v = raw.trim().replace(/\s+/g, " ");
  if (!v) return v;
  const allLower = v === v.toLowerCase();
  const allUpper = v === v.toUpperCase();
  if (!allLower && !allUpper) return v;
  let out = "";
  let start = true;
  for (const ch of v.toLowerCase()) {
    out += start ? ch.toUpperCase() : ch;
    start = ch === " " || ch === "-" || ch === "'";
  }
  return out;
}

/** Isang letra, malaking titik (walang tuldok) */
export function tidyInitial(raw: string): string {
  return raw.replace(/[^A-Za-zÑñ]/g, "").slice(0, 1).toUpperCase();
}
