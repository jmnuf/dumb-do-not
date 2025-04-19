import "./types";
import { E } from "../E";

export const jsxDEV = E;
// @ts-expect-error TODO: Need to converge the types appropriately
export const Fragment = (props: { children?: JSXNode | JSXNode[] | undefined; }) => props.children == null ? Frag() : Frag(props.children);

