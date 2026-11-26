import { expect, test, type Page } from "@playwright/test";
import { renderToString } from "solid-js/web";
import { createServer } from "vite";
import solid from "vite-plugin-solid";

const fixture = "/tests/consent.fixture.html";
const dock = (page: Page) => page.getByRole("region", { name: "Available choices" });
const accept = (page: Page) => page.getByRole("button", { name: "Accept option" });
const reject = (page: Page) => page.getByRole("button", { name: "Reject option" });
const reopen = (page: Page) => page.getByRole("button", { name: "Open choices" });
const clearance = (page: Page) => page.locator("#scope").evaluate(node => ({
  own: Number.parseFloat(node.style.getPropertyValue("--consent-dock-space")) || 0,
  total: Number.parseFloat(getComputedStyle(node).paddingBlockEnd),
  scroll: Number.parseFloat(getComputedStyle(node).scrollPaddingBlockEnd),
}));

test("SSR renders open and closed without touching browser-only ports", async () => {
  const server = await createServer({ configFile: false, plugins: [solid()],
    server: { middlewareMode: true, ws: false }, optimizeDeps: { noDiscovery: true }, appType: "custom" });
  try {
    const { ConsentDock } = await server.ssrLoadModule("/src/consent.tsx");
    const notOnServer = () => { throw new Error("Client-only port called on server"); };
    const props = { focusOnOpen: true, clearanceScope: notOnServer, returnFocusTo: notOnServer,
      label: "Available choices", acceptLabel: "<Example>", rejectLabel: "Skip",
      onAccept: notOnServer, onReject: notOnServer };
    expect(renderToString(() => ConsentDock({ ...props, open: false }))).toBe("");
    const markup = renderToString(() => ConsentDock({ ...props, open: true }));
    expect(markup).toContain('aria-label="Available choices"');
    expect(markup).toContain('type="button">&lt;Example>');
    expect(markup).toContain('type="button">Skip');
  } finally {
    await server.close();
  }
});

for (const width of [390, 1440]) {
  test(`nonmodal clearance and equally prominent choices at ${width}px under CSP`, async ({ page }, info) => {
    const violations: string[] = [];
    page.on("console", message => {
      if (message.type() === "error" && /Content Security Policy/i.test(message.text())) violations.push(message.text());
    });
    await page.setViewportSize({ width, height: 800 });
    await page.goto(fixture);
    await expect(dock(page)).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement === document.body)).toBe(true);
    const a = (await accept(page).boundingBox())!;
    const b = (await reject(page).boundingBox())!;
    const panel = (await dock(page).boundingBox())!;
    const bar = (await page.locator(".fixture-tabs").boundingBox())!;
    expect(panel.y + panel.height).toBeCloseTo(bar.y, 1);
    expect([a.width, a.height, a.y]).toEqual([b.width, b.height, b.y]);
    expect(a.width).toBeGreaterThanOrEqual(44);
    expect(a.height).toBeGreaterThanOrEqual(44);
    const emphasis = (element: Element) => {
      const { backgroundColor, color, font, border, opacity } = getComputedStyle(element);
      return [backgroundColor, color, font, border, opacity];
    };
    expect(await accept(page).evaluate(emphasis)).toEqual(await reject(page).evaluate(emphasis));
    await expect.poll(() => clearance(page)).toEqual({ own: panel.height, total: panel.height + 48, scroll: panel.height + 48 });
    await page.locator("#scope").evaluate(node => { node.scrollTop = node.scrollHeight; });
    const last = (await page.getByRole("button", { name: "Last page action" }).boundingBox())!;
    expect(last.y + last.height).toBeLessThanOrEqual(panel.y);
    await expect(page.locator("html[style], body[style]")).toHaveCount(0);
    expect(violations).toEqual([]);
    // Negative control: verify the policy blocks an unnonced script and inline CSS.
    if (width === 390) {
      expect(await page.evaluate(() => new Promise<string[]>(resolve => {
        const blocked: string[] = [];
        document.addEventListener("securitypolicyviolation", event => {
          blocked.push(event.effectiveDirective);
          if (blocked.length === 2) resolve(blocked.sort());
        });
        const script = document.createElement("script");
        script.textContent = "document.body.dataset.unexpected = 'true'";
        document.head.append(script);
        document.body.setAttribute("style", "padding: 345px");
      }))).toEqual(["script-src-elem", "style-src-attr"]);
      await expect(page.locator("body")).not.toHaveAttribute("data-unexpected");
    }
    await page.locator("#scope").evaluate(node => { node.scrollTop = 0; });
    await info.attach(`dock-${width}`, { body: await page.screenshot(), contentType: "image/png" });
  });
}

test("keyboard can traverse the dock, choose, and reopen with focus", async ({ page }) => {
  await page.goto(fixture);
  await page.keyboard.press("Tab");
  await expect(reopen(page)).toBeFocused();
  for (const label of ["Expand text", "Unmount dock", "Last page action", "Read details", "Accept option", "Reject option", "After choices"]) {
    await page.keyboard.press("Tab");
    await expect(page.getByRole(label === "Read details" ? "link" : "button", { name: label })).toBeFocused();
  }
  await page.keyboard.press("Shift+Tab");
  await expect(reject(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Result")).toHaveText("Rejected");
  await expect(dock(page)).toHaveCount(0);
  await expect(reopen(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dock(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Read details" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Result")).toHaveText("Accepted");
  await expect(reopen(page)).toBeFocused();
  await expect.poll(() => clearance(page)).toEqual({ own: 0, total: 48, scroll: 48 });
});

test.describe("touch", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("real safe-area geometry, ResizeObserver updates, touch choices and unmount cleanup", async ({ page, context }) => {
    await page.goto(fixture);
    const cdp = await context.newCDPSession(page);
    const initial = (await dock(page).boundingBox())!.height;
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom: 80, left: 24, right: 28 } });
    await expect.poll(() => clearance(page)).toEqual({ own: initial + 32, total: initial + 80, scroll: initial + 80 });
    await expect(dock(page)).toHaveCSS("padding-left", "24px");
    await expect(dock(page)).toHaveCSS("padding-right", "28px");
    const before = await clearance(page);
    await page.getByRole("button", { name: "Expand text" }).tap();
    await expect.poll(async () => (await clearance(page)).own).toBeGreaterThan(before.own);
    const enlarged = (await dock(page).boundingBox())!.height;
    await expect.poll(() => clearance(page)).toEqual({ own: enlarged, total: enlarged + 48, scroll: enlarged + 48 });
    expect((await accept(page).boundingBox())!.y + (await accept(page).boundingBox())!.height).toBeLessThanOrEqual(844 - 80);
    await accept(page).tap();
    await expect(page.getByLabel("Result")).toHaveText("Accepted");
    await expect(reopen(page)).toBeFocused();
    await expect.poll(() => clearance(page)).toEqual({ own: 0, total: 48, scroll: 48 });
    await reopen(page).tap();
    await expect(dock(page)).toBeFocused();
    const unmount = page.getByRole("button", { name: "Unmount dock" });
    await unmount.tap();
    await expect(dock(page)).toHaveCount(0);
    await expect(unmount).toBeFocused();
    await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom: 100 } });
    await expect.poll(() => clearance(page)).toEqual({ own: 0, total: 48, scroll: 48 });
    await expect(page.locator("#scope")).not.toHaveAttribute("style", /--consent-dock-space/);
  });
});
