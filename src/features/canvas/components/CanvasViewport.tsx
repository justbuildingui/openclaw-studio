import type React from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { AgentTile, CanvasTransform, TilePosition, TileSize } from "@/features/canvas/state/store";
import { zoomAtScreenPoint } from "@/features/canvas/lib/transform";
import { AgentTile as AgentTileComponent } from "./AgentTile";

type CanvasViewportProps = {
  tiles: AgentTile[];
  transform: CanvasTransform;
  viewportRef?: React.MutableRefObject<HTMLDivElement | null>;
  selectedTileId: string | null;
  canSend: boolean;
  onSelectTile: (id: string | null) => void;
  onMoveTile: (id: string, position: TilePosition) => void;
  onResizeTile: (id: string, size: TileSize) => void;
  onDeleteTile: (id: string) => void;
  onRenameTile: (id: string, name: string) => Promise<boolean>;
  onDraftChange: (id: string, value: string) => void;
  onSend: (id: string, sessionKey: string, message: string) => void;
  onModelChange: (id: string, sessionKey: string, value: string | null) => void;
  onThinkingChange: (id: string, sessionKey: string, value: string | null) => void;
  onUpdateTransform: (patch: Partial<CanvasTransform>) => void;
};

const ZOOM_SENSITIVITY = 0.002;

export const CanvasViewport = ({
  tiles,
  transform,
  viewportRef: externalViewportRef,
  selectedTileId,
  canSend,
  onSelectTile,
  onMoveTile,
  onResizeTile,
  onDeleteTile,
  onRenameTile,
  onDraftChange,
  onSend,
  onModelChange,
  onThinkingChange,
  onUpdateTransform,
}: CanvasViewportProps) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const transformRef = useRef(transform);
  const pendingTransformRef = useRef<CanvasTransform | null>(null);
  const rafRef = useRef<number | null>(null);
  const panState = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    active: boolean;
  }>({ startX: 0, startY: 0, originX: 0, originY: 0, active: false });

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  const scheduleTransform = useCallback(
    (nextTransform: CanvasTransform) => {
      pendingTransformRef.current = nextTransform;
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingTransformRef.current;
        if (!pending) return;
        pendingTransformRef.current = null;
        onUpdateTransform(pending);
      });
    },
    [onUpdateTransform]
  );

  const setViewportRef = useCallback(
    (node: HTMLDivElement | null) => {
      viewportRef.current = node;
      if (externalViewportRef) {
        externalViewportRef.current = node;
      }
    },
    [externalViewportRef]
  );

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;

    const handleWheel = (event: WheelEvent) => {
      const rect = node.getBoundingClientRect();
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      const baseTransform = pendingTransformRef.current ?? transformRef.current;
      const isZoom =
        event.ctrlKey || event.deltaMode === WheelEvent.DOM_DELTA_LINE;

      event.preventDefault();

      if (isZoom) {
        const scaleFactor =
          event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 20 : 1;
        const delta = event.deltaY * scaleFactor;
        const nextZoom = baseTransform.zoom * Math.exp(-delta * ZOOM_SENSITIVITY);
        scheduleTransform(zoomAtScreenPoint(baseTransform, nextZoom, screenPoint));
        return;
      }

      scheduleTransform({
        ...baseTransform,
        offsetX: baseTransform.offsetX - event.deltaX,
        offsetY: baseTransform.offsetY - event.deltaY,
      });
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, [scheduleTransform]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-tile]")) {
        return;
      }
      onSelectTile(null);
      const baseTransform = pendingTransformRef.current ?? transformRef.current;
      panState.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: baseTransform.offsetX,
        originY: baseTransform.offsetY,
        active: true,
      };
      const handleMove = (moveEvent: PointerEvent) => {
        if (!panState.current.active) return;
        const dx = moveEvent.clientX - panState.current.startX;
        const dy = moveEvent.clientY - panState.current.startY;
        scheduleTransform({
          ...transformRef.current,
          offsetX: panState.current.originX + dx,
          offsetY: panState.current.originY + dy,
        });
      };
      const handleUp = () => {
        panState.current.active = false;
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [onSelectTile, scheduleTransform]
  );

  const scaledStyle = useMemo(() => {
    return {
      transform: `translate(${transform.offsetX}px, ${transform.offsetY}px) scale(${transform.zoom})`,
      transformOrigin: "0 0",
    } as const;
  }, [transform.offsetX, transform.offsetY, transform.zoom]);

  return (
    <div
      ref={setViewportRef}
      className="canvas-surface relative h-full w-full overflow-hidden"
      data-canvas-viewport
      onPointerDown={handlePointerDown}
    >
      <div className="canvas-content absolute inset-0" style={scaledStyle}>
        {tiles.map((tile) => (
          <AgentTileComponent
            key={`${tile.id}-${tile.name}`}
            tile={tile}
            zoom={transform.zoom}
            isSelected={tile.id === selectedTileId}
            canSend={canSend}
            onSelect={() => onSelectTile(tile.id)}
            onMove={(position) => onMoveTile(tile.id, position)}
            onResize={(size) => onResizeTile(tile.id, size)}
            onDelete={() => onDeleteTile(tile.id)}
            onNameChange={(name) => onRenameTile(tile.id, name)}
            onDraftChange={(value) => onDraftChange(tile.id, value)}
            onSend={(message) => onSend(tile.id, tile.sessionKey, message)}
            onModelChange={(value) => onModelChange(tile.id, tile.sessionKey, value)}
            onThinkingChange={(value) => onThinkingChange(tile.id, tile.sessionKey, value)}
          />
        ))}
      </div>
    </div>
  );
};
