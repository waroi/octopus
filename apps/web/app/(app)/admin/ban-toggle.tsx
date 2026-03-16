"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toggleUserBan, toggleOrgBan } from "./actions";

export function UserBanToggle({
  userId,
  userName,
  isBanned,
}: {
  userId: string;
  userName: string;
  isBanned: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleAction() {
    setError(null);
    startTransition(async () => {
      const result = await toggleUserBan(userId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={isBanned ? "outline" : "destructive"}
          size="xs"
          disabled={isPending}
        >
          {isPending ? "..." : isBanned ? "Unban" : "Ban"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBanned ? "Unban User" : "Ban User"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBanned
              ? `Are you sure you want to unban ${userName}? They will be able to log in and access the platform again.`
              : `Are you sure you want to ban ${userName}? They will be immediately logged out and unable to access the platform.`}
            {error && (
              <span className="mt-2 block text-destructive">{error}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={isBanned ? "default" : "destructive"}
            onClick={handleAction}
          >
            {isBanned ? "Unban" : "Ban"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function OrgBanToggle({
  orgId,
  orgName,
  isBanned,
}: {
  orgId: string;
  orgName: string;
  isBanned: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleAction() {
    startTransition(async () => {
      await toggleOrgBan(orgId);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant={isBanned ? "outline" : "destructive"}
          size="xs"
          disabled={isPending}
        >
          {isPending ? "..." : isBanned ? "Unban" : "Ban"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBanned ? "Unban Organization" : "Ban Organization"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBanned
              ? `Are you sure you want to unban ${orgName}? All members will be able to access this organization again.`
              : `Are you sure you want to ban ${orgName}? All members will lose access to this organization.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={isBanned ? "default" : "destructive"}
            onClick={handleAction}
          >
            {isBanned ? "Unban" : "Ban"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
