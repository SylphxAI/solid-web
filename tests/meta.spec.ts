import { expect, test } from "@playwright/test";
import { createServer } from "vite";
import solid from "vite-plugin-solid";

let renderDocument: typeof import("./meta.server").renderDocument;
let testServer: Awaited<ReturnType<typeof createServer>> | undefined;

test.beforeAll(async () => {
  const server = await createServer({
    configFile: false,
    plugins: [solid({ ssr: true })],
    server: { middlewareMode: true, watch: null, ws: false },
  });
  try {
    ({ renderDocument } = await server.ssrLoadModule("/tests/meta.server.ts"));
    testServer = server;
  } catch (error) {
    await server.close();
    throw error;
  }
});

test.afterAll(async () => { await testServer?.close(); });

const en = "https://example.test/en/info?ref=one&format=two";
const zh = "https://example.test/zh-tw/info";
const reciprocal = [["alternate", en, "en"], ["alternate", zh, "zh-TW"]];

for (const [locale, canonical] of [["en", en], ["zh-TW", zh]] as const) {
  test(`PageMeta emits and hydrates the final ${locale} head after Suspense replay`, async ({ page, baseURL }) => {
    const html = await renderDocument(locale);
    const head = html.slice(html.indexOf("<head"), html.indexOf("</head>"));
    expect(head.match(/rel="canonical"/g)).toHaveLength(1);
    expect(head.match(/rel="alternate"/g)).toHaveLength(2);
    expect(head).not.toContain("/pending");
    expect(head).not.toContain('name="temporary"');
    if (locale === "en") {
      expect(head).toContain("Updates &lt;notes> &amp; details");
      expect(head).toContain("&quot;quoted&quot; note &amp; ");
      expect(head).toContain("?ref=one&amp;format=two");
    }

    const errors: Error[] = [];
    page.on("pageerror", error => errors.push(error));
    await page.route(new URL("/meta-ssr-fixture", baseURL).href, route => route.fulfill({ contentType: "text/html; charset=utf-8", body: html }));
    await page.goto("/meta-ssr-fixture");
    const links = page.locator("head link");
    const readLinks = () => links.evaluateAll(nodes => nodes.map(node => ["rel", "href", "hreflang"].map(attr => node.getAttribute(attr))));
    expect(await readLinks()).toEqual([["canonical", canonical, null], ...reciprocal]);
    const original = await page.locator('head link[rel="canonical"]').elementHandle();
    await page.addScriptTag({ type: "module", url: "/tests/meta.client.tsx" });
    await expect(page.locator("head [data-page-meta]")).toHaveCount(0);
    expect(await original?.evaluate(node => node === document.head.querySelector('link[rel="canonical"]'))).toBe(true);
    expect(await page.locator('head meta[name="unrelated"]').count()).toBe(1);
    expect(await readLinks()).toEqual([["canonical", canonical, null], ...reciprocal]);
    if (locale === "en") {
      await expect(page).toHaveTitle("Updates <notes> & details");
      await expect(page.locator('head meta[property="og:description"]')).toHaveAttribute("content", 'A "quoted" note & <sample>');
      const descriptors = page.locator('head meta[property="og:description"], head meta[name="description"]');
      expect(await descriptors.evaluateAll(nodes => nodes.map(node => node.getAttribute("content")))).toEqual([
        'A "quoted" note & <sample>', "Public information", "Public information",
      ]);
    } else {
      await expect(page).toHaveTitle("最新消息");
    }
    await page.getByRole("button", { name: "Reorder" }).click();
    await expect.poll(readLinks).toEqual([reciprocal[1], reciprocal[0], ["canonical", canonical, null]]);
    await page.getByRole("button", { name: "Hide metadata" }).click();
    await expect(links).toHaveCount(0);
    await expect(page.locator("head title")).toHaveCount(0);
    await expect(page.locator('head meta[property], head meta[name="description"]')).toHaveCount(0);
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute("content", "noindex");
    await page.getByRole("button", { name: "Unmount metadata" }).click();
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
    await expect(page.locator('head meta[name="unrelated"]')).toHaveAttribute("content", "preserve");
    await expect(page.locator("head meta[charset]")).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}

test("caller-supplied noindex emits no implicit title, canonical or alternates", async () => {
  const html = await renderDocument("hidden");
  const head = html.slice(html.indexOf("<head"), html.indexOf("</head>"));
  expect(head).toContain('name="robots" content="noindex"');
  expect(head).not.toMatch(/<title|<link|hreflang/);
});
