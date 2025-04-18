import { Res, Result } from "@jmnuf/results";
import { isSimpSignal as isWuonixSignal } from "@jmnuf/wuonix";

type Primitive = string | number | bigint | boolean | null | undefined;

type AttributePrimitive =
  | Primitive
  | BaseSimpSignal<string> | BaseSimpSignal<string[]>
  | BaseSimpSignal<number> | BaseSimpSignal<number[]>
  | BaseSimpSignal<bigint> | BaseSimpSignal<bigint[]>
  | BaseSimpSignal<boolean> | BaseSimpSignal<boolean[]>
  | ComputedSimpSignal<string> | ComputedSimpSignal<string[]>
  | ComputedSimpSignal<number> | ComputedSimpSignal<number[]>
  | ComputedSimpSignal<bigint> | ComputedSimpSignal<bigint[]>
  | ComputedSimpSignal<boolean> | ComputedSimpSignal<boolean[]>
  ;

type PrimitiveSimpSignal =
  | BaseSimpSignal<string> | BaseSimpSignal<string[]>
  | BaseSimpSignal<number> | BaseSimpSignal<number[]>
  | BaseSimpSignal<bigint> | BaseSimpSignal<bigint[]>
  | BaseSimpSignal<boolean> | BaseSimpSignal<boolean[]>
  | SimpSignal<Primitive> | SimpSignal<Primitive[]>
  | ComputedSimpSignal<string> | ComputedSimpSignal<string[]>
  | ComputedSimpSignal<number> | ComputedSimpSignal<number[]>
  | ComputedSimpSignal<bigint> | ComputedSimpSignal<bigint[]>
  | ComputedSimpSignal<boolean> | ComputedSimpSignal<boolean[]>
  | ComputedSimpSignal<Primitive> | ComputedSimpSignal<Primitive[]>
  ;

type ChildNodePrimitive =
  | Primitive
  | HTMLElement
  | DocumentFragment
  | PrimitiveSimpSignal
  ;

type ChildNodePrimArray = ChildNodePrimitive | Array<ChildNodePrimitive>;
type ChildNode = ChildNodePrimArray | (() => ChildNodePrimArray);
type FlatChildNode = ChildNodePrimitive | (() => ChildNodePrimitive);
export type EChildren = ChildNode | ChildNode[] | undefined | null;
type HTMLElementEventName = keyof HTMLElementEventMap;

type EventProps = {
  [EventName in HTMLElementEventName as `on${Capitalize<EventName>}`]: (event: HTMLElementEventMap[EventName]) => void;
};
// type BaseProps = {
//   [Key in ((string & {}) | "children" | HTMLElementEventName) as Key extends HTMLElementEventName ? `on${Capitalize<Key>}` : Key]?: Key extends "children"
//   ? EChildren
//   : Key extends HTMLElementEventName
//   ? ((event: HTMLElementEventMap[Key]) => void)
//   : Primitive;
// };
type BaseProps = Partial<EventProps> & {
  children?: EChildren;
  className?: string | SimpSignal<string> | BaseSimpSignal<string> | ComputedSimpSignal<string>;
};
type ValidateProps<T extends Record<string, unknown>> = {
  [K in keyof T]: K extends keyof BaseProps ? BaseProps[K] : T[K] extends AttributePrimitive ? T[K] : never;
};
// export type GenericProps<TRecord extends { [K: string]: Primitive }> = TRecord & BaseProps;
export type EFC<TProps extends Record<string, unknown>> = (props: ValidateProps<TProps>) => ChildNode;

export type ElementTagName = keyof HTMLElementTagNameMap;
export function E<
  TTag extends ElementTagName,
  TProps extends Record<string, unknown>
>(
  tag: TTag,
  props: ValidateProps<TProps> = {} as any,
): HTMLElementTagNameMap[TTag] {
  const elem = document.createElement(tag);
  for (const key of Object.keys(props as any) as Array<any>) {
    const val = (props as any)[key];
    if (val == null) continue;
    if (key === "children") {
      const children = (Array.isArray(val) ? val : [val])
        .map((x) => typeof x === "string" ? x.split("\n")
          .flatMap((v, i, arr) => i + 1 >= arr.length ? v : [v, document.createElement("br")]) : x)
        .flat(Infinity) as FlatChildNode[];
      renderChildren(elem, children);
      continue;
    }

    renderAttribute(elem, key, val);
  }
  return elem;
}


