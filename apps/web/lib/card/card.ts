/**
 * Door 8 · the holographic birthday card. Everything on a card, worked out
 * from a name, a birthday and a personality type, with no randomness: the
 * same inputs always print the same card, so a shared link shows exactly the
 * card that was made.
 */

export type Element = "Fire" | "Earth" | "Air" | "Water";
/** A star: x, y in a 100 × 100 box, and its brightness (1 = brightest, 3 = faint). */
export type Star = [number, number, 1 | 2 | 3];
export type Sign = { name: string; element: Element; trait: string; burst: string; stars: Star[]; lines: [number, number][] };

/** The twelve signs, Capricorn first (so a sign's index = the month its season mostly fills, mod 12). */
export const SIGNS: Sign[] = [
  { name: "Capricorn", element: "Earth", trait: "climbs any deadline", burst: "Summit", stars: [[12, 40, 2], [30, 30, 1], [52, 36, 3], [74, 28, 2], [88, 48, 2], [60, 66, 3], [30, 62, 2]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]] },
  { name: "Aquarius", element: "Air", trait: "waters everyone's plants", burst: "Tidebreak", stars: [[10, 30, 2], [28, 42, 1], [46, 32, 2], [62, 48, 3], [78, 38, 2], [90, 62, 3], [50, 70, 3]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 6]] },
  { name: "Pisces", element: "Water", trait: "swims through moods", burst: "Dreamtide", stars: [[8, 66, 2], [26, 56, 3], [44, 62, 2], [62, 46, 3], [78, 26, 2], [92, 42, 1], [84, 58, 3]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { name: "Aries", element: "Fire", trait: "charges in first", burst: "First spark", stars: [[18, 56, 3], [44, 40, 1], [66, 44, 2], [86, 64, 3]], lines: [[0, 1], [1, 2], [2, 3]] },
  { name: "Taurus", element: "Earth", trait: "won't leave the couch", burst: "Bedrock", stars: [[10, 24, 3], [34, 44, 2], [50, 50, 1], [64, 40, 2], [90, 20, 2], [54, 70, 3]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },
  { name: "Gemini", element: "Air", trait: "talks in two voices", burst: "Twin winds", stars: [[30, 14, 1], [34, 44, 2], [38, 76, 3], [66, 16, 1], [70, 46, 2], [74, 78, 3]], lines: [[0, 1], [1, 2], [3, 4], [4, 5], [1, 4]] },
  { name: "Cancer", element: "Water", trait: "pinches when hungry", burst: "Moonshell", stars: [[50, 18, 2], [50, 46, 3], [26, 70, 2], [76, 72, 1]], lines: [[0, 1], [1, 2], [1, 3]] },
  { name: "Leo", element: "Fire", trait: "roars at the mirror", burst: "Sunroar", stars: [[20, 34, 2], [30, 18, 3], [44, 24, 2], [46, 42, 1], [70, 54, 2], [88, 66, 2], [60, 70, 3]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { name: "Virgo", element: "Earth", trait: "alphabetises the chaos", burst: "Harvest", stars: [[10, 34, 3], [30, 40, 2], [48, 48, 2], [66, 38, 2], [86, 26, 3], [54, 74, 1]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },
  { name: "Libra", element: "Air", trait: "can't pick a restaurant", burst: "Balance", stars: [[50, 16, 2], [24, 46, 1], [76, 46, 2], [32, 76, 3], [68, 76, 3]], lines: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4]] },
  { name: "Scorpio", element: "Water", trait: "stings politely", burst: "Deep current", stars: [[10, 22, 2], [26, 30, 2], [40, 42, 1], [52, 58, 2], [66, 70, 3], [82, 66, 2], [92, 50, 2]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]] },
  { name: "Sagittarius", element: "Fire", trait: "draws the bow", burst: "Archer's flame", stars: [[16, 66, 2], [36, 46, 1], [54, 56, 2], [70, 36, 2], [88, 24, 3], [58, 76, 3], [44, 28, 3]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [1, 6]] },
];

/** The day each sign begins, by month: the sign whose season starts in month m starts on START_DAY[m-1]. */
export const START_DAY = [20, 19, 21, 20, 21, 21, 23, 23, 23, 23, 22, 22];

/**
 * Which sign a birthday falls under. In month m the sign changes on START_DAY;
 * before it you're still the sign whose season began last month. With Capricorn
 * at index 0, the sign beginning in month m is SIGNS[m % 12].
 */
export function signOf(month: number, day: number): Sign {
  return SIGNS[(day >= START_DAY[month - 1] ? month : month - 1) % 12];
}

export type Petal = "round" | "point" | "notch" | "frill";
export type Flower = { name: string; petals: number; layers: number; length: number; width: number; tip: Petal; cup: number; inner: string; outer: string };
/** Birth flowers by month, with a petal recipe each (drawn by the card's painter). */
export const FLOWERS: Flower[] = [
  { name: "carnation", petals: 14, layers: 3, length: 1, width: 0.55, tip: "frill", cup: 0.25, inner: "#fff4f6", outer: "#e88aa6" },
  { name: "violet", petals: 5, layers: 1, length: 1, width: 0.9, tip: "round", cup: 0.15, inner: "#f4ecff", outer: "#9b7ad9" },
  { name: "daffodil", petals: 6, layers: 1, length: 1.05, width: 0.6, tip: "point", cup: 0.45, inner: "#fffbe6", outer: "#f2c45a" },
  { name: "daisy", petals: 18, layers: 1, length: 1.05, width: 0.28, tip: "round", cup: 0.25, inner: "#ffffff", outer: "#f6dfe4" },
  { name: "lily of the valley", petals: 6, layers: 1, length: 0.8, width: 0.75, tip: "point", cup: 0.2, inner: "#ffffff", outer: "#dcebd8" },
  { name: "rose", petals: 6, layers: 4, length: 0.95, width: 0.95, tip: "round", cup: 0.18, inner: "#fff0f3", outer: "#d9607f" },
  { name: "larkspur", petals: 5, layers: 2, length: 1, width: 0.7, tip: "point", cup: 0.2, inner: "#eef3ff", outer: "#8aa6e6" },
  { name: "poppy", petals: 4, layers: 2, length: 1, width: 1.1, tip: "round", cup: 0.22, inner: "#ffe9e0", outer: "#e8664c" },
  { name: "aster", petals: 22, layers: 2, length: 1, width: 0.22, tip: "point", cup: 0.24, inner: "#f6efff", outer: "#b48ae6" },
  { name: "marigold", petals: 16, layers: 3, length: 0.95, width: 0.45, tip: "frill", cup: 0.22, inner: "#fff4d6", outer: "#f0a23c" },
  { name: "chrysanthemum", petals: 26, layers: 4, length: 1, width: 0.2, tip: "round", cup: 0.16, inner: "#fff3f6", outer: "#ec8fb1" },
  { name: "narcissus", petals: 6, layers: 1, length: 1, width: 0.62, tip: "point", cup: 0.36, inner: "#fffdf3", outer: "#f6e7b0" },
];

export const TYPES = ["INFJ", "INFP", "INTJ", "INTP", "ISFJ", "ISFP", "ISTJ", "ISTP", "ENFJ", "ENFP", "ENTJ", "ENTP", "ESFJ", "ESFP", "ESTJ", "ESTP"] as const;
export type CardInput = { name: string; birthday: string; type: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TALENT = [
  "Everyone nearby skips a turn, and nobody minds.",
  "Alarms deal no damage for the rest of the day.",
  "Heals 20 HP for every snack within reach.",
  "Your next move lands twice.",
  "Adds 10 to every plan you make.",
  "Starts the weekend early: allies relax and heal 30 HP.",
  "Fills the room with good energy for two turns.",
];
const WEAKNESS = ["cake", "puppies", "sunsets", "sad songs", "sale signs", "rainy days", "fresh stationery", "a good playlist"];
const RESISTS = ["mondays", "small talk", "cold coffee", "spoilers", "alarms", "bad wifi", "group chats", "long queues"];
const RECHARGE = ["a nap", "bubble tea", "one more episode", "hotpot", "a long walk", "fries", "a sunset", "a hug"];
const STATS = ["Sweetness", "Aura", "Chaos", "Snack radar"];

/** FNV-1a: a small, fast string hash, the same in every browser and on the server. */
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.codePointAt(0)!, 16777619);
  return h >>> 0;
}

/** "YYYY-MM-DD" → its parts, or null if it isn't a real date (31 February, say). */
export function parseBirthday(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? { y, m: mo, d } : null;
}

export const cleanName = (s: string) => s.replace(/[^\p{L}\p{N} .'-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);

export type Card = {
  name: string;
  type: string;
  sign: Sign;
  flower: Flower;
  /** Days on earth so far (the card's HP). */
  hp: number;
  /** Day of the year, counting 29 Feb, so every birthday has its own number out of 366. */
  number: number;
  serial: string;
  stats: { label: string; value: number }[];
  talent: { name: string; text: string; power: number };
  burst: { name: string; text: string };
  weakness: string;
  resists: string;
  recharge: string;
};

export function makeCard(input: CardInput, today: Date): Card | null {
  const b = parseBirthday(input.birthday);
  if (!b) return null;
  const born = Date.UTC(b.y, b.m - 1, b.d);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const name = cleanName(input.name) || "You";
  const type = (TYPES as readonly string[]).includes(input.type) ? input.type : "INFJ";
  const h = hash(`${name.toLowerCase()}|${input.birthday}|${type}`);
  const sign = signOf(b.m, b.d);
  const weekday = new Date(born).getUTCDay();
  return {
    name,
    type,
    sign,
    flower: FLOWERS[b.m - 1],
    hp: Math.max(0, Math.round((now - born) / 86_400_000)),
    number: Math.round((Date.UTC(2024, b.m - 1, b.d) - Date.UTC(2024, 0, 1)) / 86_400_000) + 1,
    serial: String(h).padStart(10, "0").slice(0, 10),
    stats: STATS.map((label, i) => ({ label, value: 9 + ((h >>> (i * 3)) & 1) })),
    talent: { name: `Born on a ${DAYS[weekday]}`, text: TALENT[weekday], power: 10 * (weekday + 1) },
    burst: { name: sign.burst, text: `${sign.name}'s signature: ${sign.trait}. Grows stronger every birthday, +10 a year.` },
    weakness: WEAKNESS[h % WEAKNESS.length],
    resists: RESISTS[(h >>> 5) % RESISTS.length],
    recharge: RECHARGE[(h >>> 10) % RECHARGE.length],
  };
}
