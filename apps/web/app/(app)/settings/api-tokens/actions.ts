"use server";

import { headers, cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";
import { generateApiToken, hashToken, getTokenPrefix } from "@/lib/api-auth";

export async function createApiToken(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  if (!name?.trim()) return { error: "Token name is required" };

  const cookieStore = await cookies();
  const currentOrgId = cookieStore.get("current_org_id")?.value;
  if (!currentOrgId) return { error: "No organization selected" };

  // Verify membership
  const member = await prisma.organizationMember.findFirst({
    where: {
      userId: session.user.id,
      organizationId: currentOrgId,
      deletedAt: null,
    },
  });
  if (!member) return { error: "Not a member of this organization" };

  // Rate limit: max 5 tokens per hour per user
  const recentTokens = await prisma.orgApiToken.count({
    where: {
      organizationId: currentOrgId,
      createdById: session.user.id,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recentTokens >= 5) {
    return { error: "Too many tokens created recently. Please wait." };
  }

  const rawToken = generateApiToken();
  const tokenHash = hashToken(rawToken);
  const tokenPrefix = getTokenPrefix(rawToken);

  await prisma.orgApiToken.create({
    data: {
      name: name.trim(),
      tokenHash,
      tokenPrefix,
      organizationId: currentOrgId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/settings/api-tokens");

  // Return the raw token only once — it won't be stored
  return { token: rawToken, name: name.trim() };
}

export async function deleteApiToken(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { error: "Not authenticated" };

  const tokenId = formData.get("tokenId") as string;
  if (!tokenId) return { error: "Token ID required" };

  const cookieStore = await cookies();
  const currentOrgId = cookieStore.get("current_org_id")?.value;
  if (!currentOrgId) return { error: "No organization selected" };

  // Soft delete
  const token = await prisma.orgApiToken.findFirst({
    where: { id: tokenId, organizationId: currentOrgId, deletedAt: null },
  });

  if (!token) return { error: "Token not found" };

  await prisma.orgApiToken.update({
    where: { id: tokenId },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/settings/api-tokens");
  return { success: true };
}
