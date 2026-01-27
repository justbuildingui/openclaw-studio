import { expect, test } from "@playwright/test";

const store = {
  version: 2,
  activeProjectId: "project-1",
  projects: [
    {
      id: "project-1",
      name: "Demo Workspace",
      repoPath: "/Users/demo",
      createdAt: 1,
      updatedAt: 1,
      tiles: [
        {
          id: "tile-1",
          name: "Agent A",
          agentId: "agent-1",
          role: "coding",
          sessionKey: "agent:agent-1:main",
          model: null,
          thinkingLevel: "low",
          position: { x: 400, y: 300 },
          size: { width: 560, height: 440 },
        },
      ],
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/projects", async (route, request) => {
    if (request.method() !== "GET" && request.method() !== "PUT") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(store),
    });
  });
});

test("wheel zoom updates zoom readout", async ({ page }) => {
  await page.goto("/");

  const viewport = page.locator("[data-canvas-viewport]");
  await expect(viewport).toBeVisible();

  const zoomReadout = page.locator("[data-zoom-readout]");
  await expect(zoomReadout).toBeVisible();
  const beforeText = (await zoomReadout.textContent()) ?? "";

  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  const clientX = box!.x + box!.width / 2;
  const clientY = box!.y + box!.height / 2;

  await page.dispatchEvent("[data-canvas-viewport]", "wheel", {
    deltaY: 120,
    deltaMode: 1,
    clientX,
    clientY,
  });

  await expect(zoomReadout).not.toHaveText(beforeText);
});

test("wheel changes tile bounds on the canvas", async ({ page }) => {
  await page.goto("/");

  const viewport = page.locator("[data-canvas-viewport]");
  await expect(viewport).toBeVisible();

  const tile = page.locator("[data-tile]");
  await expect(tile).toBeVisible();

  const beforeBox = await tile.boundingBox();
  expect(beforeBox).not.toBeNull();
  const beforeWidth = beforeBox!.width;

  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  const clientX = viewportBox!.x + viewportBox!.width / 2;
  const clientY = viewportBox!.y + viewportBox!.height / 2;

  await page.dispatchEvent("[data-canvas-viewport]", "wheel", {
    deltaY: 120,
    deltaMode: 1,
    clientX,
    clientY,
  });

  await page.waitForFunction(
    ({ selector, previousWidth }) => {
      const el = document.querySelector(selector);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return Math.abs(rect.width - previousWidth) > 0.5;
    },
    { selector: "[data-tile]", previousWidth: beforeWidth }
  );
});
