"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InviteModalProps {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InviteModal({ orgId, open, onOpenChange, onSuccess }: InviteModalProps) {
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCount, setSuccessCount] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessCount(0);

    const emailList = emails
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter(Boolean)
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (emailList.length === 0) {
      setError("Please enter at least one valid email address.");
      return;
    }

    setLoading(true);
    const errors: string[] = [];
    let sent = 0;

    for (const email of emailList) {
      try {
        const res = await fetch(`/api/orgs/${orgId}/invitations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, role }),
        });
        if (!res.ok) {
          const data = await res.json();
          errors.push(`${email}: ${data.error}`);
        } else {
          sent++;
        }
      } catch {
        errors.push(`${email}: Network error`);
      }
    }

    setLoading(false);
    setSuccessCount(sent);

    if (errors.length > 0) {
      setError(errors.join("\n"));
    }

    if (sent > 0) {
      onSuccess();
      if (errors.length === 0) {
        setEmails("");
        setRole("member");
        onOpenChange(false);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
          <DialogDescription>
            Send invitation emails. Separate multiple emails with commas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="emails">Email addresses</Label>
            <Input
              id="emails"
              placeholder="alice@example.com, bob@example.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="member">Member</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm whitespace-pre-line">
              {error}
            </div>
          )}
          {successCount > 0 && (
            <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md p-3 text-sm">
              {successCount} invitation{successCount > 1 ? "s" : ""} sent successfully.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
