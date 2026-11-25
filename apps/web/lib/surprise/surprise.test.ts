import { test } from "node:test";
import assert from "node:assert/strict";
import { createCipheriv, randomBytes } from "node:crypto";
import { isOpen, unseal, type Sealed } from "./open.ts";
import sealedFile from "./sealed.json" with { type: "json" };

function seal(text: string, key: Buffer): Sealed {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return { alg: "aes-256-gcm", iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64"), data: data.toString("base64") };
}

test("it opens at midnight on the 28th in India, not a minute before", () => {
  assert.equal(isOpen(new Date("2026-11-27T18:29:00Z")), false); // 23:59 IST on the 27th
  assert.equal(isOpen(new Date("2026-11-27T18:30:00Z")), true); // 00:00 IST on the 28th
  assert.equal(isOpen(new Date("2026-12-25T00:00:00Z")), true);
});

test("the right key opens it", () => {
  const key = randomBytes(32);
  assert.equal(unseal(seal("hello", key), key.toString("base64")), "hello");
});

test("a wrong key or a changed byte is refused, never garbage", () => {
  const key = randomBytes(32);
  const s = seal("hello", key);
  assert.throws(() => unseal(s, randomBytes(32).toString("base64")));
  const bad = { ...s, data: Buffer.from(Buffer.from(s.data, "base64").map((b, i) => (i === 0 ? b ^ 1 : b))).toString("base64") };
  assert.throws(() => unseal(bad, key.toString("base64")));
  assert.throws(() => unseal(s, randomBytes(16).toString("base64")), /32 bytes/);
});

test("the file in the repo is sealed: nothing readable in it", () => {
  const f = sealedFile as Sealed;
  assert.equal(f.alg, "aes-256-gcm");
  assert.ok(!/svg|Jae|birthday/i.test(Buffer.from(f.data, "base64").toString("latin1").slice(0, 4000)));
});
