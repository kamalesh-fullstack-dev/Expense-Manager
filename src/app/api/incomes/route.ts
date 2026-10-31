import { NextResponse } from "next/server";

import { getAccountBalanceAdjustments } from "@/lib/account-balance";
import { applyAccountAdjustments, getCurrentUser, ownsAccount, readJsonBody } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { serializeIncome } from "@/lib/serialize";
import { cleanText, isMonthKey, parseAmount, parseDate } from "@/lib/validation";

async function parseIncomeBody(body: Record<string, unknown>, userId: string) {
  const title = cleanText(body.title);
  const amount = parseAmount(body.amount);
  const date = parseDate(body.date);

  if (!title) return { error: "Enter a title" };
  if (amount === null) return { error: "Enter an amount greater than zero" };
  if (!date) return { error: "Enter a valid date" };

  const accountId = body.accountId ? String(body.accountId) : null;

  if (accountId && !(await ownsAccount(userId, accountId))) {
    return { error: "Account not found" };
  }

  return {
    data: {
      title,
      amountPaise: toPaise(amount),
      source: cleanText(body.source, 40) || "Other",
      notes: cleanText(body.notes, 1000) || null,
      date,
      accountId,
    },
  };
}

// Income is the mirror of an expense: the same adjustments with the sign flipped.
const creditAdjustments = (input: Parameters<typeof getAccountBalanceAdjustments>[0]) =>
  getAccountBalanceAdjustments(input).map((item) => ({ ...item, delta: -item.delta }));

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const incomes = await prisma.income.findMany({
    where: {
      userId: user.id,
      ...(isMonthKey(from) && isMonthKey(to)
        ? {
            date: {
              gte: new Date(`${from}-01T00:00:00Z`),
              lt: new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 1)),
            },
          }
        : {}),
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(incomes.map(serializeIncome));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseIncomeBody(await readJsonBody(request), user.id);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data } = parsed;

  const income = await prisma.$transaction(async (tx) => {
    const created = await tx.income.create({ data: { ...data, userId: user.id } });

    await applyAccountAdjustments(
      tx,
      user.id,
      creditAdjustments({ nextAccountId: created.accountId, nextAmount: Number(created.amountPaise) }),
    );

    return created;
  });

  return NextResponse.json(serializeIncome(income), { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const id = String(body.id ?? "");
  const parsed = await parseIncomeBody(body, user.id);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data } = parsed;

  const income = await prisma.$transaction(async (tx) => {
    // Lock the row first, so a double-tapped save can't apply the same change twice.
    await tx.income.updateMany({ where: { id, userId: user.id }, data: { updatedAt: new Date() } });

    const existing = await tx.income.findFirst({ where: { id, userId: user.id } });

    if (!existing) return null;

    const updated = await tx.income.update({ where: { id }, data });

    await applyAccountAdjustments(
      tx,
      user.id,
      creditAdjustments({
        previousAccountId: existing.accountId,
        previousAmount: Number(existing.amountPaise),
        nextAccountId: updated.accountId,
        nextAmount: Number(updated.amountPaise),
      }),
    );

    return updated;
  });

  if (!income) {
    return NextResponse.json({ error: "Income not found" }, { status: 404 });
  }

  return NextResponse.json(serializeIncome(income));
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";

  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.income.findFirst({ where: { id, userId: user.id } });

    if (!existing) return false;

    await tx.income.delete({ where: { id } });

    await applyAccountAdjustments(
      tx,
      user.id,
      creditAdjustments({ previousAccountId: existing.accountId, previousAmount: Number(existing.amountPaise) }),
    );

    return true;
  });

  if (!deleted) {
    return NextResponse.json({ error: "Income not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
