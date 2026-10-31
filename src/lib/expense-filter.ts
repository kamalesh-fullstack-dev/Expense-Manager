import { isMonthKey } from "./validation";

const startOfMonth = (month: string) => new Date(`${month}-01T00:00:00Z`);

const startOfNextMonth = (month: string) => {
  const start = startOfMonth(month);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
};

export function buildExpenseWhereInput({
  userId,
  search,
  category,
  month,
  fromMonth,
  toMonth,
  fromDate,
  toDate,
  accountId,
}: {
  userId: string;
  search?: string | null;
  category?: string | null;
  month?: string | null;
  fromMonth?: string | null;
  toMonth?: string | null;
  fromDate?: Date | null;
  toDate?: Date | null;
  accountId?: string | null;
}) {
  const first = isMonthKey(month) ? month : isMonthKey(fromMonth) ? fromMonth : null;
  const last = isMonthKey(month) ? month : isMonthKey(toMonth) ? toMonth : null;
  const term = search?.trim();

  return {
    userId,
    ...(term
      ? {
          OR: [
            { title: { contains: term } },
            { category: { contains: term } },
            { merchant: { contains: term } },
            { notes: { contains: term } },
          ],
        }
      : {}),
    ...(category && category !== "All" ? { category } : {}),
    ...(first || last || fromDate || toDate
      ? {
          date: {
            ...(first ? { gte: startOfMonth(first) } : {}),
            ...(last ? { lt: startOfNextMonth(last) } : {}),
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
    ...(accountId && accountId !== "All" ? { accountId } : {}),
  };
}
