import type { EFC, EChildren } from "./E";
import { E } from "./E";
import { Res, Result } from "@jmnuf/results";
import type { Prettify } from "./utils";
import { Arr } from "./utils";
import type { FindPathParams, SplitString } from "@jmnuf/ao/utils";

export type HistoryData = Record<string, unknown> | undefined;

type EQueryParams = Record<string, string | string[] | undefined>;
export type PageProps<TQueryParams extends Record<string, unknown> | undefined = EQueryParams, PathParams extends Record<string, unknown> = {}, PageData extends Record<string, unknown> = {}> = {
  prefetching?: boolean;
  query?: TQueryParams;
  data: PageData;
} & (PathParams extends Record<string, never> ? {} : { params: Result<PathParams> });
export type PageConfig<TQueryParams extends Record<string, unknown> | undefined = Record<string, string | string[] | undefined>, PathParams extends Record<string, unknown> = {}, PageData extends Record<string, unknown> = {}> = ({
  pageData?: PageData;
  Page: (props: PageProps<TQueryParams, PathParams, PageData>) => HTMLElement;
  querySchema?: { parse: (v: any) => TQueryParams; }
  onRequested?: (data: HistoryData) => void;
} & (PathParams extends Record<string, never> ? {} : { paramsSchema?: { parse: (v: any) => PathParams } })) | {
  redirectPath: string;
  onRequested?: (data: HistoryData) => void;
};

type RouterEventCallbacks<T extends string = string> = {
  online: () => void;
  offline: () => void;
  pageChange: (event: { type: "push" | "pop"; route: T | null; url: URL; }) => void;
};
type RouterEventName = keyof RouterEventCallbacks;

type RoutingCallbacks = { [K in keyof RouterEventCallbacks]: Array<RouterEventCallbacks[K]> };


type RouterPages = ReturnType<RoutesBuilder<"", Record<`/${string}`, PageConfig<any, any>>>["build"]>;
type RouterSetup = {
  pages: RouterPages;
  e404(): HTMLElement;
};
export function setupRouting<T extends { pages: RouterPages; e404(): HTMLElement }>(app: HTMLElement, routes: T) {
  const data = createRouter(app, routes);

  const url = new URL(location.href);
  if (url.pathname in routes.pages) {
    data.loadRoute(url.pathname, url);
    return;
  }
  const content = routes.e404();
  app.appendChild(content);

  return data;
}

function loadRouteData(
  setup: { root: HTMLElement; routes: RouterSetup; callbacks: RoutingCallbacks; },
  route: string,
  url: URL = new URL(location.href)
) {
  const { root, routes, callbacks } = setup;
  if (!root) {
    console.error("No root has been set for routing. Can't change routes if none is set");
    return;
  }
  const runCallbacks = (route: string | null) => {
    for (const cb of callbacks.pageChange) {
      cb({ type: "pop", url, route });
    }
  };

  const data = routes.pages.find(route);
  if (!data) {
    root.innerHTML = "";
    const content = routes.e404();
    root.appendChild(content);
    runCallbacks(null);
    return;
  }
  const config = data.config;
  const rawQueryParams = {} as Record<string, string | Array<string>>;
  for (const [k, v] of url.searchParams.entries()) {
    if (k in rawQueryParams) {
      if (!Array.isArray(rawQueryParams[k])) {
        rawQueryParams[k] = [rawQueryParams[k], v];
        continue;
      }
      (rawQueryParams[k] as string[]).push(v)
      continue;
    }
    rawQueryParams[k] = v;
  }

  let query: Record<string, unknown> | undefined = rawQueryParams;
  if ("redirectPath" in config) {
    const redirect = config.redirectPath;
    if (redirect.startsWith("/")) {
      const redirectURL = new URL(redirect, location.origin);
      loadRouteData(setup, redirect, redirectURL);
      return;
    }
    const anchor = E("a", { href: redirect, target: "_self" });
    anchor.click();
    return;
  }
  if (config.querySchema && typeof config.querySchema === "object" && typeof config.querySchema.parse === "function") {
    const schema = config.querySchema;
    const result = Res.syncCall(() => schema.parse(rawQueryParams));
    if (!result.ok) {
      console.error(result.error);
      query = undefined;
    } else {
      query = result.value;
    }
  }
  let params: Result<Record<string, unknown>>;
  if (config.paramsSchema && typeof config.paramsSchema === "object" && typeof config.paramsSchema.parse === "function") {
    const schema = config.paramsSchema;
    params = Res.syncCall(() => schema.parse(data.params));
  } else {
    params = Res.Ok(data.params);
  }

  root.innerHTML = "";
  const content = config.Page({ data: config.pageData ?? {}, query, params });

  root.appendChild(content);
  runCallbacks(route);
}

