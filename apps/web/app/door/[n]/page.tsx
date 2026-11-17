import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DoorFrame } from "@birthday-garden/garden-ui";
import { getCalendarDoors } from "@/lib/calendar-data";
import { DOOR_META } from "@/lib/doors";
import { DOOR_COUNT, dateLabel, doorDate, isDoorReachable } from "@/lib/unlock";
import { DoorPlaceholder, SealedDoor } from "./placeholders";

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
    <Link href="/" className="font-hand text-2xl text-line underline decoration-dashed underline-offset-4 hover:opacity-70">
      ← back to the building
    </Link>
  );

  // The unlock check happens here, on the server. A sealed door's build never
  // gets sent to the browser at all, so there's nothing to peek at.
  if (!isDoorReachable(n)) return <SealedDoor n={n} dateLabel={label} backLink={back} />;

  const door = (await getCalendarDoors((await searchParams).preview)).find((d) => d.n === n);
  const lit = Boolean(door?.shipped_at);

  return (
    <DoorFrame n={n} title={DOOR_META[n].title} dateLabel={label} backLink={back} learned={["(fill me in after shipping)"]}>
      <DoorPlaceholder n={n} lit={lit} />
    </DoorFrame>
  );
}