export function qE<TagName extends ElementTagName>(tag: TagName): HTMLElementTagNameMap[TagName];
export function qE<TagName extends ElementTagName>(tag: TagName, children: EChildren): HTMLElementTagNameMap[TagName];
export function qE<TagName extends ElementTagName>(tag: TagName, className: NonNullable<BaseProps["className"]>, children: EChildren): HTMLElementTagNameMap[TagName];
export function qE<TagName extends ElementTagName, ElemProps extends Record<string, unknown>>(tag: TagName, className: NonNullable<BaseProps["className"]>, children: EChildren, props: ValidateProps<ElemProps>): HTMLElementTagNameMap[TagName];
export function qE<TagName extends ElementTagName>(tag: TagName, ...args: [] | [EChildren] | [NonNullable<BaseProps["className"]>, EChildren] | [NonNullable<BaseProps["className"]>, EChildren, Record<string, unknown>]) {
  if (args.length === 0) return document.createElement(tag);
  if (args.length === 1) {
    const elem = document.createElement(tag);
    const children = Array.isArray(args[0]) ? args[0] : [args[0]];
    renderChildren(elem, children);
    return elem;
  }
  if (args.length === 2) {
    const className = args[0];
    const elem = document.createElement(tag);
    const children = Array.isArray(args[1]) ? args[1] : [args[1]];
    renderAttribute(elem, "class", className);
    renderChildren(elem, children);
    return elem;
  }
  const [className, children, props] = args;
  return E(tag, { ...props, className, children });
}

export function Frag(children: NonNullable<EChildren> = []) {
  const frag = document.createDocumentFragment();
  if (!Array.isArray(children)) {
    children = [children];
  }
  renderChildren(frag, children);
  return frag;
}

