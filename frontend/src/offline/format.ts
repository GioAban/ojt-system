/** Maikling oras: "5:20 PM" kung ngayong araw, kung hindi "Nov 17, 5:20 PM" */
export function formatWhen(ms: number | null) {
  if (!ms) return "";
  const d = new Date(ms);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
