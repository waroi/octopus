import { prisma } from "@octopus/db";

export async function POST() {
  // Simple rate limit: max 10 device codes created in the last minute
  const recentCount = await prisma.cliAuthSession.count({
    where: { createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  if (recentCount >= 10) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  // Generate a random device code
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  const deviceCode = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Expires in 5 minutes
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await prisma.cliAuthSession.create({
    data: { deviceCode, expiresAt },
  });

  return Response.json({
    deviceCode,
    expiresAt: expiresAt.toISOString(),
  });
}
