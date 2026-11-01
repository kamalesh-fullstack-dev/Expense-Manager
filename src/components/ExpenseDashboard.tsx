"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DeleteButton, EditButton } from "@/components/IconButtons";
import { ExpenseFormModal, type Expense } from "@/components/ExpenseFormModal";
import type { Recurring } from "@/components/RecurringPage";
import { sendJson, useApiData, useApiList } from "@/lib/api-client";
import { daysUntilDueDay, daysUntilStoredDate, formatStoredDate, localMonthString } from "@/lib/dates";
import { categoryMeta, defaultCategories, formatCurrency, formatSigned } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
};

type Debt = {
  id: string;
  name: string;
  outstanding: number;
  monthlyPayment: number;
  dueDate?: number | null;
  status?: string | null;
};

type Budget = {
  id: string;
  category: string;
  amount: number;
  month: string;
};

const RECENT_LIMIT = 5;
const noRecent: { items: Expense[] } = { items: [] };

const sumAmounts = (items: Array<{ amount: number }>) => items.reduce((sum, item) => sum + item.amount, 0);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  return hour < 17 ? "Good afternoon" : "Good evening";
};

export function ExpenseDashboard({ autoOpenAdd = false }: { autoOpenAdd?: boolean }) {
  const { data: session, status } = useSession();
  const [currentMonth] = useState(() => localMonthString());
  const [showForm, setShowForm] = useState(autoOpenAdd);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [dueError, setDueError] = useState("");

  const expenseList = useApiList<Expense>(`/api/expenses?month=${currentMonth}`);
  const recent = useApiData("/api/transactions?page=0", noRecent);
  const monthBudgets = useApiList<Budget>(`/api/budgets?month=${currentMonth}`);
  const accountList = useApiList<Account>("/api/accounts");
  const debtList = useApiList<Debt>("/api/debts");
  const customCategories = useApiList<{ name: string; color: string }>("/api/categories");
  const recurring = useApiList<Recurring>("/api/recurring");

  const accounts = accountList.items;
  const monthExpenses = expenseList.items;
  const recentExpenses = recent.data.items.slice(0, RECENT_LIMIT);
  const loadFailed = [expenseList, recent, monthBudgets, accountList, debtList].some((item) => item.failed);

  const categoryOptions = useMemo(
    () => [...new Set([...defaultCategories, ...customCategories.items.map((item) => item.name)])],
    [customCategories.items],
  );

  const debts = useMemo(() => debtList.items.filter((debt) => debt.status !== "Closed"), [debtList.items]);

  const reloadMoney = () => {
    expenseList.reload();
    recent.reload();
    accountList.reload();
    debtList.reload();
    recurring.reload();
  };

  const totalSpent = useMemo(() => sumAmounts(monthExpenses), [monthExpenses]);
  const totalBalance = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);
  const monthCap = useMemo(() => sumAmounts(monthBudgets.items), [monthBudgets.items]);
  const remaining = monthCap - totalSpent;

  // EMIs paid this month are already in spending, so only what's left is held back.
  const unpaidDebts = useMemo(
    () =>
      debts
        .map((debt) => {
          const paid = sumAmounts(monthExpenses.filter((item) => item.debtId === debt.id));
          return { ...debt, unpaid: Math.min(Math.max(debt.monthlyPayment - paid, 0), debt.outstanding) };
        })
        .filter((debt) => debt.unpaid > 0),
    [debts, monthExpenses],
  );
  const unpaidEmi = useMemo(() => unpaidDebts.reduce((sum, debt) => sum + debt.unpaid, 0), [unpaidDebts]);

  const budgetAlerts = useMemo(
    () =>
      monthBudgets.items
        .map((budget) => {
          const spent = sumAmounts(monthExpenses.filter((item) => item.category === budget.category));
          return { ...budget, percent: Math.round((spent / budget.amount) * 100) };
        })
        .filter((budget) => budget.percent >= 80)
        .sort((a, b) => b.percent - a.percent),
    [monthBudgets.items, monthExpenses],
  );

  const dueSoon = useMemo(
    () => recurring.items.filter((item) => item.active && daysUntilStoredDate(item.nextDate) <= 7),
    [recurring.items],
  );

  const debtsDueSoon = useMemo(
    () => unpaidDebts.filter((debt) => debt.dueDate != null && daysUntilDueDay(debt.dueDate) <= 7),
    [unpaidDebts],
  );

  const budgetStatus = useMemo(() => {
    if (monthCap === 0) return totalSpent > 0 ? "No budget" : "New";
    if (totalSpent > monthCap) return "Over budget";
    return totalSpent >= monthCap * 0.85 ? "Near limit" : "On track";
  }, [monthCap, totalSpent]);

  const hasAnyData = recentExpenses.length > 0 || monthBudgets.items.length > 0 || debts.length > 0;

  const closeForm = () => {
    setShowForm(false);
    setEditingExpense(null);

    if (autoOpenAdd) {
      window.history.replaceState(null, "", "/");
    }
  };

  const openAddForm = () => {
    setEditingExpense(null);
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingExpense(expense);
    setShowForm(true);
  };

  const handleDelete = async (expenseId: string) => {
    const confirmed = window.confirm("Delete this expense?");
    if (!confirmed) return;

    const error = await sendJson(`/api/expenses?id=${encodeURIComponent(expenseId)}`, "DELETE");

    if (error) {
      window.alert(error);
      return;
    }

    reloadMoney();
  };

  const handleRecurring = async ({ id, nextDate }: Recurring, skip: boolean) => {
    const error = await sendJson("/api/recurring/log", "POST", { id, nextDate, skip });

    setDueError(error ?? "");
    reloadMoney();
  };

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User";

  if (status === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a1016] text-slate-200">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto min-h-screen max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">{getGreeting()}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{userName}</h1>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#121d27] text-lg"
            aria-label="Sign out"
          >
            ⎋
          </button>
        </header>

        {loadFailed && (
          <p role="alert" className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            Couldn&apos;t load your latest data, so these figures may be incomplete.
          </p>
        )}

        <section className="rounded-[30px] border border-white/10 bg-[#121d27] p-4 shadow-[0_16px_35px_rgba(2,6,23,0.35)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">This month</p>
              <h2 className="mt-2 break-all text-[2.2rem] font-semibold leading-tight tracking-[-0.06em] text-white">{formatCurrency(totalSpent)}</h2>
            </div>
            <div className="shrink-0 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300">
              {budgetStatus}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: "Budget", value: formatCurrency(Math.round(monthCap)), tone: "text-violet-300" },
              { label: remaining >= 0 ? "Left" : "Over budget", value: formatSigned(Math.round(remaining)), tone: remaining >= 0 ? "text-emerald-300" : "text-rose-300" },
              { label: "Balance", value: formatSigned(totalBalance), tone: "text-cyan-300" },
              { label: "EMI still due", value: formatCurrency(unpaidEmi), tone: "text-violet-300" },
            ].map((item) => (
              <div key={item.label} className="min-w-0 rounded-2xl border border-white/5 bg-[#0d1820]/70 p-3">
                <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className={`mt-2 break-all text-base font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {budgetAlerts.length > 0 && (
          <section className="mt-5 space-y-2 rounded-[28px] border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-amber-200">Budget alerts</p>
            {budgetAlerts.map((budget) => (
              <Link key={budget.id} href="/budgets" className="flex items-center justify-between text-sm">
                <span className="text-white">{budget.category}</span>
                <span className={budget.percent >= 100 ? "font-semibold text-rose-300" : "font-semibold text-amber-200"}>
                  {budget.percent >= 100 ? `Over budget (${budget.percent}%)` : `${budget.percent}% used`}
                </span>
              </Link>
            ))}
          </section>
        )}

        {(dueSoon.length > 0 || debtsDueSoon.length > 0) && (
          <section className="mt-5 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Next 7 days</p>
            <h3 className="mt-1 text-lg font-semibold">Coming up</h3>

            <div className="mt-3 space-y-2">
              {dueSoon.map((item) => {
                const days = daysUntilStoredDate(item.nextDate);

                return (
                  <div key={item.id} className="rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{item.title}</p>
                        <p className={`text-xs ${days < 0 ? "text-rose-300" : "text-slate-400"}`}>
                          {days < 0 ? "Overdue" : days === 0 ? "Due today" : `Due in ${days} ${days === 1 ? "day" : "days"}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-white">{formatCurrency(item.amount)}</span>
                    </div>
                    <div className="mt-2 flex justify-end gap-2 text-[10px] uppercase tracking-[0.18em]">
                      <button type="button" onClick={() => handleRecurring(item, false)} className="rounded-lg bg-cyan-400 px-2 py-1 font-semibold text-slate-950">Log</button>
                      <button type="button" onClick={() => handleRecurring(item, true)} className="rounded-lg border border-white/10 px-2 py-1 text-slate-300">Skip</button>
                    </div>
                  </div>
                );
              })}

              {debtsDueSoon.map((debt) => (
                <Link key={debt.id} href="/debts" className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{debt.name} EMI</p>
                    <p className="text-xs text-slate-400">Due on day {debt.dueDate}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-violet-300">{formatCurrency(debt.unpaid)}</span>
                </Link>
              ))}
            </div>

            {dueError ? <p className="mt-2 text-sm text-rose-300">{dueError}</p> : null}
          </section>
        )}

        <section className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            { href: "/income", icon: "↓", label: "Income" },
            { href: "/recurring", icon: "↻", label: "Recurring" },
            { href: "/budgets", icon: "◔", label: "Budget" },
            { href: "/categories", icon: "▣", label: "Categories" },
            { href: "/debts", icon: "◈", label: "Debt" },
            { href: "/accounts", icon: "⇄", label: "Transfer" },
          ].map((item) => (
            <Link key={item.label} href={item.href} className="flex h-16 flex-col items-center justify-center rounded-[20px] border border-white/8 bg-[#1d2936] text-sm font-medium text-slate-100">
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="mt-1">{item.label}</span>
            </Link>
          ))}
        </section>

        {!hasAnyData && (
          <section className="mt-6 rounded-[28px] border border-cyan-500/20 bg-[#101c27] p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-300">Welcome</p>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-cyan-200">
                Starter
              </span>
            </div>
            <h3 className="text-xl font-semibold text-white">Let’s build your first month</h3>
            <p className="mt-2 text-sm text-slate-300">
              Add a few expenses, set your monthly budget, and your reports will start showing trends automatically.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={openAddForm}
                className="rounded-2xl bg-cyan-400 px-3 py-2.5 text-sm font-semibold text-slate-950"
              >
                Add expense
              </button>
              <Link href="/budgets" className="rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-2.5 text-center text-sm font-medium text-slate-100">
                Set budget
              </Link>
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-lg font-semibold">Recent</h3>
            <Link href="/transactions" className="text-sm text-cyan-300">
              See all
            </Link>
          </div>

          <div className="space-y-3">
            {recent.loading && recentExpenses.length === 0 ? (
              <p className="text-sm text-slate-400">Loading expenses...</p>
            ) : recentExpenses.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-[#0d1820] p-4 text-sm text-slate-400">
                No expenses yet. Tap <span className="text-cyan-300">+</span> to log your first purchase.
              </div>
            ) : (
              recentExpenses.map((expense) => (
                <div
                  key={String(expense.id)}
                  className="rounded-[22px] border border-white/10 bg-[#121d27] px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0d1820] text-lg">
                      {categoryMeta[expense.category]?.icon ?? "💸"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-white">{expense.title}</p>
                      <p className="truncate text-xs text-slate-400">
                        {expense.merchant || expense.category} • {expense.paymentMethod || "Card"} • {formatStoredDate(expense.date, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-rose-300">-{formatCurrency(expense.amount)}</span>
                  </div>

                  <div className="mt-2 flex justify-end gap-2">
                    <EditButton onClick={() => openEditForm(expense)} />
                    <DeleteButton onClick={() => handleDelete(expense.id)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <BottomNav onAdd={openAddForm} />
      </div>

      {showForm && (
        <ExpenseFormModal
          expense={editingExpense}
          accounts={accounts}
          categories={categoryOptions}
          onClose={closeForm}
          onSaved={reloadMoney}
        />
      )}
    </main>
  );
}
