"use client";

import { useMemo, useState } from "react";

import { sendJson, useApiData } from "@/lib/api-client";
import { localDateString } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

export type Expense = {
  id: string;
  title: string;
  amount: number;
  category: string;
  merchant?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  accountId?: string | null;
  debtId?: string | null;
  date: string;
};

const quickAmounts = [100, 250, 500, 1000, 2000];
const REPEAT_LIMIT = 6;
const noRecent: { items: Expense[] } = { items: [] };

// The expenses logged most often lately, most frequent first. Loan payments are left out:
// they belong to Pay EMI, which also lowers the loan.
function frequentExpenses(recent: Expense[]) {
  const groups = new Map<string, { expense: Expense; count: number; order: number }>();

  recent
    .filter((item) => !item.debtId)
    .forEach((item, order) => {
      const key = `${item.title.trim().toLowerCase()}|${item.amount}`;
      const group = groups.get(key);

      if (group) group.count += 1;
      else groups.set(key, { expense: item, count: 1, order });
    });

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, REPEAT_LIMIT)
    .map((group) => group.expense);
}
const fieldClass = "w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none placeholder:text-slate-500";
const labelClass = "mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400";

export function ExpenseFormModal({
  expense,
  accounts,
  categories,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  accounts: Array<{ id: string; name: string }>;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const recent = useApiData("/api/transactions?page=0", noRecent).data.items;
  const last = expense ? null : recent.find((item) => !item.debtId) ?? null;
  const repeats = useMemo(() => (expense ? [] : frequentExpenses(recent)), [expense, recent]);
  const pastTitles = useMemo(() => [...new Set(recent.map((item) => item.title))], [recent]);

  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  // For a new expense, undefined means "use what was used last", so the defaults can arrive after the form opens.
  const [categoryChoice, setCategoryChoice] = useState<string | undefined>(expense?.category);
  const [merchant, setMerchant] = useState(expense?.merchant ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [paymentChoice, setPaymentChoice] = useState<string | undefined>(expense ? expense.paymentMethod ?? "Card" : undefined);
  const [date, setDate] = useState(expense?.date.slice(0, 10) ?? localDateString());
  // undefined means "use the default account", null means no account.
  const [accountChoice, setAccountChoice] = useState<string | null | undefined>(expense ? expense.accountId ?? null : undefined);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const category = categoryChoice ?? last?.category ?? "Food";
  const paymentMethod = paymentChoice ?? last?.paymentMethod ?? "Card";
  const knownAccount = (id?: string | null) => (id && accounts.some((account) => account.id === id) ? id : null);
  const accountId = accountChoice === undefined ? knownAccount(last?.accountId) ?? accounts[0]?.id ?? null : accountChoice;

  const fillFrom = (item: Expense) => {
    setTitle(item.title);
    setAmount(String(item.amount));
    setCategoryChoice(item.category);
    setMerchant(item.merchant ?? "");
    setPaymentChoice(item.paymentMethod ?? "Card");
    setAccountChoice(knownAccount(item.accountId) ?? undefined);
    setError("");
  };

  const handleTitle = (value: string) => {
    setTitle(value);

    // Picking a past title fills in the rest, unless an amount is already typed.
    const match = expense ? null : recent.find((item) => !item.debtId && item.title.toLowerCase() === value.trim().toLowerCase());
    if (match && !amount) fillFrom(match);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const parsedAmount = Number(amount);

    if (!title.trim()) {
      setError("Enter a title for this expense.");
      return;
    }

    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter an amount above zero.");
      return;
    }

    setSaving(true);

    const saveError = await sendJson("/api/expenses", expense ? "PUT" : "POST", {
      id: expense?.id,
      title: title.trim(),
      amount: parsedAmount,
      category,
      merchant: merchant.trim(),
      notes: notes.trim(),
      paymentMethod,
      accountId,
      date: date || localDateString(),
    });

    setSaving(false);

    // Keep the form open on failure so the entry isn't lost.
    if (saveError) {
      setError(saveError);
      return;
    }

    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/60 p-4">
      <div role="dialog" aria-modal="true" className="mx-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/10 bg-[#121d27] p-4 text-white">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">{expense ? "Edit expense" : "Add expense"}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-lg text-slate-300">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {repeats.length > 0 && (
            <div>
              <p className={labelClass}>Repeat</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {repeats.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => fillFrom(item)}
                    className="shrink-0 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-left"
                  >
                    <span className="block whitespace-nowrap text-sm font-medium text-white">
                      {formatCurrency(item.amount)} {item.title}
                    </span>
                    <span className="block whitespace-nowrap text-[11px] text-slate-400">
                      {item.category} • {item.paymentMethod || "Card"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(event) => handleTitle(event.target.value)} list="past-titles" placeholder="Groceries" className={fieldClass} />
            <datalist id="past-titles">
              {pastTitles.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          <div>
            <label className={labelClass}>Amount</label>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className={fieldClass} />
            <div className="mt-2 flex flex-wrap gap-2">
              {quickAmounts.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="rounded-full border border-white/10 bg-[#0d1820] px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-200"
                >
                  {formatCurrency(preset)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <select value={category} onChange={(event) => setCategoryChoice(event.target.value)} className={fieldClass}>
                {[...new Set([category, ...categories])].map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
            </div>
          </div>

          <div>
            <label className={labelClass}>Merchant</label>
            <input value={merchant} onChange={(event) => setMerchant(event.target.value)} placeholder="Store or brand" className={fieldClass} />
          </div>

          <div>
            <label className={labelClass}>Payment method</label>
            <select value={paymentMethod} onChange={(event) => setPaymentChoice(event.target.value)} className={fieldClass}>
              <option value="Card">Card</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Account</label>
            <select value={accountId ?? ""} onChange={(event) => setAccountChoice(event.target.value || null)} className={fieldClass}>
              <option value="">No account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional note about this expense" className={fieldClass} />
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={saving} className="w-full rounded-2xl bg-cyan-400 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {saving ? "Saving..." : expense ? "Update expense" : "Save expense"}
          </button>
        </form>
      </div>
    </div>
  );
}
