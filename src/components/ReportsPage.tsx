"use client";

import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { useApiList } from "@/lib/api-client";
import { elapsedDaysInMonth, formatStoredDate, localMonthString, monthsEndingAt } from "@/lib/dates";
import { categoryColor, categoryMeta, formatCurrency, formatSigned } from "@/lib/format";

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  merchant?: string | null;
  date: string;
};

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
};

type Transfer = {
  id: string;
  amount: number;
  note: string | null;
  date: string;
  fromAccountName: string;
  toAccountName: string;
};

export function ReportsPage() {
  const { status } = useSession();
  const [selectedMonth, setSelectedMonth] = useState(() => localMonthString());
  const trendMonths = useMemo(() => monthsEndingAt(selectedMonth, 6), [selectedMonth]);

  const expenseList = useApiList<Expense>(`/api/expenses?from=${trendMonths[0].monthKey}&to=${selectedMonth}`);
  const { items: accounts } = useApiList<Account>("/api/accounts");
  const { items: allTransfers } = useApiList<Transfer>("/api/transfers");
  const { items: incomes } = useApiList<{ amount: number }>(`/api/incomes?from=${selectedMonth}&to=${selectedMonth}`);
  const { items: customCategories } = useApiList<{ name: string; color: string }>("/api/categories");
  const loading = expenseList.loading;

  const expenses = useMemo(
    () => expenseList.items.filter((item) => item.date.slice(0, 7) === selectedMonth),
    [expenseList.items, selectedMonth],
  );
  const transfers = useMemo(
    () => allTransfers.filter((item) => item.date.slice(0, 7) === selectedMonth),
    [allTransfers, selectedMonth],
  );

  const totalSpent = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);
  const totalBalance = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);
  const transferVolume = useMemo(() => transfers.reduce((sum, transfer) => sum + transfer.amount, 0), [transfers]);

  const accountMix = useMemo(() => {
    if (accounts.length === 0) return [];

    const total = accounts.reduce((sum, account) => sum + Math.max(account.balance, 0), 0) || 1;

    return accounts
      .map((account) => ({
        ...account,
        share: (Math.max(account.balance, 0) / total) * 100,
      }))
      .sort((a, b) => b.balance - a.balance);
  }, [accounts]);

  const monthTrend = useMemo(
    () =>
      trendMonths.map(({ monthKey, label }) => ({
        monthKey,
        label,
        total: expenseList.items
          .filter((item) => item.date.slice(0, 7) === monthKey)
          .reduce((sum, item) => sum + item.amount, 0),
      })),
    [expenseList.items, trendMonths],
  );

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();

    expenses.forEach((expense) => {
      totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
    });

    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [expenses]);

  const topMerchants = useMemo(
    () => [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 4),
    [expenses],
  );

  const merchantTotals = useMemo(() => {
    const totals = new Map<string, number>();

    expenses.forEach((expense) => {
      if (expense.merchant) {
        totals.set(expense.merchant, (totals.get(expense.merchant) ?? 0) + expense.amount);
      }
    });

    return Array.from(totals.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [expenses]);

  const totalIncome = useMemo(() => incomes.reduce((sum, item) => sum + item.amount, 0), [incomes]);
  const saved = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? Math.round((saved / totalIncome) * 100) : null;
  const previousSpent = monthTrend[monthTrend.length - 2].total;
  const monthChange = previousSpent > 0 ? Math.round(((totalSpent - previousSpent) / previousSpent) * 100) : null;

  const averagePerDay = totalSpent / elapsedDaysInMonth(selectedMonth);
  const maxTrendValue = Math.max(...monthTrend.map((item) => item.total), 1);

  if (status === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a1016] text-slate-200">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Reports</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Overview</h1>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#121d27] px-2 py-1.5 text-[10px] text-white outline-none"
            />
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-2xl border border-white/10 bg-[#121d27] px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200"
            >
              Log out
            </button>
          </div>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#121d27] p-4 shadow-[0_12px_24px_rgba(2,6,23,0.18)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Total spent</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(totalSpent)}</h2>
            </div>
            <div className="rounded-full border border-violet-500/25 bg-violet-500/10 px-2.5 py-1.5 text-[10px] font-medium text-violet-300">
              {formatCurrency(averagePerDay)}/day
            </div>
          </div>

          {expenses.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
              No report data yet. Add expenses to see your spending trends.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Top category</p>
              <p className="mt-2 text-sm font-semibold text-white">{categoryTotals[0]?.name ?? "None"}</p>
              <p className="text-xs text-cyan-300">{formatCurrency(categoryTotals[0]?.total ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Largest spend</p>
              <p className="mt-2 text-sm font-semibold text-white">{topMerchants[0]?.title ?? "None"}</p>
              <p className="text-xs text-rose-300">{formatSigned(-(topMerchants[0]?.amount ?? 0))}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Income</p>
              <p className="mt-2 text-lg font-semibold text-emerald-300">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Saved</p>
              <p className={`mt-2 text-lg font-semibold ${saved >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSigned(saved)}</p>
              <p className="text-xs text-slate-400">{savingsRate === null ? "Add income to see your rate" : `${savingsRate}% of income`}</p>
            </div>
          </div>
          {monthChange !== null && (
            <p className="mt-3 text-sm text-slate-300">
              Spending is {monthChange === 0 ? "the same as" : `${Math.abs(monthChange)}% ${monthChange > 0 ? "higher than" : "lower than"}`} the month before.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Balance today</p>
              <p className="mt-2 text-lg font-semibold text-cyan-300">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Moved this month</p>
              <p className="mt-2 text-lg font-semibold text-violet-300">{formatCurrency(transferVolume)}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Trend</p>
              <h3 className="mt-1 text-lg font-semibold">6 month spend</h3>
            </div>
          </div>

          <div className="flex h-28 items-end gap-2">
            {monthTrend.map((point) => {
              const height = (point.total / maxTrendValue) * 100;
              return (
                <div key={point.monthKey} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex h-full w-full items-end rounded-t-xl bg-[#0d1820] p-1">
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-cyan-400 to-violet-400"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400">{point.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Categories</p>
              <h3 className="mt-1 text-lg font-semibold">Spending mix</h3>
            </div>
          </div>

          <div className="space-y-4">
            {categoryTotals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                Categories will appear here once you add expenses.
              </div>
            ) : (
              categoryTotals.map((item) => {
                const width = (item.total / Math.max(categoryTotals[0]?.total ?? 1, 1)) * 100;
                return (
                  <div key={item.name}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-200">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#0d1820]">{categoryMeta[item.name]?.icon ?? "💸"}</span>
                        {item.name}
                      </span>
                      <span className="text-slate-400">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#0d1820]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(width, 8)}%`, backgroundColor: categoryColor(item.name, customCategories) }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Accounts</p>
              <h3 className="mt-1 text-lg font-semibold">Balance mix</h3>
            </div>
          </div>

          <div className="space-y-4">
            {accountMix.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                Add accounts to see your balance distribution.
              </div>
            ) : (
              accountMix.map((account) => (
                <div key={account.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ backgroundColor: account.color }}>
                        <span className="text-[10px] font-bold text-slate-950">{account.type.slice(0, 1)}</span>
                      </span>
                      {account.name}
                    </span>
                    <span className="text-slate-400">{formatCurrency(account.balance)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#0d1820]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                      style={{ width: `${account.share}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Merchants</p>
              <h3 className="mt-1 text-lg font-semibold">Highest cost</h3>
            </div>
          </div>

          <div className="space-y-3">
            {merchantTotals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                Add a merchant to your expenses to see where the most money goes.
              </div>
            ) : (
              merchantTotals.map((item) => (
                <div key={item.name} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                  <p className="text-sm font-medium text-white">{item.name}</p>
                  <span className="text-sm font-semibold text-rose-300">-{formatCurrency(item.total)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Top</p>
              <h3 className="mt-1 text-lg font-semibold">Biggest spends</h3>
            </div>
          </div>

          <div className="space-y-3">
            {loading && expenses.length === 0 ? (
              <p className="text-sm text-slate-400">Loading report data...</p>
            ) : (
              topMerchants.map((expense) => (
                <div key={String(expense.id)} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-white">{expense.title}</p>
                    <p className="text-[11px] text-slate-400">{expense.category}</p>
                  </div>
                  <span className="text-sm font-semibold text-rose-300">-{formatCurrency(expense.amount)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Flow</p>
              <h3 className="mt-1 text-lg font-semibold">Transfers this month</h3>
            </div>
          </div>

          <div className="space-y-3">
            {transfers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                Transfer activity will appear here after your first move.
              </div>
            ) : (
              transfers.slice(0, 3).map((transfer) => (
                <div key={transfer.id} className="rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{transfer.fromAccountName} → {transfer.toAccountName}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatStoredDate(transfer.date, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-cyan-300">{formatCurrency(transfer.amount)}</span>
                  </div>
                  {transfer.note ? <p className="mt-2 text-xs text-slate-400">{transfer.note}</p> : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Your data</p>
          <h3 className="mt-1 text-lg font-semibold">Export</h3>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <a href="/api/export?type=expenses" className="rounded-2xl border border-white/10 bg-[#0d1820] px-2 py-2.5 text-slate-100">Expenses CSV</a>
            <a href="/api/export?type=income" className="rounded-2xl border border-white/10 bg-[#0d1820] px-2 py-2.5 text-slate-100">Income CSV</a>
            <a href="/api/export?type=backup" className="rounded-2xl border border-white/10 bg-[#0d1820] px-2 py-2.5 text-slate-100">Full backup</a>
          </div>
        </section>

        <BottomNav />
      </div>
    </main>
  );
}
