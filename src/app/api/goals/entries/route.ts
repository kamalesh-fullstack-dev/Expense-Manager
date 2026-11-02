import { NextResponse } from "next/server";

import { getCurrentUser, readJsonBody } from "@/lib/api";
import { toPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { setAsideByAccount } from "@/lib/savings";
import { parseAmount } from "@/lib/validation";

// Sets money aside for a goal, or releases it. Balances never change: the money stays in its account.
export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const amount = parseAmount(body.amount);
  const adding = body.action === "add";

  if (amount === null || (body.action !== "add" && body.action !== "withdraw")) {
    return NextResponse.json({ error: "Enter an amount above zero" }, { status: 400 });
  }

  const goal = await prisma.savingsGoal.findFirst({ where: { id: String(body.goalId ?? ""), userId: user.id } });
  const account = await prisma.account.findFirst({ where: { id: String(body.accountId ?? ""), userId: user.id } });

  if (!goal || !account) {
    return NextResponse.json({ error: "Goal or account not found" }, { status: 404 });
  }

  const amountPaise = toPaise(amount);

  const error = await prisma.$transaction(async (tx) => {
    // Lock the account first, so two requests can't both set aside the same free money.
    await tx.account.update({ where: { id: account.id }, data: { updatedAt: new Date() } });
    const { balancePaise } = await tx.account.findUniqueOrThrow({ where: { id: account.id } });

    if (adding) {
      const held = (await setAsideByAccount(tx, { accountId: account.id })).get(account.id) ?? BigInt(0);
      const free = balancePaise - held;

      if (amountPaise > free) {
        return `That's more than is free in ${account.name}`;
      }
    } else {
      const held = (await setAsideByAccount(tx, { accountId: account.id, goalId: goal.id })).get(account.id) ?? BigInt(0);

      if (amountPaise > held) {
        return `That's more than this goal holds in ${account.name}`;
      }
    }

    await tx.goalEntry.create({
      data: { goalId: goal.id, accountId: account.id, amountPaise: adding ? amountPaise : -amountPaise, kind: adding ? "Added" : "Withdrawn" },
    });

    return null;
  });

  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
