import { ancient } from "../src/server/index";

export const config = {
  runtime: "edge",
};

export default async function(request: Request) {
  console.log("[INFO]", request.method, request.url);
  // return new Response("TODO: Create server", { status: 500 });
  return ancient.fetch(request);
}

