"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { Fragment } from "react";

import { getDisplayCurrency, setDisplayCurrency } from "@/lib/format";

function CurrencyScope({ children }: { children: React.ReactNode }) {
  const { data } = useSession();
  const currency = data?.user?.currency ?? getDisplayCurrency();

  setDisplayCurrency(currency);

  // Formatted amounts are memoized by value, so a new currency has to remount the page.
  return <Fragment key={currency}>{children}</Fragment>;
}

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CurrencyScope>{children}</CurrencyScope>
    </SessionProvider>
  );
}
