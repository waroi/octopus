import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
      organization: { deletedAt: null, bannedAt: null },
    },
    select: {
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  const organizations = memberships.map((m) => m.organization);

  return Response.json({ organizations });
}
