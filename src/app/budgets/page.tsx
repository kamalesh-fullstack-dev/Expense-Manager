import { redirect } from "next/navigation";

import { BudgetsPage } from "@/components/BudgetsPage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BudgetsRoute() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <BudgetsPage />;
}
