import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { DEFAULT_CURRENCY } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { clearRateLimit, isRateLimited } from "@/lib/rate-limit";

const LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Auth.js hides ordinary errors from the client, so the lockout needs its own code.
class TooManyAttempts extends CredentialsSignin {
  code = "too_many_attempts";
}

export const { handlers, auth } = NextAuth({
  // Vercel sets the host, so there is no AUTH_URL to compare it against.
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);
        const limitKey = `login:${email}`;

        if (await isRateLimited(limitKey, LOGIN_ATTEMPTS, LOGIN_WINDOW_MS)) {
          throw new TooManyAttempts();
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          return null;
        }

        await clearRateLimit(limitKey);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? "User",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.sub === "string" ? token.sub : "";

        // Read fresh rather than from the token, so a change reaches the user's other devices.
        // A database blip must not end the session, so the client keeps its last currency instead.
        try {
          const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { currency: true } });
          session.user.currency = user?.currency ?? DEFAULT_CURRENCY;
        } catch (error) {
          console.error("Could not read the user's currency", error);
        }
      }
      return session;
    },
  },
});

export const getAuthSession = () => auth();
