import { NextResponse } from "next/server";

import { getCurrentUser, readJsonBody } from "@/lib/api";
import { toPaise, toRupees } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cleanText, isMonthKey, parseAmount } from "@/lib/validation";

const serializeBudget = <T extends { amountPaise: bigint }>({ amountPaise, ...budget }: T) => ({
  ...budget,
  amount: toRupees(amountPaise),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const targetMonth = isMonthKey(month) ? month : new Date().toISOString().slice(0, 7);

  const budgets = await prisma.budget.findMany({
    where: {
      userId: user.id,
      month: targetMonth,
    },
    orderBy: {
      amountPaise: "desc",
    },
  });

  return NextResponse.json(budgets.map(serializeBudget));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { category, amount, month } = await readJsonBody(request);

  const targetCategory = cleanText(category, 60);
  const targetMonth = String(month ?? "").slice(0, 7);
  const targetAmount = parseAmount(amount);

  if (!targetCategory || !isMonthKey(targetMonth) || targetAmount === null) {
    return NextResponse.json({ error: "Choose a category, month and an amount above zero" }, { status: 400 });
  }

  const budget = await prisma.budget.upsert({
    where: {
      userId_category_month: {
        userId: user.id,
        category: targetCategory,
        month: targetMonth,
      },
    },
    update: { amountPaise: toPaise(targetAmount) },
    create: {
      category: targetCategory,
      amountPaise: toPaise(targetAmount),
      month: targetMonth,
      userId: user.id,
    },
  });

  return NextResponse.json(serializeBudget(budget));
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const budgetId = searchParams.get("id");

  if (!budgetId) {
    return NextResponse.json({ error: "Missing budget id" }, { status: 400 });
  }

  await prisma.budget.deleteMany({
    where: {
      id: budgetId,
      userId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