function renderAttribute(elem: HTMLElement, key: string, val: any) {
  if (key.startsWith("on")) {
    const eventName = key.substring(2).toLowerCase();
    if (typeof val !== "function") {
      return;
    }
    elem.addEventListener(eventName, val);
    return;
  }

  let attrName = key;
  if (key == "className") {
    attrName = "class";
  }

  if (attrName in elem) {
    if (typeof val === "function") {
      if (isSimpSignal(val) || isWuonixSignal(val)) {
        (elem as any)[attrName] = val.value;
        val.listen(({ cur }) => (elem as any)[attrName] = cur);
      } else {
        console.error("Unexpected function for setting element attribue", key);
      }
    } else {
      (elem as any)[attrName] = val;
    }
    return;
  }

  const attr = document.createAttribute(attrName);
  if (typeof val === "function") {
    if (isSimpSignal(val) || isWuonixSignal(val)) {
      attr.value = String(val.value);
      val.listen(({ cur }) => attr.value = String(cur));
    } else {
      console.error("Unexpected function for setting element attribue", key);
      return;
    }
  } else {
    attr.value = String(val);
  }
  elem.setAttributeNode(attr);
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
    if (child instanceof HTMLElement || child instanceof DocumentFragment) {
      elem.appendChild(child);
      return;
    }
    console.error("Unknown object passed as prop:", child);
    return;
  }
  if (typeof child === "function") {
    if (isSignal(child) || isWuonixSignal(child)) {
      createDOMNodeForSignal(elem, child);
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

  for (const [line, addNewLine] of String(child).split("\n").map((v, i, arr) => [v, i > 0 || i < arr.length - 1] as const)) {
    elem.appendChild(document.createTextNode(line));
    if (addNewLine) {
      elem.appendChild(document.createElement("br"));
    }
  }
}

function createDOMNodeForSignal(parent: HTMLElement | DocumentFragment, signal: SimpSignal<any>) {
  const value = signal.value;
  const range = new Range();
  const commentA = document.createComment("<SignalDataStart>");
  const commentB = document.createComment("<SignalDataEnd>");
  parent.appendChild(commentA);
  range.setStartAfter(commentA);
  if (Array.isArray(value)) {
    for (const item of value) {
      renderChild(parent, item);
    }
    parent.appendChild(commentB);
    range.setEndBefore(commentB);

    signal.listen((ctx) => {
      if (!document.contains(parent)) return;
      range.setStartAfter(commentA);
      range.setEndAfter(commentB);
      range.extractContents();

      const cur = ctx.cur as any[];
      const strings = cur.map((val) => String(val)).join("").split("\n");
      for (let i = strings.length - 1; i >= 0; --i) {
        const line = strings[i];
        const node = document.createTextNode(line);
        range.insertNode(node);
        if (0 < i && i < strings.length - 1) {
          range.insertNode(document.createElement("br"));
        }
      }
    });
    return;
  }
  const lines = String(signal.value).split("\n");
  for (let i = 0; i < lines.length; ++i) {
    const node = document.createTextNode(lines[i]);
    parent.append(node);
    if (0 < i && i < lines.length - 1) {
      parent.append(document.createElement("br"));
    }
  }
  parent.append(commentB);
  range.setEndBefore(commentB);
  signal.listen(({ cur }) => {
    const lines = String(cur).split("\n");
    if (!document.contains(parent)) return;
    range.setStartAfter(commentA);
    range.setEndBefore(commentB);
    range.extractContents();


    for (let i = lines.length - 1; i >= 0; --i) {
      const line = lines[i];
      const node = document.createTextNode(line);
      range.insertNode(node);
      if (0 < i && i < lines.length - 1) {
        range.insertNode(document.createElement("br"));
      }
    }
  });
}

const SimpSignalSymbol = Symbol("[SimpSignal]");
export type BaseSimpSignal<T> = {
  isComputed: false;
  (f: (prev: T) => T): void;
  listen(cb: (event: SignalValueChangedEvent<T>) => void, cfg?: { once?: boolean, signal?: AbortSignal }): void;
  computed<U>(map: (value: T) => U): ComputedSimpSignal<U>;
  readonly value: T;
};
export type SimpSignal<T> = BaseSimpSignal<T> | ComputedSimpSignal<T>;
export type ComputedSimpSignal<T> = {
  isComputed: true;
  (): void;
  listen(cb: (event: SignalValueChangedEvent<T>) => void, cfg?: { once?: boolean, signal?: AbortSignal }): void;
  computed<U>(map: (value: T) => U): ComputedSimpSignal<U>;
  readonly value: T;
};
type InternalSimpSignal<T> = SimpSignal<T> & {
  readonly dependants: SimpSignalDeps;
};
type SimpSignalDeps = Array<{ signal: ComputedSimpSignal<unknown>; mapper: (value: any) => any; }>;

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

class SignalValueChangedEvent<T> extends Event {
  readonly cur: T;
  readonly prv: T;
  constructor(cur: T, prv: T) {
    super(SignalValueChangedEvent.EVENT_NAME);
    this.cur = cur;
    this.prv = prv;
  }

  static EVENT_NAME = "signal:value-changed";
}

export function createSignal<T>(): BaseSimpSignal<T | undefined>;
export function createSignal<T>(initValue: T): BaseSimpSignal<T>;
export function createSignal(init?: any): any {
  let value = init;
  let deps: SimpSignalDeps = [];
  const eventHandler = new EventTarget();
  const signal = ((f: (prev: any) => any) => {
    const prv = value && typeof value === "object"
      ? Array.isArray(value)
        ? value.slice()
        : Object.assign({}, value)
      : value;
    value = f(value);
    eventHandler.dispatchEvent(new SignalValueChangedEvent<any>(value, prv));
    for (const sub of deps) {
      // @ts-expect-error signals are always callable to change values, making it have no arguments in TS for safety of usage
      sub.signal(() => sub.mapper(value));
    }
  }) as InternalSimpSignal<any>;

  Object.defineProperties(signal, {
    isComputed: {
      enumerable: true,
      configurable: true,
      get() {
        return false;
      },
    },
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

  signal.listen = eventHandler.addEventListener.bind(eventHandler, SignalValueChangedEvent.EVENT_NAME) as any;

  signal.computed = (mapper: (v: any) => any) => {
    const subSignal = createSignal(mapper(value)) as unknown as ComputedSimpSignal<any>;
    Object.defineProperty(subSignal, "isComputed", {
      enumerable: true,
      configurable: false,
      get() {
        return true;
      },
    });
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
    result = Res.Ok(value);
    doneSignal(() => true);
  }).catch((error) => {
    result = Res.Err(error);
    doneSignal(() => true);
  });
  return doneSignal.computed((done) => !done ? { done } : { done, result });
}


export function createAsyncGeneratorSignal<T>(generator: AsyncGenerator<T>): SimpSignal<{ done: false, value: T } | { done: true }>;
export function createAsyncGeneratorSignal<T, U>(generator: AsyncGenerator<T>, mapper: (v: T) => U): SimpSignal<{ done: false; value: U } | { done: true }>;
export function createAsyncGeneratorSignal<T>(generator: AsyncGenerator<T>, mapper?: (v: any) => any) {
  const valueSignal = createSignal<any>(null);
  let done = false;
  (async () => {
    for await (const value of generator) {
      const v = mapper ? mapper(value) : value;
      valueSignal(() => v);
    }
    done = true;
    valueSignal(() => undefined);
  })();
  return valueSignal.computed((value) => ({ done, value } as { done: false, value: any } | { done: true }));
}

export function createDeferedSignal<T, U>(baseSignal: SimpSignal<T>, checker: (v: T) => SimpSignal<U> | undefined) {
  const subSignalState = baseSignal.computed((value) => {
    return checker(value);
  });
  let started = false;
  const valueSignal = createSignal<{ started: false } | { started: true; state: U }>({ started: false });
  subSignalState.listen(({ cur: signal }) => {
    if (!signal) {
      if (started || valueSignal.value.started === false) return;
      valueSignal(() => ({ started: false }));
      return
    }
    started = true;
    signal.listen(({ cur: state }) => {
      valueSignal(() => ({ started: true, state }));
    });
  });
  return valueSignal;
}

