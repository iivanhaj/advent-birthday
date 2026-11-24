"use client";

/**
 * The music box: a song's little tune, synthesised with the Web Audio API.
 *
 * A music-box note is a steel tooth plucked by a pin: a bright attack and a
 * long, fading ring. Here that's a sine at the note plus two quiet overtones
 * (×2 and ×4, slightly detuned so it shimmers), each with a 5 ms attack and an
 * exponential fade; the higher ones fade faster, as they do on the real thing.
 */

let ctx: AudioContext | null = null;
const ROOT = 523.25; // C5

/** Plays `notes` ([semitones above C5, beats]) at `beat` seconds per beat. Returns how long it lasts, in seconds. */
export function playTune(notes: [number, number][], beat: number): number {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    let t = ctx.currentTime + 0.05;
    for (const [n, len] of notes) {
      const f = ROOT * Math.pow(2, n / 12);
      [1, 2.01, 3.98].forEach((h, k) => {
        const o = ctx!.createOscillator();
        const g = ctx!.createGain();
        o.type = "sine";
        o.frequency.value = f * h;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.08 / (k * 2 + 1), t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6 / (k + 1));
        o.connect(g).connect(ctx!.destination);
        o.start(t);
        o.stop(t + 1.7);
      });
      t += len * beat;
    }
    return notes.reduce((s, [, len]) => s + len * beat, 0);
  } catch {
    return 0; // no audio: the song just starts
  }
}
