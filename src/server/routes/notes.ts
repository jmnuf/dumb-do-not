import { sql, eq, and } from "drizzle-orm";
import { z } from "zod";
import { summonAncientOne } from "@jmnuf/ao/ancients";
import { Res } from "@jmnuf/results";

import { db, notes, notebooks, todos } from "../db/index";
import { getUser } from "./users";
import { handleSessionCookieCheck } from "../session";


export const note = summonAncientOne({ prefix: "/note" })
  .post("/new", async ({ cookies, request, error }) => {
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      () => 400,
      () => 401,
    );
    if (cookieResult.handled) {
      return error(cookieResult.response);
    }

    const session = cookieResult.session;
    const user = await getUser(session.user.id);
    if (!user) return error(401);
    const bodySchema = z.object({
      name: z.string(),
      notebookId: z.number(),
      public: z.boolean().default(false),
      content: z.string().default(""),
    });
    const bodyRes = await Res.asyncCall(() => request.json().then((json) => bodySchema.parse(json)));
    if (!bodyRes.ok) return error(400);
    const body = bodyRes.value;
    const result = (
      await db.insert(notes)
        .values({
          name: body.name,
          notebookId: body.notebookId,
          content: body.content,
          public: body.public,
          ownerId: user.id
        })
        .returning({ id: notebooks.id })
        .then((data) => ({ ok: true, value: data[0].id } as const))
        .catch((err) => ({ ok: false, error: err as Error } as const))
    );
    if (!result.ok) {
      return { created: false, message: "Failed to create note: " + result.error.message }
    }
    return { created: true, notebook: result.value, message: "Created notebook succesfully" };
  })
  .get("/:noteId", async ({ cookies, params, error }) => {
    const noteIdRes = Res.syncCall(() => {
      const n = parseInt(params.noteId);
      if (!Number.isNaN(n)) throw new Error();
      if (n < 1) throw new Error();
      return n;
    });
    if (!noteIdRes.ok) return error(400);
    const noteId = noteIdRes.value;

    const cookieResult = await handleSessionCookieCheck(
      cookies,
      async (session) => {
        const data = await getNote(noteId);
        if (data && !data.public) return error(401);
        return { data, session } as const;
      },
      () => 401,
    );
    if (cookieResult.handled) {
      const r = cookieResult.response;
      if (typeof r === "number") {
        return error(r);
      }
      return cookieResult.response;
    }

    const session = cookieResult.session;
    const data = await getNote(noteId);
    if (data && !data.public) {
      const user = await getUser(session.user.id);
      if (!user || user.id != data.ownerId) {
        return error(401);
      }
    }

    return { data, session: session.status };
  });


export async function getNote(noteId: number) {
  const data = await db.select({
    id: notes.id,
    ownerId: notes.ownerId,
    notebookId: notes.notebookId,
    public: notes.public,
    createdAt: notes.createdAt,
    updatedAt: notes.updatedAt,
    todos: {
      id: todos.id,
      name: todos.name,
      description: todos.description,
      done: todos.done,
      createdAt: todos.createdAt,
      updatedAt: todos.updatedAt,
    },
  }).from(notes)
    .where(eq(notes.id, sql`${noteId}`))
    .leftJoin(todos, eq(todos.noteId, notes.id));
  return data[0] as typeof data[number] | undefined;
}

export async function getPublicNote(noteId: number) {
  const data = await db.select({
    id: notes.id,
    ownerId: notes.ownerId,
    notebookId: notes.notebookId,
    public: notes.public,
    createdAt: notes.createdAt,
    updatedAt: notes.updatedAt,
    todos: {
      id: todos.id,
      name: todos.name,
      description: todos.description,
      done: todos.done,
      createdAt: todos.createdAt,
      updatedAt: todos.updatedAt,
    },
  }).from(notes)
    .where(
      and(
        eq(notes.id, sql`${noteId}`),
        eq(notes.public, true)
      )
    )
    .leftJoin(todos, eq(todos.noteId, notes.id));
  return data[0] as typeof data[number] | undefined;
}

