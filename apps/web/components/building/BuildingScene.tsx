"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useTransform } from "framer-motion";
import { springs } from "@birthday-garden/garden-ui";
import { FLOORS, VIEW_H, WINDOWS, pctBox } from "@/lib/building";
import { DOOR_META, doorState, type CalendarDoor, type DoorRow } from "@/lib/doors";
import type { Sky as SkyData } from "@/lib/sky";
import { browserClient } from "@/lib/supabase/browser";
import { Elevator } from "./Elevator";
import { Facade, Foreground } from "./Facade";
import { Fireworks } from "./Fireworks";
import { Room } from "./Room";
import { Sky } from "./Sky";
import { useParallax } from "./useParallax";
import { Window, type Peek } from "./Window";
import { Constellations } from "./Constellations";
import { WindowBoxes } from "./WindowBoxes";
import { useLivePushes } from "./useLivePushes";
import type { PushRow } from "@/lib/pushes";

type Props = {
  initialDoors: CalendarDoor[];
  todayDoor: number | null;
  sleeps: number;
  dateLabels: Record<number, string>;
  sky: SkyData;
  initialPushes: PushRow[];
};

const FLOOR_ORDER = { ground: 0, first: 1, second: 2, roof: 3 } as const;

/**
 * Doors whose page is a full scene of its own: the fly-through zooms into that
 * scene's backdrop (so there's no flash of a different picture) instead of the
 * little room drawing.
 */
const DOOR_SCENES: Record<number, { background: string; caption: string }> = {
  1: { background: "linear-gradient(180deg, #1C1840 0%, #352D64 55%, #554784 100%)", caption: "the living garden" },
};

