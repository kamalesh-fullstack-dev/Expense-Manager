"use client";

import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DeleteButton, EditButton } from "@/components/IconButtons";
import { PageLoader } from "@/components/Loader";
import { sendJson, useApiList } from "@/lib/api-client";
import { formatStoredDate, localDateString, localMonthString } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

type Income = {
  id: string;
  title: string;
  amount: number;
  source: string;
  notes: string | null;
  date: string;
  accountId: string | null;
};

const sources = ["Salary", "Freelance", "Business", "Interest", "Refund", "Gift", "Other"];
const fieldClass = "w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none placeholder:text-slate-500";
const labelClass = "mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400";

export function IncomePage() {
  const { status } = useSession();
  const [month, setMonth] = useState(() => localMonthString());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("Salary");
  const [date, setDate] = useState(() => localDateString());
  // undefined means "use the default account", null means no account.
  const [accountChoice, setAccountChoice] = useState<string | null | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const incomes = useApiList<Income>(`/api/incomes?from=${month}&to=${month}`);
  const accounts = useApiList<{ id: string; name: string }>("/api/accounts");
  const accountId = accountChoice === undefined ? accounts.items[0]?.id ?? null : accountChoice;

  const total = useMemo(() => incomes.items.reduce((sum, item) => sum + item.amount, 0), [incomes.items]);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setSource("Salary");
    setDate(localDateString());
    setAccountChoice(undefined);
    setNotes("");
    setError("");
  };

  const fillForm = (income: Income) => {
    setEditingId(income.id);
    setTitle(income.title);
    setAmount(String(income.amount));
    setSource(income.source);
    setDate(income.date.slice(0, 10));
    setAccountChoice(income.accountId);
    setNotes(income.notes ?? "");
    setError("");
  };

  const handleSubmit = async () => {
    const parsedAmount = Number(amount);

    if (!title.trim() || !amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a title and an amount above zero.");
      return;
    }

    setSaving(true);
    const saveError = await sendJson("/api/incomes", editingId ? "PUT" : "POST", {
      id: editingId,
      title: title.trim(),
      amount: parsedAmount,
      source,
      date,
      accountId,
      notes: notes.trim(),
    });
    setSaving(false);

    if (saveError) {
      setError(saveError);
      return;
    }

    resetForm();
    incomes.reload();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this income? It will be removed from the account balance.")) return;

    const deleteError = await sendJson(`/api/incomes?id=${encodeURIComponent(id)}`, "DELETE");
    setError(deleteError ?? "");
    incomes.reload();
  };

  if (status === "loading") {
    return <PageLoader />;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Money in</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Income</h1>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Received</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-emerald-300">{formatCurrency(total)}</h2>
            </div>
            <input
              type="month"
              aria-label="Month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-xl border border-white/10 bg-[#0d1820] px-2 py-1.5 text-xs text-white outline-none"
            />
          </div>
        </section>

        <section className="mt-6 space-y-3 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editingId ? "Edit income" : "Add income"}</h3>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs uppercase tracking-[0.18em] text-cyan-300">Cancel</button>
            )}
          </div>

          <div>
            <label className={labelClass}>Title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="October salary" className={fieldClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Amount</label>
              <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <select value={source} onChange={(event) => setSource(event.target.value)} className={fieldClass}>
                {sources.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date</label>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={labelClass}>Account</label>
              <select value={accountId ?? ""} onChange={(event) => setAccountChoice(event.target.value || null)} className={fieldClass}>
                <option value="">No account</option>
                {accounts.items.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" className={fieldClass} />
          </div>

          {error ? <p role="alert" className="text-sm text-rose-300">{error}</p> : null}

          <button type="button" onClick={handleSubmit} disabled={saving} className="w-full rounded-2xl bg-emerald-400 px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60">
            {saving ? "Saving..." : editingId ? "Update income" : "Save income"}
          </button>
        </section>

        <section className="mt-6 space-y-3">
          {incomes.items.length === 0 && !incomes.loading ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
              No income recorded for this month.
            </div>
          ) : (
            incomes.items.map((income) => (
              <div key={income.id} className="rounded-[22px] border border-white/10 bg-[#121d27] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{income.title}</p>
                    <p className="text-xs text-slate-400">{income.source} • {formatStoredDate(income.date, { day: "numeric", month: "short" })}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-emerald-300">+{formatCurrency(income.amount)}</span>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <EditButton onClick={() => fillForm(income)} />
                  <DeleteButton onClick={() => handleDelete(income.id)} />
                </div>
              </div>
            ))
          )}
        </section>

        <BottomNav />
      </div>
    </main>
  );
}
