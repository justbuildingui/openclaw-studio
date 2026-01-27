import { describe, expect, it } from "vitest";

import {
  clampZoom,
  screenToWorld,
  worldToScreen,
  zoomAtScreenPoint,
} from "@/features/canvas/lib/transform";

describe("canvas transform math", () => {
  it("round-trips screen/world coordinates", () => {
    const transform = { zoom: 1.5, offsetX: 120, offsetY: -80 };
    const world = { x: 300, y: -200 };

    const screen = worldToScreen(transform, world);
    const roundTrip = screenToWorld(transform, screen);

    expect(roundTrip.x).toBeCloseTo(world.x, 6);
    expect(roundTrip.y).toBeCloseTo(world.y, 6);
  });

  it("keeps the world point under the cursor pinned during zoom", () => {
    const transform = { zoom: 1, offsetX: 50, offsetY: 25 };
    const screenPoint = { x: 200, y: 150 };
    const worldPoint = screenToWorld(transform, screenPoint);

    const next = zoomAtScreenPoint(transform, 2, screenPoint);
    const nextScreenPoint = worldToScreen(next, worldPoint);

    expect(nextScreenPoint.x).toBeCloseTo(screenPoint.x, 6);
    expect(nextScreenPoint.y).toBeCloseTo(screenPoint.y, 6);
  });

  it("clamps zoom within the allowed range", () => {
    expect(clampZoom(0.1)).toBeCloseTo(0.25, 6);
    expect(clampZoom(5)).toBeCloseTo(3, 6);
    expect(clampZoom(1.2)).toBeCloseTo(1.2, 6);
  });
});
