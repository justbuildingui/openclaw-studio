"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { AgentTile } from "@/features/canvas/state/store";
import { AgentAvatar } from "@/features/canvas/components/AgentAvatar";
import { cn } from "@/lib/utils";

export type FeedEvent = {
  id: string;
  type: "message" | "status" | "task" | "system" | "decision" | "comment";
  agentId?: string;
  content: string;
  timestamp: number;
};

type FeedFilter = "all" | "tasks" | "comments" | "decisions" | "status";

type LiveFeedProps = {
  events: FeedEvent[];
  agents: AgentTile[];
  maxEvents?: number;
};

const FILTER_TABS: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "tasks", label: "Tasks" },
  { key: "comments", label: "Comments" },
  { key: "decisions", label: "Decisions" },
  { key: "status", label: "Status" },
];

// Pure time formatting
const formatTimeAgo = (timestamp: number, now: number) => {
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
};

export const LiveFeed = ({ events, agents, maxEvents = 50 }: LiveFeedProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [now] = useState(() => Date.now());

  const getAgentById = (id?: string) =>
    id ? agents.find((a) => a.id === id) : undefined;

  // Filter events based on selected filter
  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    const typeMap: Record<FeedFilter, FeedEvent["type"][]> = {
      all: [],
      tasks: ["task"],
      comments: ["comment", "message"],
      decisions: ["decision"],
      status: ["status", "system"],
    };
    return events.filter((e) => typeMap[filter].includes(e.type));
  }, [events, filter]);

  // Count events per filter
  const counts = useMemo(() => ({
    all: events.length,
    tasks: events.filter((e) => e.type === "task").length,
    comments: events.filter((e) => ["comment", "message"].includes(e.type)).length,
    decisions: events.filter((e) => e.type === "decision").length,
    status: events.filter((e) => ["status", "system"].includes(e.type)).length,
  }), [events]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents.length]);

  const displayEvents = filteredEvents.slice(-maxEvents);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            ✦ Live Feed
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-[10px] font-medium text-red-500">LIVE</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 border-b border-border px-2 py-1.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
              filter === tab.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className="ml-1 opacity-70">{counts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Agent filter chips */}
      {agents.length > 0 && (
        <div className="flex gap-1 overflow-x-auto border-b border-border/50 px-2 py-1.5">
          <span className="text-[10px] text-muted-foreground mr-1">All Agents</span>
          {agents.slice(0, 5).map((agent) => (
            <div
              key={agent.id}
              className="flex items-center gap-1 rounded-full bg-muted/30 px-1.5 py-0.5"
              title={agent.name}
            >
              <AgentAvatar
                name={agent.name}
                seed={agent.avatarSeed ?? agent.name}
                size={14}
              />
              <span className="text-[9px] font-medium">{agent.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Events list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        {displayEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No activity yet
          </div>
        ) : (
          <div className="space-y-0.5 p-1">
            {displayEvents.map((event) => {
              const agent = getAgentById(event.agentId);
              return (
                <div
                  key={event.id}
                  className="flex gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/30"
                >
                  {/* Agent avatar or event icon */}
                  <div className="flex-shrink-0 pt-0.5">
                    {agent ? (
                      <AgentAvatar
                        name={agent.name}
                        seed={agent.avatarSeed ?? agent.name}
                        size={20}
                      />
                    ) : (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
                        ⚙
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-snug text-foreground/90">
                      {agent && (
                        <span className="font-semibold">{agent.name}</span>
                      )}
                      {agent && " "}
                      <span className="text-muted-foreground">
                        {event.type === "message" ? "commented on" : event.type === "task" ? "completed" : ""}
                      </span>
                      {" "}
                      &ldquo;{event.content.slice(0, 60)}{event.content.length > 60 ? "..." : ""}&rdquo;
                      {" "}
                      <span className="text-muted-foreground/70">›</span>
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTimeAgo(event.timestamp, now)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
