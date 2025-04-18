import { initPWA } from './pwa.ts';
import { setupRouting } from './routing.ts';
import { routes } from "./routes.ts";
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

export const routing = setupRouting(app, {
  e404() {
    const div = document.createElement("div");
    div.className = "text-center";
    div.innerHTML = `
<h1 class="text-6xl">ERROR 404</h1>
<p>
  Page not found<br><a class="text-sky-800 decoration-wavy underline" href="/">Go home</a>
</p>
`;
    return div;
  },
  pages: routes,
});

initPWA(document.body);
