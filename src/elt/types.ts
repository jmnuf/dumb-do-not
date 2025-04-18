
import { SimpSignal as WuonixSignal } from "@jmnuf/wuonix/dist/dev";
import { SimpSignal } from "../E";

export const SELF_CLOSING_HTML_TAGS = [
  "area", "base", "br",
  "col", "embed", "hr",
  "img", "input", "link",
  "meta", "param", "source",
  "track", "wbr",
] as const;
export type SelfClosingHTMLTag = (typeof SELF_CLOSING_HTML_TAGS)[number];

declare global {
  namespace JSX {
    export type IntrinsicElements = {
      [K in keyof HTMLElementTagNameMap]: K extends SelfClosingHTMLTag ? Omit<HTMLAttributes, "children"> : HTMLAttributes;
    };

    // Declare the shape of JSX rendering result
    // This is required so the return types of components can be inferred
    export type Element = HTMLElement;
    export type Node = (typeof global)["Node"];

    type NonFn<T> = T extends (...args: any[]) => any ? never : T;
    type PickElement<TKey extends keyof HTMLElementTagNameMap> = HTMLElementTagNameMap[TKey];

    type EventCallback<TEvent extends Event> = (event: TEvent) => void;

    export type HTMLAttributes = JSXChildren & {
      [Key in keyof PickElement<keyof HTMLElementTagNameMap>]?:
      | Key extends "children" ? JSXChildren["children"]
      : NonFn<PickElement<keyof HTMLElementTagNameMap>[Key] | (JSXNode & {})>;
    } & {
      [Key in keyof HTMLElementEventMap as `on${Capitalize<Key>}`]?:
      | EventCallback<HTMLElementEventMap[Key]>
      | undefined;
    } & {
      [key: string & {}]: JSXNode | JSXNode[] | ((event: Event) => void) | undefined;
    };
  }
}
export type { JSX };

type JSXChildren = {
  children?: JSXNode | JSXNode[] | undefined;
};

export type JSXNode =
  | SimpSignal<any>
  | WuonixSignal<any>
  | JSX.Element
  | JSX.Node
  | (() => JSX.Node)
  | (() => JSX.Element)
  | boolean
  | number
  | bigint
  | string
  | null
  | undefined;
