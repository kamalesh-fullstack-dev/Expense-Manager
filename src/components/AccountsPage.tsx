"use client";

import { signOut, useSession } from "next-auth/react";
import { useMemo, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DeleteButton, EditButton } from "@/components/IconButtons";
import { PageLoader } from "@/components/Loader";
import { sendJson, useApiList } from "@/lib/api-client";
import { formatStoredDate, localDateString } from "@/lib/dates";
import { currencies, DEFAULT_CURRENCY, formatCurrency } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  type: string;
  balance: number;
  color: string;
};

type Transfer = {
  id: string;
  amount: number;
  note: string | null;
  date: string;
  fromAccountId: string;
  toAccountId: string;
  fromAccountName: string;
  toAccountName: string;
};

const defaultColors = ["#67e8f9", "#a78bfa", "#22c55e", "#f59e0b", "#fb7185", "#38bdf8"];
const accountTypes = ["Bank", "Credit Card", "UPI", "Cash", "Wallet"];

export function AccountsPage() {
  const { data: session, status, update } = useSession();
  const accountList = useApiList<Account>("/api/accounts");
  const transferList = useApiList<Transfer>("/api/transfers");
  const accounts = accountList.items;
  const transfers = transferList.items;
  const [name, setName] = useState("");
  const [type, setType] = useState("Bank");
  const [balance, setBalance] = useState("0");
  const [color, setColor] = useState(defaultColors[0]);
  const [loading, setLoading] = useState(false);
  const [fromAccountId, setFromAccountId] = useState<string>("");
  const [toAccountId, setToAccountId] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferDate, setTransferDate] = useState(() => localDateString());
  const [accountError, setAccountError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transferError, setTransferError] = useState("");
  const [currencyError, setCurrencyError] = useState("");

  const handleCurrency = async (currency: string) => {
    const error = await sendJson("/api/settings", "PUT", { currency });
    setCurrencyError(error ?? "");

    if (!error) {
      await update();
    }
  };

  const reloadAll = () => {
    accountList.reload();
    transferList.reload();
  };

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.balance ?? 0), 0),
    [accounts],
  );

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setType("Bank");
    setBalance("0");
    setColor(defaultColors[0]);
    setAccountError("");
  };

  const fillForm = (account: Account) => {
    setEditingId(account.id);
    setName(account.name);
    setType(account.type);
    setBalance(String(account.balance));
    setColor(account.color);
    setAccountError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setAccountError("Enter an account name.");
      return;
    }

    setLoading(true);
    const error = await sendJson("/api/accounts", editingId ? "PUT" : "POST", {
      id: editingId,
      name: name.trim(),
      type,
      balance: Number(balance || 0),
      color,
    });
    setLoading(false);
    setAccountError(error ?? "");

    if (!error) {
      resetForm();
      accountList.reload();
      transferList.reload();
    }
  };

  const handleDelete = async (accountId: string) => {
    const confirmed = window.confirm(
      "Delete this account? Its transfer history is removed too, and its expenses stay without an account.",
    );
    if (!confirmed) return;

    const error = await sendJson(`/api/accounts?id=${encodeURIComponent(accountId)}`, "DELETE");
    setAccountError(error ?? "");
    reloadAll();
  };

  const handleTransfer = async () => {
    const safeAmount = Number(transferAmount || 0);

    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      setTransferError("Enter an amount above zero.");
      return;
    }

    const error = await sendJson("/api/transfers", "POST", {
      fromAccountId,
      toAccountId,
      amount: safeAmount,
      note: transferNote,
      date: transferDate,
    });

    setTransferError(error ?? "");

    if (!error) {
      setTransferAmount("");
      setTransferNote("");
      setTransferDate(localDateString());
      setFromAccountId("");
      setToAccountId("");
      reloadAll();
    }
  };

  const handleDeleteTransfer = async (transferId: string) => {
    const confirmed = window.confirm("Delete this transfer? Both account balances will be restored.");
    if (!confirmed) return;

    const error = await sendJson(`/api/transfers?id=${encodeURIComponent(transferId)}`, "DELETE");
    setTransferError(error ?? "");
    reloadAll();
  };

  if (status === "loading") {
    return <PageLoader />;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Accounts</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Cash</h1>
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
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Total</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">{formatCurrency(totalBalance)}</h2>
            </div>
            <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-medium text-cyan-300">
              {accounts.length} accounts
            </div>
          </div>

          <label htmlFor="currency" className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Currency</label>
          <select
            id="currency"
            value={session?.user?.currency ?? DEFAULT_CURRENCY}
            onChange={(event) => handleCurrency(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
          >
            {Object.entries(currencies).map(([code, { label }]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">This changes the symbol only. Amounts are not converted.</p>
          {currencyError ? <p className="mt-2 text-sm text-rose-300">{currencyError}</p> : null}
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-3">
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. HDFC Savings"
              className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Type</label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
              >
                {accountTypes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Balance</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={balance}
                onChange={(event) => setBalance(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">Color</label>
            <div className="flex gap-2">
              {defaultColors.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={`Select ${swatch} color`}
                  className="h-8 w-8 rounded-full border-2"
                  style={{ backgroundColor: swatch, borderColor: color === swatch ? "#f8fafc" : "transparent" }}
                />
              ))}
            </div>
          </div>

          {accountError ? <p className="mb-3 text-sm text-rose-300">{accountError}</p> : null}

          {editingId && (
            <button type="button" onClick={resetForm} className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-300">
              Cancel editing
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-400 px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-70"
          >
            {loading ? "Saving..." : editingId ? "Update account" : "Add account"}
          </button>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Move money</p>
              <h3 className="mt-1 text-lg font-semibold">Transfer</h3>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">From</label>
              <select
                value={fromAccountId}
                onChange={(event) => setFromAccountId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">To</label>
              <select
                value={toAccountId}
                onChange={(event) => setToAccountId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
              >
                <option value="">Select account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Amount</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Date</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(event) => setTransferDate(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Note</label>
              <input
                value={transferNote}
                onChange={(event) => setTransferNote(event.target.value)}
                placeholder="Optional note"
                className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none placeholder:text-slate-500"
              />
            </div>

            {transferError ? <p className="text-sm text-rose-300">{transferError}</p> : null}

            <button
              type="button"
              onClick={handleTransfer}
              disabled={!fromAccountId || !toAccountId || fromAccountId === toAccountId}
              className="w-full rounded-2xl bg-cyan-400 px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              Transfer money
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Saved</p>
              <h3 className="mt-1 text-lg font-semibold">Your accounts</h3>
            </div>
          </div>

          <div className="space-y-3">
            {accounts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                Add your first bank, wallet, or cash account to start tracking money by source.
              </div>
            ) : (
              accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: account.color }}>
                      <span className="text-[11px] font-bold text-slate-950">{account.type.slice(0, 1)}</span>
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{account.name}</p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{account.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-cyan-300">{formatCurrency(account.balance)}</span>
                    <EditButton onClick={() => fillForm(account)} />
                    <DeleteButton onClick={() => handleDelete(account.id)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">History</p>
              <h3 className="mt-1 text-lg font-semibold">Transfers</h3>
            </div>
          </div>

          <div className="space-y-3">
            {transfers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                No transfers yet.
              </div>
            ) : (
              transfers.map((transfer) => (
                <div key={transfer.id} className="rounded-2xl border border-white/5 bg-[#0d1820] p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {transfer.fromAccountName} → {transfer.toAccountName}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        {formatStoredDate(transfer.date, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-cyan-300">{formatCurrency(transfer.amount)}</span>
                      <DeleteButton onClick={() => handleDeleteTransfer(transfer.id)} />
                    </div>
                  </div>
                  {transfer.note ? <p className="mt-2 text-xs text-slate-400">{transfer.note}</p> : null}
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
