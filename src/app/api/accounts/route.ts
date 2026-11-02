import { NextResponse } from "next/server";

import { getCurrentUser, isUniqueConstraintError, readJsonBody } from "@/lib/api";
import { toPaise, toRupees } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { setAsideByAccount, settleSavings } from "@/lib/savings";
import { cleanText, parseAmount } from "@/lib/validation";

const duplicateNameResponse = () =>
  NextResponse.json({ error: "You already have an account with this name" }, { status: 409 });

const serializeAccount = <T extends { balancePaise: bigint }>({ balancePaise, ...account }: T) => ({
  ...account,
  balance: toRupees(balancePaise),
});

const parseAccountBody = (body: Record<string, unknown>) => ({
  name: cleanText(body.name, 60),
  type: cleanText(body.type, 30),
  balance: parseAmount(body.balance ?? 0, { allowZero: true, allowNegative: true }),
  color: cleanText(body.color, 20) || "#67e8f9",
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [accounts, setAside] = await Promise.all([
    prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    setAsideByAccount(prisma, { account: { userId: user.id } }),
  ]);

  return NextResponse.json(
    accounts.map((account) => ({ ...serializeAccount(account), setAside: toRupees(setAside.get(account.id) ?? BigInt(0)) })),
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, type, balance, color } = parseAccountBody(await readJsonBody(request));

  if (!name || !type || balance === null) {
    return NextResponse.json({ error: "Enter a name, type and valid balance" }, { status: 400 });
  }

  try {
    const account = await prisma.account.create({
      data: { name, type, balancePaise: toPaise(balance), color, userId: user.id },
    });

    return NextResponse.json(serializeAccount(account), { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) return duplicateNameResponse();
    throw error;
  }
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const { id } = body;
  const { name, type, balance, color } = parseAccountBody(body);

  if (!id || !name || !type || balance === null) {
    return NextResponse.json({ error: "Enter a name, type and valid balance" }, { status: 400 });
  }

  const existing = await prisma.account.findUnique({ where: { id: String(id) } });

  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
    const account = await prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({
        where: { id: String(id) },
        data: { name, type, balancePaise: toPaise(balance), color },
      });

      await settleSavings(tx, user.id, [updated.id]);
      return updated;
    });

    return NextResponse.json(serializeAccount(account));
  } catch (error) {
    if (isUniqueConstraintError(error)) return duplicateNameResponse();
    throw error;
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.account.deleteMany({
    where: {
      id: String(id),
      userId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
