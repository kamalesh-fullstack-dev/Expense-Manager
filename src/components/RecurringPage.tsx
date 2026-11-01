"use client";

import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DeleteButton, EditButton } from "@/components/IconButtons";
import { sendJson, useApiList } from "@/lib/api-client";
import { daysUntilStoredDate, formatStoredDate, localDateString, RECURRING_FREQUENCIES } from "@/lib/dates";
import { defaultCategories, formatCurrency } from "@/lib/format";

export type Recurring = {
  id: string;
  title: string;
  amount: number;
  category: string;
  merchant: string | null;
  paymentMethod: string | null;
  frequency: string;
  nextDate: string;
  active: boolean;
  accountId: string | null;
};

const fieldClass = "w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none placeholder:text-slate-500";
const labelClass = "mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400";
const yearlyShare = { Weekly: 52 / 12, Monthly: 1, Yearly: 1 / 12 } as Record<string, number>;

export function RecurringPage() {
  const { status } = useSession();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Bills");
  const [frequency, setFrequency] = useState("Monthly");
  const [nextDate, setNextDate] = useState(() => localDateString());
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");

  const recurring = useApiList<Recurring>("/api/recurring");
  const accounts = useApiList<{ id: string; name: string }>("/api/accounts");
  const customCategories = useApiList<{ name: string }>("/api/categories");

  const categories = useMemo(
    () => [...new Set([...defaultCategories, ...customCategories.items.map((item) => item.name)])],
    [customCategories.items],
  );

  const monthlyTotal = useMemo(
    () => recurring.items.filter((item) => item.active).reduce((sum, item) => sum + item.amount * (yearlyShare[item.frequency] ?? 1), 0),
    [recurring.items],
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setCategory("Bills");
    setFrequency("Monthly");
    setNextDate(localDateString());
    setAccountId("");
    setError("");
  };

  const fillForm = (item: Recurring) => {
    setEditingId(item.id);
    setTitle(item.title);
    setAmount(String(item.amount));
    setCategory(item.category);
    setFrequency(item.frequency);
    setNextDate(item.nextDate.slice(0, 10));
    setAccountId(item.accountId ?? "");
    setError("");
  };

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);

    if (!title.trim() || !amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a title and an amount above zero.");
      return;
    }

    const saveError = await sendJson("/api/recurring", editingId ? "PUT" : "POST", {
      id: editingId,
      title: title.trim(),
      amount: parsedAmount,
      category,
      frequency,
      nextDate,
      accountId: accountId || null,
    });

    if (saveError) {
      setError(saveError);
      return;
    }

    resetForm();
    recurring.reload();
  };

  const runAction = async (request: Promise<string | null>) => {
    setError((await request) ?? "");
    recurring.reload();
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Stop tracking this recurring expense? Expenses already logged stay.")) {
      void runAction(sendJson(`/api/recurring?id=${encodeURIComponent(id)}`, "DELETE"));
    }
  };

  if (status === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a1016] text-slate-200">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Bills & subscriptions</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Recurring</h1>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Per month, on average</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(Math.round(monthlyTotal))}</h2>
          <p className="mt-2 text-xs text-slate-400">Nothing is logged automatically. You confirm each one when it&apos;s due.</p>
        </section>

        <section className="mt-6 space-y-3 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editingId ? "Edit recurring" : "Add recurring"}</h3>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs uppercase tracking-[0.18em] text-cyan-300">Cancel</button>
            )}
          </div>

          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Netflix" className={fieldClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Repeats</label>
              <select value={frequency} onChange={(event) => setFrequency(event.target.value)} className={fieldClass}>
                {RECURRING_FREQUENCIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Next due</label>
              <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Category</label>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Account</label>
            <select value={accountId} onChange={(event) => setAccountId(event.target.value)} className={fieldClass}>
              <option value="">No account</option>
              {accounts.items.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}

          <button type="button" onClick={handleSubmit} className="w-full rounded-2xl bg-cyan-400 px-3 py-2.5 text-sm font-semibold text-slate-950">
            {editingId ? "Update recurring" : "Save recurring"}
          </button>
        </section>

        <section className="mt-6 space-y-3">
          {recurring.items.length === 0 && !recurring.loading ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
              Add rent, subscriptions or bills so you never miss one.
            </div>
          ) : (
            recurring.items.map((item) => {
              const days = daysUntilStoredDate(item.nextDate);

              return (
                <div key={item.id} className={`rounded-[22px] border border-white/10 bg-[#121d27] px-3 py-3 ${item.active ? "" : "opacity-60"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className={`text-xs ${item.active && days < 0 ? "text-rose-300" : "text-slate-400"}`}>
                        {item.active ? `${item.frequency} • ${days < 0 ? "Overdue" : "Due"} ${formatStoredDate(item.nextDate, { day: "numeric", month: "short" })}` : "Paused"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-rose-300">{formatCurrency(item.amount)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-2 text-[10px] uppercase tracking-[0.18em]">
                    {item.active && (
                      <>
                        <button type="button" onClick={() => runAction(sendJson("/api/recurring/log", "POST", { id: item.id, nextDate: item.nextDate }))} className="rounded-lg bg-cyan-400 px-2 py-1 font-semibold text-slate-950">Log</button>
                        <button type="button" onClick={() => runAction(sendJson("/api/recurring/log", "POST", { id: item.id, nextDate: item.nextDate, skip: true }))} className="rounded-lg border border-white/10 bg-[#0d1820] px-2 py-1 text-slate-300">Skip</button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => runAction(sendJson("/api/recurring", "PUT", { ...item, nextDate: item.nextDate.slice(0, 10), active: !item.active }))}
                      className="rounded-lg border border-white/10 bg-[#0d1820] px-2 py-1 text-slate-300"
                    >
                      {item.active ? "Pause" : "Resume"}
                    </button>
                    <EditButton onClick={() => fillForm(item)} />
                    <DeleteButton onClick={() => handleDelete(item.id)} />
                  </div>
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
