"use client";

import { useEffect, useMemo, useRef } from "react";
import { plan, render, type Theme } from "@/lib/records/paint.ts";
import type { Song } from "@/lib/records/songs";

/**
 * One painted record. The painting is drawn once per (birthday, song, theme)
 * into a canvas at device resolution; spinning is just a CSS rotation of that
 * canvas, so it costs nothing per frame. The glossy sheen is a separate layer
 * that does NOT rotate: on a real record the light stays put while the vinyl
 * turns under it, and that's what sells the spin.
 */
export function RecordDisc({ song, birthday, theme, size, angle = 0, className = "" }: { song: Song; birthday: string; theme: Theme; size: number; angle?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const p = useMemo(() => plan(birthday, song.id, theme), [birthday, song.id, theme]);
  const brushes = useMemo(() => ({ ...p, brushes: p.brushes.filter((b) => b.k !== "sheen") }), [p]);
  const shine = p.brushes.find((b) => b.k === "sheen");

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const px = Math.round(size * Math.min(2, devicePixelRatio || 1));
    cv.width = cv.height = px;
    const ctx = cv.getContext("2d");
    if (ctx) render(ctx, brushes, px, { title: song.title, sub: `${song.artist} · ${birthday.replace("-", " · ")}` });
  }, [brushes, size, song.title, song.artist, birthday]);

  return (
    <div className={`relative rounded-full ${className}`} style={{ width: size, height: size }}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full rounded-full" style={{ transform: `rotate(${angle}deg)` }} aria-hidden />
      {shine && shine.k === "sheen" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full mix-blend-screen"
          style={{
            background: `conic-gradient(from 56deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,${shine.a}) 18deg, rgba(255,255,255,0) 40deg, rgba(255,255,255,0) 180deg, rgba(255,255,255,${shine.a * 0.7}) 198deg, rgba(255,255,255,0) 220deg)`,
          }}
        />
      )}
    </div>
  );
}

/** Same painting, rendered big for the download button. */
export function recordPng(song: Song, birthday: string, theme: Theme, px = 3000): Promise<Blob | null> {
  const cv = document.createElement("canvas");
  cv.width = cv.height = px;
  const ctx = cv.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.fillStyle = "#FBF1EE";
  ctx.fillRect(0, 0, px, px);
  render(ctx, plan(birthday, song.id, theme), px, { title: song.title, sub: `${song.artist} · ${birthday.replace("-", " · ")}` });
  return new Promise((res) => cv.toBlob(res, "image/png"));
}
