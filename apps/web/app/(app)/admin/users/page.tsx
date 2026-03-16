import { prisma } from "@octopus/db";
import { isAdminEmail } from "@/lib/admin";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserBanToggle } from "../ban-toggle";

export default async function AdminUsersPage() {
  const recentUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      bannedAt: true,
      createdAt: true,
      _count: {
        select: { organizationMembers: true },
      },
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Orgs</th>
                <th className="pb-2 text-right font-medium">Joined</th>
                <th className="pb-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="py-2">{u.name}</td>
                  <td className="py-2 text-muted-foreground">{u.email}</td>
                  <td className="py-2">
                    {isAdminEmail(u.email) ? (
                      <Badge variant="default">Admin</Badge>
                    ) : u.bannedAt ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </td>
                  <td className="py-2 text-right">{u._count.organizationMembers}</td>
                  <td className="py-2 text-right text-muted-foreground">
                    {u.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="py-2 text-right">
                    {!isAdminEmail(u.email) && (
                      <UserBanToggle
                        userId={u.id}
                        userName={u.name}
                        isBanned={!!u.bannedAt}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
