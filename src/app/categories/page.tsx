import { redirect } from "next/navigation";

import { CategoriesPage } from "@/components/CategoriesPage";
import { getAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CategoriesRoute() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/login");
  }

  return <CategoriesPage />;
}
