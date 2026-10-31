import { redirect } from "next/navigation";

import { TransactionsPage } from "@/components/TransactionsPage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TransactionsRoute() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <TransactionsPage />;
}
