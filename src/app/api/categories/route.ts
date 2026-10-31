import { NextResponse } from "next/server";

import { getCurrentUser, isUniqueConstraintError, readJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { cleanText } from "@/lib/validation";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const name = cleanText(body.name, 60);
  const color = cleanText(body.color, 20) || "#67e8f9";

  if (!name) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  const category = await prisma.category.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name,
      },
    },
    update: { color },
    create: {
      userId: user.id,
      name,
      color,
    },
  });

  return NextResponse.json(category, { status: 201 });
}

// Expenses and budgets store the category by name, so a rename has to move them too.
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const id = String(body.id ?? "");
  const name = cleanText(body.name, 60);
  const color = cleanText(body.color, 20) || "#67e8f9";

  if (!id || !name) {
    return NextResponse.json({ error: "Category name is required" }, { status: 400 });
  }

  const existing = await prisma.category.findFirst({ where: { id, userId: user.id } });

  if (!existing) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  try {
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id }, data: { name, color } });
      const match = { userId: user.id, category: existing.name };

      await tx.expense.updateMany({ where: match, data: { category: name } });
      await tx.recurringExpense.updateMany({ where: match, data: { category: name } });
      await tx.budget.updateMany({ where: match, data: { category: name } });

      return updated;
    });

    return NextResponse.json(category);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "That name is already used, or that budget already exists" }, { status: 409 });
    }

    throw error;
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("id");

  if (!categoryId) {
    return NextResponse.json({ error: "Missing category id" }, { status: 400 });
  }

  await prisma.category.deleteMany({
    where: {
      id: categoryId,
      userId: user.id,
    },
  });

  return NextResponse.json({ success: true });
}
