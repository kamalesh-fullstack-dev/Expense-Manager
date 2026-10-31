import { NextResponse } from "next/server";

import {
  createExpenseWithBalance,
  getCurrentUser,
  ownsAccount,
  readJsonBody,
} from "@/lib/api";
import { EMI_CATEGORY } from "@/lib/format";
import { toPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { serializeExpense } from "@/lib/serialize";
import { parseAmount, parseDate } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const amount = parseAmount(body.amount);
  const date = parseDate(body.date);
  const accountId = body.accountId ? String(body.accountId) : null;

  if (amount === null) {
    return NextResponse.json({ error: "Enter an amount greater than zero" }, { status: 400 });
  }

  if (!date) {
    return NextResponse.json({ error: "Enter a valid date" }, { status: 400 });
  }

  if (accountId && !(await ownsAccount(user.id, accountId))) {
    return NextResponse.json({ error: "Account not found" }, { status: 400 });
  }

  const debt = await prisma.debt.findFirst({ where: { id: String(body.debtId ?? ""), userId: user.id } });

  if (!debt) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  const amountPaise = toPaise(amount);

  const expense = await prisma.$transaction(async (tx) => {
    // The check and the deduction are one statement, so parallel payments can't both pass it.
    const { count } = await tx.debt.updateMany({
      where: { id: debt.id, outstandingPaise: { gte: amountPaise } },
      data: { outstandingPaise: { decrement: amountPaise } },
    });

    if (count === 0) return null;

    const created = await createExpenseWithBalance(tx, user.id, {
      title: `${debt.name} EMI`,
      amountPaise,
      category: EMI_CATEGORY,
      merchant: debt.lender,
      date,
      accountId,
      debtId: debt.id,
    });

    await tx.debt.updateMany({ where: { id: debt.id, outstandingPaise: BigInt(0) }, data: { status: "Closed" } });

    return created;
  });

  if (!expense) {
    return NextResponse.json({ error: "That is more than the outstanding amount" }, { status: 400 });
  }

  return NextResponse.json(serializeExpense(expense), { status: 201 });
}
