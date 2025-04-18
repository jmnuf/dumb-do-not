import type { App } from "./server";
import type { ResponseData, ResponseValueType, SimpleResponse } from "@jmnuf/ao/utils";
import { createApostle } from "@jmnuf/ao/apostles";
import { createAsyncGeneratorSignal, createDeferedSignal, createPromiseSignal, createSignal } from "./E";

export const api = createApostle<App>(location.origin).api;

export function apiFetchSignal<Value extends ResponseValueType>(promise: Promise<ResponseData<Value>>) {
  const stateSignal = createSignal<{ status: "fetching" } | { status: "error"; error: Error; response?: Response } | { status: "done"; data: Value; response: Response; }>({ status: "fetching" });
  promise.then((result) => {
    if (!result.ok) {
      stateSignal(() => ({ status: "error", error: result.error, response: result.response }));
      return;
    }
    stateSignal(() => ({ status: "done", data: result.data as any, response: result.response }));
  }).catch((fetchError: Error) => {
    // @ts-ignore cause is not known by typescript: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause
    const error = new Error("Error while fetching from api", { cause: fetchError });
    stateSignal(() => ({ status: "error", error }));
  });
  return stateSignal;
}

export function apiGeneratorSignal<TValue extends SimpleResponse>(promise: Promise<ResponseData<Generator<TValue> | AsyncGenerator<TValue>>>) {
  const stateSignal = createSignal<{
    status: "requesting" | "done";
  } | {
    status: "streaming";
    data: TValue;
  } | {
    status: "fetch-error" | "api-error" | "general-error";
    error: Error;
  }>({ status: "requesting" });
  const promiseState = createPromiseSignal(promise);
  const generatorState = promiseState.computed((fetchStatus) => {
    if (!fetchStatus.done) {
      stateSignal(() => ({ status: "requesting" }));
      return;
    }
    const result = fetchStatus.result;
    if (!result.ok) {
      stateSignal(() => ({ status: "fetch-error", error: result.error }));
      return;
    }
    const summoned = result.value;
    if (!summoned.ok) {
      stateSignal(() => ({ status: "api-error", error: summoned.error }));
      return;
    }
    return summoned.data;
  });
  const iteratorSignal = createDeferedSignal(generatorState, (g) => g ? createAsyncGeneratorSignal(g) : undefined);
  iteratorSignal.listen(({ cur: status }) => {
    if (!status.started) return;
    const state = status.state;
    if (state.done) {
      stateSignal(() => ({ status: "done" }));
      return;
    }
    stateSignal(() => ({ status: "streaming", data: state.value as any }));
  });
  return stateSignal;
}
