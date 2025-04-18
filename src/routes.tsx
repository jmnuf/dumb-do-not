import { z } from "zod";
import { createSignal } from "@jmnuf/wuonix";

import { routesBuilder } from "./routing";
// import type { EFC } from "./E";
import { api, apiGeneratorSignal } from "./api";
import { pages as testPages } from "./test-routes";

// type UserData = {
//   id: number;
//   name: string;
// };

// const user: UserData = {
//   id: -1,
//   name: "",
// };
const pages = {
  ...testPages,
  // "/": {
  //   Page(_: PageProps) {
  //     const authedRequest = apiSignal(api.user.isauthed.get());
  //     const status = authedRequest.computed((x) => x.done ? x.data : null);
  //     const message = status.computed(
  //       (x) => x != null
  //         ? x.authed
  //           ? `Hope you are well ${x.session.user.name}!`
  //           : "Login to create a notebook and start taking notes"
  //         : ""
  //     );
  //     return E("div", {
  //       className: "text-center",
  //       children: [
  //         E("h1", { children: "Dumb-Do-Not" }),
  //         E("p", {
  //           children: [
  //             "A simple todo app\n",
  //             message,
  //           ],
  //         }),
  //       ],
  //     });
  //   },
  // },
  // "/u": {
  //   Page() {
  //     router.push("/u/profile");
  //     return E("h2", { children: "Loading..." });
  //   },
  // },
  // "/u/profile": {
  //   Page() {
  //     if (user.id < 0) {
  //       router.push("/");
  //       return E("h2", { children: "No logged in user data. Redirecting" });
  //     }
  //     const fetchResult = apiSignal(api.user({ userId: user.id }).notebooks.get({ query: { limit: 50, offset: 0 } }));
  //     const message = fetchResult.computed((x) => !x.done
  //       ? "Loading notebooks..."
  //       : x.data != null
  //         ? x.data.list.map((nb) => "- " + nb.name).join("\n")
  //         : "Failed to load your notebooks :("
  //     );
  //     return E("div", {
  //       children: [
  //         E("h2", { children: `${user.name}'s Notebooks` }),
  //         E("p", { children: message }),
  //       ],
  //     });
  //   },
  // },
  // "/sign-in": {
  //   querySchema: z.object({
  //     username: z.string().optional(),
  //   }),
  //   Page({ query }) {
  //     query?.username;
  //     return E("div", {
  //       children: [
  //         E("h2", { className: "text-center", children: "Coming back?\n¿Why?" }),
  //       ],
  //     });
  //   },
  // },
  // "/sign-up": {
  //   querySchema: z.object({
  //     username: z.string().optional(),
  //   }),
  //   Page({ query }) {
  //     const qUsername = query?.username;

  //     const username = createSignal(typeof qUsername === "string" ? qUsername : "");
  //     const password = createSignal("");
  //     const create = (username: string, password: string) => api.user.new.post({ username, password });
  //     type CreatedData = ReturnType<(typeof create)> extends Promise<Treaty.TreatyResponse<{ 200: infer TData }>> ? TData : never;
  //     type Status =
  //       | { running: false; done: false; }
  //       | { running: true; done: false; }
  //       | { running: true; done: true; data: CreatedData | null; error: unknown }
  //       | { running: false; done: true; data: CreatedData | null; error: unknown };
  //     const status = createSignal<Status>({ running: false, done: false });
  //     const created = status.computed((status) => !status.running && status.done && status.data ? status.data : null);
  //     created.listen(({ cur }) => {
  //       if (!cur) return;
  //       if (cur.created) {
  //         if (cur.sessionCreated) {
  //           router.push("/u/profile");
  //           return;
  //         }
  //         router.push("/sign-in");
  //         return;
  //       }
  //       // TODO: Add a toast to display the backend's response message
  //       console.log(cur.message);
  //     });

  //     return E("div", {
  //       className: "flex flex-col gap-4",
  //       children: [
  //         E("h2", { children: "Create New Account" }),
  //         E("form", {
  //           className: "grid grid-cols-1 md:grid-cols-2 gap-2",
  //           children: [
  //             E("label", { for: "inpUsername" }),
  //             E("input", {
  //               id: "inpUsername",
  //               name: "username",
  //               type: "text",
  //               value: username,
  //               required: true,
  //             }),

  //             E("label", { for: "inpPassword" }),
  //             E("input", {
  //               id: "inpPassword",
  //               name: "password",
  //               type: "text",
  //               value: password,
  //               required: true,
  //             }),
  //             E("button", {
  //               className: "md:col-span-2",
  //               type: "submit",
  //               children: "Break In!",
  //             })
  //           ],
  //           onSubmit(event: SubmitEvent) {
  //             event.preventDefault();
  //             create(username.value, password.value)
  //               .then(({ data, error }) => {
  //                 status(() => ({ running: false, done: true, data, error }));
  //               });
  //           },
  //         }),
  //       ],
  //     });
  //   },
  // } as PageConfig<{ username?: string; }>,
} as const;
export type PageRoute = keyof typeof pages;
export type PageLink = `${PageRoute}${`#${string}` | ""}${`?${string}` | ""}`;

export const routes = routesBuilder()
  .route("/", (rb) =>
    rb.pageData({ foo: "bar" })
      .queryParams(z.object({ ref: z.string().optional() }))
      .render(({ query, data }) => {
        const ref = query?.ref;
        console.log(ref);
        console.log(data);
        return (
          <div className="text-center">
            <h1 className="font-bold text-4xl">Dumb Do Not</h1>
            <h2 className="font-bold text-2xl">Dumb Notes For Dumb Me</h2>
            <p>Page under construction</p>
          </div>
        );
      }))
  .route("/generator-example", (rb) =>
    rb.pageData({
      title: createSignal("Click Button For Starting Streaming"),
      text: createSignal("No stream started..."),
      startBtnDisabled: createSignal(false),
      restartBtnDisabled: createSignal(true),
    }).render(({ data }) => {
      const title = data.title;
      const text = data.text;
      const startBtnDisabled = data.startBtnDisabled;
      const restartBtnDisabled = data.restartBtnDisabled;
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
      return (
        <div>
          <h1>Streaming API Endpoint Example</h1>
          <h2>Simple Streaming Through Generator Functions</h2>
          <h2 className="text-xl font-bold">{title}</h2>
          <div className="flex gap-4">
            <button
              className="p-1 bg-sky-100 text-slate-900 cursor-pointer disabled:cursor-not-allowed border border-cyan-700 rounded"
              disabled={startBtnDisabled}
              onClick={() => {
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
              }}
            >
              Start Stream
            </button>
            <button
              className="p-1 bg-sky-100 text-slate-900 cursor-pointer disabled:cursor-not-allowed border border-cyan-800 rounded"
              disabled={restartBtnDisabled}
              onClick={() => {
                if (restartBtnDisabled.value) return;
                restartBtnDisabled(() => true);
                title(() => "Did you know [REDACTED]?");
                startBtnDisabled(() => false);
              }}
            >
              Restart
            </button>
          </div>
          <p>{text}</p>
        </div>
      );
    }))
  .build();

