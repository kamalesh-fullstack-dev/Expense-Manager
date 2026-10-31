import { redirect } from "next/navigation";

import { AccountsPage } from "@/components/AccountsPage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AccountsRoute() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <AccountsPage />;
}
