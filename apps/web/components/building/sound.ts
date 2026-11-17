"use client";

/**
 * Shutter sounds, synthesised with the Web Audio API: no audio files to load.
 *
 * A wooden "clack" is two things layered:
 *  - a 50ms burst of white noise through a band-pass filter (the click), whose
 *    volume decays fast (the (1 - i/len)^4 curve), and
 *  - a short sine "thock" that drops in pitch (the body of the wood).
 * Locked windows use lower frequencies, so they sound like a dull thud.
 *
 * Browsers only allow audio after a user gesture, which is fine: we only play
 * in response to clicks.
 */
let ctx: AudioContext | null = null;

export function playShutter(kind: "open" | "locked") {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;

    const len = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = kind === "open" ? 2400 : 700;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.35;
    noise.connect(band).connect(noiseGain).connect(ctx.destination);
    noise.start(t);

    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(kind === "open" ? 240 : 120, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(oscGain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch {
    /* audio unavailable: stay silent */
  }
}

/** A tiny haptic tap on phones that support it (Android; iOS Safari ignores it). */
export function buzz(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* no vibration API */
  }
}
