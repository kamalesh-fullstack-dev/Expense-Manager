import { NextResponse } from "next/server";

import { getCurrentUser, ownsAccount, readJsonBody } from "@/lib/api";
import { RECURRING_FREQUENCIES } from "@/lib/dates";
import { toPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { serializeRecurring } from "@/lib/serialize";
import { cleanText, parseAmount, parseDate } from "@/lib/validation";

async function parseRecurringBody(body: Record<string, unknown>, userId: string) {
  const title = cleanText(body.title);
  const category = cleanText(body.category, 60);
  const amount = parseAmount(body.amount);
  const nextDate = parseDate(body.nextDate);
  const frequency = RECURRING_FREQUENCIES.find((item) => item === body.frequency);

  if (!title || !category) return { error: "Title and category are required" };
  if (amount === null) return { error: "Enter an amount greater than zero" };
  if (!nextDate) return { error: "Enter the next due date" };
  if (!frequency) return { error: "Choose how often this repeats" };

  const accountId = body.accountId ? String(body.accountId) : null;

  if (accountId && !(await ownsAccount(userId, accountId))) {
    return { error: "Account not found" };
  }

  return {
    data: {
      title,
      amountPaise: toPaise(amount),
      category,
      merchant: cleanText(body.merchant) || null,
      paymentMethod: cleanText(body.paymentMethod, 40) || null,
      frequency,
      anchorDay: nextDate.getUTCDate(),
      nextDate,
      active: body.active !== false,
      accountId,
    },
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.recurringExpense.findMany({
    where: { userId: user.id },
    orderBy: { nextDate: "asc" },
  });

  return NextResponse.json(items.map(serializeRecurring));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseRecurringBody(await readJsonBody(request), user.id);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const item = await prisma.recurringExpense.create({ data: { ...parsed.data, userId: user.id } });

  return NextResponse.json(serializeRecurring(item), { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const id = String(body.id ?? "");
  const parsed = await parseRecurringBody(body, user.id);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await prisma.recurringExpense.updateMany({ where: { id, userId: user.id }, data: parsed.data });

  if (result.count === 0) {
    return NextResponse.json({ error: "Recurring expense not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";

  await prisma.recurringExpense.deleteMany({ where: { id, userId: user.id } });

  return NextResponse.json({ success: true });
}
