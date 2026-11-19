/**
 * Mochi, drawn in the building's fine-line style (the "storybook line" design).
 *
 * She's built from parts (body, head, four legs, tail) instead of fixed
 * frames, so the runtime can animate them: legs swing with the walk phase,
 * the head dips to eat, the body tilts mid-jump. Everything is in a 200 × 130
 * box with her paws at (90, 112); strokes don't scale, so she has the same
 * 1.5px pen line as the façade at any size.
 */

export type Pose = "stand" | "walk" | "jump" | "sit" | "groom" | "hungry" | "purr" | "eat" | "sleep";

export const SPRITE_W = 200;
export const SPRITE_H = 130;
/** Where her paws touch the ground, in sprite units. */
export const ANCHOR = { x: 90, y: 112 } as const;

const INK = "var(--color-line)";
const PAPER = "var(--color-paper)";
const line = { stroke: INK, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", vectorEffect: "non-scaling-stroke" } as const;

type Props = {
  pose: Pose;
  /** Walk-cycle phase in radians (advanced by the runtime with distance travelled). */
  phase?: number;
  /** Vertical speed while jumping: negative going up. Tilts the body. */
  vy?: number;
  /** 1 = facing right, -1 = facing left. */
  dir?: 1 | -1;
  width: number;
};

export function MochiSprite({ pose, phase = 0, vy = 0, dir = 1, width }: Props) {
  const flip = dir === -1 ? `translate(${SPRITE_W} 0) scale(-1 1)` : undefined;
  const sitting = pose === "sit" || pose === "groom" || pose === "hungry" || pose === "purr";
  return (
    <svg viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`} width={width} height={(width * SPRITE_H) / SPRITE_W} overflow="visible" aria-hidden>
      <ellipse cx={ANCHOR.x} cy={ANCHOR.y + 1} rx={pose === "sleep" ? 52 : 44} ry={3} fill={INK} opacity={pose === "jump" ? 0.04 : 0.09} />
      <g transform={flip}>{pose === "sleep" ? <Sleeping /> : sitting ? <Sitting pose={pose} /> : <Standing pose={pose} phase={phase} vy={vy} />}</g>
      {pose === "hungry" && <Bubble x={dir === 1 ? 104 : 40} y={22} text="mrrp?" />}
      {pose === "purr" && <Bubble x={dir === 1 ? 110 : 46} y={24} text="prrr ♡" />}
      {pose === "sleep" && (
        <g className="mochi-zz" fill={INK} fontFamily="var(--font-serif)" fontStyle="italic">
          <text x={dir === 1 ? 46 : 120} y={66} fontSize={15}>
            z
          </text>
          <text x={dir === 1 ? 58 : 132} y={54} fontSize={11} opacity={0.7}>
            z
          </text>
        </g>
      )}
    </svg>
  );
}

function Bubble({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text x={x} y={y} fontSize={15} fill={INK} fontFamily="var(--font-serif)" fontStyle="italic" className="mochi-pop">
      {text}
    </text>
  );
}

/** The head, facing right; `eyes` closed for naps and purrs. Pivot for nods is the neck (128, 78). */
function Head({ cx, cy, r = 18, closed = false }: { cx: number; cy: number; r?: number; closed?: boolean }) {
  const s = r / 18;
  const p = (dx: number, dy: number) => `${cx + dx * s} ${cy + dy * s}`;
  return (
    <g>
      <path d={`M${p(-15, -10)} L${p(-13, -29)} L${p(-1, -17)} Z M${p(5, -17)} L${p(17, -27)} L${p(16, -9)} Z`} fill={PAPER} {...line} />
      <circle cx={cx} cy={cy} r={r} fill={PAPER} {...line} />
      {closed ? (
        <path d={`M${p(5, -2)} q${4 * s} ${3 * s} ${8 * s} 0`} fill="none" {...line} />
      ) : (
        <circle cx={cx + 8 * s} cy={cy - 3 * s} r={1.8 * s} fill={INK} />
      )}
      <path d={`M${p(15, 4)} l${2 * s} ${1.5 * s} l${-2 * s} ${1.5 * s}`} fill="none" {...line} />
    </g>
  );
}

/** A leg hanging from its hip, swung by `deg` around the hip. */
function Leg({ x, y, deg, len = 14 }: { x: number; y: number; deg: number; len?: number }) {
  return <path d={`M${x} ${y} V${y + len}`} transform={`rotate(${deg} ${x} ${y})`} fill="none" {...line} />;
}

function Standing({ pose, phase, vy }: { pose: Pose; phase: number; vy: number }) {
  const walking = pose === "walk";
  const swing = walking ? Math.sin(phase) * 24 : 0;
  // Mid-jump: front legs reach forward, back legs push back, body tilts with the climb or fall.
  const jump = pose === "jump";
  const tilt = jump ? Math.max(-18, Math.min(18, vy * 0.02)) : 0;
  const bob = walking ? Math.abs(Math.cos(phase)) * -1.5 : 0;
  const eat = pose === "eat";
  return (
    <g transform={`translate(0 ${bob}) rotate(${tilt} 90 86)`}>
      <path d="M48 90 C30 86 26 66 34 54" fill="none" className="mochi-tail" {...line} />
      {/* far legs first, so the body covers their tops */}
      <Leg x={66} y={98} deg={jump ? 40 : walking ? -swing : -16} />
      <Leg x={126} y={98} deg={jump ? -40 : walking ? swing : 24} />
      <path d="M46 100 C42 82 56 72 80 72 L112 72 C128 72 136 84 134 100 Z" fill={PAPER} {...line} />
      <Leg x={58} y={98} deg={jump ? 34 : walking ? swing : 24} />
      <Leg x={118} y={98} deg={jump ? -34 : walking ? -swing : -24} />
      <g transform={eat ? "rotate(30 128 78) translate(4 10)" : undefined} className={eat ? "mochi-nibble" : undefined}>
        <Head cx={141} cy={66} />
      </g>
    </g>
  );
}

function Sitting({ pose }: { pose: Pose }) {
  const groom = pose === "groom";
  return (
    <g>
      <path d="M72 110 C50 113 44 100 54 93" fill="none" className="mochi-tail" style={{ transformOrigin: "72px 110px" }} {...line} />
      <path d="M70 112 C62 88 70 62 96 62 C118 62 126 86 120 112 Z" fill={PAPER} {...line} />
      <path d="M104 86 V112" fill="none" {...line} />
      {/* grooming: one paw comes up to the face */}
      <g className={groom ? "mochi-groom" : undefined} style={{ transformBox: "view-box", transformOrigin: "112px 86px" }}>
        <path d="M112 86 V112" fill="none" {...line} />
      </g>
      <g transform={groom ? "rotate(-12 101 62)" : pose === "hungry" ? "rotate(-6 101 62)" : undefined}>
        <Head cx={101} cy={46} closed={pose === "purr" || groom} />
      </g>
    </g>
  );
}

function Sleeping() {
  return (
    <g className="mochi-breathe" style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
      <ellipse cx={104} cy={97} rx={48} ry={16} fill={PAPER} {...line} />
      <path d="M152 100 C154 116 112 118 84 110" fill="none" {...line} />
      <Head cx={68} cy={92} r={15} closed />
    </g>
  );
}
