import { prisma } from "@/lib/prisma";

const CLEANUP_CHANCE = 0.01;

// Fixed-window limiter held in the database, so it covers every serverless instance.
// One statement does the whole count, so parallel requests can't slip past the limit.
export async function isRateLimited(key: string, limit: number, windowMs: number) {
  const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (
      ${key},
      1,
      (NOW() AT TIME ZONE 'UTC') + make_interval(secs => ${windowMs / 1000}::double precision)
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."resetAt" <= (NOW() AT TIME ZONE 'UTC') THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimit"."resetAt" <= (NOW() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt"
        ELSE "RateLimit"."resetAt"
      END
    RETURNING "count"
  `;

  if (Math.random() < CLEANUP_CHANCE) {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lte: new Date() } } });
  }

  return Number(count) > limit;
}

export const clearRateLimit = async (key: string) => {
  await prisma.rateLimit.deleteMany({ where: { key } });
};
