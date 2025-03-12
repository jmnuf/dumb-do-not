import { app } from "../src/server/index";

export const config = {
  runtime: "edge",
};

export default async function(request: Request) {
  return app.fetch(request);
}

