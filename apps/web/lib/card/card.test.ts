import { test } from "node:test";
import assert from "node:assert/strict";
import { FLOWERS, SIGNS, START_DAY, cleanName, makeCard, parseBirthday, signOf } from "./card.ts";

const today = new Date("2026-11-25T12:00:00Z");

test("28 November is Sagittarius (the bug the mock-up had)", () => {
  assert.equal(signOf(11, 28).name, "Sagittarius");
});

test("every sign starts on its day and not the day before", () => {
  const expected = ["Aquarius", "Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius", "Capricorn"];
  for (let m = 1; m <= 12; m++) {
    assert.equal(signOf(m, START_DAY[m - 1]).name, expected[m - 1], `month ${m}, first day`);
    const before = expected[(m + 10) % 12];
    assert.equal(signOf(m, START_DAY[m - 1] - 1).name, before, `month ${m}, day before`);
  }
  assert.equal(signOf(1, 1).name, "Capricorn");
  assert.equal(signOf(12, 31).name, "Capricorn");
});

test("every day of a leap year maps to exactly the twelve signs, in order", () => {
  const seen: string[] = [];
  for (let t = Date.UTC(2024, 0, 1); t < Date.UTC(2025, 0, 1); t += 86_400_000) {
    const d = new Date(t);
    const s = signOf(d.getUTCMonth() + 1, d.getUTCDate()).name;
    if (seen[seen.length - 1] !== s) seen.push(s);
  }
  assert.deepEqual(seen, ["Capricorn", ...SIGNS.slice(1).map((s) => s.name), "Capricorn"]);
});

test("star charts and flowers are well formed", () => {
  for (const s of SIGNS) for (const [a, b] of s.lines) assert.ok(s.stars[a] && s.stars[b], s.name);
  assert.equal(FLOWERS.length, 12);
  assert.equal(FLOWERS[10].name, "chrysanthemum");
});

test("birthdays must be real dates", () => {
  assert.deepEqual(parseBirthday("2003-11-28"), { y: 2003, m: 11, d: 28 });
  assert.equal(parseBirthday("2023-02-29"), null);
  assert.ok(parseBirthday("2024-02-29"));
  assert.equal(parseBirthday("28/11/2003"), null);
});

test("names are tidied: letters, spaces, a little punctuation, 16 characters", () => {
  assert.equal(cleanName("  Jae <script> "), "Jae script");
  assert.equal(cleanName("Anne-Marie O'Neil the Third"), "Anne-Marie O'Nei");
  assert.equal(cleanName("Zoë"), "Zoë");
});

test("a card is the same every time, and HP counts the days", () => {
  const a = makeCard({ name: "Jae", birthday: "2003-11-28", type: "INFJ" }, today)!;
  const b = makeCard({ name: "jae", birthday: "2003-11-28", type: "INFJ" }, today)!;
  assert.deepEqual(a.stats, b.stats);
  assert.equal(a.sign.name, "Sagittarius");
  assert.equal(a.flower.name, "chrysanthemum");
  assert.equal(a.hp, Math.round((Date.UTC(2026, 10, 25) - Date.UTC(2003, 10, 28)) / 86_400_000));
  assert.equal(a.number, 333); // 28 Nov counted in a 366-day year
  assert.equal(a.talent.name, "Born on a Friday");
  assert.ok(a.stats.every((s) => s.value === 9 || s.value === 10));
  assert.equal(makeCard({ name: "x", birthday: "nope", type: "INFJ" }, today), null);
  assert.equal(makeCard({ name: "", birthday: "2000-01-01", type: "WXYZ" }, today)!.type, "INFJ");
});