export function BuildingScene({ initialDoors, todayDoor, sleeps, dateLabels, sky, initialPushes }: Props) {
  const router = useRouter();
  const doors = useLiveDoors(initialDoors);
  const { pushes, fresh } = useLivePushes(initialPushes);
  const byN = useMemo(() => new Map(doors.map((d) => [d.n, d])), [doors]);
  const finale = Boolean(byN.get(11)?.shipped_at);
  const night = sky.phase === "night" || sky.phase === "dusk";
  const onSky = night ? "text-paper" : "text-line";

  // ---- intro: draw the building once per session at full speed, quickly after that ----
  const [intro, setIntro] = useState<"full" | "fast" | null>(null);
  const [built, setBuilt] = useState(false);
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("bg-drawn") === "1";
      sessionStorage.setItem("bg-drawn", "1");
    } catch {
      /* storage blocked: always play the full intro */
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mode = seen || reduce ? "fast" : "full";
    setIntro(mode);
    const t = setTimeout(() => setBuilt(true), mode === "fast" ? 650 : 2100);
    return () => clearTimeout(t);
  }, []);
  const fast = intro === "fast";
  const lampBase = fast ? 0.5 : 0.6;

  // ---- preferences ----
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => {
    try {
      setSoundOn(localStorage.getItem("bg-sound") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleSound = () =>
    setSoundOn((s) => {
      try {
        localStorage.setItem("bg-sound", s ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !s;
    });

  // ---- parallax (mouse / gyroscope) ----
  const { sx, sy, needsPermission, requestTilt } = useParallax();
  const fgX = useTransform(sx, (v) => v * 22);
  const fgY = useTransform(sy, (v) => v * 8);
  const bX = useTransform(sx, (v) => v * 6);

  const boxRef = useRef<HTMLDivElement>(null);

  /*
   * ---- the camera: rides between floors ----
   * Phones always use it (the elevator). Anywhere, the magnifier button turns
   * on a bigger zoom: for anyone who finds the building small, it makes the
   * windows, numbers and tags ~1.9× larger, one floor at a time, with the
   * elevator dial (and ↑/↓ keys) to move between floors.
   */
  const [isPhone, setIsPhone] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [floor, setFloor] = useState<number | null>(null);
  const [camera, setCamera] = useState({ scale: 1, y: 0 });
  const todayFloor = Math.max(0, FLOORS.findIndex((f) => f.id === (WINDOWS.find((v) => v.n === todayDoor)?.floor ?? "ground")));
  const cameraOn = isPhone || zoomed;
  useEffect(() => {
    const mq = matchMedia("(max-width: 767px)");
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const recomputeCamera = useCallback(() => {
    const box = boxRef.current;
    if (!box || !cameraOn || floor == null) return setCamera({ scale: 1, y: 0 });
    const h = box.offsetHeight;
    const stageH = innerHeight;
    // The wrapper isn't transformed, so its rect is where the building sits before the camera moves.
    const boxTop = box.parentElement?.getBoundingClientRect().top ?? stageH - h;
    const f = FLOORS[floor];
    const bandH = ((f.y1 - f.y0) / VIEW_H) * h;
    const center = ((f.y0 + f.y1) / 2 / VIEW_H) * h;
    // How far we may zoom: the phone elevator stays gentle so no side window is cropped;
    // the magnifier goes much further (on phones it may crop the outer edges a little).
    const cap = zoomed ? (isPhone ? 1.45 : 1.9) : 1.12;
    const scale = Math.min(cap, (stageH * 0.8) / bandH);
    const y = stageH / 2 - boxTop - h / 2 - (center - h / 2) * scale;
    setCamera({ scale, y });
  }, [cameraOn, zoomed, isPhone, floor]);

  function toggleZoom() {
    const next = !zoomed;
    setZoomed(next);
    if (next && floor == null) setFloor(todayFloor);
    if (!next && !isPhone) setFloor(null);
  }
  function chooseFloor(f: number | null) {
    setFloor(f);
    if (f == null && !isPhone) setZoomed(false); // "all" on desktop = zoom back out
  }

  // Keyboard: ↑/↓ ride the elevator while zoomed, Esc zooms back out.
  useEffect(() => {
    if (!cameraOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") setFloor((f) => Math.max(0, (f ?? 4) - 1));
      else if (e.key === "ArrowDown") setFloor((f) => Math.min(3, (f ?? -1) + 1));
      else if (e.key === "Escape" && zoomed) chooseFloor(null);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, zoomed]);
  useEffect(() => {
    recomputeCamera();
    addEventListener("resize", recomputeCamera);
    return () => removeEventListener("resize", recomputeCamera);
  }, [recomputeCamera]);
  // On phones, after the intro, ride up to today's floor.
  useEffect(() => {
    if (!built || !isPhone) return;
    const t = setTimeout(() => setFloor(todayFloor), 500);
    return () => clearTimeout(t);
  }, [built, isPhone, todayFloor]);
  const swipeStart = useRef<number | null>(null);

  // ---- which window is being peeked at (its card floats above the whole building) ----
  const [peek, setPeek] = useState<Peek | null>(null);
  const onPeek = useCallback((p: Peek | null, n: number) => setPeek((cur) => (p ? p : cur?.win.n === n ? null : cur)), []);

  // ---- fly through a window into its door page ----
  const [flying, setFlying] = useState<{ n: number; rect: DOMRect; lit: boolean } | null>(null);
  const onFly = useCallback(
    (n: number, el: HTMLElement, lit: boolean) => {
      router.prefetch(`/door/${n}`);
      setFlying({ n, rect: el.getBoundingClientRect(), lit });
    },
    [router],
  );

  return (
    <div
      className="relative h-dvh w-full touch-pan-x overflow-hidden select-none"
      onPointerDown={(e) => {
        swipeStart.current = isPhone ? e.clientY : null;
      }}
      onPointerUp={(e) => {
        if (swipeStart.current == null) return;
        const dy = e.clientY - swipeStart.current;
        swipeStart.current = null;
        if (Math.abs(dy) < 50) return;
        // swipe up = go up a floor (roof is index 0)
        setFloor((f) => (f == null ? 3 : Math.max(0, Math.min(3, f + (dy < 0 ? -1 : 1)))));
      }}
    >
      <Sky sky={sky} sx={sx} sy={sy} />

      {/* title */}
      <motion.header
        className={`pointer-events-none absolute top-4 left-4 z-30 sm:top-8 sm:left-10 ${onSky}`}
        initial={{ opacity: 0, y: -10 }}
        // fades back while zoomed (or on the roof floor), so it never sits over the windows
        animate={{ opacity: (zoomed || (cameraOn && floor === 0)) && floor != null ? 0.12 : 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.2 }}
      >
        <p className="font-sans text-[10px] font-medium tracking-[0.28em] uppercase opacity-75 sm:text-[11px]">Advent calendar · 2026</p>
        <h1 className="mt-1.5 font-serif text-4xl leading-none italic sm:text-6xl">
          birthday <span className="text-2xl not-italic sm:text-4xl">♡</span>
        </h1>
        <p className="mt-3 font-sans text-[13px] leading-snug sm:text-sm">
          {finale ? "11 of 11 · happy birthday, Jae" : `11 windows to Nov 28 · ${sleeps} ${sleeps === 1 ? "sleep" : "sleeps"} to go`}
        </p>
        <p className="mt-0.5 font-sans text-xs capitalize opacity-70">
          Bangalore · {sky.phase}
          {sky.tempC != null && ` · ${sky.tempC}°C`}
          {sky.raining && " · raining"}
        </p>
      </motion.header>

      {/* the building, with the camera on it */}
      {/* on phones the building sits left of the elevator panel; on desktop it's centred */}
      <div className="absolute inset-x-0 bottom-[72px] flex justify-start pl-2 md:bottom-[3dvh] md:justify-center md:pl-0">
        <motion.div
          ref={boxRef}
          // container-type lets children size text in cqw (1% of the building's width)
          className="relative aspect-[2/3] w-[min(calc(100vw-4.5rem),calc(84dvh*2/3))] [container-type:inline-size] md:w-[min(calc(100vw-1.5rem),calc(84dvh*2/3))]"
          animate={{ scale: camera.scale, y: camera.y }}
          transition={{ type: "spring", stiffness: 70, damping: 16, mass: 1.1 }}
          style={{ x: bX }}
        >
          {/* every push is a star; each day's pushes form that door's constellation (behind the building) */}
          {intro && <Constellations pushes={pushes} fresh={fresh} isPhone={isPhone} phase={sky.phase} todayDoor={todayDoor} built={built} />}
          {intro && <Facade fast={fast} night={sky.phase === "night"} />}

          {intro &&
            WINDOWS.map((w) => {
              const d = byN.get(w.n);
              if (!d) return null;
              const state = doorState(d, finale);
              const lampOn = built && (state === "golden" || ((state === "shipped" || state === "sprouted") && night));
              const lampDelay = state === "golden" ? lampBase + FLOOR_ORDER[w.floor] * 0.45 : lampBase + (w.n % 5) * 0.15;
              return (
                  <Window
                    key={w.n}
                    dimmed={cameraOn && floor != null && FLOORS[floor].id !== w.floor}
                    win={w}
                    state={state}
                    title={DOOR_META[w.n].title}
                    dateLabel={dateLabels[w.n]}
                    isToday={todayDoor === w.n}
                    phase={sky.phase}
                    lampOn={lampOn}
                    lampDelay={lampDelay}
                    built={built}
                    sx={sx}
                    sy={sy}
                    soundOn={soundOn}
                    onFly={onFly}
                    onPeek={onPeek}
                  />
              );
            })}

          {/* and a flower in that day's window box (in front of the windows) */}
          {intro && <WindowBoxes pushes={pushes} fresh={fresh} built={built} />}

          {peek && <PeekCard key={peek.win.n} peek={peek} />}

          {intro && finale && built && <Fireworks color={night ? "#FBE3B0" : "var(--color-line)"} />}

          {intro && (
            <motion.div className="pointer-events-none absolute inset-0 z-30" style={{ x: fgX, y: fgY }}>
              <Foreground lit={night || finale} fast={fast} />
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* controls */}
      <div className={`absolute bottom-4 left-4 z-40 flex items-center rounded-full border border-current/25 p-0.5 ${onSky}`}>
        <ControlButton label={zoomed ? "Zoom out" : "Zoom in (bigger windows and text)"} pressed={zoomed} onClick={toggleZoom}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 L21 21 M7.5 10.5 H13.5" />
          {!zoomed && <path d="M10.5 7.5 V13.5" />}
        </ControlButton>
        <ControlButton label={soundOn ? "Sound on" : "Sound off"} pressed={soundOn} onClick={toggleSound}>
          <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" />
          {soundOn ? <path d="M16 9 C18 11 18 13 16 15 M18.5 6.5 C22 10 22 14 18.5 17.5" /> : <path d="M17 9 L22 14 M22 9 L17 14" />}
        </ControlButton>
        {needsPermission && (
          <ControlButton label="Tilt to peek" pressed={false} onClick={requestTilt}>
            <path d="M8 3 H16 V21 H8 Z M11 18 H13 M3 9 C1 11 1 13 3 15 M21 9 C23 11 23 13 21 15" />
          </ControlButton>
        )}
      </div>

      <AnimatePresence>
        {built && (
          <motion.p
            className={`pointer-events-none absolute right-8 bottom-6 z-30 hidden max-w-56 text-right font-sans text-xs tracking-wide md:block ${onSky}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0.85, 0] }}
            transition={{ duration: 7, times: [0, 0.1, 0.8, 1] }}
          >
            Hover a window to peek · click to step inside
          </motion.p>
        )}
      </AnimatePresence>

      {cameraOn && built && <Elevator floor={floor} onFloor={chooseFloor} />}

      {/* the fly-through: the window grows until its room fills the screen */}
      <AnimatePresence>
        {flying && (
          <motion.div
            className="fixed z-[60] overflow-hidden"
            style={{
              // Doors with their own scene fly into that scene's backdrop; the rest into their room.
              background: DOOR_SCENES[flying.n]?.background ?? (flying.lit ? "radial-gradient(ellipse at 50% 28%, #FFF1CC 0%, #FBD99A 50%, #EFB173 100%)" : "var(--color-glass)"),
              border: "2px solid var(--color-line)",
            }}
            initial={{ top: flying.rect.top, left: flying.rect.left, width: flying.rect.width, height: flying.rect.height, borderRadius: 24 }}
            animate={{ top: 0, left: 0, width: "100vw", height: "100dvh", borderRadius: 0 }}
            transition={{ type: "spring", stiffness: 90, damping: 18, mass: 0.9 }}
            onAnimationComplete={() => router.push(`/door/${flying.n}`)}
          >
            {DOOR_SCENES[flying.n] ? (
              <motion.p
                className="absolute inset-x-0 top-[42%] text-center font-serif text-3xl text-paper italic sm:text-5xl"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.6 } }}
              >
                {DOOR_SCENES[flying.n].caption}
              </motion.p>
            ) : (
              <div className="absolute inset-0 flex items-end justify-center pb-[6dvh]">
                <Room n={flying.n} width={2} className="h-[72%] w-[72%]" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * The label card for the window being peeked at. It lives in its own layer
 * above the building (so it's never covered by the floor below), while the
 * window itself stays behind its window box. It hangs below the window, except
 * on the ground floor where it would run off the screen, so it sits above;
 * windows near the edges align it to that edge.
 */
function PeekCard({ peek }: { peek: Peek }) {
  const { win, title, dateLabel, locked, open } = peek;
  const above = win.floor === "ground";
  const cx = win.x + win.w / 2;
  const align = cx < 140 ? "left" : cx > 340 ? "right" : "center";
  const pos = [
    above ? "bottom-[calc(100%+10px)]" : "top-[calc(100%+20px)]",
    align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2",
  ].join(" ");
  return (
    <div className="pointer-events-none absolute z-40" style={pctBox(win.x, win.y, win.w, win.h)}>
      <div
        className={`card-in absolute w-max max-w-64 rounded-md border border-line/25 bg-paper px-3.5 py-2.5 text-line shadow-[0_12px_32px_-12px_rgba(78,30,40,0.35)] ${pos} ${align === "center" ? "-translate-x-1/2" : ""}`}
        style={{ "--card-dy": above ? "4px" : "-4px" } as React.CSSProperties}
      >
        <p className="font-sans text-[10px] font-medium tracking-[0.16em] uppercase opacity-70">
          No. {String(win.n).padStart(2, "0")} · {dateLabel}
        </p>
        <p className="mt-1 font-serif text-[17px] leading-snug">{locked ? "Sealed until then" : title}</p>
        {!locked && (
          <p className="mt-1.5 font-sans text-xs font-medium opacity-80">{open ? "Step inside →" : "Tap to open the shutters"}</p>
        )}
      </div>
    </div>
  );
}

function ControlButton({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={`flex size-9 items-center justify-center rounded-full transition-colors outline-none hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-current/50 ${pressed ? "bg-current/15" : ""}`}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

/**
 * Realtime: Supabase streams Postgres row changes over a websocket. When the
 * GitHub webhook updates a door, every open browser gets the row within a
 * second, and the window's lamp switches on. Only timestamps are merged;
 * whether a door is reachable stays the server's decision.
 */
function useLiveDoors(initial: CalendarDoor[]) {
  const [doors, setDoors] = useState(initial);
  useEffect(() => {
    const supabase = browserClient();
    if (!supabase) return;
    const channel = supabase
      .channel("calendar-doors")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "doors" }, (payload) => {
        const row = payload.new as DoorRow;
        setDoors((prev) => prev.map((d) => (d.n === row.n ? { ...d, sprouted_at: row.sprouted_at, shipped_at: row.shipped_at } : d)));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  return doors;
}
