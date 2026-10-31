import { redirect } from "next/navigation";

import { ExpenseDashboard } from "@/components/ExpenseDashboard";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  const { add } = await searchParams;

  return <ExpenseDashboard autoOpenAdd={add === "1"} />;
}
