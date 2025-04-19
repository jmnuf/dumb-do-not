import { JSXNode } from "./types";
import { E, Frag } from "../E";

export const jsx = E;
export const jsxs = E;
// @ts-expect-error TODO: Need to converge the types appropriately
export const Fragment = (props: { children?: JSXNode | JSXNode[] | undefined; }) => props.children == null ? Frag() : Frag(props.children);

