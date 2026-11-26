import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import { ConsentDock } from "../src/consent";

const mount = document.querySelector<HTMLElement>("#fixture")!;
const dispose = render(() => {
  const [open, setOpen] = createSignal(!location.search.includes("closed"));
  const [mounted, setMounted] = createSignal(true);
  const [reopened, setReopened] = createSignal(false);
  const [expanded, setExpanded] = createSignal(false);
  const [result, setResult] = createSignal("Undecided");
  let scope!: HTMLDivElement;
  let settings!: HTMLButtonElement;
  const choose = (choice: string) => {
    setResult(choice);
    setOpen(false);
  };
  return <>
    <div ref={scope} id="scope">
      <button ref={settings} type="button" onClick={() => { setReopened(true); setOpen(true); }}>Open choices</button>
      <button type="button" onClick={() => setExpanded(value => !value)}>Expand text</button>
      <button type="button" onClick={() => setMounted(false)}>Unmount dock</button>
      <output aria-label="Result">{result()}</output>
      <div class="fixture-spacer" />
      <button type="button">Last page action</button>
    </div>
    <footer class="fixture-tabs">Independent tab bar</footer>
    <Show when={mounted()}>
      <ConsentDock open={open()} focusOnOpen={reopened()} returnFocusTo={() => settings}
        clearanceScope={() => scope} label="Available choices"
        acceptLabel={<span>Accept option</span>} rejectLabel={<span>Reject option</span>}
        onAccept={() => choose("Accepted")} onReject={() => choose("Rejected")}>
        <p>Example message. <a href="#fixture">Read details</a></p>
        <Show when={expanded()}><p class="fixture-extra">Synthetic expanded details.</p></Show>
      </ConsentDock>
    </Show>
    <button type="button" class="fixture-after">After choices</button>
  </>;
}, mount);
window.addEventListener("pagehide", dispose, { once: true });
