import { Elysia, t } from "elysia";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { user } from "./routes/users";
import { notebook } from "./routes/notebooks";
import { note } from "./routes/notes";
import { cron } from "./routes/crons";
import { Res } from "@jmnuf/results";

export const app = new Elysia({ normalize: true })
  .get("/health", async ({ error }) => {
    const result = await Res.asyncCall(() => db.get(sql`SELECT (unixepoch()) as now`));
    if (!result.ok) {
      console.error(result.error);
      return error(500, { message: result.error.message });
    }
    const dbTime = result.value;
    console.log("Health check, db time:", dbTime);
    return { message: "OK", dbTime };
  }, {
    response: {
      200: t.Object({ message: t.Literal("OK"), dbTime: t.Unknown() }),
      500: t.Object({ message: t.String() }),
    }
  })
  .use(user)
  .use(notebook)
  .use(note)
  .use(cron);

export type App = typeof app;

