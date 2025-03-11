import { Link, router } from "./routing";
import type { PageProps, PageConfig } from "./routing";
import { createSignal, E } from "./E";
import { api, apiSignal } from "./api";
import { z } from "zod";

type UserData = {
  id: number;
  name: string;
};

const user: UserData = {
  id: -1,
  name: "",
};
const pages = {
  "/": {
    Page(_: PageProps) {
      const authedRequest = apiSignal(api.user.authed.get());
      const status = authedRequest.computed((x) => x.done ? x.data : null);
      const message = status.computed(
        (x) => x != null
          ? x.authed
            ? `Hope you are well ${x.session.user.name}!`
            : "Login to create a notebook and start taking notes"
          : ""
      );
      return E("div", {
        className: "text-center",
        children: [
          E("h1", { children: "Dumb-Do-Not" }),
          E("p", {
            children: [
              "A simple todo app\n",
              message,
            ],
          }),
        ],
      });
    },
  },
  "/u": {
    Page() {
      router.push("/u/profile");
      return E("h2", { children: "Loading..." });
    },
  },
  "/u/profile": {
    Page() {
      if (user.id < 0) {
        router.push("/");
        return E("h2", { children: "No logged in user data. Redirecting" });
      }
      const fetchResult = apiSignal(api.user({ userId: user.id }).notebooks.get());
      const message = fetchResult.computed((x) => !x.done
        ? "Loading notebooks..."
        : x.data != null
          ? x.data.data.map((nb) => "- " + nb.name).join("\n")
          : "Failed to load your notebooks :("
      );
      return E("div", {
        children: [
          E("h2", { children: `${user.name}'s Notebooks` }),
          E("p", { children: message }),
        ],
      });
    },
  },
  "/sign-in": {
    querySchema: z.object({
      username: z.string().optional(),
    }),
    Page({ query }) {
      const qUsername = query?.username;

      const username = createSignal(typeof qUsername === "string" ? qUsername : "");
      const password = createSignal("");
      const create = (username: string, password: string) => api.user.new.post({ username, password });
      type CreationData = { created: false; } | {
        created: true;
        id: number;
        sessionCreated: boolean;
        message: string;
      };
      type Status = { running: boolean; done: false; } | { running: boolean; done: true; data: CreationData };
      const status = createSignal<Status>({ running: false, done: false });
      const created = status.computed((status) => !status.running && status.done && status.data ? status.data : null);
      created.listen(({ cur }) => {
        if (!cur) return;
        router.push("/u/profile");
      });

      return E("div", {
        className: "flex flex-col gap-4",
        children: [
          E("h2", { children: "Create New Account" }),
          E("form", {
            className: "grid grid-cols-1 md:grid-cols-2 gap-2",
            children: [
              E("label", { for: "inpUsername" }),
              E("input", {
                id: "inpUsername",
                name: "username",
                type: "text",
                value: username,
                required: true,
              }),

              E("label", { for: "inpPassword" }),
              E("input", {
                id: "inpPassword",
                name: "password",
                type: "text",
                value: password,
                required: true,
              }),
              E("button", {
                className: "md:col-span-2",
                type: "submit",
                children: "Sign Up",
              })
            ],
            onSubmit(event: SubmitEvent) {
              event.preventDefault();
              create(username.value, password.value)
                .then(({ data, error }) => {
                  status(() => ({ running: false, done: true, data, error }));
                });
            },
          }),
        ],
      });
    },
  } as PageConfig<{ username?: string; }>,
} as const satisfies Record<`/${string}`, PageConfig>;
export type PageRoute = keyof typeof pages;
export type PageLink = `${PageRoute}${`#${string}` | ""}${`?${string}` | ""}`;

export const routes = {
  pages,
  e404() {
    return E("div", {
      className: "text-center",
      children: [
        E("h1", { children: "Dumb-Do-Not" }),
        E("p", {
          children: [
            "Error 404: Page not found\n",
            Link({ href: "/", children: "To Home" })
          ],
        }),
      ],
    });
  },
} as const;

