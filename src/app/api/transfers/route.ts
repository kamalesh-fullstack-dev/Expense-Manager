import { NextResponse } from "next/server";

import { getTransferBalanceAdjustments } from "@/lib/account-balance";
import { applyAccountAdjustments, getCurrentUser, readJsonBody } from "@/lib/api";
import { toPaise, toRupees } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cleanText, parseAmount, parseDate } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transfers = await prisma.accountTransfer.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    include: {
      fromAccount: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    transfers.map((transfer) => ({
      id: transfer.id,
      amount: toRupees(transfer.amountPaise),
      note: transfer.note ?? null,
      date: transfer.date.toISOString(),
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
      fromAccountName: transfer.fromAccount.name,
      toAccountName: transfer.toAccount.name,
    })),
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { fromAccountId, toAccountId, amount, note, date } = await readJsonBody(request);

  if (!fromAccountId || !toAccountId) {
    return NextResponse.json({ error: "Select both accounts" }, { status: 400 });
  }

  if (fromAccountId === toAccountId) {
    return NextResponse.json({ error: "Choose different accounts" }, { status: 400 });
  }

  const safeAmount = parseAmount(amount);

  if (safeAmount === null) {
    return NextResponse.json({ error: "Valid transfer amount is required" }, { status: 400 });
  }

  const transferDate = date ? parseDate(date) : new Date();

  if (!transferDate) {
    return NextResponse.json({ error: "Enter a valid date" }, { status: 400 });
  }

  const fromAccount = await prisma.account.findFirst({
    where: { id: String(fromAccountId), userId: user.id },
  });

  const toAccount = await prisma.account.findFirst({
    where: { id: String(toAccountId), userId: user.id },
  });

  if (!fromAccount || !toAccount) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const created = await tx.accountTransfer.create({
      data: {
        userId: user.id,
        fromAccountId: String(fromAccountId),
        toAccountId: String(toAccountId),
        amountPaise: toPaise(safeAmount),
        note: cleanText(note, 500) || null,
        date: transferDate,
      },
    });

    await applyAccountAdjustments(tx, user.id, getTransferBalanceAdjustments({ ...created, amount: Number(created.amountPaise) }));

    return created;
  });

  return NextResponse.json(
    {
      id: transfer.id,
      amount: toRupees(transfer.amountPaise),
      note: transfer.note ?? null,
      date: transfer.date.toISOString(),
      fromAccountId: transfer.fromAccountId,
      toAccountId: transfer.toAccountId,
    },
    { status: 201 },
  );
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

  const transfer = await prisma.accountTransfer.findUnique({
    where: { id: String(id) },
  });

  if (!transfer || transfer.userId !== user.id) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.accountTransfer.delete({ where: { id: String(id) } });

    await applyAccountAdjustments(
      tx,
      user.id,
      getTransferBalanceAdjustments({ ...transfer, amount: Number(transfer.amountPaise) }).map((item) => ({ ...item, delta: -item.delta })),
    );
  });

  return NextResponse.json({ success: true });
}
