import { NextResponse } from "next/server";

import { getCurrentUser, readJsonBody } from "@/lib/api";
import { isCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currency } = await readJsonBody(request);

  if (!isCurrency(currency)) {
    return NextResponse.json({ error: "Choose a supported currency" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { currency } });

  return NextResponse.json({ currency });
}
