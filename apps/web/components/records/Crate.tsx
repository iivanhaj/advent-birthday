"use client";

import type { Theme } from "@/lib/records/paint.ts";
import type { Song } from "@/lib/records/songs";
import { RecordDisc } from "./RecordDisc";

/**
 * The crate: one paper sleeve per song, its record peeking out of the top.
 * The record that's on the turntable leaves an empty sleeve behind.
 */
export function Crate({ songs, birthday, theme, current, onPick }: { songs: Song[]; birthday: string; theme: Theme; current: number | null; onPick: (i: number) => void }) {
  return (
    <ul className="flex snap-x gap-4 overflow-x-auto px-1 pt-12 pb-4 lg:justify-between lg:gap-2 lg:overflow-visible" aria-label="The crate">
      {songs.map((s, i) => {
        const out = i === current;
        return (
          <li key={s.id} className="shrink-0 snap-start">
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={out}
              aria-label={`${s.title} by ${s.artist}${out ? ", on the turntable" : ". Put it on"}`}
              className="group relative block w-36 text-left outline-none sm:w-40 lg:w-[8.5rem]"
            >
              {/* the record, slid half out of its sleeve; lifts a little more on hover */}
              <div className={`absolute inset-x-3 -top-10 transition-transform duration-300 ${out ? "translate-y-24 opacity-0" : "group-hover:-translate-y-3 group-focus-visible:-translate-y-3"}`}>
                <RecordDisc song={s} birthday={birthday} theme={theme} size={112} className="mx-auto" />
              </div>
              <div
                data-mochi-platform={`sleeve ${i}`}
                className={`relative flex aspect-square flex-col justify-end rounded-sm border-[1.5px] border-line bg-paper p-3 shadow-[0_10px_24px_-14px_rgba(78,30,40,0.45)] transition-colors group-focus-visible:ring-2 group-focus-visible:ring-line ${out ? "bg-glass" : ""}`}
              >
                <span className="font-sans text-[10px] font-medium tracking-[0.14em] uppercase opacity-60">{String(i + 1).padStart(2, "0")}</span>
                <span className="mt-1 line-clamp-2 font-serif text-[15px] leading-tight">{s.title}</span>
                <span className="mt-0.5 truncate font-sans text-[11px] opacity-70">{s.artist}</span>
                {out && <span className="mt-1 font-sans text-[10px] tracking-wide opacity-60">On the turntable</span>}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
