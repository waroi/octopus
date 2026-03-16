import { sendEmail } from "./email";

const APP_URL = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendInvitationEmail({
  email,
  token,
  organizationName,
  inviterName,
  role,
}: {
  email: string;
  token: string;
  organizationName: string;
  inviterName: string;
  role: string;
}) {
  const acceptUrl = `${APP_URL}/api/invitations/${token}/accept`;

  await sendEmail({
    to: email,
    subject: `You've been invited to join ${organizationName} on Octopus`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>You've been invited to ${organizationName}</h2>
        <p>${inviterName} has invited you to join <strong>${organizationName}</strong> as a <strong>${role}</strong>.</p>
        <p>
          <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">
            Accept Invitation
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">This invitation expires in 7 days.</p>
        <p style="color: #666; font-size: 14px;">If you don't want to join, you can ignore this email or <a href="${APP_URL}/api/invitations/${token}/decline">decline</a>.</p>
      </div>
    `,
  });
}
