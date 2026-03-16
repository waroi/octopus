"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { updateSystemReviewConfig } from "./model-actions";

type ReviewConfig = {
  maxFindings?: number;
  inlineThreshold?: string;
  enableConflictDetection?: boolean;
  disabledCategories?: string[];
  confidenceThreshold?: string;
  enableTwoPassReview?: boolean;
};

export function ReviewDefaultsManager({
  initialConfig,
}: {
  initialConfig: ReviewConfig;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const [maxFindings, setMaxFindings] = useState(initialConfig.maxFindings ?? 30);
  const [inlineThreshold, setInlineThreshold] = useState(initialConfig.inlineThreshold ?? "medium");
  const [confidenceThreshold, setConfidenceThreshold] = useState(initialConfig.confidenceThreshold ?? "MEDIUM");
  const [enableConflict, setEnableConflict] = useState<string>(
    initialConfig.enableConflictDetection === undefined ? "auto" : initialConfig.enableConflictDetection ? "always" : "never",
  );
  const [twoPass, setTwoPass] = useState(initialConfig.enableTwoPassReview ?? false);
  const [disabledCategories, setDisabledCategories] = useState(
    (initialConfig.disabledCategories ?? []).join(", "),
  );

  const handleSave = () => {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const config: Record<string, unknown> = {
        maxFindings,
        inlineThreshold,
        confidenceThreshold,
        enableTwoPassReview: twoPass,
      };
      if (enableConflict !== "auto") {
        config.enableConflictDetection = enableConflict === "always";
      }
      const cats = disabledCategories.split(",").map((c) => c.trim()).filter(Boolean);
      if (cats.length > 0) config.disabledCategories = cats;

      const result = await updateSystemReviewConfig(config);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform Review Defaults</CardTitle>
        <CardDescription>
          System-wide defaults for all organizations. Orgs and repos can override these.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Max findings</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={maxFindings}
              onChange={(e) => setMaxFindings(Number(e.target.value))}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Inline threshold</Label>
            <select
              value={inlineThreshold}
              onChange={(e) => setInlineThreshold(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
            >
              <option value="medium">Medium & above</option>
              <option value="high">High & above</option>
              <option value="critical">Critical only</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Confidence threshold</Label>
            <select
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
            >
              <option value="MEDIUM">Medium & above</option>
              <option value="HIGH">High only</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conflict detection</Label>
            <select
              value={enableConflict}
              onChange={(e) => setEnableConflict(e.target.value)}
              className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm"
            >
              <option value="auto">Auto</option>
              <option value="always">Always</option>
              <option value="never">Never</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs">Two-pass review</Label>
            <p className="text-[10px] text-muted-foreground">Second LLM pass to validate findings</p>
          </div>
          <Switch checked={twoPass} onCheckedChange={setTwoPass} />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Disabled categories</Label>
          <Input
            value={disabledCategories}
            onChange={(e) => setDisabledCategories(e.target.value)}
            placeholder="e.g. Style, Performance"
            className="h-8"
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {saved && <p className="text-xs text-green-600">Saved.</p>}

        <Button size="sm" className="h-7" disabled={pending} onClick={handleSave}>
          {pending ? "Saving..." : "Save Defaults"}
        </Button>
      </CardContent>
    </Card>
  );
}
