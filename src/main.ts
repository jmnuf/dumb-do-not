import { initPWA } from './pwa.ts';
import { setupRouting } from './routing.ts';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

setupRouting(app);

initPWA(document.body);
