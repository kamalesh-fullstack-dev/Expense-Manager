// Expense dates are stored as UTC midnight of the calendar day the user picked,
// so "today" must come from local time and stored dates must be read back as UTC.

export const localDateString = (date = new Date()) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

export const localMonthString = (date = new Date()) => localDateString(date).slice(0, 7);

export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));

  return shifted.toISOString().slice(0, 7);
}

export function monthsEndingAt(month: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const monthKey = shiftMonth(month, index - (count - 1));
    const label = new Date(`${monthKey}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

    return { monthKey, label };
  });
}

export const formatStoredDate = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Date(value).toLocaleDateString("en-IN", { ...options, timeZone: "UTC" });

// Days to average over: the whole month if it has ended, otherwise the days so far.
export function elapsedDaysInMonth(month: string, today = new Date()) {
  const current = localMonthString(today);

  if (month === current) return today.getDate();
  if (month > current) return 1;

  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

// Days until a monthly due day comes round, treating day 31 as the last day of shorter months.
export function daysUntilDueDay(dueDay: number, today = new Date()) {
  const dueIn = (year: number, month: number) => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, lastDay));
  };
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const thisMonth = dueIn(today.getFullYear(), today.getMonth());
  const next = thisMonth >= start ? thisMonth : dueIn(today.getFullYear(), today.getMonth() + 1);

  return Math.round((next.getTime() - start.getTime()) / 86_400_000);
}

export const RECURRING_FREQUENCIES = ["Weekly", "Monthly", "Yearly"] as const;

// The date after a stored occurrence. anchorDay keeps a bill on the 31st from
// drifting to the 28th for good after passing through February.
export function nextOccurrence(date: Date, frequency: string, anchorDay: number) {
  if (frequency === "Weekly") {
    return new Date(date.getTime() + 7 * 86_400_000);
  }

  const months = frequency === "Yearly" ? 12 : 1;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return new Date(Date.UTC(year, month, Math.min(anchorDay, lastDay)));
}

// Days from today to a stored date; negative means overdue.
export function daysUntilStoredDate(value: string, today = new Date()) {
  const start = Date.parse(`${localDateString(today)}T00:00:00Z`);
  return Math.round((Date.parse(`${value.slice(0, 10)}T00:00:00Z`) - start) / 86_400_000);
}
