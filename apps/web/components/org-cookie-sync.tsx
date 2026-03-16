"use client";

import { useEffect } from "react";

export function OrgCookieSync({ orgId }: { orgId: string }) {
  useEffect(() => {
    if (!orgId) return;
    const current = document.cookie
      .split("; ")
      .find((c) => c.startsWith("current_org_id="))
      ?.split("=")[1];
    if (current !== orgId) {
      document.cookie = `current_org_id=${orgId};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    }
  }, [orgId]);

  return null;
}