// type LinkProps<LinkType extends string> = {
//   href: LinkType | (string & {});
//   className?: string;
//   activeOn?: "MouseDown" | "Click";
//   target?: "_self" | "_blank";
//   children?: EChildren;
// };
const createRouter = <T extends { [path: `/${string}`]: PageConfig<any, any>; }>(root: HTMLElement, routes: { pages: T; e404(): HTMLElement }) => {
  type PageRoute = keyof typeof routes.pages;
  type PageLink = `${PageRoute extends `/${string}` ? PageRoute : "/"}${`#${string}` | ""}${`?${string}` | ""}`;
  const callbacks: RoutingCallbacks = { online: [], offline: [], pageChange: [] };
  const loadRoute = loadRouteData.bind(null, { root, routes: routes as any, callbacks, });
  window.addEventListener("offline", () => {
    for (const cb of callbacks.offline) {
      cb();
    }
  });
  window.addEventListener("online", () => {
    for (const cb of callbacks.online) {
      cb();
    }
  })

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
    loadRoute(url.pathname, url);
  });

  const router = {
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
  };

  type RouterLinkProps = {
    href: PageLink | (string & {});
    className?: string;
    activeOn?: "MouseDown" | "Click";
    target?: "_self" | "_blank";
    children?: EChildren;
  };

  const Link: EFC<RouterLinkProps> = (props) => {
    const target = props.target ?? "_self";
    const href = props.href as string;
    const { children, className } = props;

    const activationevent = props.activeOn ?? "Click";
    const eventCallback = (event: Event) => {
      if (target === "_self") {
        event.preventDefault();
      }
      if (props.href.startsWith("/")) {
        router.push(props.href as PageLink);
      }
    }
    if (activationevent === "MouseDown") {
      return E("a", {
        onMousedown: eventCallback,
        className,
        children,
        href,
        target,
      });
    }

    return E("a", {
      onClick: eventCallback,
      className,
      children,
      href,
      target,
    });
  }

  return {
    router,
    Link,
    loadRoute,
  };
};


type NormalizePath<Path extends string> = NormalizePathRec<SplitString<Path, "/", true>, "">;
type NormalizePathRec<PathParts extends string[], FinalPath extends string> =
  PathParts extends []
  ? FinalPath
  : PathParts extends [infer Head extends string, ...infer Tail extends string[]]
  ? NormalizePathRec<Tail, `${FinalPath}/${Head}`>
  : FinalPath;

type RoutesConfig = { [P: `/${string}`]: PageConfig };
type RouteBuilder<Prefix extends string, Cfg extends RoutesConfig, Path extends `/${string}`, QueryParams extends Record<string, unknown>, PathParams extends Record<string, unknown>, PageData extends Record<string, unknown>, SetupKeys extends string> = PathParams extends Record<string, never> ? Omit<{
  queryParams<T extends Record<string, unknown>>(schema: { parse(input: any): T }): RouteBuilder<Prefix, Cfg, Path, T, PathParams, PageData, SetupKeys | "queryParams">;

  pageData<T extends Record<string, unknown>>(data: T): RouteBuilder<Prefix, Cfg, Path, QueryParams, PathParams, T, SetupKeys | "pageData">;

  render(Component: (this: PageConfig<QueryParams, PathParams>, props: PageProps<QueryParams, PathParams, PageData>) => HTMLElement): {
    build(): PageConfig<QueryParams, PathParams, PageData>;
  };
}, SetupKeys> : Omit<{
  pathParams<T extends Record<keyof PathParams, unknown>>(schema: { parse(input: any): T }): RouteBuilder<Prefix, Cfg, Path, QueryParams, T, PageData, SetupKeys | "pathParams">;

  pageData<T extends Record<string, unknown>>(data: T): RouteBuilder<Prefix, Cfg, Path, QueryParams, PathParams, T, SetupKeys | "pageData">;

  queryParams<T extends Record<string, unknown>>(schema: { parse(input: any): T }): RouteBuilder<Prefix, Cfg, Path, T, PathParams, PageData, SetupKeys | "queryParams">;

  render(Component: (this: PageConfig<QueryParams, PathParams>, props: PageProps<QueryParams, PathParams, PageData>) => HTMLElement): {
    build(): PageConfig<QueryParams, PathParams, PageData>;
  };
}, SetupKeys>;
type RoutesBuilder<Prefix extends string, T extends RoutesConfig> = {
  route<Path extends `/${string}`, QueryParams extends Record<string, unknown>, PathParams extends Record<string, unknown>, PageData extends Record<string, unknown>>(
    pathname: Path,
    builder: (rb: RouteBuilder<Prefix, T, Path, Record<string, string | string[] | undefined>, FindPathParams<`${Prefix}/${Path}`>, {}, never>) => { build(): PageConfig<QueryParams, PathParams, PageData> }
    // @ts-expect-error Prettify says invalid keys but I think they are fine
  ): RoutesBuilder<Prefix, Prettify<T & { [P in Path]: PageConfig<QueryParams>; }>>;
  build(): Prettify<{ find(pathname: string): { config: PageConfig<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>; params: Record<string, unknown>; } | undefined; } & { [Path in keyof T as `${Prefix}${Path extends string ? Path : ""}`]: T[Path]; }>;
};

