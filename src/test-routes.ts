import type { PageProps } from "./routing";
import type { EChildren, ElementTagName, ComputedSimpSignal } from "./E";
// import { z } from "zod";
import { E, qE, createSignal } from "./E";
import { api, apiFetchSignal, apiGeneratorSignal } from "./api";

function H(num: 1 | 2 | 3 | 4 | 5 | 6, title: EChildren, props: Record<string, unknown> = {}) {
  return E(`h${num}`, { ...props, children: title });
}
function qe<T extends ElementTagName>(e: T, children: EChildren = null, props: Record<string, unknown> = {}) {
  return E(e, { ...props, children });
}
function qLk(href: string, children: EChildren, props: Record<string, unknown> = {}): HTMLAnchorElement {
  return E("a", {
    ...props,
    href: href as any,
    prefetch: "never",
    children,
  }) as any;
}

function ExampleRoutes() {
  return E("nav", {
    className: "absolute top-0 left-0 w-1/8 py-1 px-4",
    children: [
      H(2, "Routes:"),
      qe("ul", [
        qe("li", qLk("/", "Home", { className: "font-semibold text-sky-600 underline decoration-wavy" }), { className: "list-inside list-disc" }),
        qe("li", qLk("/api-check", "API Status check", { className: "font-semibold text-sky-600 underline decoration-wavy" }), { className: "list-inside list-disc" }),
        qe("li", qLk("/generator-example", "Streaming Responses", { className: "font-semibold text-sky-600 underline decoration-wavy" }), { className: "list-inside list-disc" }),
      ], { className: "flex flex-col gap-1" }),
    ],
  });
}

export const pages = {
  "/": {
    Page(_: PageProps) {
      return qe("div", [
        ExampleRoutes(),
        E("div", {
          className: "flex flex-col ml-auto md:mx-auto w-3/4 gap-2",
          children: [
            H(1, "Home page"),
            qe("p", [
              "Manage simple state with signals and fetch data with ",
              qe("code", "Apostles", { className: "font-mono bg-slate-300 px-1 rounded border border-slate-900" }),
              " that do requests onto the backend held by the ",
              qe("code", "AncientOne", { className: "font-mono bg-slate-300 px-1 rounded border border-slate-900" }),
              ". This is a real simple and small set of utilities for making small projects",
            ], { className: "text-lg" }),
          ],
        }),
      ]);
    }
  },
  "/generator-example": {
    pageData: {
      title: createSignal("Click Button For Starting Streaming"),
      text: createSignal("No stream started..."),
      startBtnDisabled: createSignal(false),
      restartBtnDisabled: createSignal(true),
    },
    Page(_: PageProps) {
      const title = this.pageData.title;
      const text = this.pageData.text;
      const startBtnDisabled = this.pageData.startBtnDisabled;
      const restartBtnDisabled = this.pageData.restartBtnDisabled;
      const createStreamingCall = () => {
        const controller = new AbortController();
        const statusSignal = apiGeneratorSignal(api.generator.get());
        const title = statusSignal.computed((state) => state.status);
        const values: string[] = [];
        const text = statusSignal.computed((state) => {
          if (state.status === "streaming") {
            values.push(JSON.stringify(state.data));
          }

          switch (state.status) {
            case "requesting":
              return "Loading...";

            case "fetch-error":
            case "api-error":
            case "general-error":
              return state.error.message;

            case "done":
            case "streaming":
              return values.reduce((acc, val) => `${acc}Value: ${val}\n`, "");
          }
        });
        return { title, text, signal: controller.signal, abort: controller.abort.bind(controller) }
      };
      return qe("div", [
        ExampleRoutes(),
        qE("h1", "Streaming API Endpoint example"),
        qE("h2", "Simple Streaming Through Generator Functions"),
        qE("h2", "text-xl font-bold", title),
        // H(2, title, { className: "text-xl font-bold" }),
        qE("div", "flex gap-4", [
          E("button", {
            className: "p-1 bg-sky-100 text-slate-900 cursor-pointer disabled:cursor-not-allowed border border-cyan-700 rounded",
            children: "Start Stream",
            disabled: startBtnDisabled,
            onClick() {
              if (startBtnDisabled.value) return;
              title(() => "Requesting...");
              startBtnDisabled(() => true);
              const call = createStreamingCall();
              call.title.listen(({ cur }) => {
                title(() => {
                  return cur.split("-").map((text) => text[0].toUpperCase() + text.substring(1).toLowerCase()).join(" ");
                });
                if (cur === "done") {
                  call.abort();
                  restartBtnDisabled(() => false);
                }
              }, { signal: call.signal });
              call.text.listen(({ cur }) => {
                text(() => cur);
              }, { signal: call.signal });
            },
          }),
          E("button", {
            className: "p-1 bg-sky-100 text-slate-900 cursor-pointer disabled:cursor-not-allowed border border-cyan-800 rounded",
            children: "Restart",
            disabled: restartBtnDisabled,
            onClick() {
              if (restartBtnDisabled.value) return;
              restartBtnDisabled(() => true);
              title(() => "Did you know [REDACTED]?");
              startBtnDisabled(() => false);
            },
          }),
        ]),
        qe("p", text)
      ]);
    }
  },
  "/api-check": {
    // Data that persists while app is open and only referenced by this route
    pageData: {
      apiHealth: undefined as ReturnType<typeof apiFetchSignal<{ message: string }>> | undefined,
      message: undefined as ComputedSimpSignal<string> | undefined,
    },
    Page({ prefetching }: PageProps) {
      if (!this.pageData) {
        this.pageData = {} as any;
        if (prefetching) {
          this.pageData.message = createSignal("Checking api status...") as any;
        }
      }
      if (!prefetching && !this.pageData.apiHealth) {
        this.pageData.apiHealth = apiFetchSignal(api.health.get());
        this.pageData.message = this.pageData.apiHealth.computed((state) => {
          if (state.status === "fetching") {
            return "Checking api status...";
          }
          if (state.status === "error") {
            if (state.response) console.log(state.response.status, state.response);
            console.error(state.error);
            return `Unexpected error occured: ${state.error.message}`;
          }
          const data = state.data;
          return `API Response: ${data.message}`;
        });
      }
      // const state = this.pageData.apiHealth;
      const message = this.pageData.message;
      return qe("div", [
        ExampleRoutes,
        E("div", {
          children: [
            H(1, "Hello"),
            qe("p", message),
          ],
        }),
      ]);
    },
  },
};


// export const someRoutes = routesBuilder()
//   .route("/", (rb) => rb.queryParams(
//     z.object({ max: z.coerce.number() })
//   ).render(({ query }) => {
//     const max = query?.max ?? NaN;
//     return qe("div", ["Max spaces to take: ", max]);
//   }))
//   .route("/uwu", (rb) =>
//     rb.queryParams(z.object({
//       on: z.string().optional(),
//     }))
//       .render((props) => props.query ? qe("p", "UwU DougDoug DougDoug") : qe("p", "Hello, Parkser Parkser"))
//   )
//   .route("/u/:id/profile", (rb) =>
//     rb.pathParams(z.object({ id: z.coerce.number() }))
//       .queryParams(z.object({ page: z.coerce.number().optional(), limit: z.coerce.number().default(25) }))
//       .render(props => qe("div", [props.params.id,])))
//   .build();

// console.log(someRoutes);
// console.log(Object.keys(someRoutes));
// console.log(someRoutes.find("u/24/profile"));
// console.log(someRoutes.find("uwu"));

