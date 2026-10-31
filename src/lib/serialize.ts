import type { Expense, Income, RecurringExpense } from "@prisma/client";

import { toRupees } from "@/lib/money";

export const serializeExpense = ({ amountPaise, date, ...expense }: Expense) => ({
  ...expense,
  amount: toRupees(amountPaise),
  date: date.toISOString(),
});

export const serializeIncome = ({ amountPaise, date, ...income }: Income) => ({
  ...income,
  amount: toRupees(amountPaise),
  date: date.toISOString(),
});

export const serializeRecurring = ({ amountPaise, nextDate, ...item }: RecurringExpense) => ({
  ...item,
  amount: toRupees(amountPaise),
  nextDate: nextDate.toISOString(),
});