export function normalizeRoute<Path extends string>(path: Path): NormalizePath<Path>;
export function normalizeRoute(path: string & {}): string;
export function normalizeRoute(path: string): string {
  return "/" + Arr.filterMap(path.split("/"), (x) => {
    const y = x.trim();
    if (!y.length || y === ".") return { save: false };
    return { save: true, value: y };
  }).join("/");
}

export function routesBuilder(): RoutesBuilder<"", {}>;
export function routesBuilder<Prefix extends `/${string}`>(prefix: Prefix): RoutesBuilder<Prefix, {}>;
export function routesBuilder<Prefix extends string = "">(prefix: Prefix = "" as Prefix): RoutesBuilder<Prefix, {}> {
  const routes = {} as Record<`/${string}`, PageConfig<any>>;
  const newRouteBuilder = () => {
    let querySchema: any;
    let paramsSchema: any;
    let pageData: any;
    let Page: any;
    const builder = {
      queryParams(schema) {
        querySchema = schema;
        return builder;
      },
      pageData(data) {
        pageData = data;
        return builder;
      },
      pathParams(schema) {
        paramsSchema = schema;
        return builder;
      },
      render(Component) {
        Page = Component;
        return builder;
      },
      build() {
        return {
          querySchema,
          paramsSchema,
          pageData,
          Page,
        } satisfies PageConfig<any, any>;
      },
    } as RouteBuilder<any, any, any, any, any, any, never> & { build: ReturnType<RouteBuilder<any, any, any, any, any, any, never>["render"]>["build"]; };
    return builder;
  };
  const builder = {
    route(pathname: `/${string}`, routeBuilder: (rb: RouteBuilder<any, any, any, any, any, any, never>) => ({ build(): PageConfig<any> })) {
      if (pathname in routes) {
        console.warn("Overwriting route:", normalizeRoute(prefix + "/" + pathname));
      }
      routes[pathname] = routeBuilder(newRouteBuilder()).build();
      return builder;
    },
    build() {
      type RouteFinder = ReturnType<RoutesBuilder<Prefix, {}>["build"]>["find"];
      const actualRoutes = {} as { [routePath: `/${string}`]: PageConfig<any> } & { find: RouteFinder };
      const routePaths = [] as Exclude<(keyof typeof actualRoutes), "find">[];
      for (const key of Object.keys(routes) as `/${string}`[]) {
        const config = routes[key];
        const route = normalizeRoute(prefix + "/" + key) as `/${string}`;
        actualRoutes[route] = config;
        routePaths.push(route);
      }
      const find: RouteFinder = (pathname) => {
        pathname = normalizeRoute(pathname);
        return Arr.findMap(routePaths, (value) => {
          const params = {} as Record<string, unknown>;
          if (!value.includes("/:")) {
            if (pathname === value) {
              return { found: true, value: { config: actualRoutes[value], params } };
            }
            return { found: false };
          }
          const zip = [value.split("/"), pathname.split("/")];
          const count = zip[0].length;
          if (zip[0].length != zip[1].length) return { found: false };
          for (let i = 0; i < count; ++i) {
            const a = zip[0][i];
            const b = zip[1][i];
            if (a.startsWith(":")) {
              const name = a.substring(1);
              if (!(name in params)) {
                params[name] = b;
                continue;
              }
              if (typeof params[name] === "string") {
                const first = params[name];
                params[name] = [first];
              }
              if (Array.isArray(params[name])) {
                params[name].push(b);
              }
              continue;
            }
            if (a != b) {
              return { found: false };
            }
          }
          return { found: true, value: { config: actualRoutes[value], params } };
        });
      };
      Object.defineProperty(actualRoutes, "find", {
        enumerable: false,
        configurable: true,
        writable: false,
        value: find,
      });
      return actualRoutes;
    },
  };
  return builder as any;
}


