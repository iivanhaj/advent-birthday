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
};

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ n: string }>; searchParams: Promise<{ preview?: string }> };

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

  const preview = (await searchParams).preview;
  const learned = LEARNED[n] ?? ["(fill me in after shipping)"];

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

  const door = (await getCalendarDoors(preview)).find((d) => d.n === n);
  const lit = Boolean(door?.shipped_at);

  return (
    <DoorFrame n={n} title={DOOR_META[n].title} dateLabel={label} backLink={back} learned={learned}>
      <DoorPlaceholder n={n} lit={lit} />
    </DoorFrame>
  );
}
