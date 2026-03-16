"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface InvitationActionsProps {
  token: string;
}

export function InvitationActions({ token }: InvitationActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: "accept" | "decline") {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/invitations/${token}/${action}`, {
        method: "POST",
      });

      if (res.ok) {
        if (action === "accept") {
          router.push("/dashboard");
        } else {
          router.push("/login?message=Invitation+declined");
        }
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-center text-sm">
          {error}
        </div>
      )}
      <div className="flex gap-3">
        <Button
          className="flex-1"
          variant="outline"
          disabled={loading !== null}
          onClick={() => handleAction("decline")}
        >
          {loading === "decline" ? "Declining…" : "Decline"}
        </Button>
        <Button
          className="flex-1"
          disabled={loading !== null}
          onClick={() => handleAction("accept")}
        >
          {loading === "accept" ? "Accepting…" : "Accept Invitation"}
        </Button>
      </div>
    </div>
  );
}
