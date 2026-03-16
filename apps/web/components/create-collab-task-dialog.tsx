"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconLoader2, IconPlus, IconCheck } from "@tabler/icons-react";
import {
  initIssueCreation,
  saveProjectMapping,
  generateIssueContent,
  createIssueFromReview,
} from "@/app/(app)/settings/integrations/collab-task-action";

type Step = "loading" | "select_project" | "generating" | "preview" | "creating" | "done" | "error";

type Project = { id: string; name: string; slug: string };

export function CreateCollabTaskButton({ issueId }: { issueId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("loading");
  const [error, setError] = useState("");

  // select_project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [repoId, setRepoId] = useState("");
  const [repoName, setRepoName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // preview state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const reset = useCallback(() => {
    setStep("loading");
    setError("");
    setProjects([]);
    setSelectedProjectId("");
    setRepoId("");
    setRepoName("");
    setTitle("");
    setDescription("");
    setIsSaving(false);
  }, []);

  const startGeneration = useCallback(
    async () => {
      setStep("generating");
      const result = await generateIssueContent(issueId);
      if ("error" in result) {
        setError(result.error);
        setStep("error");
        return;
      }
      setTitle(result.title);
      setDescription(result.description);
      setStep("preview");
    },
    [issueId],
  );

  const init = useCallback(async () => {
    reset();
    const result = await initIssueCreation(issueId);
    if ("error" in result) {
      setError(result.error);
      setStep("error");
      return;
    }
    if (result.step === "mapped") {
      // Has mapping, go straight to AI generation
      await startGeneration();
    } else {
      setProjects(result.projects);
      setRepoId(result.repoId);
      setRepoName(result.repoName);
      setStep("select_project");
    }
  }, [issueId, reset, startGeneration]);

  useEffect(() => {
    if (open) {
      init();
    }
  }, [open, init]);

  async function handleMapAndContinue() {
    if (!selectedProjectId) return;
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) return;

    setIsSaving(true);
    const result = await saveProjectMapping(repoId, project.id, project.name);
    if (result.error) {
      setError(result.error);
      setStep("error");
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
    await startGeneration();
  }

  async function handleCreateIssue() {
    if (!title.trim()) return;
    setStep("creating");
    const result = await createIssueFromReview(issueId, title.trim(), description.trim());
    if (result.error) {
      setError(result.error);
      setStep("error");
      return;
    }
    setStep("done");
    setTimeout(() => setOpen(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 shrink-0 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground"
        >
          <IconPlus className="size-3" />
          Create Issue
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Collab Issue</DialogTitle>
          <DialogDescription>
            {step === "select_project"
              ? "Select a project to map this repository to."
              : step === "preview"
                ? "Review the AI-generated content before creating."
                : "Create an issue from this review finding."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          {/* Loading */}
          {step === "loading" && (
            <div className="flex items-center justify-center py-8">
              <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Select Project */}
          {step === "select_project" && (
            <>
              <p className="text-sm text-muted-foreground">
                No project mapped for <span className="font-medium text-foreground">{repoName}</span>.
                Select a Collab project to link it to:
              </p>
              <div className="space-y-2">
                <Label>Project</Label>
                <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleMapAndContinue}
                  disabled={!selectedProjectId || isSaving}
                >
                  {isSaving ? (
                    <>
                      <IconLoader2 className="size-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Map & Continue"
                  )}
                </Button>
              </div>
            </>
          )}

          {/* Generating AI content */}
          {step === "generating" && (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generating issue content...</p>
            </div>
          )}

          {/* Preview & Edit */}
          {step === "preview" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="issue-title">Title</Label>
                <Input
                  id="issue-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Issue title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issue-description">Description</Label>
                <Textarea
                  id="issue-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder="Issue description"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateIssue} disabled={!title.trim()}>
                  Create Issue
                </Button>
              </div>
            </>
          )}

          {/* Creating */}
          {step === "creating" && (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <IconLoader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Creating issue...</p>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="flex flex-col items-center justify-center gap-2 py-8">
              <div className="flex size-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                <IconCheck className="size-5" />
              </div>
              <p className="text-sm font-medium text-green-600">Issue created!</p>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <>
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Close
                </Button>
                <Button onClick={init}>Retry</Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
