import { redirect } from "next/navigation";

import { DebtsPage } from "@/components/DebtsPage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DebtsRoutePage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <DebtsPage />;
}
