import { redirect } from "next/navigation";

import { IncomePage } from "@/components/IncomePage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function IncomeRoute() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <IncomePage />;
}
