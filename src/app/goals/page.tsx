import { redirect } from "next/navigation";

import { GoalsPage } from "@/components/GoalsPage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GoalsRoute() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <GoalsPage />;
}
