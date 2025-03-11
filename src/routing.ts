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
  queryParser?: (queryParams: Record<string, string | string[] | undefined>) => TQueryParams | undefined;
  querySchema?: { safeParse: (v: any) => { success: true; data: TQueryParams } | { success: false; error: Error }; }
  onRequested?: (data: HistoryData) => void;
} | {
  redirectPath: string;
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
  if (url.pathname in routes.pages) {
    loadRoute(url.pathname as PageRoute, url);
    return;
  }
  const content = routes.e404();
  app.appendChild(content);

  return router;
}

function loadRoute(route: PageRoute | (string & {}), url: URL = new URL(location.href)) {
  if (!root) {
    console.error("No root has been set for routing. Can't change routes if none is set");
    return;
  }
  const runCallbacks = (route: PageRoute | null) => {
    for (const cb of callbacks.pageChange) {
      cb({ type: "pop", url, route });
    }
  };
  if (prefetched.routes[location.href]) {
    root.innerHTML = "";
    root.appendChild(prefetched.routes[location.href].content);
    runCallbacks(route as PageRoute);
    return;
  }
  if (!(route in routes.pages)) {
    root.innerHTML = "";
    const content = routes.e404();
    root.appendChild(content);
    runCallbacks(null);
    return;
  }
  const config = routes.pages[route as PageRoute] as PageConfig;
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

  let query: EQueryParams | undefined = rawQueryParams;
  if ("redirectPath" in config) {
    const redirect = config.redirectPath;
    if (redirect.startsWith("/")) {
      const redirectURL = new URL(redirect, location.origin);
      loadRoute(redirect, redirectURL);
      return;
    }
    const anchor = E("a", { href: redirect, target: "_self" });
    anchor.click();
    return;
  } else {
    if (typeof config.queryParser === "function") {
      query = config.queryParser(rawQueryParams)
    } else if (config.querySchema && typeof config.querySchema === "object" && typeof config.querySchema.safeParse === "function") {
      const result = config.querySchema.safeParse(rawQueryParams);
      if (!result.success) {
        console.error(result.error);
        query = undefined;
      } else {
        query = result.data;
      }
    }

    root.innerHTML = "";
    const content = config.Page({ query });
    root.appendChild(content);
    runCallbacks(route as PageRoute);
  }
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
  loadRoute(url.pathname as PageRoute, url);
});

const prefetched = {
  routes: {} as Record<PageLink | (string & {}), { content: HTMLElement; timeout: number; lifetime: number; }>,
  www: {} as Record<string, { timeout: number | null; requestedAt: number; response?: Response; lifetime: number; abort?: () => void; }>,
};
function addPrefetchedRoute(link: PageLink) {
  if (link in prefetched.routes) {
    clearTimeout(prefetched.routes[link].timeout);
  }
  const route = (new URL(link, location.origin)).pathname as PageRoute;
  const config = routes.pages[route] as PageConfig;
  if ("redirectPath" in config) {
    const redirect = config.redirectPath;
    if (redirect.startsWith("/")) {
      addPrefetchedRoute(redirect as PageLink);
      return;
    }

    return;
  }
  const content = config.Page({ prefetching: true, });

  // 1 minute
  const lifetime = 1000 * 60;
  prefetched.routes[link] = {
    content,
    lifetime,
    timeout: setTimeout(() => {
      delete prefetched.routes[link];
    }, length) as unknown as number,
  };
}
function addPrefetchedLink(link: string) {
  // 1 second
  const lifetime = 1000;

  if (link in prefetched.www) {
    if (prefetched.www[link].timeout !== null) {
      clearTimeout(prefetched.www[link].timeout);
    }
    delete prefetched.www[link];
  }
  const controller = new AbortController();
  const data = {
    timeout: null,
    requestedAt: Date.now(),
    lifetime,
    abort: () => controller.abort(),
  } as typeof prefetched["www"][string];

  fetch(link, { signal: controller.signal })
    .then((response) => {
      delete data.abort;
      data.response = response;
      data.timeout = setTimeout(() => {
        delete prefetched.www[link];
      }, lifetime) as unknown as number;
    })
    .catch(() => {
      if (data.timeout !== null) {
        clearTimeout(data.timeout);
      }
      if (link in prefetched.www) {
        delete prefetched.www[link];
      }
    });
  prefetched.www[link] = data;
}
export const router = {
  push(route: PageLink, data: HistoryData = {}) {
    history.pushState(data, "", route);
    loadRoute(route);
  },
  pop: () => history.back(),
  online: () => navigator.onLine,
  on<TEvent extends RouterEventName>(event: TEvent, cb: RouterEventCallbacks[TEvent]) {
    const listeners = callbacks[event] ?? [];
    listeners.push(cb);
    callbacks[event] = listeners;
  },
  async prefetch(link: PageLink | (string & {})) {
    const url = new URL(link, location.origin);
    const pageRoutes = Object.keys(routes.pages) as PageRoute[];
    const pageRoute = pageRoutes.find((x) => x === url.pathname);
    if (pageRoute) {
      addPrefetchedRoute(link as PageLink);
      return;
    }
    addPrefetchedLink(link);
  },
};

const trueFetch = window.fetch;

window.fetch = async (input, init) => {
  let url: string | undefined;
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof Request) {
    url = input.url;
  } else if (input instanceof URL) {
    url = input.toString();
  }
  if (url && url in prefetched.www) {
    const data = prefetched.www[url];
    if (data.response) return data.response;
  }
  return trueFetch(input, init);
}

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

