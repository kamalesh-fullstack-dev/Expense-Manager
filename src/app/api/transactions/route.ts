import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/api";
import { buildExpenseWhereInput } from "@/lib/expense-filter";
import { toRupees } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { serializeExpense } from "@/lib/serialize";
import { parseDate } from "@/lib/validation";

const PAGE_SIZE = 30;

const SORT_ORDERS = {
  newest: [{ date: "desc" }, { createdAt: "desc" }],
  oldest: [{ date: "asc" }, { createdAt: "asc" }],
  highest: [{ amountPaise: "desc" }],
  lowest: [{ amountPaise: "asc" }],
} as const;

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get("page")) || 0, 0);
  const sort = searchParams.get("sort") ?? "newest";
  const orderBy = sort in SORT_ORDERS ? SORT_ORDERS[sort as keyof typeof SORT_ORDERS] : SORT_ORDERS.newest;

  const where = buildExpenseWhereInput({
    userId: user.id,
    search: searchParams.get("search"),
    category: searchParams.get("category"),
    accountId: searchParams.get("accountId"),
    fromDate: parseDate(searchParams.get("fromDate")),
    toDate: parseDate(searchParams.get("toDate")),
  });

  const [items, summary] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: [...orderBy], skip: page * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.expense.aggregate({ where, _count: true, _sum: { amountPaise: true } }),
  ]);

  return NextResponse.json({
    items: items.map(serializeExpense),
    total: summary._count,
    totalAmount: toRupees(summary._sum.amountPaise ?? 0),
    hasMore: (page + 1) * PAGE_SIZE < summary._count,
  });
}
