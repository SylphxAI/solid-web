# Solid Web

`@sylphx/solid-web` provides host-controlled page metadata and a consent dock for SolidJS 1.9. The host owns all copy, choices, persistence, and downstream effects. The package does not decide when to request consent or what a choice allows.

## Public imports

```tsx
import { PageMeta } from '@sylphx/solid-web/meta';
import { ConsentDock } from '@sylphx/solid-web/consent';
import '@sylphx/solid-web/consent.css'; // browser stylesheet entry only
```

The ESM subpaths ship browser and Node SSR builds and TypeScript declarations. Keep one SolidJS 1.9 runtime shared by the host and components. `PageMeta` needs no provider; it can coexist with `@solidjs/meta` 0.29.4 in a host app. Do not have two components manage the same head tags. Include the consent stylesheet through your host's browser build or stylesheet pipeline, not a native Node import.

`PageMeta` takes a `title`, `meta` descriptors (`name` or `property` with `content`), and `links` (`rel`, `href`, and optional `hreflang`). Pass absolute canonical and alternate URLs from the host when needed.

`ConsentDock` takes controlled `open` state, an accessible `label`, `acceptLabel` and `rejectLabel`, and the host's `onAccept` and `onReject`. Pass `returnFocusTo` for the opener and `clearanceScope` for the host element containing the dock. Opt in to focus on open with `focusOnOpen`. Use one dock per clearance scope. To reserve space, consume `--consent-dock-space` on that scope or its descendants; if composing with an independent offset, use `calc(var(--consent-dock-space, 0px) + var(--independent-offset, 0px))`.

## Verify from source

Requires Node.js 22.12+ and Chromium. Run `npm ci --ignore-scripts`, then `npx playwright install chromium` (or set `CHROMIUM_PATH` to an existing Chromium on a machine with its system dependencies). Run `npm run verify` to build both targets, check the declarations and exercise source and separately installed tarball consumers, including SSR and browser hydration.

## License and releases

The source and package are [MIT licensed](LICENSE). Verification runs on pull requests and merge groups; neither event can publish. The separate release workflow accepts an explicit dispatch for the exact checked commit on protected `main`. It tests the packed artifact, then verifies its digest before publishing those same bytes with npm OIDC. It requires npm Trusted Publishing to be configured separately.
