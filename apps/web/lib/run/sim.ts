/**
 * Door 9 · Mochi's rooftop run. The game as pure, deterministic maths.
 *
 * The world is made from a seed (today's date, so everyone runs the same
 * rooftops), and the simulation advances in fixed steps of 1/60 s using only
 * the player's input. Same seed + same inputs = the same run, to the star:
 * that's what makes a replay just a list of frame numbers.
 *
 * Distances are in world pixels; the screen is 360 tall with the street at
 * the bottom. Roof `h` is how high a roof's top stands above the bottom.
 */

export const STEP = 1 / 60;
export const VIEW_H = 360;
export const CAT_X = 130; // where Mochi stays on screen, in world pixels from the left edge
export const CAT_W = 34;
/** How far below a roof's top she can still scramble up onto it. */
export const LEDGE = 14;

export const PHYS = {
  gravity: 0.62,
  /** Lighter gravity while the jump is held and she's still rising: a long press jumps higher. */
  holdGravity: 0.34,
  jump: 9.4,
  bounce: 13.2,
  /** Grace frames: a jump still works just after running off an edge, or just before landing. */
  coyote: 6,
  buffer: 7,
  maxFall: 14,
};

export const speedAt = (dist: number) => Math.min(8.6, 3.6 + dist * 0.00042);

/** Longest flight with the button held, rising then falling back to the same height, in frames. */
export function airFrames(): number {
  const up = PHYS.jump / PHYS.holdGravity;
  const h = (PHYS.jump * PHYS.jump) / (2 * PHYS.holdGravity);
  const down = Math.sqrt((2 * h) / PHYS.gravity);
  return up + down;
}
/** Highest a held jump reaches, in pixels. */
export const jumpHeight = () => (PHYS.jump * PHYS.jump) / (2 * PHYS.holdGravity);

