import { NextResponse } from "next/server";

import { getCurrentUser, readJsonBody } from "@/lib/api";
import { toPaise, toRupees } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { cleanText, parseAmount, parseDate } from "@/lib/validation";

const serializeDebt = <T extends { principalPaise: bigint; outstandingPaise: bigint; monthlyPaymentPaise: bigint }>({
  principalPaise,
  outstandingPaise,
  monthlyPaymentPaise,
  ...debt
}: T) => ({
  ...debt,
  principal: toRupees(principalPaise),
  outstanding: toRupees(outstandingPaise),
  monthlyPayment: toRupees(monthlyPaymentPaise),
});

function parseDebtBody(body: Record<string, unknown>) {
  const name = cleanText(body.name, 100);
  const principal = parseAmount(body.principal);
  const outstanding = parseAmount(body.outstanding, { allowZero: true });
  const monthlyPayment = parseAmount(body.monthlyPayment, { allowZero: true });

  if (!name || principal === null || outstanding === null || monthlyPayment === null) {
    return { error: "Enter a name, principal, outstanding and EMI" };
  }

  const hasDueDate = body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "";
  const dueDate = hasDueDate ? Number(body.dueDate) : null;

  if (dueDate !== null && (!Number.isInteger(dueDate) || dueDate < 1 || dueDate > 31)) {
    return { error: "Due date must be a day between 1 and 31" };
  }

  const hasRate = body.interestRate !== undefined && body.interestRate !== null && body.interestRate !== "";
  const interestRate = hasRate ? parseAmount(body.interestRate, { allowZero: true }) : null;

  if (hasRate && interestRate === null) {
    return { error: "Enter a valid interest rate" };
  }

  const startDate = body.startDate ? parseDate(body.startDate) : null;
  const endDate = body.endDate ? parseDate(body.endDate) : null;

  if ((body.startDate && !startDate) || (body.endDate && !endDate)) {
    return { error: "Enter valid dates" };
  }

  return {
    data: {
      name,
      lender: cleanText(body.lender, 100) || null,
      principalPaise: toPaise(principal),
      outstandingPaise: toPaise(outstanding),
      monthlyPaymentPaise: toPaise(monthlyPayment),
      dueDate,
      interestRate,
      startDate,
      endDate,
      status: body.status === "Closed" ? "Closed" : "Active",
    },
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debts = await prisma.debt.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(debts.map(serializeDebt));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = parseDebtBody(await readJsonBody(request));

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const debt = await prisma.debt.create({
    data: { ...parsed.data, userId: user.id },
  });

  return NextResponse.json(serializeDebt(debt), { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const parsed = parseDebtBody(body);

  if (!body.id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  if (!parsed.data) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const existingDebt = await prisma.debt.findUnique({ where: { id: String(body.id) } });

  if (!existingDebt || existingDebt.userId !== user.id) {
    return NextResponse.json({ error: "Debt not found" }, { status: 404 });
  }

  const debt = await prisma.debt.update({
    where: { id: String(body.id) },
    data: parsed.data,
  });

  return NextResponse.json(serializeDebt(debt));
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

  await prisma.debt.deleteMany({
    where: {
      id: String(id),
      userId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
