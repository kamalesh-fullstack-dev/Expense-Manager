import test from "node:test";
import assert from "node:assert/strict";

import { cleanText, isMonthKey, parseAmount, parseDate } from "./validation";

test("parseAmount accepts positive amounts and rounds to paise", () => {
  assert.equal(parseAmount(12.5), 12.5);
  assert.equal(parseAmount("99.999"), 100);
});

test("parseAmount rejects unusable values", () => {
  for (const value of ["abc", -5, 0, "", null, undefined, true, Infinity, 1e13]) {
    assert.equal(parseAmount(value), null, String(value));
  }
});

test("parseAmount options allow zero and negative balances", () => {
  assert.equal(parseAmount(0, { allowZero: true }), 0);
  assert.equal(parseAmount(-200, { allowNegative: true }), -200);
});

test("parseDate rejects invalid dates", () => {
  assert.equal(parseDate("nope"), null);
  assert.equal(parseDate(123), null);
  assert.equal(parseDate("2026-10-31")?.toISOString(), "2026-10-31T00:00:00.000Z");
});

test("isMonthKey only accepts real months", () => {
  assert.equal(isMonthKey("2026-10"), true);
  assert.equal(isMonthKey("2026-13"), false);
  assert.equal(isMonthKey("garbage"), false);
});

test("cleanText trims and limits length", () => {
  assert.equal(cleanText("  hi  "), "hi");
  assert.equal(cleanText("abcdef", 3), "abc");
  assert.equal(cleanText({ a: 1 }), "");
});
