import { createRenderEffect, createUniqueId, onCleanup, type JSX } from "solid-js";
import { isServer, ssrElement, useAssets } from "solid-js/web";

export type PageMetaDescriptor =
  | { readonly name: string; readonly property?: never; readonly content: string }
  | { readonly property: string; readonly name?: never; readonly content: string };

export interface PageMetaLink {
  readonly rel: string;
  readonly href: string;
  readonly hreflang?: string | undefined;
}

export interface PageMetaProps {
  readonly title?: string | undefined;
  readonly meta?: readonly PageMetaDescriptor[] | undefined;
  readonly links?: readonly PageMetaLink[] | undefined;
}

type HeadTag = {
  tag: "title" | "meta" | "link";
  attributes: Record<string, string>;
  text?: string;
};

function readTags(props: PageMetaProps): HeadTag[] {
  const tags: HeadTag[] = [];
  const title = props.title;
  if (title !== undefined) tags.push({ tag: "title", attributes: {}, text: title });
  for (const { name, property, content } of props.meta ?? []) {
    tags.push({ tag: "meta", attributes: name !== undefined ? { name, content } : { property, content } });
  }
  for (const { rel, href, hreflang } of props.links ?? []) {
    tags.push({ tag: "link", attributes: hreflang === undefined ? { rel, href } : { rel, href, hreflang } });
  }
  return tags;
}

const ownerAttribute = "data-page-meta";

/** Emit only this component's explicit head entries, in the supplied order. */
export function PageMeta(props: PageMetaProps): null {
  const id = createUniqueId();
  if (isServer) {
    // Read in the current Suspense owner; a replay disposes this pass before the head is emitted.
    const tags = readTags(props);
    let active = true;
    onCleanup(() => { active = false; });
    useAssets(() => {
      if (!active) return null;
      // Solid accepts its own SSR node objects as assets, though JSX.Element omits that shape.
      return tags.map(({ tag, attributes, text }) =>
        ssrElement(tag, { ...attributes, [ownerAttribute]: id, children: text }, undefined, false),
      ) as unknown as JSX.Element;
    });
    return null;
  }

  const head = document.head;
  // Claim only this instance's SSR nodes, leaving independent head owners alone.
  let nodes = Array.from(head.querySelectorAll(`[${ownerAttribute}]`))
    .filter(node => node.getAttribute(ownerAttribute) === id);
  for (const node of nodes) node.removeAttribute(ownerAttribute);
  onCleanup(() => nodes.forEach(node => node.remove()));

  createRenderEffect(() => {
    const tags = readTags(props);
    const next = tags.map(({ tag, attributes, text }, index) => {
      const desired = document.createElement(tag);
      for (const [key, value] of Object.entries(attributes)) desired.setAttribute(key, value);
      if (text !== undefined) desired.textContent = text;
      const current = nodes[index];
      if (current?.isEqualNode(desired)) return current;
      if (current) current.replaceWith(desired);
      else head.append(desired);
      return desired;
    });
    for (const node of nodes.slice(next.length)) node.remove();
    nodes = next;
  });
  return null;
}
