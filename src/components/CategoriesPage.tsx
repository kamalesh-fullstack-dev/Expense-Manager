"use client";

import { signOut, useSession } from "next-auth/react";
import { useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { DeleteButton, EditButton } from "@/components/IconButtons";
import { sendJson, useApiList } from "@/lib/api-client";

type Category = {
  id: string;
  name: string;
  color: string;
};

const defaultColors = ["#67e8f9", "#a78bfa", "#22c55e", "#f59e0b", "#fb7185", "#38bdf8"];

export function CategoriesPage() {
  const { status } = useSession();
  const { items: categories, reload } = useApiList<Category>("/api/categories");
  const [name, setName] = useState("");
  const [color, setColor] = useState(defaultColors[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setColor(defaultColors[0]);
    setError("");
  };

  const fillForm = (category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setColor(category.color);
    setError("");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Enter a category name.");
      return;
    }

    setLoading(true);
    const saveError = await sendJson("/api/categories", editingId ? "PUT" : "POST", { id: editingId, name: name.trim(), color });
    setLoading(false);
    setError(saveError ?? "");

    if (!saveError) {
      resetForm();
      reload();
    }
  };

  const handleDelete = async (categoryId: string) => {
    const confirmed = window.confirm("Delete this category? Existing expenses keep their category name.");
    if (!confirmed) return;

    const deleteError = await sendJson(`/api/categories?id=${encodeURIComponent(categoryId)}`, "DELETE");
    setError(deleteError ?? "");

    if (!deleteError) {
      reload();
    }
  };

  if (status === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-[#0a1016] text-slate-200">Loading...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0a1016] text-white">
      <div className="mx-auto max-w-md px-4 pb-[6.5rem] pt-6">
        <header className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.32em] text-slate-400">Categories</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Manage</h1>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-2xl border border-white/10 bg-[#121d27] px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200"
          >
            Log out
          </button>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-[#121d27] p-4 shadow-[0_12px_24px_rgba(2,6,23,0.18)]">
          <div className="mb-3">
            <label className="mb-1 block text-xs uppercase tracking-[0.2em] text-slate-400">Name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Coffee"
              className="w-full rounded-2xl border border-white/10 bg-[#0d1820] px-3 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
            />
          </div>

          {categories.length === 0 && (
            <div className="mb-4 rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
              Start by creating your first spending category.
            </div>
          )}

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

          {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}

          {editingId && (
            <button type="button" onClick={resetForm} className="mb-3 text-xs uppercase tracking-[0.18em] text-cyan-300">
              Cancel editing
            </button>
          )}

          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full rounded-2xl bg-cyan-400 px-3 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-70"
          >
            {loading ? "Saving..." : editingId ? "Update category" : "Add category"}
          </button>
        </section>

        <section className="mt-6 rounded-[28px] border border-white/10 bg-[#121d27] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400">Saved</p>
              <h3 className="mt-1 text-lg font-semibold">Your categories</h3>
            </div>
          </div>

          <div className="space-y-3">
            {categories.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1820] p-3 text-sm text-slate-400">
                Your custom categories will appear here after you add them.
              </div>
            ) : (
              categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#0d1820] px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#121d27]">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                    </span>
                    <span className="text-sm font-medium text-white">{category.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <EditButton onClick={() => fillForm(category)} />
                    <DeleteButton onClick={() => handleDelete(category.id)} />
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
