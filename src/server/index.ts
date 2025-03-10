import { Elysia } from "elysia";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { user } from "./routes/users";
import { notebook } from "./routes/notebooks";
import { note } from "./routes/notes";

export const app = new Elysia()
  .get("/health", async () => {
    const data = await db.get(sql`SELECT (unixepoch()) as now`);
    console.log("Health check, db time:", data);
    return { message: "OK" };
  })
  .use(user)
  .use(notebook)
  .use(note);

export type App = typeof app;


