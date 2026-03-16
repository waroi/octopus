"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { IconBrandSlack, IconSelector, IconCheck } from "@tabler/icons-react";
import { disconnectSlack, updateSlackChannel, toggleSlackEvent } from "./actions";

type EventConfig = {
  eventType: string;
  enabled: boolean;
};

type SlackData = {
  teamName: string;
  channelId: string | null;
  channelName: string | null;
  eventConfigs: EventConfig[];
} | null;

const EVENT_LABELS: Record<string, string> = {
  "review-requested": "Review Requested",
  "review-completed": "Review Completed",
  "review-failed": "Review Failed",
  "repo-indexed": "Repository Indexed",
  "repo-analyzed": "Repository Analyzed",
  "knowledge-ready": "Knowledge Document Ready",
};

export function SlackIntegrationCard({ data }: { data: SlackData }) {
  const [isPending, startTransition] = useTransition();
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState(data?.channelId ?? "");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) {
      setLoadingChannels(true);
      fetch("/api/slack/channels")
        .then((res) => res.json())
        .then((json) => setChannels(json.channels ?? []))
        .catch(() => {})
        .finally(() => setLoadingChannels(false));
    }
  }, [data]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setChannelOpen(false);
      }
    }
    if (channelOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [channelOpen]);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center">
              <IconBrandSlack className="size-6 text-[#4A154B] dark:text-[#E8B4E9]" />
            </div>
            <div>
              <CardTitle className="text-base">Slack</CardTitle>
              <CardDescription>
                Send review notifications to your Slack workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <a href="/api/slack/oauth">
              <IconBrandSlack className="mr-2 size-4" />
              Add to Slack
            </a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center">
              <IconBrandSlack className="size-6 text-[#4A154B] dark:text-[#E8B4E9]" />
            </div>
            <div>
              <CardTitle className="text-base">Slack</CardTitle>
              <CardDescription>
                Connected to <span className="font-medium">{data.teamName}</span>
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-green-700 bg-green-100">
            Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Channel selector */}
        <div className="space-y-2">
          <Label>Notification Channel</Label>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => !loadingChannels && setChannelOpen(!channelOpen)}
              disabled={loadingChannels}
              className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className={selectedChannelId ? "" : "text-muted-foreground"}>
                {loadingChannels
                  ? "Loading channels..."
                  : selectedChannelId
                    ? `#${channels.find((c) => c.id === selectedChannelId)?.name ?? data.channelName ?? ""}`
                    : "Select a channel"}
              </span>
              <IconSelector className="size-4 opacity-50" />
            </button>
            {channelOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                <Command>
                  <CommandInput placeholder="Search channels..." />
                  <CommandList>
                    <CommandEmpty>No channel found.</CommandEmpty>
                    <CommandGroup>
                      {channels.map((ch) => (
                        <CommandItem
                          key={ch.id}
                          value={ch.name}
                          onSelect={() => {
                            setSelectedChannelId(ch.id);
                            setChannelOpen(false);
                            const fd = new FormData();
                            fd.set("channelId", ch.id);
                            fd.set("channelName", ch.name);
                            startTransition(() => {
                              updateSlackChannel(fd);
                            });
                          }}
                        >
                          <IconCheck
                            className={`size-4 ${selectedChannelId === ch.id ? "opacity-100" : "opacity-0"}`}
                          />
                          #{ch.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </div>
            )}
          </div>
        </div>

        {/* Event toggles */}
        <div className="space-y-3">
          <Label>Event Notifications</Label>
          <div className="space-y-3">
            {Object.entries(EVENT_LABELS).map(([eventType, label]) => {
              const config = data.eventConfigs.find(
                (c) => c.eventType === eventType,
              );
              const enabled = config?.enabled ?? true;

              return (
                <div
                  key={eventType}
                  className="flex items-center justify-between"
                >
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => {
                      startTransition(() => {
                        toggleSlackEvent(eventType, checked);
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Disconnect */}
        <div className="border-t pt-4">
          <Button
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                disconnectSlack();
              });
            }}
          >
            Disconnect Slack
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
