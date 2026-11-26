"use client";

/**
 * The run's sounds, synthesised (no audio files): a bell for each star that
 * climbs a pentatonic scale as you string them together, a soft thump on
 * landing, a springy "boing" for awnings and a falling sigh when it's over.
 */

let ctx: AudioContext | null = null;
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

function tone(freq: number, at: number, len: number, vol: number, type: OscillatorType = "sine", slide = 0) {
  if (!ctx) return;
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), at + len);
  gn.gain.setValueAtTime(0, at);
  gn.gain.linearRampToValueAtTime(vol, at + 0.006);
  gn.gain.exponentialRampToValueAtTime(0.0001, at + len);
  o.connect(gn).connect(ctx.destination);
  o.start(at);
  o.stop(at + len + 0.05);
}

export function wake() {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function play(kind: "star" | "cake" | "jump" | "land" | "bounce" | "over", combo = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (kind === "star") {
    const f = 659.25 * Math.pow(2, PENTA[Math.min(combo, PENTA.length - 1)] / 12);
    tone(f, t, 0.7, 0.07);
    tone(f * 2.01, t, 0.35, 0.025);
  } else if (kind === "cake") {
    [0, 4, 7, 12].forEach((s, i) => tone(523.25 * Math.pow(2, s / 12), t + i * 0.06, 0.6, 0.06));
  } else if (kind === "jump") tone(330, t, 0.12, 0.03, "triangle", 1.6);
  else if (kind === "land") tone(140, t, 0.08, 0.05, "sine", 0.6);
  else if (kind === "bounce") tone(220, t, 0.32, 0.06, "triangle", 2.4);
  else if (kind === "over") tone(440, t, 0.7, 0.05, "triangle", 0.45);
}
