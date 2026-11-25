import { createDecipheriv } from "node:crypto";
import { istDate } from "../unlock.ts";

/**
 * Something kept for the 28th. What it is lives in sealed.json, encrypted
 * with AES-256-GCM; the key is only in the server's environment
 * (SURPRISE_KEY), so the public repo and the deployed files give nothing
 * away. The server decrypts it only once the day has come in India.
 */

export const OPENS_ON = "2026-11-28";

export type Sealed = { alg: "aes-256-gcm"; iv: string; tag: string; data: string };

/** Has the day come (India time)? Dates compare as strings because they're YYYY-MM-DD. */
export const isOpen = (at: Date = new Date()) => istDate(at) >= OPENS_ON;

/** Decrypts a sealed payload. GCM checks the tag, so a wrong key or a tampered file throws instead of returning garbage. */
export function unseal(sealed: Sealed, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("SURPRISE_KEY must be 32 bytes, base64");
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  d.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(sealed.data, "base64")), d.final()]).toString("utf8");
}
