"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FILMS, type FilmId } from "@/lib/booth/film";
import { FRAMES, POSES, STAMP_IDS, STRIP, caption, pressOrLift, stripFileName, type BoothSky, type FrameId, type Stamp, type StampId } from "@/lib/booth/strip";
import { NAME_MAX, NOTE_MAX } from "@/lib/booth/guestbook";
import { BoothRoom } from "./BoothRoom";
import { VIEW, createDarkroom, type Darkroom } from "./darkroom";
import { drawStamp, paintSitter, paintStrip, siteFonts, stampStrip } from "./paintStrip";
import { useGuestbook } from "./useGuestbook";

type Stage = "room" | "inside" | "developing";
type Feed = { kind: "sitter" } | { kind: "camera"; video: HTMLVideoElement; stream: MediaStream } | { kind: "photo"; img: HTMLImageElement };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lab = "font-sans text-[10px] font-medium tracking-[0.24em] uppercase opacity-70";
const pill = "rounded-full border border-line bg-paper px-4 py-1.5 font-sans text-xs font-medium transition-colors hover:bg-glass disabled:opacity-40";
const quiet = "border-b border-transparent pb-0.5 font-serif text-[14px] transition-opacity hover:border-line";

function useCompact() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = matchMedia("(max-width: 639px)");
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return compact;
}

