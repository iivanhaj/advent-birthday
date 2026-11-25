"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Card } from "@/lib/card/card";
import { ELEMENT, backArt, windowArt } from "./art";

type OrientationCtor = { requestPermission?: () => Promise<"granted" | "denied"> };

/**
 * The slabbed card. Where the light comes from is two numbers, px and py
 * (0…1): from the mouse over the page, or the phone's gyroscope (beta is
 * front/back tilt, gamma left/right), or, when nothing has moved for a few
 * seconds, a slow sway. They're eased every frame and written to CSS
 * variables, which the tilt, the foil, the glitter and the glare all read:
 * no React re-render per frame.
 */
export function HoloCard({ card, photo }: { card: Card; photo: string | null }) {
  const stage = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [needsTilt, setNeedsTilt] = useState(false);
  const target = useRef({ x: 0.5, y: 0.5, at: 0 });
  const art = useMemo(() => windowArt(card), [card]);
  const back = useMemo(() => backArt(), []);
  const el = ELEMENT[card.sign.element];

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = stage.current!;
    const cur = { x: 0.5, y: 0.5 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = node.getBoundingClientRect();
      // a little beyond the card still counts, so the light follows you in
      target.current = { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), at: performance.now() };
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      target.current = { x: Math.min(1, Math.max(0, 0.5 + e.gamma / 50)), y: Math.min(1, Math.max(0, 0.5 + (e.beta - 45) / 50)), at: performance.now() };
    };
    addEventListener("pointermove", onMove, { passive: true });
    const Ctor = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
    if (matchMedia("(pointer: coarse)").matches && Ctor) {
      if (typeof Ctor.requestPermission === "function") setNeedsTilt(true);
      else addEventListener("deviceorientation", onOrient);
    }
    (window as unknown as { __cardOrient?: typeof onOrient }).__cardOrient = onOrient;
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = target.current;
      const idle = now - t.at > 2600;
      const gx = reduce ? 0.5 : idle ? 0.5 + Math.sin(now / 1600) * 0.28 : t.x;
      const gy = reduce ? 0.5 : idle ? 0.5 + Math.cos(now / 2000) * 0.2 : t.y;
      cur.x += (gx - cur.x) * 0.09;
      cur.y += (gy - cur.y) * 0.09;
      node.style.setProperty("--px", cur.x.toFixed(3));
      node.style.setProperty("--py", cur.y.toFixed(3));
      node.style.setProperty("--pd", Math.min(1, Math.hypot(cur.x - 0.5, cur.y - 0.5) * 2).toFixed(3));
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("pointermove", onMove);
      removeEventListener("deviceorientation", onOrient);
    };
  }, []);

  async function askTilt() {
    const Ctor = (window as unknown as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
    try {
      if ((await Ctor?.requestPermission?.()) === "granted") {
        const fn = (window as unknown as { __cardOrient?: (e: DeviceOrientationEvent) => void }).__cardOrient;
        if (fn) addEventListener("deviceorientation", fn);
        setNeedsTilt(false);
      }
    } catch {
      /* declined: the card keeps swaying on its own */
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="holo-size">
      <div ref={stage} className="holo-stage" style={{ "--glow": el.glow } as React.CSSProperties}>
        <div className="holo-slab">
          <div className="holo-label">
            <div className="holo-logo">bp</div>
            <div className="min-w-0">
              <p className="font-semibold tracking-[0.06em]">2026 BIRTHDAY PRESS</p>
              <p className="truncate">
                #{card.number} {card.name.toUpperCase()} · {card.sign.name.toUpperCase()}
              </p>
              <p className="truncate opacity-80">
                {card.sign.element} sign · {card.flower.name} · {card.type}
              </p>
              <div className="holo-stats">
                {card.stats.map((s) => (
                  <span key={s.label}>
                    {s.label.toUpperCase()} <b>{s.value}</b>
                  </span>
                ))}
              </div>
            </div>
            <div className="holo-grade">
              <span>mint</span>
              <b>10</b>
              <span>{card.serial}</span>
            </div>
            <div className="holo-seal" aria-hidden />
          </div>

          <button type="button" className={`holo-card ${flipped ? "is-flipped" : ""}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? "Turn the card face up" : "Turn the card over"}>
            <div className="holo-front">
              <div className="holo-foil" aria-hidden />
              <div className="holo-face">
                <div className="holo-rule" aria-hidden />
                <div className="flex items-end justify-between px-3 pt-3">
                  <div className="min-w-0 text-left">
                    <p className="truncate font-serif text-[22px] leading-none italic">{card.name}</p>
                    <p className="mt-1 font-sans text-[6.8px] tracking-[0.2em] uppercase opacity-80">
                      {card.sign.name} · {card.flower.name}
                    </p>
                  </div>
                  <p className="text-right font-serif leading-none">
                    <span className="text-[15px] italic">{card.hp.toLocaleString("en-IN")}</span>
                    <span className="block font-sans text-[5.8px] tracking-[0.2em] opacity-75">DAYS · HP</span>
                  </p>
                </div>
                <div className="holo-window">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: art }} />
                  )}
                  <span className="holo-window-foil" aria-hidden />
                  <span className="holo-element" style={{ background: el.badge }} aria-label={`${card.sign.element} sign`}>
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#fbf1ee" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d={el.glyph} />
                    </svg>
                  </span>
                </div>
                <Move kind="Talent" name={card.talent.name} power={String(card.talent.power)} text={card.talent.text} />
                <Move kind="Burst" name={card.burst.name} power="100+" text={card.burst.text} />
                <div className="holo-traits">
                  <span>
                    <b>WEAKNESS</b>
                    {card.weakness}
                  </span>
                  <span>
                    <b>RESISTS</b>
                    {card.resists}
                  </span>
                  <span>
                    <b>RECHARGE</b>
                    {card.recharge}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 pb-2.5 font-sans text-[6.4px] tracking-[0.14em]">
                  <span>{card.type}</span>
                  <span className="-rotate-3 font-[family-name:var(--font-caveat)] text-[19px] tracking-normal text-[#6b1d2c]">{card.name}</span>
                  <span>No. 1 / 1</span>
                </div>
              </div>
              <div className="holo-glitter" aria-hidden />
              <div className="holo-glare" aria-hidden />
            </div>
            <div className="holo-back">
              <span className="absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: back }} />
              <div className="holo-foil" aria-hidden />
              <div className="holo-glare" aria-hidden />
            </div>
          </button>
        </div>
      </div>
      </div>
      <p className="font-sans text-[11px] opacity-70">
        {flipped ? "tap the card to turn it back" : "tap the card to turn it over"}
        {needsTilt && (
          <>
            {" · "}
            <button type="button" onClick={askTilt} className="underline underline-offset-2">
              tilt with your phone
            </button>
          </>
        )}
      </p>
    </div>
  );
}

function Move({ kind, name, power, text }: { kind: string; name: string; power: string; text: string }) {
  return (
    <div className="holo-move">
      <p className="flex items-baseline gap-1.5">
        <span className="font-sans text-[6.2px] tracking-[0.18em] uppercase opacity-85">{kind}</span>
        <span className="flex-1 truncate text-left font-serif text-[11.5px] italic">{name}</span>
        <span className="font-serif text-[11px] italic">{power}</span>
      </p>
      <p className="mt-0.5 text-left font-sans text-[7.6px] leading-snug opacity-85">{text}</p>
    </div>
  );
}
