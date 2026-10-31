"use client";

import { useState } from "react";

import { sendJson } from "@/lib/api-client";
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
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState(expense?.category ?? "Food");
  const [merchant, setMerchant] = useState(expense?.merchant ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? "Card");
  const [date, setDate] = useState(expense?.date.slice(0, 10) ?? localDateString());
  // undefined means "use the default account", null means no account.
  const [accountChoice, setAccountChoice] = useState<string | null | undefined>(expense ? expense.accountId ?? null : undefined);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const accountId = accountChoice === undefined ? accounts[0]?.id ?? null : accountChoice;

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
          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Groceries" className={fieldClass} />
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
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={fieldClass}>
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
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className={fieldClass}>
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
