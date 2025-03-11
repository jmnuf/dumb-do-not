import type { EFC, EChildren } from "./E";
import { E } from "./E";
import { routes } from "./routes";
import type { PageLink, PageRoute } from "./routes";

export type HistoryData = Record<string, unknown> | undefined;

type EQueryParams = Record<string, string | number | Array<string | number> | string[] | number[] | undefined>;
export type PageProps<TQueryParams extends EQueryParams = EQueryParams> = {
  prefetching?: boolean;
  query?: TQueryParams;
};
export type PageConfig<TQueryParams extends EQueryParams = EQueryParams> = {
  Page: (props: PageProps<TQueryParams>) => HTMLElement;
  queryParser?: {
    parse: (queryParams: Record<string, string | string[] | undefined>) => TQueryParams;
  };
  onRequested?: (data: HistoryData) => void;
};

type RouterEventCallbacks = {
  online: () => void;
  offline: () => void;
  pageChange: (event: { type: "push" | "pop"; route: PageRoute | null; url: URL; }) => void;
};
type RouterEventName = keyof RouterEventCallbacks;

const callbacks = {
  online: [] as Array<RouterEventCallbacks["online"]>,
  offline: [] as Array<RouterEventCallbacks["offline"]>,
  pageChange: [] as Array<RouterEventCallbacks["pageChange"]>,
} as { [K in keyof RouterEventCallbacks]: Array<RouterEventCallbacks[K]> };

window.addEventListener("offline", () => {
  for (const cb of callbacks.offline) {
    cb();
  }
});
window.addEventListener("online", () => {
  for (const cb of callbacks.online) {
    cb();
  }
});

let root: HTMLElement | undefined;
export function setupRouting(app: HTMLElement) {
  root = app;

  const url = new URL(location.href);
  let content;
  if (url.pathname in routes.pages) {
    const config = routes.pages[url.pathname as PageRoute] as PageConfig;
    const rawQueryParams = {} as Record<string, string | Array<string>>;
    for (const [k, v] of url.searchParams.entries()) {
      if (k in rawQueryParams) {
        if (!Array.isArray(rawQueryParams[k])) {
          rawQueryParams[k] = [rawQueryParams[k], v];
          continue;
        }
        (rawQueryParams[k] as string[]).push()
        continue;
      }
      rawQueryParams[k] = v;
    }

    let query: EQueryParams = rawQueryParams;
    if (config.queryParser && config.queryParser) {
      query = config.queryParser.parse(rawQueryParams)
    }

    content = config.Page({ prefetching: false, query, });
  } else {
    content = routes.e404();
    app.appendChild(content);
  }
  app.appendChild(content);

  return router;
}

window.addEventListener("popstate", () => {
  // console.log(`Location: ${location}, state: ${JSON.stringify(event.state ?? {})}`);
  if (!root) {
    console.error("No root has been provided for client side routing to work.");
    return;
  }
  for (const child of root.children) {
    child.remove();
  }
  const url = new URL(location.href);
  let content;
  let route: PageRoute | null = null;
  if (url.pathname in routes.pages) {
    route = url.pathname as PageRoute;
    if (location.href in prefetched.routes) {
      content = prefetched.routes[location.href].content;
    } else {
      content = routes.pages[url.pathname as PageRoute].Page({});
    }
    root.appendChild(content);
  } else {
    content = routes.e404();
  }
  root.appendChild(content);
  for (const cb of callbacks.pageChange) {
    cb({ type: "pop", url, route });
  }
});

const prefetched = {
  routes: {} as Record<PageLink | (string & {}), { content: HTMLElement; timeout: number; length: number; }>,
  www: {} as Record<string, { timeout: number; start: number; length: number; }>,
};
export const router = {
  push(route: PageLink, data: HistoryData = {}) {
    return history.pushState(data, "", route);
  },
  pop: () => history.back(),
  online: () => navigator.onLine,
  on<TEvent extends RouterEventName>(event: TEvent, cb: RouterEventCallbacks[TEvent]) {
    const listeners = callbacks[event] ?? [];
    listeners.push(cb);
    callbacks[event] = listeners;
  },
  async prefetch(link: PageLink | (string & {})) {
    const length = 1000 * 60;
    const url = new URL(link, location.origin);
    const pageRoutes = Object.keys(routes.pages) as PageRoute[];
    const pageIndex = pageRoutes.findIndex((x) => x === url.pathname);
    if (pageIndex !== -1) {
      const path = pageRoutes[pageIndex];
      if (link in prefetched.routes) {
        clearTimeout(prefetched.routes[link].timeout);
      }
      const page = routes.pages[path].Page({ prefetching: true });
      const timeout = setTimeout(() => {
        delete prefetched.routes[link];
      }, length) as unknown as number;
      prefetched.routes[link] = { content: page, timeout, length };
      return;
    }
    if (link in prefetched.www) {
      clearTimeout(prefetched.www[link].timeout);
    }
    await fetch(link);
    const timeout = setTimeout(() => {
      delete prefetched.www[link];
    }, length) as unknown as number;
    prefetched.www[link] = { timeout, start: Date.now(), length };
  },
};

export type LinkProps = {
  href: PageLink;
  className?: string;
  prefetch?: "MouseDown" | "MouseOver" | "never";
  target?: "_self" | "_blank";
  children?: EChildren;
};
export const Link: EFC<LinkProps> = (props) => {
  const target = props.target ?? "_self";

  const prefetch = () => router.prefetch(props.href);
  const prefetchOnEvent = props.prefetch ?? "MouseOver";
  const prefetchEvent = prefetchOnEvent === "never"
    ? {}
    : { [`on${prefetchOnEvent}`]: prefetch };

  return E("a", {
    href: props.href,
    className: props.className,
    children: props.children,
    target,
    onClick(event: MouseEvent) {
      if (target === "_self") {
        event.preventDefault();
      }
      router.push(props.href);
    },
    ...prefetchEvent,
  });
}

