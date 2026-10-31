import test from "node:test";
import assert from "node:assert/strict";

import { toCsv } from "./csv";
import { toPaise, toRupees } from "./money";
import { isRateLimited } from "./rate-limit";

test("rupees convert to exact paise and back", () => {
  assert.equal(toPaise(0.07), BigInt(7));
  assert.equal(toPaise(1.1) + toPaise(2.2), BigInt(330));
  assert.equal(toRupees(toPaise(19.99)), 19.99);
});

test("loans above the 32-bit integer limit stay exact", () => {
  assert.equal(toPaise(75_000_000.5), BigInt(7_500_000_050));
  assert.equal(toRupees(BigInt(7_500_000_050)), 75_000_000.5);
});

test("csv quotes separators and defuses spreadsheet formulas", () => {
  assert.equal(toCsv(["A"], [['say "hi", ok']]), 'A\r\n"say ""hi"", ok"');
  assert.equal(toCsv(["A"], [["=SUM(1)"]]), "A\r\n'=SUM(1)");
  assert.equal(toCsv(["A"], [[-5]]), "A\r\n-5");
});

test("rate limiter blocks past the limit until the window ends", () => {
  assert.equal(isRateLimited("k", 2, 1000, 0), false);
  assert.equal(isRateLimited("k", 2, 1000, 1), false);
  assert.equal(isRateLimited("k", 2, 1000, 2), true);
  assert.equal(isRateLimited("k", 2, 1000, 1001), false);
});
