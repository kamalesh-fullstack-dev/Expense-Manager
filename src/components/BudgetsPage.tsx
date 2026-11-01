"use client";

import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DeleteButton } from "@/components/IconButtons";
import { sendJson, useApiList } from "@/lib/api-client";
import { localMonthString, shiftMonth } from "@/lib/dates";
import { categoryMeta, defaultCategories, formatCurrency } from "@/lib/format";

type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
};

type Budget = {
  id: string;
  category: string;
  amount: number;
  month: string;
};

type Debt = {
  id: string;
  name: string;
  monthlyPayment: number;
  status?: string | null;
};

export function BudgetsPage() {
  const { status } = useSession();
  const [month, setMonth] = useState(() => localMonthString());
  const [budgetCategory, setBudgetCategory] = useState("Food");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [error, setError] = useState("");

  const expenseList = useApiList<Expense>(`/api/expenses?month=${month}`);
  const budgetList = useApiList<Budget>(`/api/budgets?month=${month}`);
  const debtList = useApiList<Debt>("/api/debts");
  const customCategories = useApiList<{ name: string }>("/api/categories");

  const expenses = expenseList.items;
  const budgets = budgetList.items;
  const debts = useMemo(() => debtList.items.filter((debt) => debt.status !== "Closed"), [debtList.items]);
  const categoryOptions = useMemo(
    () => [...new Set([...defaultCategories, ...customCategories.items.map((item) => item.name)])],
    [customCategories.items],
  );

  const totalBudget = useMemo(
    () => budgets.reduce((sum, budget) => sum + Number(budget.amount), 0),
    [budgets],
  );

  const spentThisMonth = useMemo(() => expenses.reduce((sum, item) => sum + item.amount, 0), [expenses]);

  const totalDebtEmi = useMemo(
    () => debts.reduce((sum, debt) => sum + Number(debt.monthlyPayment ?? 0), 0),
    [debts],
  );

  const remainingAfterDebt = useMemo(
    () => totalBudget - spentThisMonth - totalDebtEmi,
    [totalBudget, spentThisMonth, totalDebtEmi],
  );

  const debtPressure = useMemo(
    () => (totalBudget > 0 ? (totalDebtEmi / totalBudget) * 100 : 0),
    [totalBudget, totalDebtEmi],
  );

  const budgetCards = useMemo(
    () =>
      budgets.map((budget) => {
        const spent = expenses
          .filter((item) => item.category === budget.category)
          .reduce((sum, item) => sum + item.amount, 0);

        return {
          ...budget,
          spent,
          progress: Math.min((spent / Number(budget.amount)) * 100, 100),
          remaining: Number(budget.amount) - spent,
        };
      }),
    [budgets, expenses],
  );

  const handleSaveBudget = async () => {
    const parsedAmount = Number(budgetAmount);

    if (!budgetAmount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a budget amount above zero.");
      return;
    }

    const saveError = await sendJson("/api/budgets", "POST", {
      category: budgetCategory,
      amount: parsedAmount,
      month,
    });

    setError(saveError ?? "");

    if (!saveError) {
      setBudgetAmount("");
      budgetList.reload();
    }
  };

  const handleCopyBudgets = async () => {
    const copyError = await sendJson("/api/budgets/copy", "POST", { fromMonth: shiftMonth(month, -1), toMonth: month });

    setError(copyError ?? "");

    if (!copyError) {
      budgetList.reload();
    }
  };

  const handleDeleteBudget = async (budgetId: string) => {
    const deleteError = await sendJson(`/api/budgets?id=${encodeURIComponent(budgetId)}`, "DELETE");

    setError(deleteError ?? "");

    if (!deleteError) {
      budgetList.reload();
    }
  };

  if (status === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a1016] text-slate-200">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Budgeting</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Plan</h1>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-2xl border border-white/10 bg-[#121d27] px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200"
          >
            Log out
          </button>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#121d27] p-4 shadow-[0_12px_24px_rgba(2,6,23,0.18)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Month</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(totalBudget)}</h2>
            </div>
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#0d1820] px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-400/40"
            />
          </div>

          {budgets.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
              No budget set yet. Create a category budget to start tracking limits.
              <button type="button" onClick={handleCopyBudgets} className="mt-2 block text-cyan-300">
                Copy last month&apos;s budgets
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Allocated</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(totalBudget)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Spent</p>
              <p className="mt-2 text-sm font-semibold text-cyan-300">{formatCurrency(spentThisMonth)}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[0.2em] text-violet-200/80">Debt flow</p>
                <p className="mt-1 text-sm font-semibold text-white">{formatCurrency(totalDebtEmi)} monthly EMI</p>
              </div>
              <span className="text-xs font-medium text-violet-200">{debtPressure.toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-950/60">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-400 to-cyan-400" style={{ width: `${Math.min(debtPressure, 100)}%` }} />
            </div>
            <p className={`mt-2 text-xs ${remainingAfterDebt >= 0 ? "text-cyan-200" : "text-rose-200"}`}>
              {remainingAfterDebt >= 0
                ? `${formatCurrency(remainingAfterDebt)} left after spending + debt` 
                : `${formatCurrency(Math.abs(remainingAfterDebt))} over after spending + debt`}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Set</p>
              <h3 className="mt-1 text-lg font-semibold">Category budget</h3>
            </div>
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

          {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}

          <button
            onClick={handleSaveBudget}
            className="w-full rounded-2xl bg-emerald-400 px-3 py-2.5 text-sm font-semibold text-slate-950"
          >
            Save budget
          </button>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Progress</p>
              <h3 className="mt-1 text-lg font-semibold">Budget health</h3>
            </div>
          </div>

          <div className="space-y-4">
            {budgetCards.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                Budget cards will appear here after you add your category limits.
              </div>
            ) : (
              budgetCards.map((card) => (
                <div key={`${card.id}-${card.category}`} className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-200">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#121d27]">{categoryMeta[card.category]?.icon ?? "💸"}</span>
                      {card.category}
                    </span>
                    <DeleteButton onClick={() => handleDeleteBudget(card.id)} />
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span>{formatCurrency(card.spent)} spent</span>
                    <span>{formatCurrency(Number(card.amount))} cap</span>
                  </div>
                  <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-[#121d27]">
                    <div
                      className={`h-full rounded-full ${card.progress >= 100 ? "bg-rose-400" : card.progress >= 80 ? "bg-amber-400" : "bg-emerald-400"}`}
                      style={{ width: `${card.progress}%` }}
                    />
                  </div>
                  <p className={`text-xs ${card.remaining < 0 ? "text-rose-300" : card.progress >= 80 ? "text-amber-300" : "text-cyan-300"}`}>
                    {card.remaining >= 0 ? `${formatCurrency(card.remaining)} left${card.progress >= 80 ? " • near limit" : ""}` : `${formatCurrency(Math.abs(card.remaining))} over budget`}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <BottomNav />
      </div>
    </main>
  );
}
