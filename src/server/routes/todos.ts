import { eq } from "drizzle-orm";
import { z } from "zod";
import { summonAncientOne } from "@jmnuf/ao/ancients";

import { db, todos } from "../db/index.ts";
import { isUuidLike, readBodyAs } from "../utility.ts";
import { handleSessionCookieCheck } from "../session.ts";
import { getUser } from "./users.ts";
import { Res } from "@jmnuf/results";

export const todo = summonAncientOne({ prefix: "/todo" })
  .get("/:id", async ({ params, cookies, error }) => {
    const todoIdRes = isUuidLike(params.id);
    if (!todoIdRes.ok) return error(400, JSON.stringify({ message: todoIdRes.error.message }));
    const todoId = todoIdRes.value;

    const cookieResult = await handleSessionCookieCheck(
      cookies,
      async (session) => {
        const data = await getTodo(todoId);
        if (data && !data.public) throw error(401);
        return { data, session } as const;
      },
      () => 401,
    );
    if (cookieResult.handled) {
      const r = cookieResult.response;
      if (typeof r === "number") {
        throw error(r);
      }
      return cookieResult.response;
    }

    const session = cookieResult.session;
    const data = await getTodo(todoId);
    if (data && !data.public) {
      const user = await getUser(session.user.id);
      if (!user || user.id != data.ownerId) {
        throw error(401);
      }
    }

    return { data, session: session.status };
  })
  .post("/new", async ({ request, cookies, error }) => {
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      () => [400, { message: "Must be logged into a valid session" }] as const,
      () => [401, { message: "Unauthorized: Your session has expired" }] as const,
    );
    if (cookieResult.handled) {
      const [code, data] = cookieResult.response;
      throw error(code, JSON.stringify(data));
    }

    const session = cookieResult.session;
    const user = await getUser(session.user.id);
    if (!user) throw error(401, JSON.stringify({ message: "Your session points to an inexistent user" }));
    const bodyRes = await readBodyAs(request, z.object({
      name: z.string(),
      description: z.string().default(""),
      public: z.coerce.boolean().default(false),
      noteId: z.string().optional(),
    }));
    if (!bodyRes.ok) {
      const e = bodyRes.error;
      const response = "details" in e ? { message: e.message, details: e.details } : { message: e.message };
      throw error(400, JSON.stringify(response));
    }
    const body = bodyRes.value;

    const insert = await Res.asyncCall(async () => {
      const values = await db.insert(todos).values({
        id: crypto.randomUUID(),
        ownerId: user.id,
        name: body.name,
        description: body.description,
        public: body.public,
        noteId: body.noteId,
      }).returning({ id: todos.id });
      if (values.length === 0) return null;
      return values[0];
    });

    if (!insert.ok) return { created: false, message: "Failed to create todo: " + insert.error.message } as const;
    if (!insert.value) return { created: false, message: "Failed to create todo: No response received for creation" } as const;

    return { created: true, message: "Succesfully created todo: " + insert.value.id, todo: insert.value };
  })
  ;


async function getTodo(id: string) {
  const td = await db.select().from(todos).where(eq(todos.id, id));
  if (td.length === 0) return null;
  return td[0];
}

