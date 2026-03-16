"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  IconGitBranch,
  IconRouteSquare2,
  IconLoader2,
  IconHistory,
  IconTrash,
  IconSearch,
  IconSparkles,
} from "@tabler/icons-react";
import type { DiagramType } from "@/lib/mermaid-utils";
import { UserAvatar } from "@/components/user-avatar";

type Repo = {
  id: string;
  name: string;
  fullName: string;
  indexStatus: string;
};

type Diagram = {
  prId: string;
  number: number;
  title: string;
  author: string;
  repoId: string;
  repoName: string;
  diagramCount: number;
  diagramTypes: DiagramType[];
};

type Member = {
  id: string;
  role: string;
  user: { name: string; email: string };
};

type Results = {
  repos: Repo[];
  diagrams: Diagram[];
  members: Member[];
};

const DIAGRAM_TYPE_LABELS: Record<DiagramType, string> = {
  flowchart: "Flow",
  sequence: "Seq",
  er: "ER",
  state: "State",
};

const STATUS_COLORS: Record<string, string> = {
  indexed: "bg-green-500",
  indexing: "bg-yellow-500",
  pending: "bg-gray-400",
  failed: "bg-red-500",
};

const SUGGESTIONS = [
  { label: "authentication service", icon: IconGitBranch },
  { label: "flow diagram", icon: IconRouteSquare2 },
  { label: "payment integration", icon: IconGitBranch },
  { label: "API endpoints", icon: IconSearch },
];

const HISTORY_KEY = "octopus-search-history";
const MAX_HISTORY = 10;

function getHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addToHistory(q: string) {
  const trimmed = q.trim();
  if (!trimmed) return;
  const prev = getHistory().filter((h) => h !== trimmed);
  const next = [trimmed, ...prev].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function CommandPalette({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Load history & reset on open/close
  useEffect(() => {
    if (open) {
      setHistory(getHistory());
    } else {
      setQuery("");
      setResults(null);
      setLoading(false);
      setConfirmClear(false);
    }
  }, [open]);

  // Debounced search
  const search = useCallback(
    (q: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();

      if (!q.trim()) {
        setResults(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      timerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const res = await fetch(
            `/api/search?q=${encodeURIComponent(q)}&orgId=${encodeURIComponent(orgId)}`,
            { signal: controller.signal }
          );
          if (!res.ok) throw new Error("Search failed");
          const data = await res.json();
          setResults(data);
        } catch (err: unknown) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [orgId]
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    search(value);
  }

  function navigate(path: string) {
    if (query.trim()) {
      addToHistory(query);
    }
    setOpen(false);
    router.push(path);
  }

  function handleClearHistory() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearHistory();
    setHistory([]);
    setConfirmClear(false);
  }

  const hasResults =
    results &&
    (results.repos.length > 0 ||
      results.diagrams.length > 0 ||
      results.members.length > 0);

  const showHome = !query.trim() && !loading;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search repositories, diagrams, members..."
        value={query}
        onValueChange={handleQueryChange}
      />
      <CommandList>
        {query.trim() && !loading && !hasResults && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <IconLoader2 className="size-4 animate-spin" />
            Searching...
          </div>
        )}

        {/* Home screen: history + suggestions */}
        {showHome && (
          <>
            {history.length > 0 && (
              <CommandGroup heading="Recent Searches">
                {history.map((h) => (
                  <CommandItem
                    key={h}
                    value={`history-${h}`}
                    onSelect={() => {
                      setQuery(h);
                      search(h);
                    }}
                  >
                    <IconHistory className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-sm">{h}</span>
                  </CommandItem>
                ))}
                <div className="px-2 py-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearHistory();
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <IconTrash className="size-3" />
                    {confirmClear ? "Are you sure? Click again to clear" : "Clear search history"}
                  </button>
                </div>
              </CommandGroup>
            )}
            {history.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Try searching for">
              {SUGGESTIONS.map((s) => (
                <CommandItem
                  key={s.label}
                  value={`suggestion-${s.label}`}
                  onSelect={() => {
                    setQuery(s.label);
                    search(s.label);
                  }}
                >
                  <IconSparkles className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Search results */}
        {results && results.repos.length > 0 && (
          <CommandGroup heading="Repositories">
            {results.repos.map((repo) => (
              <CommandItem
                key={repo.id}
                value={`repo-${repo.fullName}`}
                onSelect={() => navigate(`/repositories?repo=${repo.id}`)}
              >
                <IconGitBranch className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{repo.fullName}</span>
                <span
                  className={`size-2 rounded-full ${STATUS_COLORS[repo.indexStatus] ?? "bg-gray-400"}`}
                  title={repo.indexStatus}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results &&
          results.repos.length > 0 &&
          results.diagrams.length > 0 && <CommandSeparator />}

        {results && results.diagrams.length > 0 && (
          <CommandGroup heading="Diagrams">
            {results.diagrams.map((d) => (
              <CommandItem
                key={d.prId}
                value={`diagram-${d.title}-${d.number}`}
                onSelect={() => navigate(`/repositories?repo=${d.repoId}`)}
              >
                <IconRouteSquare2 className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex gap-1">
                    {d.diagramTypes.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium"
                      >
                        {DIAGRAM_TYPE_LABELS[t]}
                      </span>
                    ))}
                  </div>
                  <span className="truncate">
                    PR #{d.number} {d.title}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {d.repoName}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {results &&
          (results.repos.length > 0 || results.diagrams.length > 0) &&
          results.members.length > 0 && <CommandSeparator />}

        {results && results.members.length > 0 && (
          <CommandGroup heading="Members">
            {results.members.map((m) => (
              <CommandItem
                key={m.id}
                value={`member-${m.user.name}-${m.user.email}`}
              >
                <UserAvatar value={m.user.email} size={24} className="shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{m.user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {m.user.email}
                  </span>
                </div>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize">
                  {m.role}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-3 py-2">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono">esc</kbd>
            close
          </span>
        </div>
      </div>
    </CommandDialog>
  );
}
