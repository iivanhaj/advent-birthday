"use client";

import { useEffect, useState } from "react";
import { Crate } from "@/components/records/Crate";
import { recordPng } from "@/components/records/RecordDisc";
import { Turntable } from "@/components/records/Turntable";
import { useSpotify } from "@/components/records/useSpotify";
import { THEMES, monthDay, recordSeed, type Theme } from "@/lib/records/paint.ts";
import { MY_BIRTHDAY, SONGS } from "@/lib/records/songs";

/**
 * Door 3 · birthday records. A crate of songs, each with a record painted from
 * a birthday mixed with that song. Pull one out, it plays on the turntable
 * through Spotify's embed. Anyone can switch the paint theme or put in their
 * own birthday; both live in the URL, so a crate can be shared exactly.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pretty = (md: string) => `${Number(md.slice(3))} ${MONTHS[Number(md.slice(0, 2)) - 1]}`;

const card = "rounded-lg border border-line/20 bg-paper/90 p-5 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)]";
const eyebrow = "font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70";
const pill = "rounded-full border border-line/30 px-3.5 py-1.5 font-sans text-xs font-medium transition-colors hover:bg-glass";

export function BirthdayRecords() {
  const [birthday, setBirthday] = useState(MY_BIRTHDAY);
  const [theme, setTheme] = useState<Theme>("dreamy");
  const [current, setCurrent] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const spotify = useSpotify(SONGS[0].id);

  // read ?birthday=MM-DD&theme=… once, so shared links open the same crate
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const b = q.get("birthday");
    const t = q.get("theme");
    if (b && monthDay(b)) setBirthday(monthDay(b)!);
    if (t && THEMES.some((x) => x.id === t)) setTheme(t as Theme);
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (birthday === MY_BIRTHDAY) q.delete("birthday");
    else q.set("birthday", birthday);
    if (theme === "dreamy") q.delete("theme");
    else q.set("theme", theme);
    const s = q.toString();
    history.replaceState(null, "", `${location.pathname}${s ? `?${s}` : ""}`);
  }, [birthday, theme]);

  const song = current == null ? null : SONGS[current];
  const { position, duration, paused } = spotify.state;
  const playing = song != null && !paused && duration > 0;
  const progress = duration > 0 ? position / duration : 0;
  const mine = birthday === MY_BIRTHDAY;

  function pick(i: number) {
    setCurrent(i);
    spotify.play(SONGS[i].id);
  }

  async function download() {
    if (!song) return;
    setSaving(true);
    const blob = await recordPng(song, birthday, theme);
    setSaving(false);
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `birthday-record-${birthday}-${song.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  return (
    <div className="min-h-dvh px-4 pt-28 pb-28 sm:px-10 sm:pt-32">
      <div className="mx-auto max-w-6xl">
        <p className={eyebrow}>Birthday records</p>
        <h2 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">A record for every song, painted by {mine ? "my birthday" : `the ${pretty(birthday)} birthday`}.</h2>
        <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed opacity-85 sm:text-[15px]">
          Each record is painted from the birthday mixed with the song, so every song gets its own record and the same birthday always paints the
          same crate. Pull one out to play it.
        </p>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.35fr_1fr]">
          <section className={card} aria-label="Turntable">
            <Turntable song={song} birthday={birthday} theme={theme} playing={playing} progress={progress} />
          </section>

          <div className="grid gap-5">
            <section data-mochi-platform="now playing" className={card}>
              <p className={eyebrow}>Now playing</p>
              <p className="mt-1 font-serif text-2xl leading-tight">{song ? song.title : "Nothing yet"}</p>
              <p className="mt-0.5 font-sans text-xs opacity-70">{song ? song.artist : "Pick a record from the crate below."}</p>
              {song && <p className="mt-2 font-mono text-[11px] opacity-55">seed 0x{recordSeed(birthday, song.id).toString(16).padStart(8, "0")}</p>}
              <div ref={spotify.host} className="mt-4 min-h-[152px] overflow-hidden rounded-xl" />
              {!spotify.ready && <p className="mt-2 font-sans text-[11px] opacity-60">Loading the Spotify player…</p>}
              <p className="mt-2 font-sans text-[11px] leading-relaxed opacity-60">Signed in to Spotify you&rsquo;ll hear the whole song; otherwise a preview.</p>
            </section>

            <section data-mochi-platform="make yours" className={card}>
              <p className={eyebrow}>Paint</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Paint theme">
                {THEMES.map((t) => (
                  <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => setTheme(t.id)} className={`${pill} ${theme === t.id ? "bg-glass" : ""}`} title={t.blurb}>
                    {t.label}
                  </button>
                ))}
              </div>
              <p className={`${eyebrow} mt-5`}>Make yours</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="font-sans text-xs">
                  <span className="sr-only">Your birthday</span>
                  <input
                    type="date"
                    className="rounded-full border border-line/30 bg-transparent px-3 py-1.5 font-sans text-xs"
                    onChange={(e) => {
                      const md = monthDay(e.target.value);
                      if (md) setBirthday(md);
                    }}
                  />
                </label>
                {!mine && (
                  <button type="button" className={pill} onClick={() => setBirthday(MY_BIRTHDAY)}>
                    Back to mine
                  </button>
                )}
                <button type="button" className={pill} onClick={download} disabled={!song || saving}>
                  {saving ? "Painting…" : "Download this record"}
                </button>
              </div>
              <p className="mt-2 font-sans text-[11px] leading-relaxed opacity-60">Only the month and day are used, and nothing is saved. The link above now opens this exact crate.</p>
            </section>
          </div>
        </div>

        <section className="mt-6" aria-label="Crate">
          <p className={eyebrow}>The crate · {SONGS.length} records</p>
          <Crate songs={SONGS} birthday={birthday} theme={theme} current={current} onPick={pick} />
        </section>
      </div>
    </div>
  );
}
