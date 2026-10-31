"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { ExpenseFormModal, type Expense } from "@/components/ExpenseFormModal";
import type { Recurring } from "@/components/RecurringPage";
import { sendJson, useApiList } from "@/lib/api-client";
import { daysUntilDueDay, daysUntilStoredDate, elapsedDaysInMonth, formatStoredDate, localMonthString, monthsEndingAt } from "@/lib/dates";
import { categoryColor, categoryMeta, defaultCategories, formatCurrency, formatSigned } from "@/lib/format";

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
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterMonth, setFilterMonth] = useState("");
  const [budgetMonth, setBudgetMonth] = useState(currentMonth);
  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("All");
  const [budgetError, setBudgetError] = useState("");
  const [dueError, setDueError] = useState("");

  const trendMonths = useMemo(() => monthsEndingAt(currentMonth, 6), [currentMonth]);

  const filteredUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (filterCategory !== "All") params.set("category", filterCategory);
    if (filterMonth) params.set("month", filterMonth);
    if (accountFilter !== "All") params.set("accountId", accountFilter);

    return `/api/expenses?${params.toString()}`;
  }, [search, filterCategory, filterMonth, accountFilter]);

  // Totals and trends always use their own unfiltered data, so searching the
  // recent list cannot change the figures at the top of the dashboard.
  const trendExpenses = useApiList<Expense>(`/api/expenses?from=${trendMonths[0].monthKey}&to=${currentMonth}`);
  const filteredExpenses = useApiList<Expense>(filteredUrl);
  const budgetExpenses = useApiList<Expense>(`/api/expenses?month=${budgetMonth}`);
  const monthBudgets = useApiList<Budget>(`/api/budgets?month=${currentMonth}`);
  const planBudgets = useApiList<Budget>(`/api/budgets?month=${budgetMonth}`);
  const accountList = useApiList<Account>("/api/accounts");
  const debtList = useApiList<Debt>("/api/debts");
  const customCategories = useApiList<{ name: string; color: string }>("/api/categories");
  const monthIncomes = useApiList<{ amount: number }>(`/api/incomes?from=${currentMonth}&to=${currentMonth}`);
  const recurring = useApiList<Recurring>("/api/recurring");

  const accounts = accountList.items;
  const expenses = filteredExpenses.items;
  const budgets = planBudgets.items;
  const loadFailed = [trendExpenses, filteredExpenses, monthBudgets, accountList, debtList].some((item) => item.failed);

  const categoryOptions = useMemo(
    () => [...new Set([...defaultCategories, ...customCategories.items.map((item) => item.name)])],
    [customCategories.items],
  );

  const debts = useMemo(() => debtList.items.filter((debt) => debt.status !== "Closed"), [debtList.items]);

  const monthExpenses = useMemo(
    () => trendExpenses.items.filter((item) => item.date.slice(0, 7) === currentMonth),
    [trendExpenses.items, currentMonth],
  );

  const reloadMoney = () => {
    trendExpenses.reload();
    filteredExpenses.reload();
    budgetExpenses.reload();
    accountList.reload();
    debtList.reload();
    recurring.reload();
  };

  const totalSpent = useMemo(() => sumAmounts(monthExpenses), [monthExpenses]);
  const totalBalance = useMemo(() => accounts.reduce((sum, account) => sum + account.balance, 0), [accounts]);
  const monthCap = useMemo(() => sumAmounts(monthBudgets.items), [monthBudgets.items]);
  const remaining = monthCap - totalSpent;
  const totalDebtEmi = useMemo(() => debts.reduce((sum, debt) => sum + debt.monthlyPayment, 0), [debts]);
  const totalIncome = useMemo(() => sumAmounts(monthIncomes.items), [monthIncomes.items]);
  const saved = totalIncome - totalSpent;

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
  const runwayAfterDebt = remaining - unpaidEmi;

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

  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();

    monthExpenses.forEach((item) => {
      totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
    });

    const values = Array.from(totals.values());
    const maxValue = values.length ? Math.max(...values) : 1;

    return Array.from(totals.entries())
      .map(([name, value]) => ({
        name,
        value,
        width: Math.min((value / maxValue) * 100, 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthExpenses]);

  const budgetSummary = useMemo(() => {
    const totalBudget = sumAmounts(budgets);
    const spentInMonth = sumAmounts(budgetExpenses.items);

    return {
      totalBudget,
      spentInMonth,
      remaining: Math.max(totalBudget - spentInMonth, 0),
    };
  }, [budgets, budgetExpenses.items]);

  const monthTrend = useMemo(
    () =>
      trendMonths.map(({ monthKey, label }) => ({
        monthKey,
        label,
        total: sumAmounts(trendExpenses.items.filter((item) => item.date.slice(0, 7) === monthKey)),
      })),
    [trendExpenses.items, trendMonths],
  );

  const trendChange = useMemo(() => {
    const latest = monthTrend[monthTrend.length - 1].total;
    const previous = monthTrend[monthTrend.length - 2].total;

    return previous > 0 ? `${Math.round(((latest - previous) / previous) * 100)}% vs last month` : "No prior month";
  }, [monthTrend]);

  const nextDueDebt = useMemo(() => {
    const active = debts.filter((debt) => debt.outstanding > 0 && debt.dueDate != null);

    return [...active].sort((a, b) => daysUntilDueDay(a.dueDate ?? 1) - daysUntilDueDay(b.dueDate ?? 1))[0] ?? null;
  }, [debts]);

  const topMerchants = useMemo(
    () => [...monthExpenses].sort((a, b) => b.amount - a.amount).slice(0, 3),
    [monthExpenses],
  );

  const hasAnyData = trendExpenses.items.length > 0 || monthBudgets.items.length > 0 || debts.length > 0 || monthIncomes.items.length > 0;
  const hasFilters = Boolean(search.trim()) || filterCategory !== "All" || Boolean(filterMonth) || accountFilter !== "All";

  const handleSaveBudget = async () => {
    const parsedAmount = Number(budgetAmount);

    if (!budgetAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setBudgetError("Enter a budget amount above zero.");
      return;
    }

    const error = await sendJson("/api/budgets", "POST", {
      category: budgetCategory,
      amount: parsedAmount,
      month: budgetMonth,
    });

    setBudgetError(error ?? "");

    if (!error) {
      setBudgetAmount("");
      planBudgets.reload();
      monthBudgets.reload();
    }
  };

  const recentExpenses = expenses.slice(0, 6);

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
            <div>
              <p className="text-[10px] uppercase tracking-[0.28em] text-slate-400">This month</p>
              <h2 className="mt-2 text-[2.2rem] font-semibold tracking-[-0.06em] text-white">{formatCurrency(totalSpent)}</h2>
            </div>
            <div className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300">
              {budgetStatus}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Spent", value: formatCurrency(Math.round(totalSpent)), meta: "Actual", tone: "text-cyan-300" },
              { label: "Budget", value: formatCurrency(Math.round(monthCap)), meta: "Plan", tone: "text-violet-300" },
              { label: "Left", value: formatSigned(Math.round(remaining)), meta: remaining >= 0 ? "Available" : "Over budget", tone: remaining >= 0 ? "text-emerald-300" : "text-rose-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/5 bg-[#0d1820]/70 p-2.5">
                <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className={`mt-2 whitespace-nowrap text-sm font-semibold ${item.tone}`}>{item.value}</p>
                <p className="mt-1 text-[9px] text-slate-400">{item.meta}</p>
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

        <section className="mt-5 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Cashflow</p>
              <h3 className="mt-1 text-lg font-semibold">Overview</h3>
            </div>
          </div>

          <Link
            href="/accounts"
            className="mb-3 flex items-center justify-between rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2.5 text-cyan-200 transition-colors hover:border-cyan-400/30 hover:bg-cyan-500/15"
          >
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-cyan-300/80">Accounts</p>
              <p className="mt-1 text-sm font-medium text-white">Track balances & transfers</p>
            </div>
            <span className="text-lg text-cyan-300">→</span>
          </Link>

          <div className="mb-3 grid grid-cols-2 gap-2.5">
            {[
              { label: "Income", value: formatCurrency(totalIncome), tone: "text-emerald-300" },
              { label: "Spent", value: `-${formatCurrency(totalSpent)}`, tone: "text-rose-300" },
              { label: "Saved", value: formatSigned(saved), tone: saved >= 0 ? "text-emerald-300" : "text-rose-300" },
              { label: "Balance", value: formatSigned(totalBalance), tone: "text-cyan-300" },
              { label: "EMI still due", value: `-${formatCurrency(unpaidEmi)}`, tone: "text-violet-300" },
              { label: "Net left", value: formatSigned(runwayAfterDebt), tone: runwayAfterDebt >= 0 ? "text-cyan-300" : "text-rose-300" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className={`mt-2 text-base font-semibold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {accounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                No account added yet. Create one to track spending by source.
              </div>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: account.color }}>
                      <span className="text-[11px] text-slate-950">{account.type.slice(0, 1)}</span>
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{account.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{account.type}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-cyan-300">{formatCurrency(account.balance)}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-3 gap-2.5">
          <button
            onClick={openAddForm}
            className="flex h-16 flex-col items-center justify-center rounded-[20px] border border-cyan-400/30 bg-cyan-400 text-sm font-medium text-slate-950 shadow-[0_10px_20px_rgba(34,211,238,0.2)]"
          >
            <span className="text-xl leading-none">＋</span>
            <span className="mt-1">Expense</span>
          </button>
          {[
            { href: "/income", icon: "↓", label: "Income" },
            { href: "/recurring", icon: "↻", label: "Recurring" },
            { href: "/budgets", icon: "◔", label: "Budget" },
            { href: "/categories", icon: "▣", label: "Categories" },
            { href: "/transactions", icon: "≡", label: "History" },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="flex h-16 flex-col items-center justify-center rounded-[20px] border border-white/8 bg-[#1d2936] text-sm font-medium text-slate-100">
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="mt-1">{item.label}</span>
            </Link>
          ))}
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Debt</p>
              <h3 className="mt-1 text-lg font-semibold">Loan snapshot</h3>
            </div>
            <Link href="/debts" className="text-xs uppercase tracking-[0.18em] text-cyan-300">
              Manage
            </Link>
          </div>

          {debts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No active debts yet. Add a loan or EMI to track your monthly obligation.</p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Monthly EMI</p>
                <p className="mt-2 text-lg font-semibold text-cyan-300">{formatCurrency(totalDebtEmi)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Outstanding</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {formatCurrency(debts.reduce((sum, debt) => sum + debt.outstanding, 0))}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                  <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Next due</p>
                  <p className="mt-2 text-sm font-semibold text-violet-300">
                    {nextDueDebt ? `${nextDueDebt.name} • D${nextDueDebt.dueDate}` : "None"}
                  </p>
                </div>
              </div>
            </div>
          )}
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
              Add a few expenses, set your monthly budget, and your dashboard will start showing trends automatically.
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
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Spending</p>
              <h3 className="mt-1 text-lg font-semibold">Category split</h3>
            </div>
            <Link href="/reports" className="text-xs uppercase tracking-[0.18em] text-cyan-300">
              View
            </Link>
          </div>

          <div className="space-y-4">
            {categoryBreakdown.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-4 text-sm text-slate-400">
                No spending data yet. Add your first expense to see category trends.
              </div>
            ) : (
              categoryBreakdown.slice(0, 4).map((item) => (
                <div key={item.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-slate-200">{item.name}</span>
                    <span className="text-slate-400">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#0d1820]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${item.width}%`, backgroundColor: categoryColor(item.name, customCategories.items) }}
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
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Budget</p>
              <h3 className="mt-1 text-lg font-semibold">Month plan</h3>
            </div>
            <input
              type="month"
              value={budgetMonth}
              onChange={(event) => setBudgetMonth(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#0d1820] px-2 py-1.5 text-xs text-white outline-none"
            />
          </div>

          <div className="mb-4 grid grid-cols-[1fr_auto] gap-2">
            <select
              value={budgetCategory}
              onChange={(event) => setBudgetCategory(event.target.value)}
              className="rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-2.5 text-sm text-white outline-none"
            >
              {categoryOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={budgetAmount}
              onChange={(event) => setBudgetAmount(event.target.value)}
              placeholder="Budget"
              className="w-28 rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          {budgetError ? <p className="mb-3 text-sm text-rose-300">{budgetError}</p> : null}

          <button
            onClick={handleSaveBudget}
            className="mb-4 w-full rounded-2xl bg-emerald-400 px-3 py-2.5 text-sm font-semibold text-slate-950"
          >
            Save budget
          </button>

          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-slate-300">Total plan</span>
            <span className="font-medium text-white">{formatCurrency(budgetSummary.totalBudget)}</span>
          </div>

          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-slate-300">Used</span>
            <span className="font-medium text-cyan-300">{formatCurrency(budgetSummary.spentInMonth)}</span>
          </div>

          <div className="space-y-3">
            {budgets.length === 0 ? (
              <p className="text-sm text-slate-400">No category budgets set yet.</p>
            ) : (
              budgets.map((budget) => {
                const categorySpent = sumAmounts(budgetExpenses.items.filter((item) => item.category === budget.category));
                const progress = Math.min((categorySpent / Number(budget.amount)) * 100, 100);

                return (
                  <div key={`${budget.id}-${budget.category}`}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-slate-200">{budget.category}</span>
                      <span className="text-slate-400">{formatCurrency(categorySpent)} / {formatCurrency(Number(budget.amount))}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-[#0d1820]">
                      <div
                        className={`h-full rounded-full ${progress >= 100 ? "bg-rose-400" : progress >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Reports</p>
              <h3 className="mt-1 text-lg font-semibold">Monthly trend</h3>
            </div>
            <span className="text-xs text-cyan-300">{trendChange}</span>
          </div>

          <div className="h-28 rounded-[22px] border border-white/5 bg-[#0d1820] p-3">
            <div className="flex h-full items-end gap-2">
              {monthTrend.map((point) => {
                const height = (point.total / Math.max(...monthTrend.map((item) => item.total), 1)) * 100;

                return (
                  <div key={point.monthKey} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div className="flex w-full flex-1 items-end rounded-t-xl bg-[#1b2b37]">
                      <div className="w-full rounded-t-xl bg-gradient-to-t from-cyan-400 to-violet-400" style={{ height: `${height}%` }} />
                    </div>
                    <span className="text-[9px] text-slate-400">{point.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Top category</p>
              <p className="mt-2 text-sm font-semibold text-white">{categoryBreakdown[0]?.name ?? "None"}</p>
              <p className="text-xs text-cyan-300">{formatCurrency(categoryBreakdown[0]?.value ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Avg / day</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(totalSpent / elapsedDaysInMonth(currentMonth))}</p>
              <p className="text-xs text-violet-300">This month</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Top spends</p>
              <h3 className="mt-1 text-lg font-semibold">Biggest items</h3>
            </div>
          </div>

          <div className="space-y-3">
            {topMerchants.length === 0 && <p className="text-sm text-slate-400">Your biggest purchases this month will appear here.</p>}
            {topMerchants.map((merchant) => (
              <div key={String(merchant.id)} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-white">{merchant.title}</p>
                  <p className="text-[11px] text-slate-400">{merchant.category}</p>
                </div>
                <span className="text-sm font-semibold text-rose-300">-{formatCurrency(merchant.amount)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <h3 className="text-lg font-semibold">Recent</h3>
            <Link href="/transactions" className="text-sm text-cyan-300">
              See all
            </Link>
          </div>

          <div className="mb-4 space-y-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setAccountFilter("All")}
                className={`rounded-full border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] ${
                  accountFilter === "All"
                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                    : "border-white/10 bg-[#0d1820] text-slate-300"
                }`}
              >
                All
              </button>
              {accounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => setAccountFilter(account.id)}
                  className={`rounded-full border px-2.5 py-1.5 text-[10px] uppercase tracking-[0.18em] ${
                    accountFilter === account.id
                      ? "border-violet-400/40 bg-violet-500/10 text-violet-200"
                      : "border-white/10 bg-[#0d1820] text-slate-300"
                  }`}
                >
                  {account.name}
                </button>
              ))}
            </div>

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search expenses"
              className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={filterCategory}
                onChange={(event) => setFilterCategory(event.target.value)}
                className="rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="All">All categories</option>
                {categoryOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>

              <input
                type="month"
                value={filterMonth}
                onChange={(event) => setFilterMonth(event.target.value)}
                className="rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-2.5 text-sm text-white outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredExpenses.loading && expenses.length === 0 ? (
              <p className="text-sm text-slate-400">Loading expenses...</p>
            ) : recentExpenses.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-[#0d1820] p-4 text-sm text-slate-400">
                {hasFilters ? "No expenses match these filters." : <>No expenses yet. Tap <span className="text-cyan-300">Add</span> to log your first purchase.</>}
              </div>
            ) : (
              recentExpenses.map((expense) => (
                <div
                  key={String(expense.id)}
                  className="flex items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#121d27] px-3 py-3"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0d1820] text-lg">
                      {categoryMeta[expense.category]?.icon ?? "💸"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{expense.title}</p>
                      <p className="text-xs text-slate-400">
                        {expense.merchant || expense.category} • {expense.paymentMethod || "Card"} • {formatStoredDate(expense.date, { month: "short", day: "numeric" })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(expense)}
                      className="rounded-lg border border-white/10 bg-[#0d1820] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(expense.id)}
                      className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-300"
                    >
                      Delete
                    </button>
                    <span className="whitespace-nowrap text-sm font-semibold text-rose-300">-{formatCurrency(expense.amount)}</span>
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
