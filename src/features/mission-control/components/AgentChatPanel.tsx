"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentTile } from "@/features/canvas/state/store";
import { AgentAvatar } from "@/features/canvas/components/AgentAvatar";
import { Button } from "@/components/ui/button";
import { X, Send, FileText, Settings, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentChatPanelProps = {
  tile: AgentTile;
  onClose: () => void;
  onSend: (message: string) => void;
  onOpenFiles: () => void;
  onOpenSettings: () => void;
  canSend: boolean;
};

export const AgentChatPanel = ({
  tile,
  onClose,
  onSend,
  onOpenFiles,
  onOpenSettings,
  canSend,
}: AgentChatPanelProps) => {
  const [draft, setDraft] = useState(tile.draft || "");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when output changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [tile.outputLines.length, tile.streamText]);

  // Sync draft with tile
  useEffect(() => {
    setDraft(tile.draft || "");
  }, [tile.draft]);

  const handleSubmit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || !canSend) return;
    onSend(trimmed);
    setDraft("");
    inputRef.current?.focus();
  }, [draft, canSend, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const isRunning = tile.status === "running";

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <AgentAvatar
            name={tile.name}
            seed={tile.avatarSeed ?? tile.name}
            size={32}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{tile.name}</span>
              {isRunning && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {tile.role || "Agent"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onOpenFiles}
            title="View Files"
          >
            <FileText className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onOpenSettings}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chat output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm"
      >
        {tile.outputLines.length === 0 && !tile.streamText ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            No messages yet. Send an instruction to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {tile.outputLines.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  line.startsWith(">") && "text-muted-foreground"
                )}
              >
                {line}
              </div>
            ))}
            {tile.streamText && (
              <div className="whitespace-pre-wrap break-words text-foreground/80">
                {tile.streamText}
                <span className="animate-pulse">▌</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${tile.name}...`}
            disabled={!canSend}
            className={cn(
              "flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm",
              "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
            rows={3}
          />
          <Button
            className="self-end"
            onClick={handleSubmit}
            disabled={!canSend || !draft.trim()}
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};
