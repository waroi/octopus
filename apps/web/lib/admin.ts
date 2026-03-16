const ADMIN_EMAILS = ["admin@example.com"];

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email);
}
