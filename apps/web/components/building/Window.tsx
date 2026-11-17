"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useTransform, type MotionValue } from "framer-motion";
import { springs } from "@birthday-garden/garden-ui";
import { FRONT_DOOR, SILL, pctBox, windowRadius, type BuildingWindow } from "@/lib/building";
import type { DoorState } from "@/lib/doors";
import type { SkyPhase } from "@/lib/sky";
import { Room } from "./Room";
import { buzz, playShutter } from "./sound";

type Props = {
  win: BuildingWindow;
  state: DoorState;
  title: string;
  dateLabel: string;
  isToday: boolean;
  phase: SkyPhase;
  /** Lamp on? (decided by the scene: sunset + progress, or the finale) */
  lampOn: boolean;
  lampDelay: number;
  /** The façade has finished drawing itself. */
  built: boolean;
  sx: MotionValue<number>;
  sy: MotionValue<number>;
  soundOn: boolean;
  /** Phone elevator: windows on other floors fade back. */
  dimmed?: boolean;
  onFly: (n: number, el: HTMLElement, lit: boolean) => void;
};

/** Louvred shutter slats: thin lines every 7px, drawn with a gradient (no extra elements). */
const LOUVERS = "repeating-linear-gradient(180deg, transparent 0 6px, color-mix(in srgb, var(--color-line) 45%, transparent) 6px 7px)";

