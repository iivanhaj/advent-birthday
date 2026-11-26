"use client";

import { RooftopRun } from "@/components/run/RooftopRun";

/** Door 9 · Mochi's rooftop run. */
export function RunPage({ today }: { today: string }) {
  const eyebrow = "font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70";
  return (
    <div className="min-h-dvh px-4 pt-28 pb-28 sm:px-10 sm:pt-32">
      <div className="mx-auto max-w-5xl">
        <p className={eyebrow}>Mochi&apos;s rooftop run</p>
        <h2 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">How far can Mochi go tonight?</h2>
        <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed opacity-85 sm:text-[15px]">
          Mochi has slipped out onto the rooftops at dusk. Help her leap from roof to roof, catch the stars, bounce off the awnings and dodge the
          pigeons. Everyone runs the same rooftops today; tomorrow there are new ones. Finish a run and share it: the link replays it exactly.
        </p>
        <section data-mochi-platform="run" className="mt-8 rounded-lg border border-line/20 bg-paper/90 p-2 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)] sm:p-3" aria-label="Mochi's rooftop run">
          <RooftopRun today={today} />
        </section>
      </div>
    </div>
  );
}
