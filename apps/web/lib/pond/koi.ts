/**
 * A push becomes a koi. Everything comes from the push itself, seeded by its
 * SHA so the same push is always the same fish on every device:
 *   school  = the door (day) it landed on, so each day swims together;
 *   patches = the kinds of files it touched, in door 1's colours, biggest first;
 *   size    = how many files it touched (a big push is a big fish);
 *   pattern = where the patches sit, from the SHA.
 */
import type { FileCounts, FileKind } from "../file-kinds.ts";

/** Stronger versions of the greenhouse tints, so patches read on a koi's back. */
export const KOI_COLOURS: Record<FileKind, string> = {
  ts: "#E58FA8",
  css: "#F2C45A",
  sql: "#6FB5A5",
  md: "#9E8BD6",
  config: "#7FA9D1",
  java: "#E8945A",
  py: "#8DBF6A",
  rust: "#C9774E",
  html: "#E07A5F",
  asset: "#B8A89A",
  other: "#D9879C",
};

export type KoiLook = {
  id: string;
  school: number;
  length: number; // px at 1×
  patches: { colour: string; at: number; across: number; size: number }[]; // at: 0 head → 1 tail
  phase: number;
};

/** Integer-only string hash → PRNG (same idea as the rest of the site: identical on every engine). */
function rng(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function koiFor(push: { delivery_id: string; sha: string | null; files?: FileCounts | null }, school: number): KoiLook {
  const r = rng(push.sha ?? push.delivery_id);
  const kinds = Object.entries(push.files ?? {})
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [FileKind, number][];
  const total = kinds.reduce((s, [, n]) => s + n, 0);
  const used: FileKind[] = kinds.length ? kinds.slice(0, 3).map(([k]) => k) : ["other"];
  const patches = used.map((k, i) => ({
    colour: KOI_COLOURS[k],
    at: Math.round((0.22 + i * 0.22 + (r() - 0.5) * 0.12) * 1000) / 1000,
    across: Math.round((r() - 0.5) * 0.5 * 1000) / 1000,
    size: Math.round((i === 0 ? 0.75 : 0.5 + r() * 0.2) * 1000) / 1000,
  }));
  // 18 px for a one-file push, growing gently (log) up to ~38 px for big ones
  const length = Math.round(18 + Math.min(20, Math.log2(1 + total) * 5));
  return { id: push.delivery_id, school, length, patches, phase: Math.round(r() * 6283) / 1000 };
}
