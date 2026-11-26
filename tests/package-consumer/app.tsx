import { MetaProvider } from '@solidjs/meta';
import { createSignal } from 'solid-js';
import { PageMeta, type PageMetaProps } from '@sylphx/solid-web/meta';
import { ConsentDock, type ConsentDockProps } from '@sylphx/solid-web/consent';

export function App() {
  const [open, setOpen] = createSignal(true);
  let opener!: HTMLButtonElement;
  let scope!: HTMLElement;
  const meta: PageMetaProps = {
    title: 'Fixture title',
    meta: [{ name: 'description', content: 'Fixture description' }],
    links: [{ rel: 'canonical', href: 'https://example.test/fixture' }],
  };
  const consent: ConsentDockProps = {
    get open() { return open(); },
    label: 'Choice',
    acceptLabel: 'Accept',
    rejectLabel: 'Reject',
    onAccept: () => setOpen(false),
    onReject: () => setOpen(false),
    returnFocusTo: () => opener,
    clearanceScope: () => scope,
  };
  return (
    <MetaProvider>
      <PageMeta {...meta} />
      <main ref={scope}>
        <button ref={opener} onClick={() => setOpen(true)}>Open choices</button>
        <ConsentDock {...consent} />
      </main>
    </MetaProvider>
  );
}
