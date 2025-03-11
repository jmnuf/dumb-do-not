import { treaty, type Treaty } from "@elysiajs/eden";
import type { App } from "./server";
import { createPromiseSignal } from "./E";

export const api = treaty<App>(location.host + "/api");

export function apiSignal<T>(promise: Promise<Treaty.TreatyResponse<{ 200: T }>>) {
  const requestSignal = createPromiseSignal(promise);
  const statusSignal = requestSignal.computed((status) => {
    if (!status.done) {
      return status;
    }
    const result = status.result;
    if (!result.ok) {
      return { done: true as const, data: null, error: result.error };
    }
    return { done: true as const, data: result.value.data, error: result.value.error?.value };
  });
  return statusSignal;
}

