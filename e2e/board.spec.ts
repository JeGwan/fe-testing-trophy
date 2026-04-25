import { expect, test } from "@playwright/test";

// Each Playwright test gets a fresh browser context, so localStorage
// starts empty per test. The seed cards rendered by page.tsx are
// always present on first load.

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("adds a card via the column form and shows it in that column", async ({
  page,
}) => {
  const todo = page.getByRole("region", { name: "Todo column" });

  await todo.getByRole("button", { name: /add card/i }).click();
  await todo
    .getByRole("textbox", { name: /new card title/i })
    .fill("Plan E2E");
  await todo.getByRole("button", { name: "Add" }).click();

  await expect(todo.getByText("Plan E2E")).toBeVisible();
});

test("persists added card across a full page reload (the jsdom-uncatchable case)", async ({
  page,
}) => {
  const todo = page.getByRole("region", { name: "Todo column" });

  await todo.getByRole("button", { name: /add card/i }).click();
  await todo
    .getByRole("textbox", { name: /new card title/i })
    .fill("Survives reload");
  await todo.getByRole("button", { name: "Add" }).click();
  await expect(todo.getByText("Survives reload")).toBeVisible();

  await page.reload();

  // After a real browser reload, the localStorage write from the
  // previous step must have been flushed. The Board re-mounts, the
  // hydration effect reads localStorage, and the card reappears.
  const todoAfterReload = page.getByRole("region", { name: "Todo column" });
  await expect(todoAfterReload.getByText("Survives reload")).toBeVisible();
});
