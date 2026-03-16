"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconSelector, IconCheck, IconPlus } from "@tabler/icons-react";
import { switchOrganization, createOrganization } from "@/app/(app)/actions";
import Link from "next/link";

type Org = {
  id: string;
  name: string;
};

export function OrgSwitcher({
  orgs,
  currentOrg,
  collapsed,
}: {
  orgs: Org[];
  currentOrg: Org;
  collapsed?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createOrganization, {});

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <button className="flex items-center justify-center rounded-md transition-colors hover:opacity-80">
              <Image src="/logo.svg" alt="Octopus" width={20} height={20} />
            </button>
          ) : (
            <button className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/50">
              <Link href="/dashboard" onClick={(e) => e.stopPropagation()}>
                <Image src="/logo.svg" alt="Octopus" width={24} height={24} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">Octopus</div>
                <div className="truncate text-xs text-muted-foreground">
                  {currentOrg.name}
                </div>
              </div>
              <IconSelector className="size-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => {
                if (org.id !== currentOrg.id) {
                  switchOrganization(org.id);
                }
              }}
            >
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === currentOrg.id && (
                <IconCheck className="size-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <IconPlus className="size-4" />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
          </DialogHeader>
          <form action={formAction}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Name</Label>
                <Input
                  id="org-name"
                  name="name"
                  placeholder="My Organization"
                  required
                  minLength={2}
                />
              </div>
              {state.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
