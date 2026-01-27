import type { AgentTile, CanvasTransform } from "@/features/canvas/state/store";

type Point = { x: number; y: number };
type Size = { width: number; height: number };

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;

export const clampZoom = (zoom: number): number => {
  if (zoom < MIN_ZOOM) return MIN_ZOOM;
  if (zoom > MAX_ZOOM) return MAX_ZOOM;
  return zoom;
};

export const screenToWorld = (transform: CanvasTransform, screen: Point): Point => {
  return {
    x: (screen.x - transform.offsetX) / transform.zoom,
    y: (screen.y - transform.offsetY) / transform.zoom,
  };
};

export const worldToScreen = (transform: CanvasTransform, world: Point): Point => {
  return {
    x: transform.offsetX + world.x * transform.zoom,
    y: transform.offsetY + world.y * transform.zoom,
  };
};

export const zoomAtScreenPoint = (
  transform: CanvasTransform,
  nextZoomRaw: number,
  screenPoint: Point
): CanvasTransform => {
  const worldPoint = screenToWorld(transform, screenPoint);
  const nextZoom = clampZoom(nextZoomRaw);

  return {
    zoom: nextZoom,
    offsetX: screenPoint.x - worldPoint.x * nextZoom,
    offsetY: screenPoint.y - worldPoint.y * nextZoom,
  };
};

export const zoomToFit = (
  tiles: AgentTile[],
  viewportSize: Size,
  paddingPx: number,
  currentTransform: CanvasTransform
): CanvasTransform => {
  if (tiles.length === 0) return currentTransform;

  const minX = Math.min(...tiles.map((tile) => tile.position.x));
  const minY = Math.min(...tiles.map((tile) => tile.position.y));
  const maxX = Math.max(
    ...tiles.map((tile) => tile.position.x + tile.size.width)
  );
  const maxY = Math.max(
    ...tiles.map((tile) => tile.position.y + tile.size.height)
  );

  const boundsWidth = Math.max(1, maxX - minX);
  const boundsHeight = Math.max(1, maxY - minY);
  const availableWidth = Math.max(1, viewportSize.width - paddingPx * 2);
  const availableHeight = Math.max(1, viewportSize.height - paddingPx * 2);

  const nextZoom = clampZoom(
    Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight)
  );
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    zoom: nextZoom,
    offsetX: viewportSize.width / 2 - centerX * nextZoom,
    offsetY: viewportSize.height / 2 - centerY * nextZoom,
  };
};
