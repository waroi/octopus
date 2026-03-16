"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { connectCollab, disconnectCollab } from "./actions";

type CollabData = {
  baseUrl: string;
  isActive: boolean;
  workspaceName: string | null;
} | null;

function CollabLogo() {
  return (
    <div className="flex size-10 items-center justify-center">
      <Image src="/collab.png" alt="Collab" width={20} height={20} />
    </div>
  );
}

export function CollabIntegrationCard({ data }: { data: CollabData }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CollabLogo />
            <div>
              <CardTitle className="text-base">Collab</CardTitle>
              <CardDescription>
                Project management integration for task tracking.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            action={(fd) => {
              setError("");
              startTransition(async () => {
                const result = await connectCollab(fd);
                if (result.error) setError(result.error);
              });
            }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label htmlFor="collab-key">Token</Label>
              <Input
                id="collab-key"
                name="apiKey"
                type="password"
                placeholder="collab_at_..."
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending ? "Connecting..." : "Connect"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CollabLogo />
            <div>
              <CardTitle className="text-base">Collab</CardTitle>
              <CardDescription>
                {data.workspaceName
                  ? <>Connected to <span className="font-medium">{data.workspaceName}</span></>
                  : "Project management integration"}
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-green-700 bg-green-100">
            Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              disconnectCollab();
            });
          }}
        >
          Disconnect Collab
        </Button>
      </CardContent>
    </Card>
  );
}
