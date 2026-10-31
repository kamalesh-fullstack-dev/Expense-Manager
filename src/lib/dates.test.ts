import test from "node:test";
import assert from "node:assert/strict";

import { daysUntilDueDay, daysUntilStoredDate, elapsedDaysInMonth, localDateString, localMonthString, monthsEndingAt, nextOccurrence, shiftMonth } from "./dates";

test("local dates use the device's calendar day, not UTC", () => {
  // 00:30 local time is still the previous UTC day in India, which toISOString would report.
  const justAfterMidnight = new Date(2026, 10, 1, 0, 30);

  assert.equal(localDateString(justAfterMidnight), "2026-11-01");
  assert.equal(localMonthString(justAfterMidnight), "2026-11");
});

test("shiftMonth crosses year boundaries", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("monthsEndingAt lists months oldest first", () => {
  assert.deepEqual(monthsEndingAt("2026-02", 3).map((item) => item.monthKey), ["2025-12", "2026-01", "2026-02"]);
});

test("elapsed days use days so far now and the full length of past months", () => {
  const today = new Date(2026, 9, 15);

  assert.equal(elapsedDaysInMonth("2026-10", today), 15);
  assert.equal(elapsedDaysInMonth("2026-02", today), 28);
  assert.equal(elapsedDaysInMonth("2026-11", today), 1);
});

test("due days roll to next month once passed and clamp to short months", () => {
  const today = new Date(2026, 9, 20);

  assert.equal(daysUntilDueDay(25, today), 5);
  assert.equal(daysUntilDueDay(20, today), 0);
  assert.equal(daysUntilDueDay(5, today), 16);
  assert.equal(daysUntilDueDay(31, new Date(2026, 1, 10)), 18);
});

test("monthly bills keep their day after passing through a short month", () => {
  const january = new Date("2026-01-31T00:00:00Z");
  const february = nextOccurrence(january, "Monthly", 31);

  assert.equal(february.toISOString().slice(0, 10), "2026-02-28");
  assert.equal(nextOccurrence(february, "Monthly", 31).toISOString().slice(0, 10), "2026-03-31");
});

test("weekly and yearly occurrences advance by the right amount", () => {
  const start = new Date("2026-12-28T00:00:00Z");

  assert.equal(nextOccurrence(start, "Weekly", 28).toISOString().slice(0, 10), "2027-01-04");
  assert.equal(nextOccurrence(start, "Yearly", 28).toISOString().slice(0, 10), "2027-12-28");
});

test("stored dates count down from the local day", () => {
  const today = new Date(2026, 9, 20);

  assert.equal(daysUntilStoredDate("2026-10-23T00:00:00.000Z", today), 3);
  assert.equal(daysUntilStoredDate("2026-10-19T00:00:00.000Z", today), -1);
});
