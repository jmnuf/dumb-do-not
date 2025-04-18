
import { sql } from "drizzle-orm";
import { summonAncientOne } from "@jmnuf/ao/ancients";
import { Res } from "@jmnuf/results";

import { db } from "./db/index";
import { user } from "./routes/users";
import { notebook } from "./routes/notebooks";
import { note } from "./routes/notes";
import { cron } from "./routes/crons";


function wait(secs: number) {
  return new Promise((resolve) => setTimeout(resolve, secs * 1000));
}


export const ancient = summonAncientOne({ prefix: "/api" })
  .get("/health", async () => {
    const result = await Res.asyncCall(() => db.get(sql`SELECT (unixepoch()) as now`));
    if (!result.ok) {
      console.error(result.error);
      return {
        server: "OK",
        database: "ERROR: " + result.error.message,
        message: "DB Inaccessible",
      };
    }
    const dbTime = result.value;
    console.log("Health check, db time:", dbTime);
    return { message: "OK", server: "OK", database: "OK", dbTime };
  })
  .get("/generator", async function*(ctx) {
    const max = typeof ctx.query.max === "string" ? /\d+/.test(ctx.query.max) ? Number.parseInt(ctx.query.max) : 5 : 5;
    let i = 0;
    while (i < max) {
      const waitTime = Math.floor(Math.random() * 5 + 1);
      yield { waitTime, number: ++i };
      await wait(waitTime);
    }
  })
  .get("/ao-handler", () => {
    return "WAH! WAH!";
  })
  .seize(user)
  .seize(notebook)
  .seize(note)
  .seize(cron);


export type App = typeof ancient;
// export type App = typeof app;

