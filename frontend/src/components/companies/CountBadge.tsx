/** Maliit na bilog na may bilang (para sa tab at sidebar). Walang lalabas kapag 0. */
export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} pending`}
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold leading-none text-white ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
