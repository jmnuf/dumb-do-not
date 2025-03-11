import { Elysia, t } from "elysia";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { user } from "./routes/users";
import { notebook } from "./routes/notebooks";
import { note } from "./routes/notes";
import { cron } from "./routes/crons";

export const app = new Elysia()
  .get("/health", async () => {
    const data = await db.get(sql`SELECT (unixepoch()) as now`);
    console.log("Health check, db time:", data);
    return { message: "All good", data };
  }, { response: t.Object({ message: t.String(), data: t.Any() }) })
  .use(user)
  .use(notebook)
  .use(note)
  .use(cron);

export type App = typeof app;

