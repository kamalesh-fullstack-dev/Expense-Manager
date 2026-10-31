export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a1016] px-4 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#121d27] p-6 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Offline</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">You&apos;re not connected</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your balances are only shown when they&apos;re up to date. Reconnect to see them and add expenses.
        </p>
        {/* A full page load is needed here so the service worker can retry the network. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-5 block rounded-2xl bg-cyan-400 py-3 text-sm font-semibold text-slate-950">
          Try again
        </a>
      </div>
    </main>
  );
}
