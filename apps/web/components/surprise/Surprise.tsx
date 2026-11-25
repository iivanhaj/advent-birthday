"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * The 28th's present. The picture itself arrives from /api/surprise (it's
 * encrypted until the day), as two SVGs: a big one for screens and a tall one
 * for phones, each with a lid. Lift the lid and the pieces drop in one by one;
 * then either version can be saved as a PNG: the tall one is sized for a
 * phone's lock screen.
 */

type Payload = { fonts: string; big: string; phone: string };
const SIZES = { big: [1920, 1200], phone: [1170, 2532] } as const;

/** Adds the fonts, and optionally takes the lid off, so the SVG can be drawn on its own. */
function finished(svg: string, fonts: string, lid: boolean) {
  const doc = new DOMParser().parseFromString(svg.replace("<style>", `<style>${fonts}`), "image/svg+xml");
  if (!lid) doc.querySelectorAll("[data-lid]").forEach((n) => n.remove());
  return new XMLSerializer().serializeToString(doc);
}

async function savePng(svg: string, [w, h]: readonly [number, number], name: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // the embedded fonts finish loading inside the image a moment after it decodes
    await new Promise((r) => setTimeout(r, 300));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Surprise() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tall, setTall] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/surprise")
      .then(async (r) => (r.ok ? setPayload(await r.json()) : setProblem((await r.json()).error ?? "Not yet.")))
      .catch(() => setProblem("Couldn't reach it. Try again in a moment."));
    const mq = matchMedia("(max-aspect-ratio: 9/10)");
    const update = () => setTall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const shown = useMemo(() => (payload ? finished(tall ? payload.phone : payload.big, payload.fonts, true) : ""), [payload, tall]);

  // number the pieces so each drops in after the one before
  useEffect(() => {
    stage.current?.querySelectorAll<SVGGElement>("[data-step]").forEach((g) => g.style.setProperty("--i", g.dataset.step ?? "0"));
  }, [shown]);

  async function save(kind: "phone" | "big") {
    if (!payload) return;
    setSaving(kind);
    await savePng(finished(payload[kind], payload.fonts, false), SIZES[kind], kind === "phone" ? "happy-birthday-jae-lock-screen.png" : "happy-birthday-jae.png");
    setSaving(null);
  }

  if (problem) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#6b1d2c] px-6 text-center text-[#f7eedf]">
        <p className="font-serif text-4xl italic">Not yet.</p>
        <p className="font-sans text-sm opacity-80">{problem === "Not yet." ? "This one opens on the 28th." : problem}</p>
      </div>
    );
  }

  return (
    <div className={`surprise relative h-dvh w-full overflow-hidden bg-[#6b1d2c] ${open ? "is-open" : ""}`}>
      {!payload && <p className="absolute inset-0 grid place-items-center font-serif text-2xl text-[#f7eedf] italic opacity-80">one moment…</p>}
      <div ref={stage} className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: shown }} />
      {payload && !open && <button type="button" className="absolute inset-0 cursor-pointer" aria-label="Lift the lid" onClick={() => setOpen(true)} />}
      {open && (
        <div className="surprise-actions absolute inset-x-0 top-4 flex flex-wrap justify-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:justify-end">
          <button type="button" onClick={() => save("phone")} className="rounded-full bg-[#f7eedf] px-5 py-2.5 font-sans text-xs font-medium tracking-[0.14em] text-[#6b1d2c] uppercase shadow-lg">
            {saving === "phone" ? "Saving…" : "Save as my lock screen"}
          </button>
          <button type="button" onClick={() => save("big")} className="rounded-full border border-[#f7eedf]/70 px-5 py-2.5 font-sans text-xs font-medium tracking-[0.14em] text-[#f7eedf] uppercase">
            {saving === "big" ? "Saving…" : "Save the big one"}
          </button>
        </div>
      )}
    </div>
  );
}
