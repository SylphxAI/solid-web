import { Meta, MetaProvider } from "@solidjs/meta";
import { createResource, createSignal, Show, Suspense } from "solid-js";
import { PageMeta, type PageMetaProps } from "../src/meta";

const enUrl = "https://example.test/en/info?ref=one&format=two";
const zhUrl = "https://example.test/zh-tw/info";
const alternates = [
  { rel: "alternate", href: enUrl, hreflang: "en" },
  { rel: "alternate", href: zhUrl, hreflang: "zh-TW" },
] as const;
const english = {
  title: "Updates <notes> & details",
  meta: [
    { property: "og:description", content: 'A "quoted" note & <sample>' },
    { name: "description", content: "Public information" },
    { name: "description", content: "Public information" },
  ],
  links: [{ rel: "canonical", href: enUrl }, ...alternates],
} as const satisfies PageMetaProps;
const chinese = {
  title: "最新消息",
  meta: [{ property: "og:description", content: "公開資訊" }],
  links: [{ rel: "canonical", href: zhUrl }, ...alternates],
} as const satisfies PageMetaProps;
const pending = {
  title: "Pending",
  meta: [{ name: "temporary", content: "pending" }],
  links: [{ rel: "canonical", href: "https://example.test/pending" }, ...alternates],
} as const satisfies PageMetaProps;
const hidden = {
  meta: [{ name: "robots", content: "noindex" }],
} as const satisfies PageMetaProps;

function headProps(page: "en" | "zh-TW" | "hidden" | undefined): PageMetaProps {
  return page === "en" ? english : page === "zh-TW" ? chinese : page === "hidden" ? hidden : pending;
}

export function MetaFixture(props: { locale: "en" | "zh-TW" }) {
  const [locale] = createResource(() => Promise.resolve(props.locale));
  const [view, setView] = createSignal<"hidden" | "reordered" | "unmounted">();
  const metadata = () => headProps(view() === "hidden" ? "hidden" : locale());
  const links = () => view() === "reordered" ? metadata().links?.slice().reverse() : metadata().links;
  return (
    <MetaProvider>
      <Meta name="unrelated" content="preserve" />
      <Suspense fallback={<p>Loading</p>}>
        <Show when={view() !== "unmounted"}>
          <PageMeta title={metadata().title} meta={metadata().meta} links={links()} />
        </Show>
        <p>{locale()}</p>
      </Suspense>
      <button onClick={() => setView("reordered")}>Reorder</button>
      <button onClick={() => setView("hidden")}>Hide metadata</button>
      <button onClick={() => setView("unmounted")}>Unmount metadata</button>
    </MetaProvider>
  );
}

export function HiddenFixture() {
  return <PageMeta meta={hidden.meta} />;
}
