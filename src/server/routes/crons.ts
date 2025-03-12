import { Elysia } from "elysia";
import { sql, lte } from "drizzle-orm";
import { db, sessions } from "../db/index.ts";

export const cron = new Elysia({ prefix: "/cron" })
  .get("/kill-sessions", async () => {
    try {
      const result = await db.delete(sessions).where(lte(sessions.killAt, sql`(unixepoch())`));
      const rowsDeleted = result.rowsAffected;
      return { ok: true, count: rowsDeleted } as const;
    } catch (err) {
      console.error(err);
      return { ok: false, message: err instanceof Error ? err.message : "Fatal Error: Call to db.delete failed unexpectedly" } as const;
    }
  });
