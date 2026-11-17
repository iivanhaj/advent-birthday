import { BuildingScene } from "@/components/building/BuildingScene";
import { getCalendarDoors } from "@/lib/calendar-data";
import { getSky } from "@/lib/sky";
import { DOOR_COUNT, dateLabel, doorDate, doorForDate, istDate, sleepsUntilBirthday } from "@/lib/unlock";

// Unlocking depends on the current time, so never serve a cached copy of this page.
export const dynamic = "force-dynamic";

type Search = { preview?: string; sky?: string; rain?: string };

export default async function Home({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const now = new Date();
  const [doors, sky] = await Promise.all([getCalendarDoors(params.preview), getSky(params)]);
  const dateLabels = Object.fromEntries(Array.from({ length: DOOR_COUNT }, (_, i) => [i + 1, dateLabel(doorDate(i + 1))]));

  return <BuildingScene initialDoors={doors} todayDoor={doorForDate(istDate(now))} sleeps={sleepsUntilBirthday(now)} dateLabels={dateLabels} sky={sky} />;
}
