"use client";

import { InfiniteBloom } from "@/components/bloom/InfiniteBloom";
import type { SkyPhase } from "@/lib/sky";

/** Door 5 · the infinite bloom. */
export function BloomPage({ phase }: { phase: SkyPhase }) {
  const eyebrow = "font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70";
  return (
    <div className="min-h-dvh px-4 pt-28 pb-28 sm:px-10 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <p className={eyebrow}>The infinite bloom</p>
        <h2 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">A flower made of flowers, forever.</h2>
        <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed opacity-85 sm:text-[15px]">
          Every petal holds a smaller copy of the whole flower, so you can zoom in for as long as you like and it never runs out. Click a petal to dive
          into it, scroll to speed up or zoom back out, and change the petals, nesting and twist to grow a different infinite flower.
        </p>
        <section data-mochi-platform="bloom" className="mt-8 rounded-lg border border-line/20 bg-paper/90 p-4 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)] sm:p-5" aria-label="The bloom">
          <InfiniteBloom phase={phase} />
        </section>
      </div>
    </div>
  );
}
