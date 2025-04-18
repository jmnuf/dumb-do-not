import { summonAncientOne } from "@jmnuf/ao/ancients";

import { sql, eq, and } from "drizzle-orm";
import { db, notebooks, users, notes } from "../db/index.ts";
import { getUser } from "./users.ts";
import { handleSessionCookieCheck } from "../session.ts";
import { Res } from "@jmnuf/results";
import { z } from "zod";

const validBody = <T>(p: Request, s: { parse: (data: any) => T }) => Res.asyncCall(() => p.json().then(s.parse.bind(s)));

export const notebook = summonAncientOne({ prefix: "/notebook" })
  .post("/new", async ({ cookies, request, error }) => {
    const bodyRes = await validBody(request, z.object({ name: z.string(), public: z.boolean().default(false) }));
    if (!bodyRes.ok) return error(400, JSON.stringify({ message: bodyRes.error.message }));
    const body = bodyRes.value;
    // z.object({ body: z.object({ name: z.string(), public: z.boolean().default(false) }) })

    const cookieResult = await handleSessionCookieCheck(
      cookies,
      () => error(400),
      () => error(401),
    );
    if (cookieResult.handled) {
      return cookieResult.response;
    }

    const session = cookieResult.session;
    const user = await getUser(session.user.id);
    if (!user) return error(401);
    const result = (
      await db.insert(notebooks)
        .values({ name: body.name, public: body.public, ownerId: user.id })
        .returning({ id: notebooks.id })
        .then((data) => ({ ok: true, value: data[0].id } as const))
        .catch((err) => ({ ok: false, error: err as Error } as const))
    );
    if (!result.ok) {
      return { created: false, message: "Failed to create notebook: " + result.error.message }
    }
    return { created: true, notebook: result.value, message: "Created notebook succesfully" };
  })
  // .guard({ params: t.Object({ notebookId: t.Integer() }) })
  .get("/:notebookId", async ({ cookies, params, error }) => {
    const nbIdRes = Res.syncCall(() => {
      const n = parseInt(params.notebookId);
      if (Number.isNaN(n)) throw new Error();
      if (!Number.isFinite(n)) throw new Error();
      return n;
    });
    if (!nbIdRes.ok) return error(400, JSON.stringify({ message: nbIdRes.error.message }));
    const notebookId = nbIdRes.value;

    const result = await handleSessionCookieCheck(
      cookies,
      async (session) => {
        const data = await getNotebook(notebookId);
        if (!data) {
          return { data, session } as const;
        }
        if (!data.public) {
          return error(401);
        }
        return { data, session } as const;
      },
      () => error(401),
    );
    if (result.handled) {
      return result.response;
    }
    const session = result.session;

    const data = await getNotebook(notebookId);
    if (!data) return { data, session: session.status };
    if (session.user.id != data.owner.id && !data.public) {
      return error(401);
    }
    return { data, session: session.status } as const;
  });

export async function getNotebook(notebookId: number) {
  const notebook = (
    await db.select({
      id: notebooks.id,
      name: notebooks.name,
      public: notebooks.public,
      createdAt: notebooks.createdAt,
      updatedAt: notebooks.updatedAt,
      owner: {
        id: users.id,
        name: users.name,
      },
    })
      .from(notebooks)
      .where(eq(notebooks.id, sql`${notebookId}`))
      .leftJoin(users, eq(notebooks.ownerId, users.id))
  )[0];

  if (!notebook) return undefined;

  const notebookNotes = (
    await db.select({ id: notes.id, name: notes.name })
      .from(notes)
      .where(eq(notes.notebookId, sql`${notebookId}`))
  );

  return Object.assign(notebook, { notes: notebookNotes, owner: notebook.owner! });
}

export async function publicNotebooksByUser(cfg: { userId: number; limit: number; offset: number; }) {
  const data = await db.select({ id: notebooks.id, name: notebooks.name })
    .from(notebooks)
    .where(
      and(
        eq(notebooks.ownerId, sql`${cfg.userId}`),
        eq(notebooks.public, true)
      )
    )
    .limit(cfg.limit)
    .offset(cfg.limit * cfg.offset);
  return data;
}
