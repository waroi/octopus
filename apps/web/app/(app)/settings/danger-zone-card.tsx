"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { IconAlertTriangle } from "@tabler/icons-react";
import { deleteOrganization } from "../actions";
import { signOut } from "@/lib/auth-client";

export function DangerZoneCard({
  orgSlug,
  isLastOrg = false,
}: {
  orgSlug: string;
  isLastOrg?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [phraseInput, setPhraseInput] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const canDelete =
    slugInput === orgSlug && phraseInput === "delete my organization";

  const handleDelete = () => {
    setError("");
    startTransition(async () => {
      const result = await deleteOrganization(slugInput, phraseInput);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.logout) {
        await signOut({ fetchOptions: { onSuccess: () => window.location.assign("/login") } });
      }
    });
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setSlugInput("");
      setPhraseInput("");
      setError("");
    }
  };

  return (
    <>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>
            Irreversible and destructive actions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Delete this organization</p>
              <p className="text-xs text-muted-foreground">
                Once deleted, all repositories, reviews, and data will be
                permanently lost.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="w-fit shrink-0"
              onClick={() => setOpen(true)}
            >
              Delete Organization
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Delete Organization</DialogTitle>
            <DialogDescription>
              This will permanently delete the organization and all related
              resources like repositories, pull request reviews, knowledge
              documents, and integrations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {isLastOrg && (
              <div className="flex items-start gap-2 rounded-md bg-orange-500/10 border border-orange-500/20 px-3 py-2.5">
                <IconAlertTriangle className="size-4 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  This is your last organization. Deleting it will close your
                  account and you will be logged out.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm">
                To confirm, type &ldquo;<span className="font-semibold">{orgSlug}</span>&rdquo;
              </p>
              <Input
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder={orgSlug}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm">
                To confirm, type &ldquo;<span className="font-semibold">delete my organization</span>&rdquo;
              </p>
              <Input
                value={phraseInput}
                onChange={(e) => setPhraseInput(e.target.value)}
                placeholder="delete my organization"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="flex items-center gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
              <IconAlertTriangle className="size-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                Deleting {orgSlug} cannot be undone.
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!canDelete || isPending}
              onClick={handleDelete}
            >
              {isPending ? "Deleting..." : isLastOrg ? "Delete & Close Account" : "Delete Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
