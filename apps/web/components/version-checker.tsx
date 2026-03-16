"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

const POLL_INTERVAL = 300_000;
const INITIAL_DELAY = 10_000;

export function VersionChecker() {
  const currentBuildId = process.env.NEXT_PUBLIC_BUILD_ID;
  const shownRef = useRef(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { buildId } = await res.json();
        if (buildId && buildId !== currentBuildId && !shownRef.current) {
          shownRef.current = true;
          toast.info("New version available", {
            description: "Refresh the page to get the latest updates.",
            duration: Infinity,
            action: {
              label: "Refresh",
              onClick: () => window.location.reload(),
            },
          });
        }
      } catch {
        // ignore network errors
      }
    };

    const timeout = setTimeout(check, INITIAL_DELAY);
    const interval = setInterval(check, POLL_INTERVAL);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [currentBuildId]);

  return null;
}
