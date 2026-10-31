export const EMI_CATEGORY = "Loan EMI";

export const categoryMeta: Record<string, { icon: string; color: string }> = {
  Food: { icon: "🍽️", color: "#34d399" },
  Transport: { icon: "🚗", color: "#22d3ee" },
  Entertainment: { icon: "🎬", color: "#a78bfa" },
  Health: { icon: "💊", color: "#fb7185" },
  Bills: { icon: "💡", color: "#fbbf24" },
  Shopping: { icon: "🛍️", color: "#f472b6" },
  Travel: { icon: "✈️", color: "#38bdf8" },
  Utilities: { icon: "⚡", color: "#818cf8" },
  Miscellaneous: { icon: "💸", color: "#94a3b8" },
  [EMI_CATEGORY]: { icon: "🏦", color: "#c084fc" },
};

export const defaultCategories = Object.keys(categoryMeta);

// Paise only appear when an amount actually has them.
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);

export const formatSigned = (value: number) => (value >= 0 ? formatCurrency(value) : `-${formatCurrency(Math.abs(value))}`);

export const categoryColor = (name: string, custom: Array<{ name: string; color: string }>) =>
  custom.find((item) => item.name === name)?.color ?? categoryMeta[name]?.color ?? "#22d3ee";
