import { NextResponse } from "next/server";

import { getCurrentUser, readJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isMonthKey } from "@/lib/validation";

// Copies a month's budgets forward, leaving any budget already set in the target month alone.
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fromMonth, toMonth } = await readJsonBody(request);

  if (!isMonthKey(fromMonth) || !isMonthKey(toMonth)) {
    return NextResponse.json({ error: "Choose valid months" }, { status: 400 });
  }

  const [source, target] = await Promise.all([
    prisma.budget.findMany({ where: { userId: user.id, month: fromMonth } }),
    prisma.budget.findMany({ where: { userId: user.id, month: toMonth } }),
  ]);

  if (source.length === 0) {
    return NextResponse.json({ error: "No budgets found in the previous month" }, { status: 404 });
  }

  const taken = new Set(target.map((budget) => budget.category));
  const missing = source.filter((budget) => !taken.has(budget.category));

  await prisma.budget.createMany({
    data: missing.map(({ category, amountPaise }) => ({ category, amountPaise, month: toMonth, userId: user.id })),
  });

  return NextResponse.json({ copied: missing.length });
}
