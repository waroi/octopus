"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function GlobalErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Prevent the default browser error overlay / white screen
      event.preventDefault();

      console.error("[GlobalErrorHandler]", event.error);
      toast.error("Something went wrong", {
        description: "An unexpected error occurred. Please refresh and try again.",
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();

      console.error("[GlobalErrorHandler] Unhandled rejection:", event.reason);
      toast.error("Something went wrong", {
        description: "An unexpected error occurred. Please refresh and try again.",
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
