import test from "node:test";
import assert from "node:assert/strict";

import { getAccountBalanceAdjustments, getTransferBalanceAdjustments } from "./account-balance";
import { buildExpenseWhereInput } from "./expense-filter";

test("create expense subtracts amount from the chosen account", () => {
  assert.deepEqual(
    getAccountBalanceAdjustments({ previousAccountId: null, previousAmount: 0, nextAccountId: "acct-1", nextAmount: 250 }),
    [{ accountId: "acct-1", delta: -250 }],
  );
});

test("update on same account adjusts by the delta in amount", () => {
  assert.deepEqual(
    getAccountBalanceAdjustments({ previousAccountId: "acct-1", previousAmount: 100, nextAccountId: "acct-1", nextAmount: 250 }),
    [{ accountId: "acct-1", delta: -150 }],
  );
});

test("switching accounts adds back old account and debits new one", () => {
  assert.deepEqual(
    getAccountBalanceAdjustments({ previousAccountId: "acct-1", previousAmount: 100, nextAccountId: "acct-2", nextAmount: 250 }),
    [
      { accountId: "acct-1", delta: 100 },
      { accountId: "acct-2", delta: -250 },
    ],
  );
});

test("delete expense restores the original amount to the selected account", () => {
  assert.deepEqual(
    getAccountBalanceAdjustments({ previousAccountId: "acct-3", previousAmount: 150, nextAccountId: null, nextAmount: 0 }),
    [{ accountId: "acct-3", delta: 150 }],
  );
});

test("transfers debit the source and credit the destination", () => {
  assert.deepEqual(
    getTransferBalanceAdjustments({ fromAccountId: "acct-1", toAccountId: "acct-2", amount: 250 }),
    [
      { accountId: "acct-1", delta: -250 },
      { accountId: "acct-2", delta: 250 },
    ],
  );
});

test("account filter adds account scope to the expense query", () => {
  const filter = buildExpenseWhereInput({
    userId: "user-1",
    search: "coffee",
    category: "Food",
    month: "2026-10",
    accountId: "acct-2",
  });

  assert.equal(filter.userId, "user-1");
  assert.equal(filter.category, "Food");
  assert.equal(filter.accountId, "acct-2");
  assert.ok(Array.isArray(filter.OR));
  assert.ok(filter.date && typeof filter.date === "object");
});

test("month filter covers exactly one calendar month", () => {
  const filter = buildExpenseWhereInput({ userId: "user-1", month: "2026-12" });

  assert.deepEqual(filter.date, { gte: new Date("2026-12-01T00:00:00Z"), lt: new Date("2027-01-01T00:00:00Z") });
});

test("from and to build a month range", () => {
  const filter = buildExpenseWhereInput({ userId: "user-1", fromMonth: "2026-05", toMonth: "2026-10" });

  assert.deepEqual(filter.date, { gte: new Date("2026-05-01T00:00:00Z"), lt: new Date("2026-11-01T00:00:00Z") });
});

test("an invalid month is ignored instead of crashing the query", () => {
  assert.equal(buildExpenseWhereInput({ userId: "user-1", month: "garbage" }).date, undefined);
});
