"use client";

import { Pond } from "@/components/pond/Pond";
import { StressPond } from "@/components/pond/StressPond";
import type { PushRow } from "@/lib/pushes";
import type { SkyPhase } from "@/lib/sky";

/** Door 4 · the commit pond: every push is a koi, schooling by day, under real water. */
export function CommitPond({ initialPushes, phase }: { initialPushes: PushRow[]; phase: SkyPhase }) {
  const eyebrow = "font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70";
  return (
    <div className="min-h-dvh px-4 pt-28 pb-28 sm:px-10 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <p className={eyebrow}>The commit pond</p>
        <h2 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">Every push is a koi.</h2>
        <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed opacity-85 sm:text-[15px]">
          Each koi is one push to this project, its patches coloured by the kinds of files it touched, its size by how many. Koi from the same day
          school together. Hover one to see its commit, click the water to make ripples, and leave the page open: the next push drops a new koi in.
        </p>
        <section data-mochi-platform="pond" className="mt-8 rounded-lg border border-line/20 bg-paper/90 p-4 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)] sm:p-5" aria-label="The pond">
          <Pond initialPushes={initialPushes} phase={phase} />
        </section>

        <section data-mochi-platform="stress" className="mt-6 rounded-lg border border-line/20 bg-paper/90 p-4 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)] sm:p-5" aria-label="Stress test">
          <p className={eyebrow}>Stress test · CPU vs GPU</p>
          <h3 className="mt-1 font-serif text-2xl">Ten thousand koi</h3>
          <p className="mt-2 max-w-2xl font-sans text-[13px] leading-relaxed opacity-85">
            The same flocking rules, at a scale a CPU struggles with. On the GPU, a WebGPU compute shader updates every koi in parallel, comparing
            each one with every other (a hundred million pairs a frame at 10,000 koi) and draws them all in a single instanced call. On the CPU, the
            spatial hash cuts the comparisons enormously, but it still works through them one at a time. Switch between them and watch the frame
            rate.
          </p>
          <div className="mt-4">
            <StressPond />
          </div>
        </section>
      </div>
    </div>
  );
}
