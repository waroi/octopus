import { IconBan } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const isOrgBanned = reason === "organization";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <IconBan className="size-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">
            {isOrgBanned ? "Organization Suspended" : "Account Suspended"}
          </h1>
          <p className="text-muted-foreground">
            {isOrgBanned
              ? "This organization has been suspended by a platform administrator. If you belong to other organizations, please switch to continue using the platform."
              : "Your account has been suspended by a platform administrator. If you believe this is a mistake, please contact support."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
