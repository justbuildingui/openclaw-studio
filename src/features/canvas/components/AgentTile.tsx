import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentTile as AgentTileType, TileSize } from "@/features/canvas/state/store";
import { isTraceMarkdown } from "@/lib/text/extractThinking";
import { extractSummaryText } from "@/lib/text/summary";
import { normalizeAgentName } from "@/lib/names/agentNames";
import { MoreHorizontal, Send, Eye } from "lucide-react";
import { MAX_TILE_HEIGHT, MIN_TILE_SIZE } from "@/lib/canvasTileDefaults";
import { AgentAvatar } from "./AgentAvatar";

type AgentTileProps = {
  tile: AgentTileType;
  isSelected: boolean;
  canSend: boolean;
  onInspect: () => void;
  onNameChange: (name: string) => Promise<boolean>;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onAvatarShuffle: () => void;
  onNameShuffle: () => void;
  onResize?: (size: TileSize) => void;
  onResizeEnd?: (size: TileSize) => void;
};

export const AgentTile = ({
  tile,
  isSelected,
  canSend,
  onInspect,
  onNameChange,
  onDraftChange,
  onSend,
  onAvatarShuffle,
  onNameShuffle,
  onResize,
  onResizeEnd,
}: AgentTileProps) => {
  const [nameDraft, setNameDraft] = useState(tile.name);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeStateRef = useRef<{
    active: boolean;
    axis: "height" | "width";
    startX?: number;
    startY?: number;
    startWidth?: number;
    startHeight?: number;
  } | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const resizeSizeRef = useRef<TileSize>({
    width: tile.size.width,
    height: tile.size.height,
  });
  const resizeHandlersRef = useRef<{
    move: (event: PointerEvent) => void;
    stop: () => void;
  } | null>(null);

  const resizeDraft = useCallback(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.style.overflowY = el.scrollHeight > el.clientHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    setNameDraft(tile.name);
  }, [tile.name]);

  useEffect(() => {
    resizeDraft();
  }, [resizeDraft, tile.draft]);

  useEffect(() => {
    resizeSizeRef.current = {
      width: tile.size.width,
      height: tile.size.height,
    };
  }, [tile.size.height, tile.size.width]);

  const stopResize = useCallback(() => {
    if (!resizeStateRef.current?.active) return;
    resizeStateRef.current = null;
    if (resizeHandlersRef.current) {
      window.removeEventListener("pointermove", resizeHandlersRef.current.move);
      window.removeEventListener("pointerup", resizeHandlersRef.current.stop);
      window.removeEventListener("pointercancel", resizeHandlersRef.current.stop);
      resizeHandlersRef.current = null;
    }
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    if (onResizeEnd) {
      onResizeEnd(resizeSizeRef.current);
    }
  }, [onResizeEnd]);

  const scheduleResize = useCallback(
    (size: Partial<TileSize>) => {
      resizeSizeRef.current = {
        ...resizeSizeRef.current,
        ...size,
      };
      if (resizeFrameRef.current !== null) return;
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        onResize?.(resizeSizeRef.current);
      });
    },
    [onResize]
  );

  const startHeightResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!onResize) return;
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const startY = event.clientY;
      const startHeight = tile.size.height;
      resizeStateRef.current = {
        active: true,
        axis: "height",
        startY,
        startHeight,
      };
      document.body.style.cursor = "row-resize";
      document.body.style.userSelect = "none";
      const move = (moveEvent: PointerEvent) => {
        if (!resizeStateRef.current?.active) return;
        const delta = moveEvent.clientY - startY;
        const nextHeight = Math.min(
          MAX_TILE_HEIGHT,
          Math.max(MIN_TILE_SIZE.height, startHeight + delta)
        );
        scheduleResize({ height: nextHeight });
      };
      const stop = () => {
        stopResize();
      };
      resizeHandlersRef.current = { move, stop };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    [onResize, scheduleResize, stopResize, tile.size.height]
  );

  const startWidthResize = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!onResize) return;
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startWidth = tile.size.width;
      resizeStateRef.current = {
        active: true,
        axis: "width",
        startX,
        startWidth,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const move = (moveEvent: PointerEvent) => {
        if (!resizeStateRef.current?.active) return;
        const delta = moveEvent.clientX - startX;
        const nextWidth = Math.max(MIN_TILE_SIZE.width, startWidth + delta);
        scheduleResize({ width: nextWidth });
      };
      const stop = () => {
        stopResize();
      };
      resizeHandlersRef.current = { move, stop };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    [onResize, scheduleResize, stopResize, tile.size.width]
  );

  useEffect(() => {
    return () => stopResize();
  }, [stopResize]);

  const commitName = async () => {
    const next = normalizeAgentName(nameDraft);
    if (!next) {
      setNameDraft(tile.name);
      return;
    }
    if (next === tile.name) {
      return;
    }
    const ok = await onNameChange(next);
    if (!ok) {
      setNameDraft(tile.name);
      return;
    }
    setNameDraft(next);
  };

  const statusConfig = {
    running: {
      dot: "bg-primary",
      label: "Running",
      badge: "status-running",
    },
    error: {
      dot: "bg-destructive",
      label: "Error",
      badge: "status-error",
    },
    idle: {
      dot: "bg-muted-foreground/40",
      label: "Idle",
      badge: "status-idle",
    },
  };

  const status = statusConfig[tile.status] || statusConfig.idle;

  const latestUpdate = (() => {
    const lastResult = tile.lastResult?.trim();
    if (lastResult) return lastResult;
    for (let index = tile.outputLines.length - 1; index >= 0; index -= 1) {
      const line = tile.outputLines[index];
      if (!line) continue;
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (isTraceMarkdown(trimmed)) continue;
      if (trimmed.startsWith(">")) continue;
      return trimmed;
    }
    const latestPreview = tile.latestPreview?.trim();
    if (latestPreview) return latestPreview;
    return "Waiting for activity...";
  })();

  const latestSummary =
    latestUpdate === "Waiting for activity..."
      ? latestUpdate
      : extractSummaryText(latestUpdate);

  const avatarSeed = tile.avatarSeed ?? tile.agentId;
  const resizeHandleClass = isSelected
    ? "pointer-events-auto opacity-100"
    : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100";

  return (
    <div data-tile className="group relative flex h-full w-full flex-col">
      {/* Card container */}
      <div className={`
        flex flex-1 flex-col rounded-xl border bg-card
        transition-shadow duration-200
        ${isSelected 
          ? "border-primary/50 shadow-lg ring-1 ring-primary/20" 
          : "border-border shadow-sm hover:shadow-md"
        }
      `}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div data-drag-handle className="cursor-grab active:cursor-grabbing">
              <AgentAvatar
                seed={avatarSeed}
                name={tile.name}
                size={36}
                isSelected={isSelected}
              />
            </div>
            <div className="flex flex-col">
              <input
                className="bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => void commitName()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    setNameDraft(tile.name);
                    event.currentTarget.blur();
                  }
                }}
              />
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                <span className="text-xs text-muted-foreground">{status.label}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              className="nodrag flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="button"
              aria-label="Inspect agent"
              data-testid="agent-inspect-toggle"
              onClick={onInspect}
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              className="nodrag flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="button"
              aria-label="More options"
              onClick={(e) => {
                e.stopPropagation();
                // Toggle between avatar and name shuffle on click
                onAvatarShuffle();
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 flex-col gap-3 p-4">
          {/* Latest update */}
          <div className="flex-1 overflow-hidden">
            <p className="text-overline mb-2">Latest update</p>
            <p className="line-clamp-4 text-sm text-foreground/80 leading-relaxed">
              {latestSummary}
            </p>
          </div>

          {/* Input area */}
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={draftRef}
                rows={1}
                className="input max-h-24 min-h-[42px] resize-none pr-10"
                value={tile.draft}
                onChange={(event) => {
                  onDraftChange(event.target.value);
                  resizeDraft();
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  if (!canSend || tile.status === "running") return;
                  const message = tile.draft.trim();
                  if (!message) return;
                  onSend(message);
                }}
                placeholder="Send a message..."
              />
              <button
                className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
                type="button"
                onClick={() => onSend(tile.draft)}
                disabled={!canSend || tile.status === "running" || !tile.draft.trim()}
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Resize handles */}
      <button
        type="button"
        aria-label="Resize tile height"
        className={`nodrag absolute -bottom-1.5 left-8 right-8 flex h-3 cursor-row-resize touch-none items-center justify-center transition-opacity ${resizeHandleClass}`}
        onPointerDown={startHeightResize}
      >
        <span className="h-1 w-12 rounded-full bg-border" />
      </button>
      <button
        type="button"
        aria-label="Resize tile width"
        className={`nodrag absolute -right-1.5 top-8 bottom-8 flex w-3 cursor-col-resize touch-none items-center justify-center transition-opacity ${resizeHandleClass}`}
        onPointerDown={startWidthResize}
      >
        <span className="h-12 w-1 rounded-full bg-border" />
      </button>
    </div>
  );
};
