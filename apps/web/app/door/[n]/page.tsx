import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DoorFrame } from "@birthday-garden/garden-ui";
import { getCalendarDoors, getPushes } from "@/lib/calendar-data";
import { DOOR_META } from "@/lib/doors";
import { DOOR_COUNT, dateLabel, doorDate, doorForDate, istDate, isDoorReachable } from "@/lib/unlock";
import { DoorPlaceholder, SealedDoor } from "./placeholders";
import { Greenhouse } from "./Greenhouse";
import { MochiHome } from "./MochiHome";
import { BirthdayRecords } from "./BirthdayRecords";
import { CommitPond } from "./CommitPond";
import { getSky } from "@/lib/sky";

/** Each door's "what I learned" card (written after shipping). */
const LEARNED: Record<number, string[]> = {
  1: [
    "Supabase Realtime turns a Postgres INSERT into a websocket event, so a push lights a star in about a second",
    "seed a PRNG with the commit SHA and the same push draws the same star on every screen",
    "Math.cos can differ in the last digit between Node and browsers, enough to break hydration",
  ],
  2: [
    "a statechart keeps behaviour honest: every state and transition is explicit, and testable without a browser",
    "A* over (ledge, x) states turns 'get to the kibble' into a route of walks and jumps",
    "a jump is three facts (start, end, apex height); the projectile equations do the rest",
  ],
  3: [
    "separate the plan from the paint: a seeded list of brush strokes is pure data, so determinism is testable without a canvas",
    "watercolour is many nearly transparent layers of a slightly different deformed polygon, not one soft blob",
    "Spotify's iFrame API reports playback position, which is all a tonearm needs",
  ],
  4: [
    "a spatial hash turns 'check every fish' into 'check your 3 × 3 cells', and a test can prove it finds the same neighbours",
    "water is the wave equation on a grid: next = (four neighbours) / 2 − previous, run in parallel in a shader",
    "a WebGPU compute shader can compare 100 million pairs a frame if each workgroup shares its tile of fish",
  ],
};

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ n: string }>; searchParams: Promise<{ preview?: string; sky?: string; rain?: string }> };

function parseDoor(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= DOOR_COUNT ? n : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const n = parseDoor((await params).n);
  return { title: n ? `no. ${n} · ${DOOR_META[n].title}` : "Window not found" };
}

export default async function DoorPage({ params, searchParams }: Params) {
  const n = parseDoor((await params).n);
  if (!n) notFound();

  const label = dateLabel(doorDate(n));
  const back = (
    <Link
      href="/"
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 whitespace-nowrap font-sans text-xs font-medium tracking-wide transition-colors ${n === 1 ? "border-paper/30 text-paper hover:bg-paper/10" : "border-line/30 bg-paper text-line hover:bg-glass"}`}
    >
      ← The building
    </Link>
  );

  // The unlock check happens here, on the server. A sealed door's build never
  // gets sent to the browser at all, so there's nothing to peek at.
  if (!isDoorReachable(n)) return <SealedDoor n={n} dateLabel={label} backLink={back} />;

  const query = await searchParams;
  const preview = query.preview;
  const learned = LEARNED[n] ?? [];

  // Door 1: the greenhouse (a stem inside and a star outside for every push).
  if (n === 1) {
    const pushes = await getPushes(preview);
    return (
      <DoorFrame n={n} title={DOOR_META[n].title} dateLabel={label} backLink={back} learned={learned}>
        <Greenhouse initialPushes={pushes} todayDoor={doorForDate(istDate())} />
      </DoorFrame>
    );
  }

  // Door 2: Mochi's home (Mochi herself roams every page).
  if (n === 2) {
    const pushes = await getPushes(preview);
    return (
      <DoorFrame n={n} title={DOOR_META[n].title} dateLabel={label} backLink={back} learned={learned}>
        <MochiHome initialPushes={pushes} today={istDate()} />
      </DoorFrame>
    );
  }

  // Door 3: birthday records.
  if (n === 3) {
    return (
      <DoorFrame n={n} title={DOOR_META[n].title} dateLabel={label} backLink={back} learned={learned}>
        <BirthdayRecords />
      </DoorFrame>
    );
  }

  // Door 4: the commit pond (its look follows the real sky).
  if (n === 4) {
    const [pushes, sky] = await Promise.all([getPushes(preview), getSky({ sky: query.sky, rain: query.rain })]);
    return (
      <DoorFrame n={n} title={DOOR_META[n].title} dateLabel={label} backLink={back} learned={learned}>
        <CommitPond initialPushes={pushes} phase={sky.phase} />
      </DoorFrame>
    );
  }

  const door = (await getCalendarDoors(preview)).find((d) => d.n === n);
  const lit = Boolean(door?.shipped_at);

  return (
    <DoorFrame n={n} title={DOOR_META[n].title} dateLabel={label} backLink={back} learned={learned}>
      <DoorPlaceholder n={n} title={DOOR_META[n].title} lit={lit} />
    </DoorFrame>
  );
}
