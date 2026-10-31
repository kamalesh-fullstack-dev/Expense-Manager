export type AccountBalanceAdjustment = {
  accountId: string;
  delta: number;
};

export function getAccountBalanceAdjustments({
  previousAccountId,
  previousAmount,
  nextAccountId,
  nextAmount,
}: {
  previousAccountId?: string | null;
  previousAmount?: number;
  nextAccountId?: string | null;
  nextAmount?: number;
}): AccountBalanceAdjustment[] {
  const adjustments = new Map<string, number>();
  const previousId = previousAccountId ?? null;
  const nextId = nextAccountId ?? null;
  const previousValue = Number(previousAmount ?? 0);
  const nextValue = Number(nextAmount ?? 0);

  if (previousId && previousId !== nextId) {
    adjustments.set(previousId, previousValue);
  }

  if (nextId) {
    if (previousId === nextId) {
      adjustments.set(nextId, -(nextValue - previousValue));
    } else {
      adjustments.set(nextId, -nextValue);
    }
  }

  return Array.from(adjustments.entries())
    .map(([accountId, delta]) => ({ accountId, delta }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
}

export function getTransferBalanceAdjustments({
  fromAccountId,
  toAccountId,
  amount,
}: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
}): AccountBalanceAdjustment[] {
  const safeAmount = Number(amount ?? 0);

  return [
    { accountId: fromAccountId, delta: -safeAmount },
    { accountId: toAccountId, delta: safeAmount },
  ];
}