export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's course: the date's digits, hashed. "2026-11-26" always gives the same seed. */
export function seedFor(date: string): number {
  let h = 2166136261;
  for (const c of `rooftops:${date}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

export type Roof = {
  x: number;
  w: number;
  h: number;
  /** Decorations, picked by the generator (drawn, not collided). */
  deco: "tank" | "antenna" | "plants" | "lights" | "chimney" | "none";
  /** A striped awning along part of the roof that bounces Mochi high. */
  awning: { x: number; w: number } | null;
  style: number;
};
export type Item = { id: number; x: number; y: number; kind: "star" | "cake" };
export type Bird = { id: number; x: number; y: number; amp: number; phase: number };
export type World = { roofs: Roof[]; items: Item[]; birds: Bird[] };

/**
 * Builds the course up to `untilX`. Every gap is jumpable at the speed she'll
 * be going there (with a margin), and no roof rises higher than a held jump.
 */
export function buildWorld(seed: number, untilX: number): World {
  const rnd = mulberry32(seed);
  const roofs: Roof[] = [{ x: -200, w: 760, h: 120, deco: "lights", awning: null, style: 0 }];
  const items: Item[] = [];
  const birds: Bird[] = [];
  let id = 0;
  while (roofs[roofs.length - 1].x < untilX) {
    const last = roofs[roofs.length - 1];
    const edge = last.x + last.w;
    const v = speedAt(edge);
    const reach = v * airFrames() * 0.62; // comfortably inside a full jump
    const gap = Math.round(56 + rnd() * Math.max(10, reach - 56));
    const rise = Math.min(jumpHeight() * 0.55, 70);
    const h = Math.round(Math.max(70, Math.min(190, last.h + (rnd() - 0.5) * 2 * rise)));
    const w = Math.round(120 + v * 14 + rnd() * 260); // faster runs get roomier roofs to land on
    const x = edge + gap;
    const decos: Roof["deco"][] = ["tank", "antenna", "plants", "lights", "chimney", "none"];
    // sometimes the roof she's leaving gets an awning at its far end: a springboard that throws her
    // across this gap, so only where this roof is no taller and the gap is within the bounce's reach
    if (roofs.length > 1 && last.w > 200 && h <= last.h + 6 && gap < v * 34 && rnd() < 0.2) last.awning = { x: last.x + last.w - 84, w: 72 };
    roofs.push({ x, w, h, deco: decos[Math.floor(rnd() * decos.length)], awning: null, style: Math.floor(rnd() * 4) });
    // stars in a little arc over the roof (or over the gap, to reward the jump); sometimes a slice of cake
    const n = Math.floor(rnd() * 4);
    const overGap = rnd() < 0.35;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      const ix = overGap ? edge + gap * t : x + 40 + (w - 80) * t;
      const arc = overGap ? Math.sin(Math.PI * t) * 50 : 0;
      items.push({ id: id++, x: Math.round(ix), y: Math.round(VIEW_H - Math.max(last.h, h) - 44 - arc), kind: "star" });
    }
    if (rnd() < 0.12) items.push({ id: id++, x: Math.round(x + w * 0.5), y: Math.round(VIEW_H - h - 90), kind: "cake" });
    // pigeons cross later on, at heights you can jump over or run under
    if (x > 1600 && rnd() < 0.22) birds.push({ id: id++, x: x + w * 0.6, y: Math.round(VIEW_H - h - 70 - rnd() * 40), amp: 6 + rnd() * 10, phase: rnd() * 6.28 });
  }
  return { roofs, items, birds };
}

export type Input = { held: boolean; pressed: boolean };
export type Cat = { y: number; vy: number; onGround: boolean; coyote: number; buffer: number; squash: number; jumping: boolean };
export type RunState = {
  frame: number;
  dist: number;
  speed: number;
  cat: Cat;
  score: number;
  stars: number;
  cakes: number;
  got: Set<number>;
  over: null | "fell" | "bird" | "wall";
  /** Events from the last step, for sounds and sparkles. */
  events: ("jump" | "land" | "bounce" | "star" | "cake")[];
};

export function startState(world: World): RunState {
  const r0 = world.roofs[0];
  return { frame: 0, dist: 0, speed: speedAt(0), cat: { y: VIEW_H - r0.h, vy: 0, onGround: true, coyote: 0, buffer: 0, squash: 0, jumping: false }, score: 0, stars: 0, cakes: 0, got: new Set(), over: null, events: [] };
}

/** The roof under Mochi's paws, by her world x (a little forgiving at the edges). */
export function roofAt(world: World, wx: number): Roof | undefined {
  return world.roofs.find((r) => wx + CAT_W * 0.35 >= r.x && wx - CAT_W * 0.35 <= r.x + r.w);
}

export function birdY(b: Bird, frame: number) {
  return b.y + Math.sin(frame * 0.12 + b.phase) * b.amp;
}

/** One fixed step. Mutates and returns `s`. */
export function step(world: World, s: RunState, input: Input): RunState {
  s.events = [];
  if (s.over) return s;
  s.frame++;
  s.speed = speedAt(s.dist);
  s.dist += s.speed;
  const c = s.cat;
  const wx = s.dist + CAT_X;

  if (input.pressed) c.buffer = PHYS.buffer;
  else if (c.buffer > 0) c.buffer--;
  if (c.onGround) c.coyote = PHYS.coyote;
  else if (c.coyote > 0) c.coyote--;

  if (c.buffer > 0 && c.coyote > 0) {
    c.vy = -PHYS.jump;
    c.onGround = false;
    c.coyote = 0;
    c.buffer = 0;
    c.jumping = true;
    s.events.push("jump");
  }
  const rising = c.vy < 0;
  c.vy = Math.min(PHYS.maxFall, c.vy + (rising && input.held && c.jumping ? PHYS.holdGravity : PHYS.gravity));
  const before = c.y;
  c.y += c.vy;

  const roof = roofAt(world, wx);
  const top = roof ? VIEW_H - roof.h : Infinity;
  // a ledge grab: arriving at a roof's edge just below its top, she scrambles up instead of bumping into it
  const grab = roof && !c.onGround && c.y > top && c.y - top <= LEDGE && before - top <= LEDGE + Math.abs(c.vy);
  if (roof && ((c.vy >= 0 && before <= top + 1 && c.y >= top) || grab)) {
    // landed, perhaps on a bouncy awning
    c.y = top;
    const aw = roof.awning;
    if (aw && wx >= aw.x && wx <= aw.x + aw.w) {
      c.vy = -PHYS.bounce;
      c.onGround = false;
      c.jumping = false;
      s.events.push("bounce");
    } else {
      if (!c.onGround) {
        s.events.push("land");
        c.squash = 1;
      }
      c.vy = 0;
      c.onGround = true;
      c.jumping = false;
    }
  } else if (roof && c.y > top + 6 && before > top + 6) {
    s.over = "wall"; // ran into the side of a taller roof
  } else if (!roof || c.y < top) {
    c.onGround = false;
  }
  if (c.squash > 0) c.squash = Math.max(0, c.squash - 0.12);
  if (c.y > VIEW_H + 60) s.over = "fell";

  for (const it of world.items) {
    if (s.got.has(it.id) || Math.abs(it.x - wx) > 24) continue;
    if (Math.abs(it.y - (c.y - 22)) < 28) {
      s.got.add(it.id);
      if (it.kind === "star") {
        s.stars++;
        s.score += 1;
        s.events.push("star");
      } else {
        s.cakes++;
        s.score += 5;
        s.events.push("cake");
      }
    }
  }
  for (const b of world.birds) {
    const bx = b.x - s.frame * 1.2; // pigeons fly towards her
    if (Math.abs(bx - wx) < 20 && Math.abs(birdY(b, s.frame) - (c.y - 18)) < 16) s.over = "bird";
  }
  return s;
}

/**
 * A replay is the frames where the button went down or up, alternating,
 * starting with a press. Stored as gaps between them in base-36, so a whole
 * run fits in a short link.
 */
export function encodeReplay(date: string, toggles: number[]): string {
  const gaps = toggles.map((f, i) => (f - (i ? toggles[i - 1] : 0)).toString(36));
  return `${date}~${gaps.join(".")}`;
}
export function decodeReplay(s: string): { date: string; toggles: number[] } | null {
  const m = /^(\d{4}-\d{2}-\d{2})~([0-9a-z.]*)$/.exec(s);
  if (!m) return null;
  const toggles: number[] = [];
  let f = 0;
  for (const g of m[2] ? m[2].split(".") : []) {
    const n = parseInt(g, 36);
    if (!Number.isFinite(n) || n < 0) return null;
    toggles.push((f += n));
  }
  return { date: m[1], toggles };
}

/** Runs a whole replay to the end (or `maxFrames`) and returns the final state. */
export function simulate(world: World, toggles: number[], maxFrames = 60 * 60 * 10): RunState {
  const s = startState(world);
  let k = 0;
  let held = false;
  while (!s.over && s.frame < maxFrames) {
    let pressed = false;
    while (k < toggles.length && toggles[k] === s.frame) {
      held = !held;
      if (held) pressed = true;
      k++;
    }
    step(world, s, { held, pressed });
  }
  return s;
}
