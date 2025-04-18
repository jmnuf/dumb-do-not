import { initPWA } from './pwa';
import { setupRouting } from './routing';
import { routes } from "./routes";
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

export const routing = setupRouting(app, {
  e404() {
    return (
      <div className="text-center">
        <h1 className="text-6xl">ERROR 404</h1>
        <p>
          Page not found<br />
          <a className="text-sky-800 decoration-wavy underline" href="/">Go home</a>
        </p>
      </div>
    )
  },
  pages: routes,
});

initPWA(document.body);
