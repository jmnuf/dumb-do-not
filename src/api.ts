import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "./server";
import { createSignal } from "./E";

export const api = treaty<App>(location.host + "/api");

export function apiToSignal<T>(promise: Promise<Treaty.TreatyResponse<{ 200: T }>>) {
  type FetchData =
    | { done: false }
    | {
      done: true;
      data: T | null;
      error: { status: unknown; value: unknown } | { status: null; value: Error } | null
    };
  const signal = createSignal<FetchData>({ done: false });
  promise.then(({ data, error }) => {
    signal(() => ({ done: true, data, error }));
  }).catch((value: Error) => {
    signal(() => ({ done: true, data: null, error: { status: null, value } }));
  });
  return signal;
}

