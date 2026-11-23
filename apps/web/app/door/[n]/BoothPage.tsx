"use client";

import { PhotoBooth } from "@/components/booth/PhotoBooth";
import type { BoothSky } from "@/lib/booth/strip";

/** Door 6 · the photo booth. */
export function BoothPage({ sky, tempC }: { sky: BoothSky; tempC: number | null }) {
  const eyebrow = "font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70";
  return (
    <div className="min-h-dvh px-4 pt-28 pb-28 sm:px-10 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <p className={eyebrow}>The photo booth</p>
        <h2 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">Four poses, one strip.</h2>
        <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed opacity-85 sm:text-[15px]">
          Step behind the curtain and pose four times. The booth prints you live in rose ink on cream paper, or as a classic black-and-white booth
          strip, and the little strip beside the viewfinder shows exactly how it will look in the frame you pick. Stamp it, save it, or print it at the
          real 2 × 6 inch size, then sign the guestbook on the wall. The photos never leave your screen.
        </p>
        <section data-mochi-platform="booth" className="mt-8 rounded-lg border border-line/20 bg-paper/90 p-3 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)] sm:p-5" aria-label="The photo booth">
          <PhotoBooth sky={sky} tempC={tempC} />
        </section>
      </div>
    </div>
  );
}
