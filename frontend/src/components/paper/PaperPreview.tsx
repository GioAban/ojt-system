import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Kunwari ay papel: kumikipot ang laki para magkasya sa screen, may hangganan at anino ang bawat pahina.
 * paperWidth = lapad ng papel sa px (816 = 8.5 in na patayo; 1248 = 13 in na pahiga).
 */
export function PaperPreview({ children, paperWidth = 816 }: { children: ReactNode; paperWidth?: number }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const s = Math.min(1, (outer.current.clientWidth - 24) / paperWidth);
      const next = s > 0 ? s : 1;
      setScale(next);
      setHeight(inner.current.offsetHeight * next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [paperWidth]);

  return (
    <div ref={outer} className="overflow-hidden rounded-lg bg-zinc-200 p-3 dark:bg-zinc-800">
      <div style={{ height }}>
        <div ref={inner} style={{ width: paperWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
