import { redirect } from "next/navigation";

import { RecurringPage } from "@/components/RecurringPage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RecurringRoute() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <RecurringPage />;
}
