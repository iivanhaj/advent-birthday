"use client";

import { useEffect, useMemo, useState } from "react";
import { HoloCard } from "@/components/card/HoloCard";
import { TYPES, cleanName, makeCard } from "@/lib/card/card";

/**
 * Door 8 · the holographic card. A name, a birthday and a type print a
 * graded, slabbed card. A photo, if you add one, is only ever an object URL
 * in this tab; the share link carries the name, birthday and type, nothing else.
 */

const eyebrow = "font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70";
const field = "block w-full border-b border-line/45 bg-transparent pb-1 font-serif text-[17px] italic text-[#7c2a3a] outline-none focus:border-line [color-scheme:light]";
const btn = "font-sans text-[10.5px] font-medium tracking-[0.16em] uppercase border border-line/55 px-3.5 py-2 transition-colors hover:bg-glass";

export function CardPage({ today }: { today: string }) {
  const [name, setName] = useState("Jae");
  const [birthday, setBirthday] = useState("2003-11-28");
  const [type, setType] = useState("INFJ");
  const [photo, setPhoto] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // a shared link opens the card it was made from
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("name")) setName(cleanName(q.get("name")!));
    if (q.get("b")) setBirthday(q.get("b")!);
    if (q.get("t")) setType(q.get("t")!);
  }, []);
  useEffect(() => () => void (photo && URL.revokeObjectURL(photo)), [photo]);

  const card = useMemo(() => makeCard({ name, birthday, type }, new Date(`${today}T12:00:00Z`)), [name, birthday, type, today]);
  const query = card ? `name=${encodeURIComponent(card.name)}&b=${birthday}&t=${card.type}` : "";

  async function share() {
    const url = `${location.origin}/door/8?${query}`;
    try {
      if (navigator.share && matchMedia("(pointer: coarse)").matches) await navigator.share({ title: `${card!.name}'s birthday card`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* share sheet closed */
    }
  }

  return (
    <div className="min-h-dvh px-4 pt-28 pb-28 sm:px-10 sm:pt-32">
      <div className="mx-auto max-w-5xl">
        <p className={eyebrow}>The holographic card</p>
        <h2 className="mt-2 max-w-3xl font-serif text-3xl leading-tight sm:text-5xl">Your birthday, in foil.</h2>
        <section
          data-mochi-platform="card"
          className="mt-8 grid gap-10 rounded-lg border border-line/20 bg-paper/90 p-5 shadow-[0_12px_32px_-18px_rgba(78,30,40,0.35)] sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          aria-label="The holographic card"
        >
          <div className="max-w-md">
            <p className="font-sans text-sm leading-relaxed opacity-85">
              Put in a name and a birthday. The press finds your star sign, charts its constellation in gold, paints your birth flower under it, and
              seals the card in a graded slab. Move the mouse, or tilt your phone, and the foil catches the light. Tap the card to turn it over.
            </p>
            <label className={`${eyebrow} mt-6 block`} htmlFor="card-name">
              Name
            </label>
            <input id="card-name" className={field} value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
            <label className={`${eyebrow} mt-5 block`} htmlFor="card-birthday">
              Birthday
            </label>
            <input id="card-birthday" type="date" className={field} value={birthday} min="1900-01-01" max={today} onChange={(e) => setBirthday(e.target.value)} />
            <label className={`${eyebrow} mt-5 block`} htmlFor="card-type">
              Type
            </label>
            <select id="card-type" className={field} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t} className="bg-paper text-line not-italic">
                  {t}
                </option>
              ))}
            </select>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <label className={`${btn} cursor-pointer`}>
                {photo ? "Change the photo" : "Add a photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setPhoto(URL.createObjectURL(f));
                  }}
                />
              </label>
              {photo && (
                <button type="button" className={btn} onClick={() => setPhoto(null)}>
                  Back to the painting
                </button>
              )}
              {card && (
                <>
                  <button type="button" className={btn} onClick={share}>
                    {copied ? "Link copied" : "Share my card"}
                  </button>
                  <a className={btn} href={`/api/card?${query}&format=card&download=1`}>
                    Save the card
                  </a>
                </>
              )}
            </div>
            <p className="mt-3 font-sans text-[11px] opacity-60">Your photo stays on this screen. The saved card and the shared link use the painting.</p>
          </div>
          <div className="justify-self-center">{card ? <HoloCard card={card} photo={photo} /> : <p className="font-serif text-lg italic opacity-70">That date doesn&apos;t look right.</p>}</div>
        </section>
      </div>
    </div>
  );
}
