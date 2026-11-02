"use client";

import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DeleteButton, EditButton } from "@/components/IconButtons";
import { ListSkeleton, PageLoader } from "@/components/Loader";
import { sendJson, useApiList } from "@/lib/api-client";
import { countDueDates, daysUntilDueDay, localDateString } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

type Debt = {
  id: string;
  name: string;
  lender?: string | null;
  principal: number;
  outstanding: number;
  monthlyPayment: number;
  dueDate?: number | null;
  interestRate?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
};

const inputClass = "w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none placeholder:text-slate-500";
const dateClass = "mt-1 w-full min-w-0 rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-sm normal-case tracking-normal text-white outline-none [color-scheme:dark]";

const timesPayments = (amount: number, payments: number) => Math.round(amount * payments * 100) / 100;

export function DebtsPage() {
  const { status } = useSession();
  const { items: debts, loading, reload } = useApiList<Debt>("/api/debts");
  const accounts = useApiList<{ id: string; name: string }>("/api/accounts");
  const [error, setError] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payAccountChoice, setPayAccountChoice] = useState<string | undefined>();
  const payAccountId = payAccountChoice ?? accounts.items[0]?.id ?? "";
  const [payDate, setPayDate] = useState(() => localDateString());
  const [payError, setPayError] = useState("");
  const [name, setName] = useState("");
  const [lender, setLender] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [dueDate, setDueDate] = useState("5");
  const [interestRate, setInterestRate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusValue, setStatusValue] = useState("Active");
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeDebts = useMemo(() => debts.filter((debt) => debt.status !== "Closed"), [debts]);

  // Payments before today count as already made, so only the ones still to come are owed.
  const today = localDateString();
  const dueDay = Number(dueDate);
  const validDueDay = Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31;
  const amountPerMonth = Number(monthlyPayment);
  const firstPayment = startDate > today ? startDate : today;
  const paymentsLeft = endDate && validDueDay ? countDueDates(firstPayment, endDate, dueDay) : null;
  const toPay = paymentsLeft === null ? null : timesPayments(amountPerMonth, paymentsLeft);

  const totals = useMemo(() => {
    const totalOutstanding = activeDebts.reduce((sum, debt) => sum + Number(debt.outstanding), 0);
    const totalMonthly = activeDebts.reduce((sum, debt) => sum + Number(debt.monthlyPayment), 0);
    const interestWeightedTotal = activeDebts.reduce((sum, debt) => {
      const rate = Number(debt.interestRate ?? 0);
      return sum + Number(debt.outstanding) * rate;
    }, 0);
    const averageRate = totalOutstanding > 0 ? interestWeightedTotal / totalOutstanding : 0;
    const largestDebt = activeDebts.reduce((max, debt) => Math.max(max, Number(debt.outstanding)), 0);
    const highestEmi = activeDebts.reduce((max, debt) => Math.max(max, Number(debt.monthlyPayment)), 0);

    return {
      totalOutstanding,
      totalMonthly,
      count: activeDebts.length,
      averageRate,
      largestDebt,
      highestEmi,
    };
  }, [activeDebts]);

  const nextDueDebt = useMemo(() => {
    const due = activeDebts.filter((debt) => debt.outstanding > 0 && debt.dueDate != null);

    return [...due].sort((a, b) => daysUntilDueDay(a.dueDate ?? 1) - daysUntilDueDay(b.dueDate ?? 1))[0] ?? null;
  }, [activeDebts]);

  const debtBars = useMemo(() => {
    if (activeDebts.length === 0) return [];

    const maxValue = Math.max(...activeDebts.map((debt) => Number(debt.outstanding)), 1);

    return activeDebts.slice(0, 5).map((debt) => ({
      id: debt.id,
      name: debt.name,
      value: Number(debt.outstanding),
      height: `${(Number(debt.outstanding) / maxValue) * 100}%`,
    }));
  }, [activeDebts]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setLender("");
    setMonthlyPayment("");
    setDueDate("5");
    setInterestRate("");
    setStartDate("");
    setEndDate("");
    setStatusValue("Active");
    setError("");
  };

  const fillForm = (debt: Debt) => {
    setEditingId(debt.id);
    setName(debt.name);
    setLender(debt.lender ?? "");
    setMonthlyPayment(String(debt.monthlyPayment));
    setDueDate(String(debt.dueDate ?? 5));
    setInterestRate(debt.interestRate !== null && debt.interestRate !== undefined ? String(debt.interestRate) : "");
    setStartDate(debt.startDate ? debt.startDate.slice(0, 10) : "");
    setEndDate(debt.endDate ? debt.endDate.slice(0, 10) : "");
    setStatusValue(debt.status ?? "Active");
  };

  const openPayment = (debt: Debt) => {
    setPayingId(debt.id);
    setPayAmount(String(Math.min(debt.monthlyPayment, debt.outstanding)));
    setPayAccountChoice(undefined);
    setPayDate(localDateString());
    setPayError("");
  };

  const handlePayment = async () => {
    const paymentError = await sendJson("/api/debts/pay", "POST", {
      debtId: payingId,
      amount: Number(payAmount),
      accountId: payAccountId || null,
      date: payDate,
    });

    setPayError(paymentError ?? "");

    if (!paymentError) {
      setPayingId(null);
      reload();
    }
  };

  const handleSubmit = async () => {
    const editing = debts.find((debt) => debt.id === editingId);

    if (!name.trim() || !(amountPerMonth > 0)) {
      setError("Enter a name and the amount per month.");
      return;
    }

    if (!validDueDay) {
      setError("Enter a due day between 1 and 31.");
      return;
    }

    if (!editing && !endDate) {
      setError("Choose when the loan ends.");
      return;
    }

    // An edit that leaves the schedule alone keeps the balance, so payments already made still count.
    const scheduleChanged =
      !editing ||
      editing.monthlyPayment !== amountPerMonth ||
      editing.dueDate !== dueDay ||
      (editing.endDate?.slice(0, 10) ?? "") !== endDate;
    const useSchedule = Boolean(endDate) && scheduleChanged;

    if (useSchedule && !paymentsLeft) {
      setError("That end date leaves no payments. Choose a later date.");
      return;
    }

    const saveError = await sendJson("/api/debts", editingId ? "PUT" : "POST", {
      id: editingId,
      name: name.trim(),
      lender: lender.trim(),
      principal: useSchedule ? timesPayments(amountPerMonth, countDueDates(startDate || firstPayment, endDate, dueDay)) : editing?.principal,
      outstanding: useSchedule ? toPay : editing?.outstanding,
      monthlyPayment: amountPerMonth,
      dueDate: dueDay,
      interestRate: interestRate === "" ? null : Number(interestRate),
      startDate: startDate || null,
      endDate: endDate || null,
      status: statusValue,
    });

    setError(saveError ?? "");

    if (!saveError) {
      resetForm();
      reload();
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this debt?");
    if (!confirmed) return;

    const deleteError = await sendJson(`/api/debts?id=${encodeURIComponent(id)}`, "DELETE");
    setError(deleteError ?? "");

    if (!deleteError) {
      reload();
    }
  };

  if (status === "loading") {
    return <PageLoader />;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Debt</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Loans</h1>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-2xl border border-white/10 bg-[#121d27] px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200"
          >
            Log out
          </button>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Summary</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(totals.totalOutstanding)}</h2>
            </div>
            <div className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-medium text-rose-300">
              {totals.count} active
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Outstand.</p>
              <p className="mt-2 text-sm font-semibold text-white">{formatCurrency(totals.totalOutstanding)}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">EMI / mo</p>
              <p className="mt-2 text-sm font-semibold text-cyan-300">{formatCurrency(totals.totalMonthly)}</p>
            </div>
          </div>

          {activeDebts.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Avg rate</p>
                <p className="mt-2 text-sm font-semibold text-violet-300">{totals.averageRate.toFixed(1)}%</p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Largest EMI</p>
                <p className="mt-2 text-sm font-semibold text-rose-300">{formatCurrency(totals.highestEmi)}</p>
              </div>
            </div>
          )}
        </section>

        {activeDebts.length > 0 && (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Insights</p>
                <h3 className="mt-1 text-lg font-semibold">Debt health</h3>
              </div>
            </div>

            <div className="mb-4 flex h-20 items-end gap-2">
              {debtBars.map((bar) => (
                <div key={bar.id} className="flex flex-1 flex-col items-center justify-end gap-2">
                  <div className="flex h-full w-full items-end rounded-t-xl bg-[#0d1820] p-1">
                    <div className="w-full rounded-t-xl bg-gradient-to-t from-cyan-400 to-violet-400" style={{ height: bar.height }} />
                  </div>
                  <span className="max-w-[3rem] truncate text-[8px] text-slate-400">{bar.name}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5 text-sm text-slate-200">
                Largest loan: <span className="font-medium text-white">{formatCurrency(totals.largestDebt)}</span>
              </div>
              <div className="rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5 text-sm text-slate-200">
                Monthly burden: <span className="font-medium text-cyan-300">{formatCurrency(totals.totalMonthly)}</span>
              </div>
              <div className="rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5 text-sm text-slate-200">
                Avg interest: <span className="font-medium text-violet-300">{totals.averageRate.toFixed(1)}%</span>
              </div>
              {nextDueDebt && (
                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2.5 text-sm text-cyan-100">
                  Next due: <span className="font-medium text-white">{nextDueDebt.name}</span> on day <span className="font-medium text-white">{nextDueDebt.dueDate}</span>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4 shadow-[0_20px_40px_rgba(7,12,18,0.18)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Add</p>
              <h3 className="mt-1 text-lg font-semibold">Loan / EMI</h3>
            </div>

            {editingId && (
              <button type="button" onClick={resetForm} className="text-xs uppercase tracking-[0.18em] text-cyan-300">
                Cancel
              </button>
            )}
          </div>

          <div className="space-y-3">
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Loan name" className={inputClass} />

            <div className="grid grid-cols-2 gap-3">
              <input type="number" inputMode="decimal" min="0" step="0.01" value={monthlyPayment} onChange={(event) => setMonthlyPayment(event.target.value)} placeholder="Amount per month" className={`min-w-0 ${inputClass}`} />
              <input aria-label="Due day" type="number" inputMode="numeric" value={dueDate} onChange={(event) => setDueDate(event.target.value)} min="1" max="31" placeholder="Due day (1-31)" className={`min-w-0 ${inputClass}`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Start date
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={dateClass} />
              </label>
              <label className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                End date
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={dateClass} />
              </label>
            </div>

            {paymentsLeft !== null && amountPerMonth > 0 && (
              <p className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2.5 text-sm text-cyan-100">
                {paymentsLeft === 0
                  ? "No payments left before this end date."
                  : `${paymentsLeft} ${paymentsLeft === 1 ? "payment" : "payments"} left · ${formatCurrency(toPay ?? 0)} to pay`}
              </p>
            )}

            <details className="rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-2.5">
              <summary className="cursor-pointer text-sm text-slate-300">More details</summary>
              <div className="mt-3 space-y-3">
                <input value={lender} onChange={(event) => setLender(event.target.value)} placeholder="Lender / bank" className={inputClass} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" inputMode="decimal" min="0" step="0.01" value={interestRate} onChange={(event) => setInterestRate(event.target.value)} placeholder="Rate %" className={`min-w-0 ${inputClass}`} />
                  <select aria-label="Status" value={statusValue} onChange={(event) => setStatusValue(event.target.value)} className={`min-w-0 ${inputClass}`}>
                    <option value="Active">Active</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
            </details>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <button type="button" onClick={handleSubmit} className="w-full rounded-2xl bg-cyan-400 px-3 py-2.5 text-sm font-semibold text-slate-950">
              {editingId ? "Update debt" : "Save debt"}
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Your loans</p>
              <h3 className="mt-1 text-lg font-semibold">Debt list</h3>
            </div>
          </div>

          <div className="space-y-3">
            {loading && debts.length === 0 ? (
              <ListSkeleton />
            ) : debts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                No debts added yet. Add your first EMI or loan here.
              </div>
            ) : (
              debts.map((debt) => (
                <div key={debt.id} className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{debt.name}</p>
                      <p className="text-[11px] text-slate-400">{debt.lender || "No lender"}</p>
                    </div>
                    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-cyan-200">
                      {debt.status || "Active"}
                    </span>
                  </div>

                  <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-400">Outstanding</p>
                      <p className="mt-1 text-white">{formatCurrency(debt.outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-slate-400">EMI</p>
                      <p className="mt-1 text-cyan-300">{formatCurrency(debt.monthlyPayment)}</p>
                      {debt.status !== "Closed" && debt.monthlyPayment > 0 && (
                        <p className="text-[11px] text-slate-400">{Math.ceil(debt.outstanding / debt.monthlyPayment)} left</p>
                      )}
                    </div>
                  </div>

                  {payingId === debt.id && (
                    <div className="mb-2 space-y-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input aria-label="Payment amount" type="number" inputMode="decimal" min="0" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0d1820] px-2 py-2 text-white outline-none" />
                        <input aria-label="Payment date" type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0d1820] px-2 py-2 text-white outline-none" />
                      </div>
                      <select aria-label="Paid from" value={payAccountId} onChange={(event) => setPayAccountChoice(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0d1820] px-2 py-2 text-white outline-none">
                        <option value="">No account</option>
                        {accounts.items.map((account) => (
                          <option key={account.id} value={account.id}>{account.name}</option>
                        ))}
                      </select>
                      {payError ? <p className="text-sm text-rose-300">{payError}</p> : null}
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setPayingId(null)} className="rounded-xl border border-white/10 py-2 text-sm text-slate-200">Cancel</button>
                        <button type="button" onClick={handlePayment} disabled={accounts.loading} className="rounded-xl bg-cyan-400 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">Confirm</button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    {debt.outstanding > 0 && debt.status !== "Closed" && (
                      <button type="button" onClick={() => openPayment(debt)} className="rounded-lg bg-cyan-400 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-950">
                        Pay EMI
                      </button>
                    )}
                    <EditButton onClick={() => fillForm(debt)} />
                    <DeleteButton onClick={() => handleDelete(debt.id)} />
                  </div>
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
