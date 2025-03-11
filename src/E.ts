import { Res, Result } from "@jmnuf/results";

type Primitive = string | number | bigint;
type ChildNodePrimitive = string | number | bigint | HTMLElement | SimpSignal<any>;
type ChildNodePrimArray = ChildNodePrimitive | Array<ChildNodePrimitive>;
type ChildNode = ChildNodePrimArray | (() => ChildNodePrimArray);
type FlatChildNode = ChildNodePrimitive | (() => ChildNodePrimitive);
export type EChildren = ChildNode | ChildNode[] | undefined | null;
// type HTMLEventName = keyof HTMLElementEventMap;

type BaseProps = {
  children?: EChildren;
} & Record<string, Primitive | ((event: Event) => void)>;
export type GenericProps<TRecord extends Record<`on${string}`, ((event: Event) => void)> & Record<string, Primitive>> = TRecord & BaseProps;

export type EFC<TProps extends GenericProps<any>> = (props: TProps) => ChildNode;

export function E<
  TTag extends keyof HTMLElementTagNameMap,
  TProps extends GenericProps<any>
>(
  tag: TTag,
  props: TProps = {} as any,
): HTMLElementTagNameMap[TTag] {
  const elem = document.createElement(tag);
  for (const key of Object.keys(props as any) as Array<any>) {
    const val = (props as any)[key];
    if (val == null) continue;

    if (key.startsWith("on")) {
      const eventName = key.substring(2).toLowerCase();
      if (typeof val !== "function") {
        continue;
      }
      elem.addEventListener(eventName, val);
      continue;
    }
    if (key === "children") {
      const children = (Array.isArray(val) ? val : [val])
        .map((x) => typeof x === "string" ? x.split("\n")
          .flatMap((v, i, arr) => i + 1 >= arr.length ? v : [v, document.createElement("br")]) : x)
        .flat(Infinity) as FlatChildNode[];
      renderChildren(elem, children);
      continue;
    }

    if (typeof val === "function") {
      console.error("Unexpected function for setting element attribue");
      continue;
    }

    let attrName = key;
    if (key == "className") {
      attrName = "class";
    }

    const attr = document.createAttribute(attrName);
    if (isSimpSignal(val)) {
      attr.value = String(val.value);
      val.listen(({ cur }) => attr.value = String(cur));
    } else {
      attr.value = String(val);
    }
    elem.setAttributeNode(attr);
  }
  return elem;
}

function renderChildren(elem: HTMLElement | DocumentFragment, children: EChildren): void {
  if (children == null) return;
  if (!Array.isArray(children)) return renderChild(elem, children);
  for (const child of children) {
    renderChild(elem, child);
  }
}
function renderChild(elem: HTMLElement | DocumentFragment, child: ChildNode): void {
  if (Array.isArray(child)) return renderChildren(elem, child);
  if (typeof child === "object") {
    if (child instanceof HTMLElement) {
      elem.append(child);
      return;
    }
    console.error("Unknown object passed as prop:", child);
    return;
  }
  if (typeof child === "function") {
    if (isSignal(child)) {
      const node = createDOMNodeForSignal(child);
      elem.append(node);
      return;
    }
    const ret = (child as () => ChildNodePrimitive)();
    if (Array.isArray(ret)) {
      renderChildren(elem, ret);
    } else {
      renderChild(elem, ret);
    }
    return;
  }

  elem.append(String(child));
}

function createDOMNodeForSignal(signal: SimpSignal<any>) {
  const value = signal.value;
  if (Array.isArray(value)) {
    const frag = document.createDocumentFragment();
    for (const item of value) {
      renderChild(frag, item);
    }
    signal.listen((ctx) => {
      // TODO: Maybe actually do a diff
      const cur = ctx.cur as any[];
      for (const item of frag.children) {
        item.remove();
      }
      for (const item of cur) {
        renderChild(frag, item);
      }
    });
    return frag;
  } else {
    const node = document.createTextNode(String(value));
    signal.listen(({ cur }) => {
      node.nodeValue = String(cur);
    });
    return node;
  }
}

const SimpSignalSymbol = Symbol("[SimpSignal]");
export type SimpSignal<T> = {
  (f: (prev: T) => T): void;
  listen(cb: (o: { prv: T; cur: T }) => void): void;
  computed<U>(map: (value: T) => U): SimpSignal<U>;
  readonly value: T;
}
type InternalSimpSignal<T> = SimpSignal<T> & {
  readonly dependants: SimpSignalDeps;
};
type SimpSignalDeps = Array<{ signal: SimpSignal<unknown>; mapper: (value: any) => any; }>;

export function isSimpSignal<T = unknown>(obj: any): obj is SimpSignal<T> {
  if (typeof obj !== "function") return false;
  if (!("__tag" in obj) || obj.__tag !== SimpSignalSymbol) return false;
  return true;
}
function isSignal<T = unknown>(obj: any): obj is InternalSimpSignal<T> {
  if (typeof obj !== "function") return false;
  if (!("__tag" in obj) || obj.__tag !== SimpSignalSymbol) return false;
  return true;
}

export function createSignal<T>(): SimpSignal<T | undefined>;
export function createSignal<T>(initValue: T): SimpSignal<T>;
export function createSignal(init?: any) {
  let value = init;
  let deps: SimpSignalDeps = [];
  const listeners = [] as Array<(obj: { prv: any, cur: any }) => any>;
  const signal = ((f: (prev: any) => any) => {
    const prv = value && typeof value === "object"
      ? Array.isArray(value)
        ? value.slice()
        : Object.assign({}, value)
      : value;
    value = f(value);
    for (const cb of listeners) {
      cb({ prv, cur: value });
    }
    for (const sub of deps) {
      sub.signal(() => sub.mapper(value));
    }
  }) as InternalSimpSignal<any>;

  Object.defineProperties(signal, {
    value: {
      enumerable: true,
      configurable: false,
      get() {
        return value;
      },
    },
    __tag: {
      enumerable: false,
      configurable: false,
      get() {
        return SimpSignalSymbol;
      },
    },
    dependants: {
      enumerable: false,
      configurable: false,
      get() {
        return deps;
      },
    }
  });

  signal.listen = (cb) => {
    listeners.push(cb);
  };

  signal.computed = (mapper: (v: any) => any) => {
    const subSignal = createSignal(mapper(value));
    signal.dependants.push({ signal: subSignal, mapper });
    return subSignal;
  };

  return signal;
}

export function createPromiseSignal<T>(promise: Promise<T>): SimpSignal<{ done: false } | { done: true; result: Result<T> }>;
export function createPromiseSignal<T, U>(promise: Promise<T>, mapper: (v: T) => U): SimpSignal<{ done: false } | { done: true; result: Result<U> }>;
export function createPromiseSignal(promise: Promise<any>, mapper?: (v: any) => any) {
  const doneSignal = createSignal(false);
  let result: Result<any> = Res.Ok(null);
  if (typeof mapper === "function") {
    promise = promise.then((value) => mapper(value));
  }
  promise.then((value: any) => {
    doneSignal(() => true);
    result = Res.Ok(value);
  }).catch((error) => {
    doneSignal(() => true);
    result = Res.Err(error);
  });
  return doneSignal.computed((done) => !done ? { done } : { done, result });
}

