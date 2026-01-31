import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import { ThemeToggle } from "@/components/theme-toggle";
import { Plus, Settings, ChevronDown, Trash2, MessageSquarePlus } from "lucide-react";

type HeaderBarProps = {
  workspaceLabel: string;
  workspacePath: string | null;
  hasArchivedTiles: boolean;
  status: GatewayStatus;
  showArchived: boolean;
  onToggleArchived: () => void;
  onNewAgent: () => void;
  canCreateAgent: boolean;
  onWorkspaceSettings: () => void;
  onCreateDiscordChannel: () => void;
  canCreateDiscordChannel: boolean;
  onCleanupArchived: () => void;
  canCleanupArchived: boolean;
};

const statusConfig: Record<GatewayStatus, { dot: string; label: string }> = {
  disconnected: { dot: "bg-destructive", label: "Disconnected" },
  connecting: { dot: "bg-warning", label: "Connecting" },
  connected: { dot: "bg-primary", label: "Connected" },
};

export const HeaderBar = ({
  workspaceLabel,
  workspacePath,
  hasArchivedTiles,
  status,
  showArchived,
  onToggleArchived,
  onNewAgent,
  canCreateAgent,
  onWorkspaceSettings,
  onCreateDiscordChannel,
  canCreateDiscordChannel,
  onCleanupArchived,
  canCleanupArchived,
}: HeaderBarProps) => {
  const hasActions = canCleanupArchived || canCreateDiscordChannel;
  const statusInfo = statusConfig[status];

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - workspace info */}
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-sm font-semibold text-foreground">
              {workspaceLabel}
            </h1>
            {workspacePath && (
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                {workspacePath}
              </p>
            )}
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5">
            <span
              className={`h-2 w-2 rounded-full ${statusInfo.dot}`}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-muted-foreground">
              {statusInfo.label}
            </span>
          </div>

          {/* Archived toggle */}
          {hasArchivedTiles && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={onToggleArchived}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
              />
              <span className="text-xs font-medium text-muted-foreground">
                Show archived
              </span>
            </label>
          )}
        </div>

        {/* Right side - actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          <button
            className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            type="button"
            onClick={onWorkspaceSettings}
            data-testid="workspace-settings-toggle"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>

          {hasActions && (
            <details className="relative">
              <summary className="btn-secondary flex items-center gap-2 rounded-lg px-3 py-2 text-sm list-none [&::-webkit-details-marker]:hidden cursor-pointer">
                Actions
                <ChevronDown className="h-3.5 w-3.5" />
              </summary>
              <div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                {canCleanupArchived && (
                  <button
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    type="button"
                    onClick={(event) => {
                      onCleanupArchived();
                      const details = event.currentTarget.closest("details") as HTMLDetailsElement | null;
                      if (details) details.open = false;
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                    Clean archived agents
                  </button>
                )}
                {canCreateDiscordChannel && (
                  <button
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
                    type="button"
                    onClick={(event) => {
                      onCreateDiscordChannel();
                      const details = event.currentTarget.closest("details") as HTMLDetailsElement | null;
                      if (details) details.open = false;
                    }}
                  >
                    <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                    Create Discord channel
                  </button>
                )}
              </div>
            </details>
          )}

          <button
            className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm disabled:opacity-50"
            type="button"
            onClick={onNewAgent}
            disabled={!canCreateAgent}
          >
            <Plus className="h-4 w-4" />
            New Agent
          </button>
        </div>
      </div>
    </header>
  );
};
