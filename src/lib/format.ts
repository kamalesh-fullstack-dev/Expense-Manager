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

export const DEFAULT_CURRENCY = "INR";

// Every currency here has two decimals, which is what the paise columns store.
export const currencies: Record<string, { label: string; locale: string }> = {
  INR: { label: "₹ Indian Rupee", locale: "en-IN" },
  USD: { label: "$ US Dollar", locale: "en-US" },
  EUR: { label: "€ Euro", locale: "en-IE" },
  GBP: { label: "£ British Pound", locale: "en-GB" },
  AED: { label: "AED UAE Dirham", locale: "en-AE" },
  SGD: { label: "S$ Singapore Dollar", locale: "en-SG" },
  CAD: { label: "CA$ Canadian Dollar", locale: "en-CA" },
  AUD: { label: "A$ Australian Dollar", locale: "en-AU" },
};

export const isCurrency = (code: unknown): code is string =>
  typeof code === "string" && Object.keys(currencies).includes(code);

let displayCurrency = DEFAULT_CURRENCY;

// Set from the session by AppSessionProvider. This only changes the symbol: amounts are never converted.
export const setDisplayCurrency = (code: string) => {
  displayCurrency = isCurrency(code) ? code : DEFAULT_CURRENCY;
};

// Paise only appear when an amount actually has them.
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat(currencies[displayCurrency].locale, {
    style: "currency",
    currency: displayCurrency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);

export const formatSigned = (value: number) => (value >= 0 ? formatCurrency(value) : `-${formatCurrency(Math.abs(value))}`);

export const categoryColor = (name: string, custom: Array<{ name: string; color: string }>) =>
  custom.find((item) => item.name === name)?.color ?? categoryMeta[name]?.color ?? "#22d3ee";
