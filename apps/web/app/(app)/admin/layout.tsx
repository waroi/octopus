import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/login");
  if (!isAdminEmail(session.user.email)) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl p-6 md:p-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">System Admin</h1>
        <p className="text-muted-foreground text-sm">
          Platform-wide overview — all organizations combined
        </p>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <aside className="w-full md:w-48 md:shrink-0">
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
