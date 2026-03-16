"use client";

import { IconRefresh } from "@tabler/icons-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncRepos } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

export function SyncReposButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          const result = await syncRepos();
          if (result.error) {
            console.error("Sync failed:", result.error);
          } else {
            console.log(`Synced ${result.synced} repos, removed ${result.removed}`);
            router.refresh();
          }
        })
      }
    >
      <IconRefresh className={`mr-1.5 size-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Syncing..." : "Sync Repos"}
    </Button>
  );
}
