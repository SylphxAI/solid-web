import { hydrate } from 'solid-js/web';
import '@sylphx/solid-web/consent.css';
import { App } from './app';

const root = document.getElementById('app')!;
const opener = root.querySelector('main > button');
if (!opener) throw new Error('SSR opener missing');
hydrate(() => <App />, root);
if (root.querySelector('main > button') !== opener) throw new Error('Hydration replaced the SSR opener');
