"use client";

import { Button } from "@/components/ui/button";
import { Settings, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

type MissionControlHeaderProps = {
  workspaceLabel: string;
  status: ConnectionStatus;
  agentCount: number;
  activeAgentCount: number;
  taskCount: number;
  onOpenSettings: () => void;
};

export const MissionControlHeader = ({
  workspaceLabel,
  status,
  agentCount,
  activeAgentCount,
  taskCount,
  onOpenSettings,
}: MissionControlHeaderProps) => {
  const now = new Date();
  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateString = now.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).toUpperCase();

  return (
    <div className="flex items-center justify-between">
      {/* Left: Logo + workspace */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            ◈
          </div>
          <span className="text-sm font-semibold tracking-wide uppercase">
            Mission Control
          </span>
        </div>
        <div className="h-6 w-px bg-border" />
        <span className="text-sm text-muted-foreground">{workspaceLabel}</span>
      </div>

      {/* Center: Stats */}
      <div className="flex items-center gap-12">
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight">
            {activeAgentCount}
            <span className="text-lg text-muted-foreground font-normal"> / {agentCount}</span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Agents Active
          </div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight">{taskCount}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Tasks in Queue
          </div>
        </div>
      </div>

      {/* Right: Time + Status + Settings */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground"
        >
          <FileText className="h-4 w-4" />
          <span className="text-sm">Docs</span>
        </Button>
        <div className="text-right">
          <div className="text-sm font-mono tabular-nums">{timeString}</div>
          <div className="text-[10px] text-muted-foreground">{dateString}</div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
            status === "connected"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : status === "connecting"
              ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}
        >
          <div
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                ? "bg-yellow-500 animate-pulse"
                : "bg-red-500"
            )}
          />
          {status === "connected" ? "ONLINE" : status === "connecting" ? "CONNECTING" : "OFFLINE"}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
