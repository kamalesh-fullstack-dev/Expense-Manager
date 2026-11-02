"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DeleteButton, EditButton } from "@/components/IconButtons";
import { ListSkeleton, PageLoader } from "@/components/Loader";
import { sendJson, useApiList } from "@/lib/api-client";
import { formatStoredDate, localMonthString } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

export type Goal = {
  id: string;
  name: string;
  target: number;
  targetDate: string | null;
  saved: number;
  byAccount: Array<{ accountId: string; accountName: string; amount: number }>;
  history: Array<{ id: string; kind: string; amount: number; accountName: string; createdAt: string }>;
};

type Account = { id: string; name: string; balance: number; setAside: number };

const fieldClass = "w-full min-w-0 rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none placeholder:text-slate-500";
const smallField = "w-full min-w-0 rounded-xl border border-white/10 bg-[#0d1820] px-2 py-2 text-white outline-none";

// Months from this month to the target month, at least one.
const monthsUntil = (date: string) => {
  const [fromYear, fromMonth] = localMonthString().split("-").map(Number);
  const [toYear, toMonth] = date.slice(0, 7).split("-").map(Number);

  return Math.max((toYear - fromYear) * 12 + (toMonth - fromMonth), 1);
};

export function GoalsPage() {
  const { status } = useSession();
  const goals = useApiList<Goal>("/api/goals");
  const accounts = useApiList<Account>("/api/accounts");
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [moving, setMoving] = useState<{ goalId: string; action: "add" | "withdraw" } | null>(null);
  const [moveAmount, setMoveAmount] = useState("");
  const [moveAccountChoice, setMoveAccountChoice] = useState<string | undefined>();
  const [moveError, setMoveError] = useState("");

  const reloadAll = () => {
    goals.reload();
    accounts.reload();
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setTarget("");
    setTargetDate("");
    setFormError("");
  };

  const fillForm = (goal: Goal) => {
    setEditingId(goal.id);
    setName(goal.name);
    setTarget(String(goal.target));
    setTargetDate(goal.targetDate ? goal.targetDate.slice(0, 10) : "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    const error = await sendJson("/api/goals", editingId ? "PUT" : "POST", {
      id: editingId,
      name: name.trim(),
      target: Number(target),
      targetDate: targetDate || null,
    });

    setFormError(error ?? "");

    if (!error) {
      resetForm();
      goals.reload();
    }
  };

  const handleDelete = async (goal: Goal) => {
    if (!window.confirm(`Delete ${goal.name}? The money set aside for it becomes free again.`)) return;

    await sendJson(`/api/goals?id=${encodeURIComponent(goal.id)}`, "DELETE");
    reloadAll();
  };

  const openMove = (goalId: string, action: "add" | "withdraw") => {
    setMoving({ goalId, action });
    setMoveAmount("");
    setMoveAccountChoice(undefined);
    setMoveError("");
  };

  // Withdrawing can only come from accounts this goal holds money in.
  const moveAccounts = (goal: Goal) =>
    moving?.action === "withdraw"
      ? goal.byAccount.map((item) => ({ id: item.accountId, label: `${item.accountName} · ${formatCurrency(item.amount)} held` }))
      : accounts.items.map((account) => ({ id: account.id, label: `${account.name} · ${formatCurrency(Math.max(account.balance - account.setAside, 0))} free` }));

  const handleMove = async (goal: Goal) => {
    const accountId = moveAccountChoice ?? moveAccounts(goal)[0]?.id;
    const error = await sendJson("/api/goals/entries", "POST", {
      goalId: goal.id,
      accountId,
      amount: Number(moveAmount),
      action: moving?.action,
    });

    setMoveError(error ?? "");

    if (!error) {
      setMoving(null);
      reloadAll();
    }
  };

  if (status === "loading") {
    return <PageLoader />;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Savings</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Goals</h1>
          <p className="mt-2 text-sm text-slate-400">Money you set aside stays in its account. Balances never change.</p>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{editingId ? "Edit goal" : "New goal"}</h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                Cancel
              </button>
            )}
          </div>
          <div className="space-y-3">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Goal name, e.g. Bike" className={fieldClass} />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" inputMode="decimal" min="0" step="0.01" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="Target amount" className={fieldClass} />
              <label className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                By (optional)
                <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className={`mt-1 text-sm normal-case tracking-normal [color-scheme:dark] ${fieldClass}`} />
              </label>
            </div>
            {formError ? <p className="text-sm text-rose-300">{formError}</p> : null}
            <button type="button" onClick={handleSave} className="w-full rounded-2xl bg-cyan-400 py-2.5 text-sm font-semibold text-slate-950">
              {editingId ? "Update goal" : "Save goal"}
            </button>
          </div>
        </section>

        <section className="mt-6 space-y-3">
          {goals.loading && goals.items.length === 0 ? (
            <ListSkeleton />
          ) : goals.items.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-[#0d1820] p-4 text-sm text-slate-400">
              No goals yet. Add one above, then set money aside for it from any account.
            </div>
          ) : (
            goals.items.map((goal) => {
              const progress = Math.min((goal.saved / goal.target) * 100, 100);
              const remaining = Math.max(goal.target - goal.saved, 0);

              return (
                <div key={goal.id} className="rounded-[22px] border border-white/10 bg-[#121d27] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{goal.name}</p>
                      <p className="text-sm text-slate-300">
                        <span className="font-semibold text-emerald-300">{formatCurrency(goal.saved)}</span> of {formatCurrency(goal.target)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <EditButton onClick={() => fillForm(goal)} />
                      <DeleteButton onClick={() => handleDelete(goal)} />
                    </div>
                  </div>

                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#0d1820]">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${progress}%` }} />
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    {remaining === 0
                      ? "Goal reached."
                      : goal.targetDate
                        ? `${formatCurrency(Math.ceil(remaining / monthsUntil(goal.targetDate)))} a month to reach it by ${formatStoredDate(goal.targetDate, { month: "short", year: "numeric" })}`
                        : `${formatCurrency(remaining)} to go`}
                  </p>

                  {goal.byAccount.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {goal.byAccount.map((item) => (
                        <span key={item.accountId} className="rounded-full border border-white/10 bg-[#0d1820] px-2.5 py-1 text-xs text-slate-200">
                          {item.accountName} {formatCurrency(item.amount)}
                        </span>
                      ))}
                    </div>
                  )}

                  {moving?.goalId === goal.id ? (
                    <div className="mt-3 space-y-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input aria-label="Amount" type="number" inputMode="decimal" min="0" step="0.01" value={moveAmount} onChange={(event) => setMoveAmount(event.target.value)} placeholder="Amount" className={smallField} />
                        <select aria-label={moving.action === "add" ? "From account" : "Release from"} value={moveAccountChoice ?? moveAccounts(goal)[0]?.id ?? ""} onChange={(event) => setMoveAccountChoice(event.target.value)} className={smallField}>
                          {moveAccounts(goal).map((item) => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                          ))}
                        </select>
                      </div>
                      {moveError ? <p className="text-sm text-rose-300">{moveError}</p> : null}
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setMoving(null)} className="rounded-xl border border-white/10 py-2 text-sm text-slate-200">Cancel</button>
                        <button type="button" onClick={() => handleMove(goal)} disabled={accounts.loading} className="rounded-xl bg-cyan-400 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">
                          {moving.action === "add" ? "Set aside" : "Withdraw"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => openMove(goal.id, "add")} className="rounded-xl bg-cyan-400 py-2 text-sm font-semibold text-slate-950">Add money</button>
                      <button type="button" onClick={() => openMove(goal.id, "withdraw")} disabled={goal.byAccount.length === 0} className="rounded-xl border border-white/10 py-2 text-sm text-slate-200 disabled:opacity-40">Withdraw</button>
                    </div>
                  )}

                  {goal.history.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-white/5 pt-3 text-xs text-slate-400">
                      {goal.history.map((entry) => (
                        <li key={entry.id} className="flex justify-between gap-2">
                          <span>
                            {entry.kind === "Used" ? "Spent from" : entry.kind === "Added" ? "Set aside from" : "Withdrawn from"} {entry.accountName} ·{" "}
                            {formatStoredDate(entry.createdAt, { day: "numeric", month: "short" })}
                          </span>
                          <span className={entry.amount > 0 ? "text-emerald-300" : entry.kind === "Used" ? "text-rose-300" : "text-slate-300"}>
                            {entry.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(entry.amount))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </section>

        <BottomNav />
      </div>
    </main>
  );
}