function Options<T extends string>({ label, list, value, onChange }: { label: string; list: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className={lab}>{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {list.map((o) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} className={`${quiet} ${value === o.id ? "border-line opacity-100" : "opacity-55"}`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The booth's curtains, framing the inside view. */
function Curtains() {
  const side = (flip: boolean) => (
    <svg viewBox="0 0 200 640" preserveAspectRatio="none" className={`absolute inset-y-0 hidden w-[19%] sm:block ${flip ? "right-0 -scale-x-100" : "left-0"}`} aria-hidden>
      <path d="M0 0 H190 C178 200 194 430 180 640 H0Z" fill="#F3D9D6" opacity=".35" />
      <g fill="none" stroke="#9E3B4C" strokeWidth="1.3" vectorEffect="non-scaling-stroke">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M${20 + i * 20} 0 C${28 + i * 20} 180 ${14 + i * 20} 420 ${24 + i * 20} 640`} opacity={i % 2 ? 0.3 : 0.6} vectorEffect="non-scaling-stroke" />
        ))}
      </g>
    </svg>
  );
  return (
    <>
      {side(false)}
      {side(true)}
      <div className="absolute inset-x-0 top-0 h-px bg-line" aria-hidden />
    </>
  );
}

export function PhotoBooth({ sky, tempC }: { sky: BoothSky; tempC: number | null }) {
  const compact = useCompact();
  const [stage, setStage] = useState<Stage>("room");
  const [film, setFilm] = useState<FilmId>("rose");
  const [frame, setFrame] = useState<FrameId>("line");
  const [feed, setFeed] = useState<Feed>({ kind: "sitter" });
  const [feedNote, setFeedNote] = useState("a stand-in sitter");
  const [count, setCount] = useState("");
  const [flash, setFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shotsTaken, setShotsTaken] = useState(0);
  const [strip, setStrip] = useState<{ base: HTMLCanvasElement; at: Date; id: number } | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [stamp, setStamp] = useState<StampId>("heart");
  const { notes, sign, status, setStatus } = useGuestbook();

  const view = useRef<HTMLCanvasElement>(null);
  const out = useRef<HTMLCanvasElement>(null);
  const darkroom = useRef<Darkroom | null>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const taken = useRef<HTMLCanvasElement[]>([]);
  const live = useRef({ film, feed, frame, sky, tempC });
  live.current = { film, feed, frame, sky, tempC };
  const sitter = useRef<HTMLCanvasElement | null>(null);

  // development only: ?testphoto=<cors image url> loads a portrait to tune the films on
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const url = new URLSearchParams(location.search).get("testphoto");
    if (!url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setFeed({ kind: "photo", img });
    img.src = url;
  }, []);

  // stop the camera whenever the feed changes or the booth goes away
  useEffect(() => {
    if (feed.kind !== "camera") return;
    return () => feed.stream.getTracks().forEach((t) => t.stop());
  }, [feed]);

  // inside the booth: develop the feed every frame
  useEffect(() => {
    if (stage !== "inside" || !view.current) return;
    darkroom.current = createDarkroom(view.current);
    if (!sitter.current) {
      sitter.current = document.createElement("canvas");
      sitter.current.width = VIEW.w;
      sitter.current.height = VIEW.h;
    }
    let raf = 0;
    let painted = 0;
    const tick = (t: number) => {
      const { film, feed, frame, sky, tempC } = live.current;
      const room = darkroom.current!;
      if (feed.kind === "camera" && feed.video.readyState >= 2) room.draw(feed.video, film, true);
      else if (feed.kind === "photo") room.draw(feed.img, film, false);
      else {
        paintSitter(sitter.current!.getContext("2d")!, t);
        room.draw(sitter.current!, film, false);
      }
      // the strip beside the viewfinder, a few times a second: poses taken so far, then the live view
      // in every window still to come, inside the chosen frame
      if (preview.current && view.current && t - painted > 160) {
        painted = t;
        const slots = Array.from({ length: POSES }, (_, i) => taken.current[i] ?? view.current!);
        paintStrip(slots, frame, caption(new Date(), sky, tempC), 1128, preview.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  // the developed strip, with its stamps pressed on
  useEffect(() => {
    if (stage === "developing" && strip && out.current) stampStrip(strip.base, out.current, stamps, dayLabel(strip.at));
  }, [stage, strip, stamps]);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      setFeed({ kind: "camera", video, stream });
      setFeedNote("your camera, never uploaded");
    } catch {
      setFeedNote("no camera here: try a photo");
    }
  }

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setFeed({ kind: "photo", img });
      setFeedNote("your photo, never uploaded");
    };
    img.src = URL.createObjectURL(file);
  }

  const takeStrip = useCallback(async () => {
    if (busy || !view.current) return;
    setBusy(true);
    const shots: HTMLCanvasElement[] = [];
    taken.current = shots;
    for (let k = 0; k < POSES; k++) {
      setShotsTaken(k);
      for (const n of ["three", "two", "one"]) {
        setCount(n);
        await sleep(k ? 520 : 750);
      }
      setCount("");
      setFlash(true);
      const shot = document.createElement("canvas");
      shot.width = VIEW.w;
      shot.height = VIEW.h;
      shot.getContext("2d")!.drawImage(view.current, 0, 0);
      shots.push(shot);
      await sleep(90);
      setFlash(false);
      await sleep(420);
    }
    setShotsTaken(POSES);
    taken.current = [];
    const at = new Date();
    // read the frame and sky as they are now, not as they were when the countdown began
    const now = live.current;
    setStrip({ base: paintStrip(shots, now.frame, caption(at, now.sky, now.tempC), at.getTime() | 0), at, id: at.getTime() });
    setStamps([]);
    setStage("developing");
    setBusy(false);
  }, [busy]);

  function press(e: React.PointerEvent<HTMLCanvasElement>) {
    const b = e.currentTarget.getBoundingClientRect();
    setStamps((s) => pressOrLift(s, stamp, ((e.clientX - b.left) / b.width) * STRIP.w, ((e.clientY - b.top) / b.height) * STRIP.h));
  }

  function save() {
    out.current?.toBlob((blob) => {
      if (!blob || !strip) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = stripFileName(strip.at);
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, "image/png");
  }

  /** Print at true size: a 2 × 6 in page holding only the strip, for as long as the print dialog is open. */
  function printStrip() {
    if (!out.current) return;
    const holder = document.createElement("div");
    holder.id = "booth-print";
    const img = new Image();
    img.src = out.current.toDataURL("image/png");
    holder.appendChild(img);
    const style = document.createElement("style");
    style.textContent = `@media print { @page { size: 2in 6in; margin: 0 } body > *:not(#booth-print) { display: none !important } #booth-print { display: block !important } #booth-print img { width: 2in; height: 6in; display: block } }
      @media screen { #booth-print { display: none } }`;
    document.head.appendChild(style);
    document.body.appendChild(holder);
    const done = () => {
      holder.remove();
      style.remove();
      removeEventListener("afterprint", done);
    };
    addEventListener("afterprint", done);
    img.decode().then(() => window.print()).catch(done);
  }

  function leave() {
    setStage("room");
    setCount("");
    // turn the camera off whenever you step out
    setFeed({ kind: "sitter" });
    setFeedNote("a stand-in sitter");
  }

  return (
    <div className="relative overflow-hidden rounded-xl border-[1.5px] border-line bg-paper text-line">
      {stage === "room" && (
        <div className="relative">
          <BoothRoom sky={sky} notes={notes} compact={compact} onEnter={() => setStage("inside")} />
          <div className="flex justify-center pb-4 sm:absolute sm:inset-x-0 sm:bottom-5 sm:pb-0">
            <button type="button" onClick={() => setStage("inside")} className="rounded-full border border-line bg-paper px-5 py-2 font-sans text-[11px] font-medium tracking-[0.28em] uppercase transition-colors hover:bg-glass">
              Step behind the curtain
            </button>
          </div>
        </div>
      )}

      {stage === "inside" && (
        <div className="relative px-4 pt-6 pb-6 sm:aspect-[3/2] sm:px-[17%] sm:pt-[3.5%] sm:pb-0">
          <Curtains />
          <div className="relative flex items-start gap-3 sm:gap-5">
            <div className="relative min-w-0 flex-1 border-[1.5px] border-line bg-paper p-2">
              <div className="relative overflow-hidden border border-line/50">
                <canvas ref={view} className="block aspect-[4/3] h-auto w-full" aria-label="The viewfinder, developed live" />
                {count && (
                  <div aria-live="assertive" className="pointer-events-none absolute inset-0 grid place-items-center font-serif text-6xl italic [text-shadow:0_0_14px_#fbf1ee,0_0_4px_#fbf1ee] sm:text-8xl">
                    {count}
                  </div>
                )}
                <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity ${flash ? "opacity-90 duration-0" : "opacity-0 duration-500"}`} />
                <p className="absolute bottom-2 left-2 bg-paper/90 px-1.5 font-serif text-[11px] italic">{busy ? `pose ${shotsTaken + 1} of ${POSES}` : feedNote}</p>
              </div>
            </div>
            {/* the strip as it will print: your poses so far, the live view in the windows still to fill, in the chosen frame */}
            <figure className="w-[22%] shrink-0 sm:w-[19%]">
              <canvas ref={preview} width={600} height={1800} className="block aspect-[1/3] h-auto w-full border border-line/50 shadow-[3px_3px_0_rgba(158,59,76,0.12)]" aria-label="A preview of your strip in the chosen frame" />
              <figcaption className="mt-1.5 text-center font-serif text-[11px] italic opacity-70">your strip</figcaption>
            </figure>
          </div>
          <div className="relative mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3">
              <Options label="Film" list={FILMS} value={film} onChange={setFilm} />
              <Options label="Frame" list={FRAMES} value={frame} onChange={setFrame} />
            </div>
            <button
              type="button"
              onClick={takeStrip}
              disabled={busy}
              className="mx-auto size-[76px] shrink-0 rounded-full border-[1.5px] border-line bg-paper font-serif text-base italic shadow-[0_0_0_5px_#fbf1ee,0_0_0_6px_rgba(158,59,76,0.4)] transition-colors hover:bg-glass disabled:opacity-50 sm:mx-0"
            >
              {busy ? "…" : "begin"}
            </button>
            <div className="flex flex-row flex-wrap justify-center gap-x-4 gap-y-1 sm:flex-col sm:items-end">
              <button type="button" className={quiet} onClick={startCamera} disabled={busy}>
                Use my camera
              </button>
              <label className={`${quiet} cursor-pointer`}>
                Use a photo
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} disabled={busy} />
              </label>
              <button type="button" className={quiet} onClick={leave} disabled={busy}>
                Leave the booth
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "developing" && strip && (
        <div className="grid gap-8 p-5 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] sm:p-10">
          <div className="grid place-items-center rounded-lg border border-dashed border-line/50 p-4">
            <canvas
              key={strip.id}
              ref={out}
              width={STRIP.w}
              height={STRIP.h}
              onPointerDown={press}
              className="booth-develop h-auto max-h-[72vh] w-auto max-w-full cursor-crosshair border border-line/50"
              style={{ aspectRatio: "1 / 3" }}
              aria-label="Your strip of four photos. Click to press or lift a stamp."
            />
          </div>
          <div className="flex flex-col gap-4">
            <p className={lab}>Developing</p>
            <h3 className="font-serif text-3xl italic">Four poses, one strip.</h3>
            <p className="font-sans text-sm leading-relaxed opacity-85">Pick a stamp, then click the strip to press it. Click a stamp again to lift it off.</p>
            <div className="flex gap-2" role="radiogroup" aria-label="Stamps">
              {STAMP_IDS.map((id) => (
                <StampButton key={id} id={id} on={stamp === id} onPick={() => setStamp(id)} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={pill} onClick={save}>
                Save
              </button>
              <button type="button" className={pill} onClick={printStrip}>
                Print · 2 × 6 in
              </button>
              <button type="button" className={pill} onClick={() => setStage("inside")}>
                Another strip
              </button>
              <button type="button" className={pill} onClick={leave}>
                Back to the room
              </button>
            </div>
            <form
              className="mt-auto border-t border-line/30 pt-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const f = new FormData(form);
                if (await sign(String(f.get("message") ?? ""), String(f.get("name") ?? ""))) {
                  form.reset();
                  setTimeout(leave, 900);
                }
              }}
            >
              <p className={lab}>Sign the guestbook</p>
              <p className="mt-1 font-sans text-xs opacity-70">Only your words are kept. The photos never leave this page.</p>
              <div className="mt-3 flex gap-3">
                <input name="message" maxLength={NOTE_MAX} required placeholder="a few words" onInput={() => setStatus(null)} className="min-w-0 flex-1 border-b border-line bg-transparent py-1 font-serif italic outline-none placeholder:text-line/45" />
                <input name="name" maxLength={NAME_MAX} placeholder="your name" className="w-28 border-b border-line bg-transparent py-1 font-serif italic outline-none placeholder:text-line/45" />
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button type="submit" className={pill} disabled={status?.kind === "sending"}>
                  Sign
                </button>
                {status && <p className="font-sans text-xs" role="status">{status.text}</p>}
              </div>
            </form>
          </div>
        </div>
      )}

      {stage === "room" && compact && notes.length > 0 && (
        <ul className="border-t border-line/30 px-5 py-4" aria-label="Guestbook">
          {notes.slice(0, 6).map((n) => (
            <li key={n.id} className="border-b border-dashed border-line/30 py-2 font-serif text-sm italic last:border-0">
              {n.message}
              <span className="ml-2 font-sans text-[10px] tracking-[0.18em] uppercase not-italic opacity-60">{n.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const dayLabel = (at: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }).format(at);

function StampButton({ id, on, onPick }: { id: StampId; on: boolean; onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    c.clearRect(0, 0, 100, 100);
    c.save();
    c.translate(50, 50);
    c.scale(0.95, 0.95);
    drawStamp(c, id, 0, 0, dayLabel(new Date()), siteFonts().serif);
    c.restore();
  }, [id]);
  return (
    <button type="button" role="radio" aria-checked={on} aria-label={`${id} stamp`} onClick={onPick} className={`grid size-11 place-items-center rounded-full border bg-paper transition-colors ${on ? "border-[1.5px] border-line" : "border-line/35 hover:bg-glass"}`}>
      <canvas ref={ref} width={100} height={100} className="size-9" />
    </button>
  );
}
