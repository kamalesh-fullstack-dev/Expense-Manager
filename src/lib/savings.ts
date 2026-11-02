import type { Prisma } from "@prisma/client";

const ZERO = BigInt(0);

// Paise set aside in each of the given accounts, by account.
export async function setAsideByAccount(tx: Prisma.TransactionClient, where: Prisma.GoalEntryWhereInput) {
  const rows = await tx.goalEntry.groupBy({ by: ["accountId"], where, _sum: { amountPaise: true } });

  return new Map(rows.map((row) => [row.accountId, row._sum.amountPaise ?? ZERO]));
}

// An account can't hold less than it has set aside. When spending takes it below, the newest goals
// give up the difference first, and the user tops them up again by hand.
export async function settleSavings(tx: Prisma.TransactionClient, userId: string, accountIds: string[]) {
  for (const accountId of new Set(accountIds)) {
    const account = await tx.account.findFirst({ where: { id: accountId, userId }, select: { balancePaise: true } });

    if (!account) continue;

    const byGoal = await tx.goalEntry.groupBy({ by: ["goalId"], where: { accountId }, _sum: { amountPaise: true } });
    const held = new Map(
      byGoal.map((row) => [row.goalId, row._sum.amountPaise ?? ZERO] as const).filter(([, amount]) => amount > ZERO),
    );
    const totalHeld = [...held.values()].reduce((sum, amount) => sum + amount, ZERO);
    let shortfall = totalHeld - (account.balancePaise > ZERO ? account.balancePaise : ZERO);

    if (shortfall <= ZERO) continue;

    const goals = await tx.savingsGoal.findMany({
      where: { id: { in: [...held.keys()] } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    for (const { id } of goals) {
      if (shortfall <= ZERO) break;

      const amount = held.get(id) ?? ZERO;
      const used = amount < shortfall ? amount : shortfall;

      await tx.goalEntry.create({ data: { goalId: id, accountId, amountPaise: -used, kind: "Used" } });
      shortfall -= used;
    }
  }
}
