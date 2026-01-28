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
          size: { width: 420, height: 520 },
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

test("new agent tile shows avatar and input without transcript", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByAltText("Avatar for Agent A")).toBeVisible();
  await expect(page.getByPlaceholder("Send a command")).toBeVisible();
  await expect(page.locator("[data-testid='agent-transcript']")).toHaveCount(0);

  await page.locator("[data-tile]").click({ force: true });
  await page.getByTestId("agent-options-toggle").dispatchEvent("click");
  await expect(page.getByText("Model")).toBeVisible();
  await expect(page.getByText("Thinking")).toBeVisible();
});
