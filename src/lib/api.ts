import type { Prisma } from "@prisma/client";

import { getAccountBalanceAdjustments, type AccountBalanceAdjustment } from "@/lib/account-balance";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getAuthSession();

  if (!session?.user?.email) {
    return null;
  }

  return prisma.user.findUnique({
    where: { email: session.user.email },
  });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export const isUniqueConstraintError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

export async function applyAccountAdjustments(
  tx: Prisma.TransactionClient,
  userId: string,
  adjustments: AccountBalanceAdjustment[],
) {
  for (const { accountId, delta } of adjustments) {
    await tx.account.updateMany({
      where: { id: accountId, userId },
      data: { balancePaise: { increment: BigInt(delta) } },
    });
  }
}

export async function ownsAccount(userId: string, accountId: string) {
  return (await prisma.account.count({ where: { id: accountId, userId } })) > 0;
}

export async function createExpenseWithBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  data: Omit<Prisma.ExpenseUncheckedCreateInput, "userId">,
) {
  const expense = await tx.expense.create({ data: { ...data, userId } });

  await applyAccountAdjustments(
    tx,
    userId,
    getAccountBalanceAdjustments({ nextAccountId: expense.accountId, nextAmount: Number(expense.amountPaise) }),
  );

  return expense;
}

// Moves a loan's outstanding amount, closing it at zero and reopening it if a payment is undone.
export async function adjustDebtOutstanding(
  tx: Prisma.TransactionClient,
  userId: string,
  debtId: string,
  delta: bigint,
) {
  const debt = await tx.debt.findFirst({ where: { id: debtId, userId } });

  if (!debt) return;

  const next = debt.outstandingPaise + delta;
  const outstandingPaise = next > BigInt(0) ? next : BigInt(0);

  await tx.debt.update({
    where: { id: debtId },
    data: { outstandingPaise, status: outstandingPaise === BigInt(0) ? "Closed" : "Active" },
  });
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
