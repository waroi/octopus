import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@octopus/db";
import { InvitationActions } from "./invitation-actions";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;

  const invitation = await prisma.organizationInvitation.findUnique({
    where: { token },
    include: {
      organization: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto max-w-md rounded-lg border p-8 text-center">
          <h1 className="text-xl font-semibold">Invitation Not Found</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            This invitation link is invalid or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // Check if expired (update status if needed)
  const isExpired =
    invitation.status === "expired" ||
    (invitation.status === "pending" && new Date() > invitation.expiresAt);

  const isProcessed = invitation.status === "accepted" || invitation.status === "revoked";

  // Check authentication
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session && invitation.status === "pending" && !isExpired) {
    const returnUrl = encodeURIComponent(`/invitation/${token}`);
    redirect(`/login?callbackUrl=${returnUrl}`);
  }

  const inviterName = invitation.invitedBy.name || invitation.invitedBy.email;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="mx-auto w-full max-w-md rounded-lg border p-8">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Organization Invitation</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            You&apos;ve been invited to join{" "}
            <strong>{invitation.organization.name}</strong>
          </p>
        </div>

        <div className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Invited by</span>
            <span className="font-medium">{inviterName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium capitalize">{invitation.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{invitation.email}</span>
          </div>
        </div>

        <div className="mt-6">
          {isExpired ? (
            <div className="rounded-md bg-amber-500/10 p-4 text-center text-sm text-amber-600 dark:text-amber-400">
              This invitation has expired. Please ask the organization admin to resend it.
            </div>
          ) : isProcessed ? (
            <div className="rounded-md bg-muted p-4 text-center text-sm">
              This invitation has already been{" "}
              <strong>{invitation.status}</strong>.
            </div>
          ) : (
            <InvitationActions token={token} />
          )}
        </div>
      </div>
    </div>
  );
}
