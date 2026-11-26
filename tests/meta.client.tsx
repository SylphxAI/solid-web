import { hydrate } from "solid-js/web";
import { MetaFixture } from "./meta.fixture";

const locale = document.documentElement.lang === "zh-TW" ? "zh-TW" : "en";
hydrate(() => <MetaFixture locale={locale} />, document.querySelector("#app")!);
