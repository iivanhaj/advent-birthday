"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createCarousel, type CarouselControl } from "@/components/firefly/carousel3d";
import { playTune } from "@/components/firefly/musicBox";
import { useSpotify } from "@/components/records/useSpotify";
import { buildCarousels, tune } from "@/lib/firefly/mood";

/**
 * Door 7 · the firefly carousel. A music box with a firefly lantern on every
 * pole; each firefly is a song. Pick a mood to load its carousel, turn it until
 * the song you want is at the front, and play: the box winds up a little tune
 * of its own for that song, then the song itself plays through Spotify while
 * the carousel turns.
 */

const eyebrow = "font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70";
const btn = "font-sans text-[10.5px] font-medium tracking-[0.18em] uppercase border border-line/50 px-4 py-2 transition-colors hover:bg-glass disabled:opacity-40";
/** The chime is kept short, so the song starts while the click still counts as a user gesture. */
const CHIME_MAX = 2.2;

export function FireflyPage() {
  const carousels = useMemo(() => buildCarousels(), []);
  const [mood, setMood] = useState(0);
  const [front, setFront] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const ctl = useRef<CarouselControl | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);
  const spotify = useSpotify(carousels[0].songs[0].id, 80);
  const songs = carousels[mood].songs;

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ctl.current = createCarousel(host.current!, setFront, reduce);
    return () => {
      ctl.current?.dispose();
      ctl.current = null;
    };
  }, []);

  useEffect(() => {
    ctl.current?.setCount(songs.length);
  }, [songs]);

  // when Spotify pauses (the song ended, or the embed's own button), the carousel stops too
  const { paused } = spotify.state;
  useEffect(() => {
    if (playing == null) return;
    if (!paused) started.current = true;
    else if (started.current) stop(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, playing]);

  function stop(pauseSong = true) {
    if (timer.current) clearTimeout(timer.current);
    if (pauseSong && started.current && !paused) spotify.toggle();
    started.current = false;
    setPlaying(null);
    ctl.current?.setPlaying(null);
  }

  function play() {
    if (playing != null) return stop();
    const song = songs[front];
    const m = carousels[mood].mood;
    const notes = tune(song.id, m, 7);
    const beats = notes.reduce((s, [, len]) => s + len, 0);
    const length = playTune(notes, Math.min(m.beat, CHIME_MAX / beats));
    setPlaying(front);
    ctl.current?.setPlaying(front);
    timer.current = setTimeout(() => spotify.play(song.id), Math.max(0, length * 1000 - 250));
  }

  function pickMood(i: number) {
    if (i === mood) return;
    if (playing != null) stop();
    setMood(i);
  }

  const shown = songs[playing ?? front];

  return (
    <div className="min-h-dvh px-4 pt-28 pb-28 sm:px-10 sm:pt-32">
      <div className="mx-auto max-w-5xl">
        <p className={eyebrow}>Firefly music</p>
        <h2 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">A carousel for every mood.</h2>
        <p className="mt-3 max-w-2xl font-sans text-sm leading-relaxed opacity-85 sm:text-[15px]">
          Eighty-seven songs from one playlist, sorted into five moods by how they feel. Every pole carries a lantern with a firefly inside, and
          every firefly is a song. Pick a mood, turn the carousel until the song you want is at the front, and let the music box play it.
        </p>
        <section data-mochi-platform="carousel" className="mt-8 rounded-lg border border-line/20 bg-paper/90 p-3 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)] sm:p-6" aria-label="The firefly carousel">
          <div className="relative px-3 py-4 sm:px-8 sm:py-6">
            <Ribbon />
            <div ref={host} className="relative h-[380px] cursor-grab active:cursor-grabbing sm:h-[460px]" role="img" aria-label={`A carousel of ${songs.length} firefly lanterns, one for each song`} />
          </div>
          <div className="mt-1 text-center" aria-live="polite">
            <p className="font-serif text-xl italic sm:text-2xl">{shown?.title}</p>
            <p className="mt-1 font-sans text-[10.5px] tracking-[0.16em] uppercase opacity-70">
              {playing != null ? "now playing · " : ""}
              {shown?.artist}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2">
            <span className={eyebrow}>Tonight I feel</span>
            {carousels.map((c, i) => (
              <button
                key={c.mood.id}
                type="button"
                onClick={() => pickMood(i)}
                aria-pressed={i === mood}
                className={`border-b pb-0.5 font-serif text-[15px] italic transition-opacity ${i === mood ? "border-line opacity-100" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                {c.mood.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex justify-center gap-2.5">
            <button type="button" className={btn} onClick={() => ctl.current?.nudge(-1)} disabled={playing != null} aria-label="Turn the carousel left">
              ‹ Turn
            </button>
            <button type="button" className={`${btn} bg-line text-paper hover:bg-line/90`} onClick={play}>
              {playing != null ? "Stop" : "Play"}
            </button>
            <button type="button" className={btn} onClick={() => ctl.current?.nudge(1)} disabled={playing != null} aria-label="Turn the carousel right">
              Turn ›
            </button>
          </div>

          <div className="mx-auto mt-6 max-w-md">
            <div ref={spotify.host} className="overflow-hidden rounded-xl" />
            <p className="mt-2 text-center font-sans text-[11px] opacity-60">Signed in to Spotify, you hear whole songs; otherwise, previews.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

/** The ribbon frame round the carousel, drawn like the stamp borders on the booth strip. */
function Ribbon() {
  const d =
    "M70 26 C40 26 26 40 26 70 V200 C26 228 8 236 8 260 C8 284 26 292 26 320 V450 C26 480 40 494 70 494 H570 C600 494 614 480 614 450 V320 C614 292 632 284 632 260 C632 236 614 228 614 200 V70 C614 40 600 26 570 26 Z";
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 640 520" preserveAspectRatio="none" aria-hidden>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        <path d={d} stroke="rgba(229,143,168,.5)" strokeWidth="7" vectorEffect="non-scaling-stroke" />
        <path d={d} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <path d="M300 26 c6 -10 14 -10 20 0 c6 10 14 10 20 0 M300 494 c6 -10 14 -10 20 0 c6 10 14 10 20 0" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </g>
      <g stroke="currentColor" strokeWidth="1" opacity=".7" vectorEffect="non-scaling-stroke">
        <path d="M90 90v14M83 97h14M560 120v10M555 125h10M110 400v10M105 405h10M540 420v14M533 427h14M500 70v8M496 74h8M140 60v8M136 64h8" vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
