import { redirect } from "next/navigation";

import { ReportsPage } from "@/components/ReportsPage";
import { getAuthSession } from "@/lib/auth";
import { isMonthKey } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function ReportsRoute({ searchParams }: PageProps<"/reports">) {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  const { month } = await searchParams;

  return <ReportsPage initialMonth={isMonthKey(month) ? month : undefined} />;
}
