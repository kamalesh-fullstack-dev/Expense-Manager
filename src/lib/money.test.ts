import test from "node:test";
import assert from "node:assert/strict";

import { toCsv } from "./csv";
import { formatCurrency, formatSigned, setDisplayCurrency } from "./format";
import { toPaise, toRupees } from "./money";

test("amounts use the chosen currency without being converted", () => {
  assert.equal(formatCurrency(100000), "₹1,00,000");
  setDisplayCurrency("USD");
  assert.equal(formatCurrency(100000), "$100,000");
  assert.equal(formatCurrency(1234.5), "$1,234.50");
  setDisplayCurrency("NOPE");
  assert.equal(formatCurrency(100000), "₹1,00,000");
});

test("signed amounts never show a minus sign on zero", () => {
  assert.equal(formatSigned(-0), "₹0");
  assert.equal(formatSigned(0), "₹0");
  assert.equal(formatSigned(-250.5), "-₹250.50");
  assert.equal(formatSigned(250), "₹250");
});

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

