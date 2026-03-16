"use client";

import { useActionState, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  createAvailableModel,
  updateAvailableModel,
  toggleAvailableModel,
  setPlatformDefault,
} from "./model-actions";

type Model = {
  id: string;
  modelId: string;
  displayName: string;
  provider: string;
  category: string;
  inputPrice: number;
  outputPrice: number;
  isActive: boolean;
  isPlatformDefault: boolean;
  sortOrder: number;
};

export function ModelManager({ models }: { models: Model[] }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [createState, createAction, createPending] = useActionState(createAvailableModel, {});
  const [editState, editAction, editPending] = useActionState(updateAvailableModel, {});

  const llmModels = models.filter((m) => m.category === "llm");
  const embeddingModels = models.filter((m) => m.category === "embedding");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Available Models</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add Model"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add form */}
        {showAdd && (
          <form action={createAction} className="rounded-md border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="modelId" className="text-xs">Model ID</Label>
                <Input id="modelId" name="modelId" placeholder="claude-sonnet-4-20250514" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="displayName" className="text-xs">Display Name</Label>
                <Input id="displayName" name="displayName" placeholder="Claude Sonnet 4" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="provider" className="text-xs">Provider</Label>
                <select name="provider" className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="category" className="text-xs">Category</Label>
                <select name="category" className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs">
                  <option value="llm">LLM</option>
                  <option value="embedding">Embedding</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="inputPrice" className="text-xs">Input $/1M tokens</Label>
                <Input id="inputPrice" name="inputPrice" type="number" step="0.01" placeholder="3" className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="outputPrice" className="text-xs">Output $/1M tokens</Label>
                <Input id="outputPrice" name="outputPrice" type="number" step="0.01" placeholder="15" className="h-8 text-xs" />
              </div>
            </div>
            {createState.error && <p className="text-xs text-destructive">{createState.error}</p>}
            {createState.success && <p className="text-xs text-green-600">Model added.</p>}
            <Button type="submit" size="sm" disabled={createPending}>
              {createPending ? "Adding..." : "Add Model"}
            </Button>
          </form>
        )}

        {/* LLM Models */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">LLM Models</h4>
          <ModelTable
            models={llmModels}
            editId={editId}
            setEditId={setEditId}
            editAction={editAction}
            editState={editState}
            editPending={editPending}
          />
        </div>

        {/* Embedding Models */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Embedding Models</h4>
          <ModelTable
            models={embeddingModels}
            editId={editId}
            setEditId={setEditId}
            editAction={editAction}
            editState={editState}
            editPending={editPending}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ModelTable({
  models,
  editId,
  setEditId,
  editAction,
  editState,
  editPending,
}: {
  models: Model[];
  editId: string | null;
  setEditId: (id: string | null) => void;
  editAction: (formData: FormData) => void;
  editState: { error?: string; success?: boolean };
  editPending: boolean;
}) {
  if (models.length === 0) {
    return <p className="text-xs text-muted-foreground">No models</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">Model</th>
            <th className="pb-2 font-medium">Provider</th>
            <th className="pb-2 text-right font-medium">Input</th>
            <th className="pb-2 text-right font-medium">Output</th>
            <th className="pb-2 text-center font-medium">Status</th>
            <th className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            editId === m.id ? (
              <tr key={m.id} className="border-b">
                <td colSpan={6} className="py-2">
                  <form action={(fd) => { editAction(fd); setEditId(null); }} className="flex items-end gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <div className="space-y-1">
                      <Label className="text-[10px]">Display Name</Label>
                      <Input name="displayName" defaultValue={m.displayName} className="h-7 text-xs w-40" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Input $</Label>
                      <Input name="inputPrice" type="number" step="0.01" defaultValue={m.inputPrice} className="h-7 text-xs w-20" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Output $</Label>
                      <Input name="outputPrice" type="number" step="0.01" defaultValue={m.outputPrice} className="h-7 text-xs w-20" />
                    </div>
                    <Button type="submit" size="sm" variant="outline" className="h-7 text-xs" disabled={editPending}>
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditId(null)}>
                      Cancel
                    </Button>
                    {editState.error && <span className="text-xs text-destructive">{editState.error}</span>}
                  </form>
                </td>
              </tr>
            ) : (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-2">
                  <div className="font-medium">{m.displayName}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">{m.modelId}</div>
                </td>
                <td className="py-2 capitalize">{m.provider}</td>
                <td className="py-2 text-right">${m.inputPrice}</td>
                <td className="py-2 text-right">${m.outputPrice}</td>
                <td className="py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Badge variant={m.isActive ? "default" : "secondary"} className="text-[10px]">
                      {m.isActive ? "Active" : "Inactive"}
                    </Badge>
                    {m.isPlatformDefault && (
                      <Badge variant="outline" className="text-[10px] border-blue-500 text-blue-500">
                        Default
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!m.isPlatformDefault && m.isActive && (
                      <form action={setPlatformDefault}>
                        <input type="hidden" name="id" value={m.id} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="h-6 text-[10px] px-2 text-blue-500"
                        >
                          Set Default
                        </Button>
                      </form>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setEditId(m.id)}
                    >
                      Edit
                    </Button>
                    <form action={toggleAvailableModel}>
                      <input type="hidden" name="id" value={m.id} />
                      <Button
                        type="submit"
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-2"
                      >
                        {m.isActive ? "Disable" : "Enable"}
                      </Button>
                    </form>
                  </div>
                </td>
              </tr>
            )
          ))}
        </tbody>
      </table>
    </div>
  );
}
