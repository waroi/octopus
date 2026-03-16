"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { IconThumbUp, IconThumbUpFilled, IconThumbDown, IconThumbDownFilled } from "@tabler/icons-react";
import { feedbackIssue } from "@/app/(app)/actions";

export function FeedbackButtons({
  issueId,
  currentFeedback,
}: {
  issueId: string;
  currentFeedback: "up" | "down" | null;
}) {
  const [isPending, startTransition] = useTransition();

  const handleFeedback = (value: "up" | "down") => {
    startTransition(async () => {
      await feedbackIssue(issueId, value);
    });
  };

  return (
    <span className="inline-flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-green-500"
        disabled={isPending}
        onClick={() => handleFeedback("up")}
      >
        {currentFeedback === "up" ? (
          <IconThumbUpFilled className="size-3.5 text-green-500" />
        ) : (
          <IconThumbUp className="size-3.5" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500"
        disabled={isPending}
        onClick={() => handleFeedback("down")}
      >
        {currentFeedback === "down" ? (
          <IconThumbDownFilled className="size-3.5 text-red-500" />
        ) : (
          <IconThumbDown className="size-3.5" />
        )}
      </Button>
    </span>
  );
}
