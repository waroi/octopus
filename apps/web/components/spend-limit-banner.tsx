"use client";

import Link from "next/link";
import { IconAlertTriangle } from "@tabler/icons-react";

export function SpendLimitBanner({ isOverLimit }: { isOverLimit: boolean }) {
  if (!isOverLimit) return null;

  return (
    <div className="sticky top-0 z-50">
      <div className="flex items-center justify-between gap-3 bg-amber-950 px-4 py-1.5">
        <div className="flex items-center gap-2 overflow-hidden">
          <IconAlertTriangle className="size-3.5 shrink-0 text-amber-400" />
          <p className="truncate text-xs text-amber-200">
            <span className="font-medium">Monthly AI usage limit reached ($150).</span>{" "}
            Enter your own API keys or upgrade to continue.
          </p>
        </div>
        <Link
          href="/settings/api-keys"
          className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-200 transition-colors hover:bg-amber-500/30"
        >
          Go to Settings
        </Link>
      </div>
    </div>
  );
}
