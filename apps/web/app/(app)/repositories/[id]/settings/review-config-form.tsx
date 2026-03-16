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
import { updateReviewConfig } from "../../actions";

type ReviewConfig = {
  maxFindings?: number;
  inlineThreshold?: string;
  enableConflictDetection?: boolean;
  disabledCategories?: string[];
  confidenceThreshold?: string;
  enableTwoPassReview?: boolean;
};

export function ReviewConfigForm({
  repoId,
  isOwner,
  initialConfig,
}: {
  repoId: string;
  isOwner: boolean;
  initialConfig: ReviewConfig;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [maxFindings, setMaxFindings] = useState(initialConfig.maxFindings ?? 30);
  const [inlineThreshold, setInlineThreshold] = useState(initialConfig.inlineThreshold ?? "medium");
  const [enableConflictDetection, setEnableConflictDetection] = useState(
    initialConfig.enableConflictDetection ?? undefined,
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    initialConfig.confidenceThreshold ?? "MEDIUM",
  );
  const [enableTwoPassReview, setEnableTwoPassReview] = useState(
    initialConfig.enableTwoPassReview ?? false,
  );
  const [disabledCategories, setDisabledCategories] = useState(
    (initialConfig.disabledCategories ?? []).join(", "),
  );

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const config: ReviewConfig = {
        maxFindings,
        inlineThreshold,
        confidenceThreshold,
        enableTwoPassReview,
      };
      if (enableConflictDetection !== undefined) {
        config.enableConflictDetection = enableConflictDetection;
      }
      const cats = disabledCategories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      if (cats.length > 0) {
        config.disabledCategories = cats;
      }

      const result = await updateReviewConfig(repoId, config);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Configuration</CardTitle>
        <CardDescription>
          Customize how Octopus reviews PRs for this repository. These settings override the default behavior.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={handleSubmit}
          className="space-y-5"
        >
          <fieldset disabled={!isOwner || pending} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="maxFindings">Max findings per review</Label>
              <Input
                id="maxFindings"
                type="number"
                min={1}
                max={50}
                value={maxFindings}
                onChange={(e) => setMaxFindings(Number(e.target.value))}
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Limit the number of findings reported per review (1-50). Findings are prioritized by severity.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Inline comment threshold</Label>
              <div className="space-y-2">
                {[
                  { value: "medium", label: "Medium & above", desc: "Inline comments for Critical, High, and Medium findings" },
                  { value: "high", label: "High & above", desc: "Inline comments for Critical and High findings only" },
                  { value: "critical", label: "Critical only", desc: "Inline comments for Critical findings only" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name="inlineThreshold"
                      value={opt.value}
                      checked={inlineThreshold === opt.value}
                      onChange={() => setInlineThreshold(opt.value)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium">{opt.label}</span>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Findings below this threshold appear in a summary table instead of inline PR comments.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Confidence threshold</Label>
              <div className="flex gap-4">
                {[
                  { value: "MEDIUM", label: "Medium & above (default)" },
                  { value: "HIGH", label: "High only" },
                ].map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="confidenceThreshold"
                      value={opt.value}
                      checked={confidenceThreshold === opt.value}
                      onChange={() => setConfidenceThreshold(opt.value)}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Only include findings at or above this confidence level.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Conflict detection</Label>
                <p className="text-xs text-muted-foreground">
                  Analyze potential merge conflicts when shared files are modified. Leave auto to only enable when shared files are touched.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {enableConflictDetection === undefined ? "Auto" : enableConflictDetection ? "Always" : "Never"}
                </span>
                <select
                  className="text-sm border rounded px-2 py-1"
                  value={enableConflictDetection === undefined ? "auto" : enableConflictDetection ? "always" : "never"}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEnableConflictDetection(v === "auto" ? undefined : v === "always");
                  }}
                >
                  <option value="auto">Auto</option>
                  <option value="always">Always</option>
                  <option value="never">Never</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Two-pass review</Label>
                <p className="text-xs text-muted-foreground">
                  Use a second LLM pass to validate findings before posting. Increases accuracy but doubles review cost.
                </p>
              </div>
              <Switch
                checked={enableTwoPassReview}
                onCheckedChange={setEnableTwoPassReview}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disabledCategories">Disabled categories</Label>
              <Input
                id="disabledCategories"
                value={disabledCategories}
                onChange={(e) => setDisabledCategories(e.target.value)}
                placeholder="e.g. Style, Performance"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of finding categories to suppress (e.g. Style, Performance).
              </p>
            </div>
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">Configuration saved.</p>}

          <Button type="submit" disabled={pending || !isOwner} className="w-full" size="sm">
            {pending ? "Saving..." : "Save Configuration"}
          </Button>

          {!isOwner && (
            <p className="text-muted-foreground text-center text-xs">
              Only owners can change review configuration.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
