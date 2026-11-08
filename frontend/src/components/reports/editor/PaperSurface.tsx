import { useEffect, useRef, useState, type ReactNode } from "react";

export type Zoom = "fit" | number;

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

interface PaperSurfaceProps {
  paperWidth: number;
  zoom: Zoom;
  onZoom: (z: number) => void;
  /** Puwang sa gilid ng papel para sa mga control ng row (sa labas ng papel) */
  gutter: number;
  /** Mga control na hindi naka-scale; nakaposisyon sa parehong lugar ng mga row */
  overlay?: ReactNode;
  /** Ibinabalik ang kasalukuyang scale (para sa label ng zoom) */
  onScale?: (scale: number) => void;
  children: ReactNode;
}

const clamp = (n: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, n));

/**
 * Ang lugar ng papel: sa screen lang naka-scale (zoom), hindi kailanman sa print o PDF.
 * Pahalang lang ang scroll dito; ang patayong pag-swipe (isang daliri) ay napupunta sa page.
 * Dalawang daliri: pinch para sa zoom ng papel lang.
 */
export function PaperSurface({ paperWidth, zoom, onZoom, gutter, overlay, onScale, children }: PaperSurfaceProps) {
  const outer = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const zoomRef = useRef(onZoom);
  const scaleRef = useRef(1);

  const fit = avail > 0 ? Math.min(1.5, Math.max(MIN_ZOOM, (avail - gutter * 2) / paperWidth)) : 0.5;
  const scale = zoom === "fit" ? fit : clamp(zoom);

  useEffect(() => {
    zoomRef.current = onZoom;
    scaleRef.current = scale;
    onScale?.(scale);
  });

  useEffect(() => {
    const o = outer.current;
    const c = content.current;
    if (!o || !c) return;
    const ro = new ResizeObserver(() => {
      setAvail(o.clientWidth);
      setContentHeight(c.offsetHeight);
    });
    ro.observe(o);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  // Pinch: dalawang daliri lang; ang isang daliri ay normal na scroll (hindi hinaharang)
  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    let start: { dist: number; scale: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 2) start = { dist: dist(e.touches), scale: scaleRef.current };
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && start && start.dist > 0) {
        zoomRef.current(clamp(start.scale * (dist(e.touches) / start.dist)));
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) start = null;
    };
    o.addEventListener("touchstart", onStart, { passive: true });
    o.addEventListener("touchmove", onMove, { passive: true });
    o.addEventListener("touchend", onEnd, { passive: true });
    o.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      o.removeEventListener("touchstart", onStart);
      o.removeEventListener("touchmove", onMove);
      o.removeEventListener("touchend", onEnd);
      o.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const pad = 16;
  return (
    <div
      ref={outer}
      className="w-full overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-xl bg-zinc-200 dark:bg-zinc-800"
      style={{ touchAction: "pan-x pan-y" }}
    >
      <div
        style={{ position: "relative", width: paperWidth * scale + gutter * 2, height: contentHeight * scale + pad * 2, margin: "0 auto" }}
      >
        <div
          ref={content}
          style={{ position: "absolute", left: gutter, top: pad, width: paperWidth, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
        {overlay}
      </div>
    </div>
  );
}
