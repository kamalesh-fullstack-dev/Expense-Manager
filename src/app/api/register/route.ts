import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { clientIp, isUniqueConstraintError, readJsonBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (await isRateLimited(`register:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many sign-ups. Please try again later." }, { status: 429 });
  }

  const { name, email, password } = await readJsonBody(request);

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedName = String(name).trim();

  if (normalizedName.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  if (String(password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const createdUser = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        password: await bcrypt.hash(String(password), 10),
      },
    });

    return NextResponse.json(
      {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
      },
      { status: 201 },
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }

    throw error;
  }
}
