import { redirect } from "next/navigation";

import { ReportsPage } from "@/components/ReportsPage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ReportsRoute() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <ReportsPage />;
}
