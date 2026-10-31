import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { toRupees } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { serializeExpense, serializeIncome, serializeRecurring } from "@/lib/serialize";

const download = (body: string, type: string, name: string) =>
  new NextResponse(body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });

const day = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = new URL(request.url).searchParams.get("type");
  const where = { userId: user.id };

  if (type === "expenses") {
    const rows = await prisma.expense.findMany({ where, orderBy: { date: "desc" }, include: { account: true } });

    return download(
      toCsv(
        ["Date", "Title", "Amount", "Category", "Merchant", "Payment method", "Account", "Notes"],
        rows.map((row) => [
          day(row.date), row.title, toRupees(row.amountPaise), row.category, row.merchant, row.paymentMethod, row.account?.name, row.notes,
        ]),
      ),
      "text/csv; charset=utf-8",
      "expenses.csv",
    );
  }

  if (type === "income") {
    const rows = await prisma.income.findMany({ where, orderBy: { date: "desc" }, include: { account: true } });

    return download(
      toCsv(
        ["Date", "Title", "Amount", "Source", "Account", "Notes"],
        rows.map((row) => [day(row.date), row.title, toRupees(row.amountPaise), row.source, row.account?.name, row.notes]),
      ),
      "text/csv; charset=utf-8",
      "income.csv",
    );
  }

  if (type === "backup") {
    const [accounts, categories, expenses, incomes, budgets, debts, transfers, recurring] = await Promise.all([
      prisma.account.findMany({ where }),
      prisma.category.findMany({ where }),
      prisma.expense.findMany({ where }),
      prisma.income.findMany({ where }),
      prisma.budget.findMany({ where }),
      prisma.debt.findMany({ where }),
      prisma.accountTransfer.findMany({ where }),
      prisma.recurringExpense.findMany({ where }),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      accounts: accounts.map(({ balancePaise, ...row }) => ({ ...row, balance: toRupees(balancePaise) })),
      categories,
      expenses: expenses.map(serializeExpense),
      incomes: incomes.map(serializeIncome),
      budgets: budgets.map(({ amountPaise, ...row }) => ({ ...row, amount: toRupees(amountPaise) })),
      debts: debts.map(({ principalPaise, outstandingPaise, monthlyPaymentPaise, ...row }) => ({
        ...row,
        principal: toRupees(principalPaise),
        outstanding: toRupees(outstandingPaise),
        monthlyPayment: toRupees(monthlyPaymentPaise),
      })),
      transfers: transfers.map(({ amountPaise, ...row }) => ({ ...row, amount: toRupees(amountPaise) })),
      recurring: recurring.map(serializeRecurring),
    };

    return download(JSON.stringify(backup, null, 2), "application/json", "money-manager-backup.json");
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
}
