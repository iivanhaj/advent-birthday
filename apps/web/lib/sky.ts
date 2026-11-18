import { devUnlockAll } from "./unlock";

export type SkyPhase = "dawn" | "day" | "dusk" | "night";
export type Sky = { phase: SkyPhase; raining: boolean; cloudy: boolean; tempC: number | null; source: "live" | "fallback" | "preview" };

const BANGALORE = { lat: 12.97, lon: 77.59 };
const TWILIGHT_MIN = 40; // dawn/dusk last ~40 minutes either side of sunrise/sunset

/** WMO weather codes: 51–67 drizzle/rain, 80–82 showers, 95–99 thunderstorms. */
const isRainCode = (c: number) => (c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95;

function phaseAt(now: Date, sunrise: Date, sunset: Date): SkyPhase {
  const m = 60_000;
  const t = now.getTime();
  if (Math.abs(t - sunrise.getTime()) <= TWILIGHT_MIN * m) return "dawn";
  if (Math.abs(t - sunset.getTime()) <= TWILIGHT_MIN * m) return "dusk";
  return t > sunrise.getTime() && t < sunset.getTime() ? "day" : "night";
}

/** Open-Meteo returns local times without an offset (e.g. "2026-11-17T06:14"); pin them to IST. */
const ist = (local: string) => new Date(`${local}:00+05:30`);

/**
 * Bangalore's real sky right now.
 *
 * `next: { revalidate: 600 }` tells Next's fetch cache to reuse the response
 * for 10 minutes: every visitor in that window shares one upstream request
 * (a time-to-live cache, for free).
 * If the API is down we fall back to typical sunrise/sunset times, so the page
 * never breaks because of the weather.
 */
export async function getSky(preview?: { sky?: string; rain?: string }): Promise<Sky> {
  if (devUnlockAll() && preview?.sky && ["dawn", "day", "dusk", "night"].includes(preview.sky)) {
    return { phase: preview.sky as SkyPhase, raining: preview.rain === "1", cloudy: preview.rain === "1", tempC: 22, source: "preview" };
  }

  const now = new Date();
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${BANGALORE.lat}&longitude=${BANGALORE.lon}` +
      `&current=weather_code,cloud_cover,temperature_2m&daily=sunrise,sunset&timezone=Asia%2FKolkata&forecast_days=1`;
    const res = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const data = (await res.json()) as {
      current: { weather_code: number; cloud_cover: number; temperature_2m: number };
      daily: { sunrise: string[]; sunset: string[] };
    };
    return {
      phase: phaseAt(now, ist(data.daily.sunrise[0]), ist(data.daily.sunset[0])),
      raining: isRainCode(data.current.weather_code),
      cloudy: data.current.cloud_cover > 70,
      tempC: Math.round(data.current.temperature_2m),
      source: "live",
    };
  } catch (err) {
    console.warn("Sky fallback:", (err as Error).message);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
    return { phase: phaseAt(now, ist(`${today}T06:20`), ist(`${today}T17:55`)), raining: false, cloudy: false, tempC: null, source: "fallback" };
  }
}
