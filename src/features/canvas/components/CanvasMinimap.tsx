import type React from "react";
import { useCallback, useMemo, useRef } from "react";
import type { AgentTile, CanvasTransform } from "@/features/canvas/state/store";

type CanvasMinimapProps = {
  tiles: AgentTile[];
  transform: CanvasTransform;
  viewportSize: { width: number; height: number };
  onUpdateTransform: (patch: Partial<CanvasTransform>) => void;
};

export const CanvasMinimap = ({
  tiles,
  transform,
  viewportSize,
  onUpdateTransform,
}: CanvasMinimapProps) => {
  const draggingRef = useRef(false);

  const bounds = useMemo(() => {
    if (tiles.length === 0) return null;
    const minX = Math.min(...tiles.map((tile) => tile.position.x));
    const minY = Math.min(...tiles.map((tile) => tile.position.y));
    const maxX = Math.max(
      ...tiles.map((tile) => tile.position.x + tile.size.width)
    );
    const maxY = Math.max(
      ...tiles.map((tile) => tile.position.y + tile.size.height)
    );
    const padding = 160;
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }, [tiles]);

  const viewportWorld = useMemo(() => {
    return {
      x: -transform.offsetX / transform.zoom,
      y: -transform.offsetY / transform.zoom,
      width: viewportSize.width / transform.zoom,
      height: viewportSize.height / transform.zoom,
    };
  }, [transform.offsetX, transform.offsetY, transform.zoom, viewportSize]);

  const updateFromEvent = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!bounds) return;
      if (viewportSize.width === 0 || viewportSize.height === 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ratioX = (event.clientX - rect.left) / rect.width;
      const ratioY = (event.clientY - rect.top) / rect.height;
      const worldX = bounds.minX + bounds.width * ratioX;
      const worldY = bounds.minY + bounds.height * ratioY;
      onUpdateTransform({
        offsetX: viewportSize.width / 2 - worldX * transform.zoom,
        offsetY: viewportSize.height / 2 - worldY * transform.zoom,
      });
    },
    [bounds, onUpdateTransform, transform.zoom, viewportSize]
  );

  if (!bounds || viewportSize.width === 0 || viewportSize.height === 0) return null;

  return (
    <div className="pointer-events-auto absolute bottom-6 right-6 w-56 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-lg backdrop-blur">
      <svg
        className="h-36 w-full"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        onPointerDown={(event) => {
          draggingRef.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateFromEvent(event);
        }}
        onPointerMove={(event) => {
          if (!draggingRef.current) return;
          updateFromEvent(event);
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerLeave={() => {
          draggingRef.current = false;
        }}
      >
        {tiles.map((tile) => (
          <rect
            key={tile.id}
            x={tile.position.x}
            y={tile.position.y}
            width={tile.size.width}
            height={tile.size.height}
            fill="rgba(148, 163, 184, 0.55)"
            stroke="rgb(100, 116, 139)"
            strokeWidth={6}
          />
        ))}
        <rect
          x={viewportWorld.x}
          y={viewportWorld.y}
          width={viewportWorld.width}
          height={viewportWorld.height}
          fill="rgba(59, 130, 246, 0.12)"
          stroke="rgb(59, 130, 246)"
          strokeWidth={8}
        />
      </svg>
    </div>
  );
};
