import { createComponent } from "solid-js";
import { HydrationScript, renderToStringAsync, ssr } from "solid-js/web";
import { HiddenFixture, MetaFixture } from "./meta.fixture";

export function renderDocument(locale: "en" | "zh-TW" | "hidden") {
  // Keep the document shell outside the hydrated subtree's component/element IDs.
  return renderToStringAsync(() => ssr([
    '<html lang="', '"><head><meta charset="utf-8">', '</head><body><div id="app">', '</div></body></html>',
  ], locale === "hidden" ? "en" : locale, HydrationScript(), locale === "hidden"
    ? createComponent(HiddenFixture, {})
    : createComponent(MetaFixture, { locale })));
}
