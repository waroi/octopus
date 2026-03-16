"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";
import { isAdminEmail } from "@/lib/admin";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Not authenticated");
  if (!isAdminEmail(session.user.email)) throw new Error("Not authorized");
  return session;
}

export async function toggleUserBan(userId: string) {
  const session = await requireAdmin();

  const target = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, bannedAt: true },
  });

  // Prevent self-ban
  if (target.email === session.user.email) {
    return { error: "You cannot ban yourself." };
  }

  // Prevent banning other admins
  if (isAdminEmail(target.email)) {
    return { error: "You cannot ban another admin." };
  }

  if (target.bannedAt) {
    // Unban
    await prisma.user.update({
      where: { id: userId },
      data: { bannedAt: null, bannedReason: null },
    });
  } else {
    // Ban + delete all sessions to force logout
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { bannedAt: new Date() },
      }),
      prisma.session.deleteMany({
        where: { userId },
      }),
    ]);
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function toggleOrgBan(orgId: string) {
  await requireAdmin();

  const target = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: { bannedAt: true },
  });

  if (target.bannedAt) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { bannedAt: null, bannedReason: null },
    });
  } else {
    await prisma.organization.update({
      where: { id: orgId },
      data: { bannedAt: new Date() },
    });
  }

  revalidatePath("/admin");
  return { success: true };
}
