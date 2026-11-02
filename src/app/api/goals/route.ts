import { NextResponse } from "next/server";

import { getCurrentUser, readJsonBody } from "@/lib/api";
import { toPaise, toRupees } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cleanText, parseAmount, parseDate } from "@/lib/validation";

const HISTORY_LIMIT = 8;

function parseGoalBody(body: Record<string, unknown>) {
  const name = cleanText(body.name, 60);
  const target = parseAmount(body.target);
  const targetDate = body.targetDate ? parseDate(body.targetDate) : null;

  if (!name || target === null) {
    return { error: "Enter a name and a target above zero" };
  }

  if (body.targetDate && !targetDate) {
    return { error: "Enter a valid target date" };
  }

  return { data: { name, targetPaise: toPaise(target), targetDate } };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const goals = await prisma.savingsGoal.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { entries: { orderBy: { createdAt: "desc" }, include: { account: { select: { name: true } } } } },
  });

  return NextResponse.json(
    goals.map(({ targetPaise, entries, ...goal }) => {
      const byAccount = new Map<string, { accountId: string; accountName: string; paise: bigint }>();

      entries.forEach((entry) => {
        const current = byAccount.get(entry.accountId) ?? { accountId: entry.accountId, accountName: entry.account.name, paise: BigInt(0) };
        current.paise += entry.amountPaise;
        byAccount.set(entry.accountId, current);
      });

      const saved = [...byAccount.values()].reduce((sum, item) => sum + item.paise, BigInt(0));

      return {
        ...goal,
        target: toRupees(targetPaise),
        saved: toRupees(saved),
        byAccount: [...byAccount.values()]
          .filter((item) => item.paise > BigInt(0))
          .map(({ paise, ...item }) => ({ ...item, amount: toRupees(paise) })),
        history: entries.slice(0, HISTORY_LIMIT).map((entry) => ({
          id: entry.id,
          kind: entry.kind,
          amount: toRupees(entry.amountPaise),
          accountName: entry.account.name,
          createdAt: entry.createdAt.toISOString(),
        })),
      };
    }),
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseGoalBody(await readJsonBody(request));

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const goal = await prisma.savingsGoal.create({ data: { ...parsed.data, userId: user.id } });

  return NextResponse.json({ id: goal.id }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const parsed = parseGoalBody(body);

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { count } = await prisma.savingsGoal.updateMany({ where: { id: String(body.id ?? ""), userId: user.id }, data: parsed.data });

  if (count === 0) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// Deleting a goal releases everything set aside for it. No balance changes, because nothing was moved.
export async function DELETE(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id") ?? "";
  const { count } = await prisma.savingsGoal.deleteMany({ where: { id, userId: user.id } });

  if (count === 0) {
    return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
