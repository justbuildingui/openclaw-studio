"use client";

import { useState } from "react";
import type { AgentTile } from "@/features/canvas/state/store";
import { AgentAvatar } from "@/features/canvas/components/AgentAvatar";
import { Button } from "@/components/ui/button";
import { Plus, Settings, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentsSidebarProps = {
  agents: AgentTile[];
  selectedAgentId: string | null;
  onSelectAgent: (id: string) => void;
  onAddAgent: () => void;
  onInspectAgent: (id: string) => void;
  canAddAgent: boolean;
};

const getStatusBadge = (status: AgentTile["status"]) => {
  switch (status) {
    case "running":
      return { label: "WORKING", color: "bg-green-500/15 text-green-600 dark:text-green-400" };
    case "error":
      return { label: "ERROR", color: "bg-red-500/15 text-red-600 dark:text-red-400" };
    case "idle":
    default:
      return null;
  }
};

// Generate a role badge color based on the role name
const getRoleBadgeColor = (role: string) => {
  const colors = [
    "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    "bg-purple-500/15 text-purple-600 dark:text-purple-400",
    "bg-pink-500/15 text-pink-600 dark:text-pink-400",
    "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  ];
  const hash = role.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

// Abbreviate role to 3-4 letters
const abbreviateRole = (role: string): string => {
  if (!role) return "";
  // Common abbreviations
  const abbrevs: Record<string, string> = {
    "founder": "LEAD",
    "lead": "LEAD",
    "developer": "DEV",
    "engineer": "ENG",
    "designer": "DES",
    "analyst": "ANL",
    "researcher": "RES",
    "writer": "WRT",
    "marketing": "MKT",
    "product": "PRD",
    "support": "SUP",
    "specialist": "SPC",
    "intern": "INT",
    "chief": "CHF",
    "coding": "DEV",
  };
  const lower = role.toLowerCase();
  for (const [key, abbr] of Object.entries(abbrevs)) {
    if (lower.includes(key)) return abbr;
  }
  // Default: first 3 chars uppercase
  return role.slice(0, 3).toUpperCase();
};

export const AgentsSidebar = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onAddAgent,
  onInspectAgent,
  canAddAgent,
}: AgentsSidebarProps) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            ← Agents
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            {agents.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onAddAgent}
          disabled={!canAddAgent}
          title="Add Agent"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto py-1">
        {agents.map((agent) => {
          const statusBadge = getStatusBadge(agent.status);
          const roleAbbrev = abbreviateRole(agent.role || "");

          return (
            <div
              key={agent.id}
              className={cn(
                "group relative flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors",
                "hover:bg-muted/50",
                selectedAgentId === agent.id && "bg-muted"
              )}
              onClick={() => onSelectAgent(agent.id)}
              onMouseEnter={() => setHoveredId(agent.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <AgentAvatar
                  name={agent.name}
                  seed={agent.avatarSeed ?? agent.name}
                  size={36}
                />
              </div>

              {/* Name, role badge, and status */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {agent.name}
                  </span>
                  {roleAbbrev && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide",
                        getRoleBadgeColor(agent.role || "")
                      )}
                    >
                      {roleAbbrev}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {agent.role || "Agent"}
                  </span>
                  {statusBadge && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide",
                        statusBadge.color
                      )}
                    >
                      {statusBadge.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Inspect button - shows on hover */}
              {hoveredId === agent.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onInspectAgent(agent.id);
                  }}
                  title="Agent Settings"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}

              {/* Selected indicator */}
              {selectedAgentId === agent.id && (
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              )}
            </div>
          );
        })}

        {agents.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No agents yet.
            <br />
            <Button
              variant="link"
              className="mt-2 h-auto p-0"
              onClick={onAddAgent}
              disabled={!canAddAgent}
            >
              Add your first agent
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
