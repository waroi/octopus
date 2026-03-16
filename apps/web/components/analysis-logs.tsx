"use client";

import { useEffect, useRef, useState } from "react";
import { getPubbyClient } from "@/lib/pubby-client";
import {
  IconCircleCheck,
  IconCircleX,
  IconAlertTriangle,
  IconLoader2,
  IconSparkles,
  IconPoint,
} from "@tabler/icons-react";

interface LogEntry {
  message: string;
  level: "info" | "success" | "error" | "warning";
  timestamp: number;
}

function LogIcon({ level, isActive }: { level: LogEntry["level"]; isActive: boolean }) {
  if (level === "success") {
    return <IconCircleCheck className="size-3.5 shrink-0 text-emerald-400" />;
  }
  if (level === "error") {
    return <IconCircleX className="size-3.5 shrink-0 text-red-400" />;
  }
  if (level === "warning") {
    return <IconAlertTriangle className="size-3.5 shrink-0 text-amber-400" />;
  }
  if (isActive) {
    return <IconLoader2 className="size-3.5 shrink-0 animate-spin text-purple-400" />;
  }
  return <IconPoint className="size-3.5 shrink-0 text-zinc-500" />;
}

const levelColor: Record<LogEntry["level"], string> = {
  info: "text-zinc-300",
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-amber-400",
};

export function AnalysisLogs({
  repoId,
  orgId,
  isAnalyzing,
}: {
  repoId: string;
  orgId: string;
  isAnalyzing: boolean;
}) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [done, setDone] = useState(!isAnalyzing);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAnalyzing && logs.length === 0) return;

    const pubby = getPubbyClient();
    const channel = pubby.subscribe(`presence-org-${orgId}`);

    const handleLog = (raw: unknown) => {
      const data = raw as { repoId: string; message: string; level: LogEntry["level"]; timestamp: number };
      if (data.repoId !== repoId) return;
      setLogs((prev) => {
        if (prev.some((l) => l.timestamp === data.timestamp)) return prev;
        return [...prev, { message: data.message, level: data.level, timestamp: data.timestamp }];
      });
    };

    const handleStatus = (raw: unknown) => {
      const data = raw as { repoId: string; status: string };
      if (data.repoId !== repoId) return;
      if (data.status !== "analyzing") {
        setDone(true);
      }
    };

    channel.bind("analysis-log", handleLog);
    channel.bind("analysis-status", handleStatus);

    return () => {
      channel.unbind("analysis-log", handleLog);
      channel.unbind("analysis-status", handleStatus);
    };
  }, [repoId, orgId, isAnalyzing, logs.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;

  let lastInfoIndex = -1;
  if (!done) {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].level === "info") {
        lastInfoIndex = i;
        break;
      }
    }
  }

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-3 py-2">
        <IconSparkles className="size-4 text-purple-400" />
        <span className="text-xs font-medium text-zinc-400">Analysis Logs</span>
        {!done && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-purple-400">
            <IconLoader2 className="size-3 animate-spin" />
            Running
          </span>
        )}
        {done && logs.some((l) => l.level === "error") && (
          <span className="ml-auto text-xs text-red-400">Failed</span>
        )}
        {done && logs.some((l) => l.level === "success" && l.message.includes("completed")) && (
          <span className="ml-auto text-xs text-emerald-400">Completed</span>
        )}
        {done && logs.some((l) => l.level === "warning" && l.message.includes("cancelled")) && (
          <span className="ml-auto text-xs text-amber-400">Cancelled</span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
      >
        {logs.map((log, i) => (
          <div key={i} className="flex items-start gap-2 py-0.5">
            <span className="mt-0.5">
              <LogIcon level={log.level} isActive={i === lastInfoIndex} />
            </span>
            <span className={levelColor[log.level]}>{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
