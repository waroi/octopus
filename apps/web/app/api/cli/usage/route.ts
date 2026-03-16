import { authenticateApiToken } from "@/lib/api-auth";
import { prisma } from "@octopus/db";
import { getModelPricing, calcCost, getOrgMonthlySpend } from "@/lib/cost";

export async function GET(request: Request) {
  const result = await authenticateApiToken(request);
  if (!result) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [usages, pricing, monthlySpend, org] = await Promise.all([
    prisma.aiUsage.groupBy({
      by: ["model", "operation"],
      where: {
        organizationId: result.org.id,
        createdAt: { gte: monthStart },
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cacheReadTokens: true,
        cacheWriteTokens: true,
      },
      _count: true,
    }),
    getModelPricing(),
    getOrgMonthlySpend(result.org.id),
    prisma.organization.findUnique({
      where: { id: result.org.id },
      select: {
        monthlySpendLimitUsd: true,
        creditBalance: true,
        freeCreditBalance: true,
      },
    }),
  ]);

  const breakdown = usages.map((row) => ({
    model: row.model,
    operation: row.operation,
    count: row._count,
    inputTokens: row._sum?.inputTokens ?? 0,
    outputTokens: row._sum?.outputTokens ?? 0,
    cacheReadTokens: row._sum?.cacheReadTokens ?? 0,
    cacheWriteTokens: row._sum?.cacheWriteTokens ?? 0,
    cost: calcCost(
      pricing,
      row.model,
      row._sum?.inputTokens ?? 0,
      row._sum?.outputTokens ?? 0,
      row._sum?.cacheReadTokens ?? 0,
      row._sum?.cacheWriteTokens ?? 0,
    ),
  }));

  return Response.json({
    period: {
      start: monthStart.toISOString(),
      end: now.toISOString(),
    },
    totalSpend: monthlySpend,
    spendLimit: org?.monthlySpendLimitUsd ?? null,
    creditBalance: Number(org?.creditBalance ?? 0),
    freeCreditBalance: Number(org?.freeCreditBalance ?? 0),
    breakdown,
  });
}
