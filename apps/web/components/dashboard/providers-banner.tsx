"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  IconBrandGithub,
  IconBrandBitbucket,
  IconCircleCheck,
  IconCircle,
  IconX,
} from "@tabler/icons-react";

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

export function ProvidersBanner({
  githubConnected,
  bitbucketConnected,
  githubAppSlug,
  baseUrl,
}: {
  githubConnected: boolean;
  bitbucketConnected: boolean;
  githubAppSlug: string | undefined;
  baseUrl: string;
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const githubInstallUrl = githubAppSlug
    ? `https://github.com/apps/${githubAppSlug}/installations/new?state=${encodeURIComponent(`${baseUrl}/dashboard`)}`
    : null;

  return (
    <Card className="mt-6 px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Connect your code providers</p>
        <button
          onClick={() => {
            setCookie("providers_banner_dismissed", "1", 365);
            setDismissed(true);
          }}
          className="text-muted-foreground hover:text-foreground transition-colors rounded-sm p-0.5"
          aria-label="Dismiss"
        >
          <IconX className="size-4" />
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3">
          {githubConnected ? (
            <IconCircleCheck className="size-4 shrink-0 text-emerald-500" />
          ) : (
            <IconCircle className="size-4 shrink-0 text-muted-foreground" />
          )}
          <IconBrandGithub className="size-4 shrink-0" />
          <span className="text-sm">GitHub</span>
          {githubConnected ? (
            githubInstallUrl ? (
              <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" asChild>
                <a
                  href={githubInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Manage Repos &rarr;
                </a>
              </Button>
            ) : (
              <span className="ml-auto text-xs font-medium text-emerald-500">Connected</span>
            )
          ) : (
            githubInstallUrl && (
              <Button size="sm" variant="cta" className="ml-auto h-7 text-xs" asChild>
                <a
                  href={githubInstallUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Connect &rarr;
                </a>
              </Button>
            )
          )}
        </div>

        <div className="flex items-center gap-3">
          {bitbucketConnected ? (
            <IconCircleCheck className="size-4 shrink-0 text-emerald-500" />
          ) : (
            <IconCircle className="size-4 shrink-0 text-muted-foreground" />
          )}
          <IconBrandBitbucket className="size-4 shrink-0 text-[#0052CC]" />
          <span className="text-sm">Bitbucket</span>
          {bitbucketConnected ? (
            <span className="ml-auto text-xs font-medium text-emerald-500">Connected</span>
          ) : (
            <Button size="sm" variant="cta" className="ml-auto h-7 text-xs" asChild>
              <a href="/api/bitbucket/oauth">
                Connect &rarr;
              </a>
            </Button>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        You can always manage integrations from{" "}
        <a
          href="/settings/integrations"
          className="underline hover:text-foreground transition-colors"
        >
          Settings
        </a>
        .
      </p>
    </Card>
  );
}
