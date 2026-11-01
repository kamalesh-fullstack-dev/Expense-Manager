"use client";

import { useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { ExpenseFormModal, type Expense } from "@/components/ExpenseFormModal";
import { sendJson, useApiData, useApiList } from "@/lib/api-client";
import { formatStoredDate } from "@/lib/dates";
import { categoryMeta, defaultCategories, formatCurrency } from "@/lib/format";

type TransactionPage = { items: Expense[]; total: number; totalAmount: number; hasMore: boolean };

const emptyPage: TransactionPage = { items: [], total: 0, totalAmount: 0, hasMore: false };
const fieldClass = "w-full min-w-0 rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-2.5 text-sm normal-case tracking-normal text-white outline-none [color-scheme:dark] placeholder:text-slate-500";

export function TransactionsPage() {
  const { status } = useSession();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [accountId, setAccountId] = useState("All");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [adding, setAdding] = useState(false);

  const url = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), sort });
    if (search.trim()) params.set("search", search.trim());
    if (category !== "All") params.set("category", category);
    if (accountId !== "All") params.set("accountId", accountId);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);

    return `/api/transactions?${params.toString()}`;
  }, [page, sort, search, category, accountId, fromDate, toDate]);

  const { data, loading, failed, reload } = useApiData<TransactionPage>(url, emptyPage);
  const accounts = useApiList<{ id: string; name: string }>("/api/accounts");
  const customCategories = useApiList<{ name: string }>("/api/categories");

  const categories = useMemo(
    () => [...new Set([...defaultCategories, ...customCategories.items.map((item) => item.name)])],
    [customCategories.items],
  );

  // Any filter change starts again from the first page.
  const filtered = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(0);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this expense?")) return;

    const error = await sendJson(`/api/expenses?id=${encodeURIComponent(id)}`, "DELETE");

    if (error) {
      window.alert(error);
      return;
    }

    reload();
  };

  if (status === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a1016] text-slate-200">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Expenses</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Expense log</h1>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="space-y-2">
            <input value={search} onChange={(event) => filtered(setSearch)(event.target.value)} placeholder="Search title, merchant, notes" className={fieldClass} />

            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Category" value={category} onChange={(event) => filtered(setCategory)(event.target.value)} className={`col-span-2 ${fieldClass}`}>
                <option value="All">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <select aria-label="Account" value={accountId} onChange={(event) => filtered(setAccountId)(event.target.value)} className={`col-span-2 ${fieldClass}`}>
                <option value="All">All accounts</option>
                {accounts.items.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
              <label className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                From
                <input type="date" value={fromDate} onChange={(event) => filtered(setFromDate)(event.target.value)} className={`mt-1 ${fieldClass}`} />
              </label>
              <label className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                To
                <input type="date" value={toDate} onChange={(event) => filtered(setToDate)(event.target.value)} className={`mt-1 ${fieldClass}`} />
              </label>
            </div>

            <select aria-label="Sort" value={sort} onChange={(event) => filtered(setSort)(event.target.value)} className={fieldClass}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest amount</option>
              <option value="lowest">Lowest amount</option>
            </select>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-slate-400">
              {loading && data.items.length === 0 ? "Loading..." : `${data.total} ${data.total === 1 ? "expense" : "expenses"}`}
            </span>
            <span className="font-semibold text-rose-300">{formatCurrency(data.totalAmount)}</span>
          </div>
        </section>

        {failed && <p role="alert" className="mt-4 text-sm text-rose-300">Couldn&apos;t load your transactions. Please try again.</p>}

        <section className="mt-5 space-y-3">
          {!loading && data.items.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-white/10 bg-[#0d1820] p-4 text-sm text-slate-400">
              No expenses match these filters.
            </div>
          ) : (
            data.items.map((expense) => (
              <div key={expense.id} className="rounded-[22px] border border-white/10 bg-[#121d27] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0d1820]">{categoryMeta[expense.category]?.icon ?? "💸"}</div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{expense.title}</p>
                      <p className="truncate text-xs text-slate-400">
                        {expense.merchant || expense.category} • {formatStoredDate(expense.date, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-rose-300">-{formatCurrency(expense.amount)}</span>
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditing(expense)} className="rounded-lg border border-white/10 bg-[#0d1820] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-300">
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(expense.id)} className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-300">
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {(page > 0 || data.hasMore) && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-2xl border border-white/10 bg-[#121d27] py-2.5 text-sm disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={!data.hasMore} onClick={() => setPage(page + 1)} className="rounded-2xl border border-white/10 bg-[#121d27] py-2.5 text-sm disabled:opacity-40">
              Next
            </button>
          </div>
        )}

        <BottomNav onAdd={() => setAdding(true)} />
      </div>

      {(editing || adding) && (
        <ExpenseFormModal
          key={editing?.id ?? "new"}
          expense={editing}
          accounts={accounts.items}
          categories={categories}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
          onSaved={reload}
        />
      )}
    </main>
  );
}
