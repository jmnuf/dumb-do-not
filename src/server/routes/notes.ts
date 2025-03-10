import { Elysia, t } from "elysia";
import { sql, eq, and } from "drizzle-orm";
import { db, notes, notebooks, todos } from "../db";
import { getUser } from "./users";
import { handleSessionCookieCheck } from "../session";

export const note = new Elysia({ prefix: "/note" })
  .post("/new", async ({ cookie: cookies, body, error }) => {
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      () => error(400),
      () => error(401),
    );
    if (cookieResult.handled) {
      return cookieResult.response;
    }

    const session = cookieResult.session;
    const user = await getUser(session.user);
    if (!user) return error(401);
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
  }, { body: t.Object({ name: t.String(), notebookId: t.Integer(), public: t.Boolean({ default: false }), content: t.String({ default: "" }) }) })
  .guard({ params: t.Object({ noteId: t.Integer() }) })
  .get("/:noteId", async ({ cookie: cookies, params: { noteId }, error }) => {
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      async (session) => {
        const data = await getNote(noteId);
        if (!data) return { data, session } as const;
        if (!data.public) return error(401);
        return { data, session } as const;
      },
      () => error(401),
    );
    if (cookieResult.handled) {
      return cookieResult.response;
    }

    const session = cookieResult.session;
    const data = await getNote(noteId);
    if (!data) return { data, session: session.status } as const;
    if (!data.public) {
      const user = await getUser(session.user);
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

