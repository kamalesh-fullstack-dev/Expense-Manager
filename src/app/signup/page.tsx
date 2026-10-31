"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to create account.");
        setLoading(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        callbackUrl: "/",
        redirect: false,
      });

      if (signInResult?.error) {
        setError("Account created, but sign in failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong while creating your account.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0a1016] px-4">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#121d27] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
        <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Create account</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Start tracking</h1>
        <p className="mt-2 text-sm text-slate-400">Set up your personal budget in minutes.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
              placeholder="Aarav"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none"
              placeholder="Minimum 8 characters"
              required
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-400 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account? {" "}
          <Link href="/login" className="font-medium text-cyan-300">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