export function Window({ win, state, title, dateLabel, isToday, phase, lampOn, lampDelay, built, sx, sy, soundOn, dimmed = false, onFly }: Props) {
  const router = useRouter();
  const ref = useRef<HTMLButtonElement>(null);
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const locked = state === "locked";
  const progressed = state === "sprouted" || state === "shipped" || state === "golden";
  const open = built && !locked && (progressed || hover || pinned);

  /*
   * Diorama depth: the room sits "behind" the glass, so it moves opposite to
   * the viewer, a little. Peeking from the left shows more of the room's
   * right side, just like a real window.
   */
  const roomX = useTransform(sx, (v) => `${v * -9}%`);
  const roomY = useTransform(sy, (v) => `${v * -6}%`);

  const night = phase === "night" || phase === "dusk";

  // Where the hover tag hangs (see the comment on the tag below).
  const above = win.floor === "ground";
  const cx = win.x + win.w / 2;
  const align = cx < 140 ? "left" : cx > 340 ? "right" : "center";
  const tagPos = {
    above,
    x: align === "center" ? "-50%" : "0%",
    className: [
      above ? "bottom-[calc(100%+10px)] origin-bottom" : "top-[calc(100%+18px)] origin-top",
      align === "left" ? "left-0" : align === "right" ? "right-0" : "left-1/2",
    ].join(" "),
  };
  const glass = lampOn ? undefined : night ? "#2B2548" : "var(--color-glass)";
  const roomColor = lampOn || !night ? "var(--color-line)" : "rgba(251,241,238,0.35)";

  function activate() {
    if (locked) {
      // Rattle the shutters: restart a CSS animation by removing + re-adding the class.
      const el = rootRef.current;
      if (el) {
        el.classList.remove("window-rattle");
        void el.offsetWidth; // forces a reflow so the browser sees the class as new
        el.classList.add("window-rattle");
      }
      if (soundOn) playShutter("locked");
      buzz(25);
      setHover(true);
      return;
    }
    if (!open) {
      setPinned(true);
      if (soundOn) playShutter("open");
      buzz();
      return;
    }
    if (ref.current) onFly(win.n, ref.current, lampOn);
  }

  return (
    <div
      ref={rootRef}
      className="absolute"
      // The hovered window rises above its neighbours so its hanging tag isn't covered by the floor below.
      style={{ ...pctBox(win.x, win.y, win.w, win.h), zIndex: hover || pinned ? 35 : 5, opacity: dimmed ? 0.45 : 1, transition: "opacity 0.5s" }}
    >
      <button
        ref={ref}
        type="button"
        onClick={activate}
        onMouseEnter={() => {
          setHover(true);
          if (!locked) router.prefetch(`/door/${win.n}`);
          if (!locked && !open && soundOn) playShutter("open");
        }}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        aria-label={locked ? `Window ${win.n}, ${title}: sealed until ${dateLabel}` : `Window ${win.n}, ${title}, ${dateLabel}. ${open ? "Step inside" : "Open the shutters"}`}
        className={`absolute inset-0 overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-line focus-visible:ring-offset-2 ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
        // Fade in once the façade lines are drawn (plain CSS transition).
        style={{
          borderRadius: windowRadius(win),
          border: "1.5px solid var(--color-line)", // same pen weight as every façade line
          background: glass,
          opacity: built ? 1 : 0,
          transition: "background 0.8s, opacity 0.5s",
        }}
      >
        {/* lamplight: switches on with a CSS transition (delay staggers the windows) */}
        <span
          className={`absolute inset-0 ${lampOn ? "lamp-flicker" : ""}`}
          style={{
            background: "radial-gradient(ellipse at 50% 28%, #FFF1CC 0%, #FBD99A 50%, #EFB173 100%)",
            opacity: lampOn ? 1 : 0,
            transition: `opacity 0.6s ease-out ${lampOn ? lampDelay : 0}s`,
          }}
        />

        {/* the room, deeper than the glass */}
        <motion.span className="absolute -inset-[10%] flex items-end justify-center pb-[10%]" style={{ x: roomX, y: roomY }}>
          <Room n={win.n} color={roomColor} className="h-[78%] w-[78%]" />
        </motion.span>

        {/*
          Shutters: two real 3D panels hinged on the outer edges. `perspective`
          on the parent makes the rotateY look like depth. The cubic-bezier with
          a y-value above 1 (1.45) overshoots slightly: a spring feel in pure CSS.
        */}
        <span className="absolute inset-0 [perspective:260px]">
          {(["left", "right"] as const).map((side) => (
            <span
              key={side}
              className="absolute top-0 h-full w-1/2 bg-paper"
              style={{
                [side]: 0,
                transformOrigin: side,
                backgroundImage: LOUVERS,
                borderLeft: side === "right" ? "1.5px solid var(--color-line)" : undefined,
                borderRight: side === "left" ? "1.5px solid var(--color-line)" : undefined,
                transform: `rotateY(${open ? (side === "left" ? -76 : 76) : 0}deg)`,
                transition: "transform 0.75s cubic-bezier(0.3, 1.45, 0.5, 1)",
              }}
            />
          ))}
        </span>
      </button>

      {/*
        The window's number. Normal windows carry it on their sill; the front
        door gets a little house-number plate. Sizes are in % of the window and
        cqw (1% of the building's width), so they scale with the drawing and
        never cross a floor line at any screen size.
      */}
      {win.n === FRONT_DOOR ? (
        <span
          aria-hidden
          className={`pointer-events-none absolute left-1/2 z-10 flex -translate-x-1/2 items-center justify-center rounded-[2px] border-[1.5px] border-line font-serif text-line italic ${locked ? "opacity-60" : ""}`}
          style={{ top: "12%", width: "44%", height: "15%", fontSize: "max(8px, 2.6cqw)", background: isToday ? "var(--color-glow)" : "var(--color-paper)" }}
        >
          {win.n}
        </span>
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute left-[-6%] flex w-[112%] items-center justify-center border-[1.5px] border-line font-serif leading-none text-line italic"
          style={{ top: "100%", height: `${(SILL / win.h) * 100}%`, fontSize: "max(8px, 2.5cqw)", background: isToday ? "var(--color-glow)" : "var(--color-paper)" }}
        >
          <span className={locked ? "opacity-55" : ""}>{win.n}</span>
        </span>
      )}

      {/*
        Kraft tag on hover/focus. It hangs below the window, except on the
        ground floor where there's no room below (it would be cut off by the
        screen edge), so it hangs above instead. Windows near the left/right
        edge align the tag to that edge rather than centring it, for the same reason.
      */}
      <AnimatePresence>
        {(hover || pinned) && built && (
          <motion.div
            className={`kraft pointer-events-none absolute z-40 w-max max-w-60 px-4 py-2.5 shadow-[0_10px_22px_-10px_rgba(74,52,36,0.65)] ${tagPos.className}`}
            initial={{ opacity: 0, y: tagPos.above ? 8 : -8, rotate: -6, x: tagPos.x }}
            animate={{ opacity: 1, y: 0, rotate: -1.5, x: tagPos.x, transition: springs.bouncy }}
            exit={{ opacity: 0, y: tagPos.above ? 6 : -6, x: tagPos.x, transition: { duration: 0.15 } }}
          >
            <p className="font-hand text-xl leading-none">
              no. {win.n} · {dateLabel}
            </p>
            <p className="mt-1 font-serif text-lg leading-tight italic">{locked ? "sealed. no peeking." : title}</p>
            {!locked && <p className="mt-1.5 font-hand text-lg leading-none opacity-85">{open ? "click to step inside →" : "tap to open"}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
