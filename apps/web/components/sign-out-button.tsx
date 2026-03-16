"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { clearOrgCookie } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { IconLogout } from "@tabler/icons-react";

export function SignOutButton() {
  const router = useRouter();

  return (
    <Button
      variant="outline"
      onClick={async () => {
        await clearOrgCookie();
        await signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      <IconLogout data-icon="inline-start" />
      Sign out
    </Button>
  );
}
