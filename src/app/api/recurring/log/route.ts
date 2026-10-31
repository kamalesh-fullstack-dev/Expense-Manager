import { NextResponse } from "next/server";

import { createExpenseWithBalance, getCurrentUser, readJsonBody } from "@/lib/api";
import { nextOccurrence } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { serializeRecurring } from "@/lib/serialize";
import { parseDate } from "@/lib/validation";

// Recurring items never post by themselves: the user logs or skips each occurrence.
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const id = String(body.id ?? "");
  const occurrence = parseDate(body.nextDate);

  if (!occurrence) {
    return NextResponse.json({ error: "Missing the occurrence to log" }, { status: 400 });
  }

  const item = await prisma.$transaction(async (tx) => {
    const existing = await tx.recurringExpense.findFirst({ where: { id, userId: user.id, active: true } });

    if (!existing) return null;

    // The client names the occurrence it saw, so a double tap can't log the next one too.
    const claimed = await tx.recurringExpense.updateMany({
      where: { id, nextDate: occurrence },
      data: { nextDate: nextOccurrence(existing.nextDate, existing.frequency, existing.anchorDay) },
    });

    if (claimed.count === 0) return null;

    if (!body.skip) {
      await createExpenseWithBalance(tx, user.id, {
        title: existing.title,
        amountPaise: existing.amountPaise,
        category: existing.category,
        merchant: existing.merchant,
        paymentMethod: existing.paymentMethod,
        date: existing.nextDate,
        accountId: existing.accountId,
      });
    }

    return tx.recurringExpense.findUniqueOrThrow({ where: { id } });
  });

  if (!item) {
    return NextResponse.json({ error: "This item was already updated" }, { status: 409 });
  }

  return NextResponse.json(serializeRecurring(item));
}
