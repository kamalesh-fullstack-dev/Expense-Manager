import { NextResponse } from "next/server";

import { getAccountBalanceAdjustments } from "@/lib/account-balance";
import {
  adjustDebtOutstanding,
  applyAccountAdjustments,
  createExpenseWithBalance,
  getCurrentUser,
  ownsAccount,
  readJsonBody,
} from "@/lib/api";
import { buildExpenseWhereInput } from "@/lib/expense-filter";
import { toPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { serializeExpense } from "@/lib/serialize";
import { cleanText, parseAmount, parseDate } from "@/lib/validation";


// Validates a create/update payload; the account must belong to the current user.
async function parseExpenseBody(body: Record<string, unknown>, userId: string) {
  const title = cleanText(body.title);
  const category = cleanText(body.category, 60);
  const amount = parseAmount(body.amount);
  const date = parseDate(body.date);

  if (!title || !category) return { error: "Title and category are required" };
  if (amount === null) return { error: "Enter an amount greater than zero" };
  if (!date) return { error: "Enter a valid date" };

  const accountId = body.accountId ? String(body.accountId) : null;

  if (accountId) {
    if (!(await ownsAccount(userId, accountId))) return { error: "Account not found" };
  }

  return {
    data: {
      title,
      amountPaise: toPaise(amount),
      category,
      merchant: cleanText(body.merchant) || null,
      notes: cleanText(body.notes, 1000) || null,
      paymentMethod: cleanText(body.paymentMethod, 40) || null,
      date,
      accountId,
    },
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expenses = await prisma.expense.findMany({
    where: buildExpenseWhereInput({
      userId: user.id,
      search: searchParams.get("search"),
      category: searchParams.get("category"),
      month: searchParams.get("month"),
      fromMonth: searchParams.get("from"),
      toMonth: searchParams.get("to"),
      accountId: searchParams.get("accountId"),
    }),
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses.map(serializeExpense));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseExpenseBody(await readJsonBody(request), user.id);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data } = parsed;

  const expense = await prisma.$transaction((tx) => createExpenseWithBalance(tx, user.id, data));

  return NextResponse.json(serializeExpense(expense), { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);

  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const id = String(body.id);
  const parsed = await parseExpenseBody(body, user.id);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data } = parsed;

  const expense = await prisma.$transaction(async (tx) => {
    // Lock the row first, so a double-tapped save can't apply the same change twice.
    await tx.expense.updateMany({ where: { id, userId: user.id }, data: { updatedAt: new Date() } });

    const existing = await tx.expense.findFirst({ where: { id, userId: user.id } });

    if (!existing) return null;

    const updated = await tx.expense.update({ where: { id }, data });

    await applyAccountAdjustments(
      tx,
      user.id,
      getAccountBalanceAdjustments({
        previousAccountId: existing.accountId,
        previousAmount: Number(existing.amountPaise),
        nextAccountId: updated.accountId,
        nextAmount: Number(updated.amountPaise),
      }),
    );

    if (existing.debtId) {
      await adjustDebtOutstanding(tx, user.id, existing.debtId, existing.amountPaise - updated.amountPaise);
    }

    return updated;
  });

  if (!expense) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  return NextResponse.json(serializeExpense(expense));
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findFirst({ where: { id, userId: user.id } });

    if (!existing) return false;

    await tx.expense.delete({ where: { id } });

    await applyAccountAdjustments(
      tx,
      user.id,
      getAccountBalanceAdjustments({ previousAccountId: existing.accountId, previousAmount: Number(existing.amountPaise) }),
    );

    if (existing.debtId) {
      await adjustDebtOutstanding(tx, user.id, existing.debtId, existing.amountPaise);
    }

    return true;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
