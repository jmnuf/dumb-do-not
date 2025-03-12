import { Elysia, t } from "elysia";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, users, notebooks, sessions } from "../db/index.ts";
import { env } from "../../env.ts";
import { publicNotebooksByUser } from "./notebooks.ts";
import { encryptCookie, handleSessionCookieCheck, SESSION_COOKIE } from "../session.ts";
import { Res } from "@jmnuf/results";

export const user = new Elysia({ prefix: "/user" })
  .get("/isauthed", async ({ cookie: cookies, error }) => {
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      () => ({ authed: false } as const),
      () => error(400, { message: "Invalid cookie set" }),
    );
    if (cookieResult.handled) {
      return cookieResult.response;
    }
    const session = cookieResult.session;
    const data = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, sql`${session.user.id}`));
    if (data.length === 0) return error(400, { message: "No session for user with such id was found" });
    const user = data[0];
    return { authed: true, session: { id: session.id, user: user } } as const;
  }, {
    response: {
      200: t.Union([
        t.Object({
          authed: t.Literal(false),
        }),
        t.Object({
          authed: t.Literal(true),
          session: t.Object({
            id: t.Number(),
            user: t.Object({ id: t.Number(), name: t.String() }),
          }),
        }),
      ]),
      400: t.Object({ message: t.String(), }),
    },
  })
  .post("/new", async ({ cookie: cookies, body }) => {
    const name = body.username;
    const existingUsers = await db.select({ name: users.name }).from(users).where(eq(users.name, sql`${name}`));
    if (existingUsers.length >= 1) {
      return { created: false, message: "Username already in use" };
    }
    const salt = await bcrypt.genSalt(12);
    const password = await bcrypt.hash(body.password, salt);
    const userResult = await db.insert(users).values({ name, salt, password }).returning({ id: users.id });
    if (userResult.length === 0) {
      return { created: false, message: "Failed to create user" };
    }
    const user = userResult[0];
    const sessionResult = await Res.asyncCall(() => db.insert(sessions)
      .values({ userId: user.id })
      .returning({ id: sessions.id })
      .then((data) => data[0]));
    const response = {
      created: true,
      id: user.id,
      sessionCreated: true,
      message: "User created"
    } as { created: true, id: number, sessionCreated: boolean, message: string };
    if (!sessionResult.ok) {
      response.sessionCreated = false;
    } else {
      const cookie = cookies[SESSION_COOKIE];
      cookie.value = await encryptCookie({
        session: sessionResult.value.id,
        user: { id: user.id, name },
      });
      cookie.secure = env.NODE_ENV === "production";
    }
    return response;
  }, {
    body: t.Object({ username: t.String(), password: t.String() }),
    response: {
      200: t.Union([
        t.Object({
          created: t.Literal(false),
          message: t.String(),
        }),
        t.Object({
          created: t.Literal(true),
          id: t.Integer(),
          sessionCreated: t.Boolean(),
          message: t.String(),
        })
      ]),
    },
  })
  .post("/login", async ({ cookie: cookies, body }) => {
    const cookie = cookies[SESSION_COOKIE];
    const checkResult = await handleSessionCookieCheck(
      cookies,
      () => true,
      () => cookie.remove(),
    );
    if (checkResult.session) {
      return { ok: true, user: checkResult.session.user, message: "already logged into an account" as string };
    }

    const user = await getUserByName(body.username);
    if (!user) return { ok: false, message: "No user with such a name" };
    const aligned = await bcrypt.compare(body.password, user.password);
    if (!aligned) {
      return { ok: false, message: "Incorrect password" as string };
    }
    const results = await db.insert(sessions).values({ userId: user.id }).returning({ id: sessions.id });
    if (results.length === 0) {
      return { ok: false, message: "Server failed to create session data" as string };
    }
    const sessionId = results[0].id;
    const userData = { id: user.id, name: user.name };
    cookie.value = await encryptCookie({
      session: sessionId,
      user: userData,
    });
    cookie.secure = env.NODE_ENV === "production";
    return { ok: true, message: "Succesfully logged in" as string, user: userData };
  }, {
    body: t.Object({ username: t.String(), password: t.String() }),
    response: {
      200: t.Union([
        t.Object({ ok: t.Literal(false), message: t.String() }),
        t.Object({
          ok: t.Literal(true),
          message: t.String(),
          user: t.Object({
            id: t.Number(),
            name: t.String(),
          }),
        }),
      ]),
    },
  })
  .guard({ params: t.Object({ userId: t.Integer(), }), })
  .get("/:userId/notebooks", async ({ cookie: cookies, query, params: { userId }, error }) => {
    const limit = query.limit ?? 25;
    const offset = (query.offset ?? 0) + 1;
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      async (session) => {
        const list = await publicNotebooksByUser({ userId, limit, offset });
        return { list, session };
      },
      () => error(400, { message: "User not found" }),
    );
    if (cookieResult.handled) {
      return cookieResult.response;
    }

    const session = cookieResult.session;

    if (session.user.id != userId) {
      const list = await publicNotebooksByUser({ userId, limit, offset });

      return { list, session };
    }

    const list = await db.select({ id: notebooks.id, name: notebooks.name })
      .from(notebooks)
      .where(eq(notebooks.ownerId, sql`${userId}`))
      .limit(limit).offset(limit * offset);
    return { list, session }
  }, {
    query: t.Optional(t.Object({
      limit: t.Integer({ minimum: 1 }),
      offset: t.Integer({ minimum: 0 }),
    })),
    response: {
      200: t.Object({
        list: t.Array(t.Object({ id: t.Number(), name: t.String(), })),
        session: t.Union((["none", "expired", "active"] as const).map((v) => t.Literal(v))),
      }),
      400: t.Object({ message: t.String(), }),
    },
  });

export async function getUser(userId: number) {
  const data = await db.select().from(users).where(eq(users.id, userId));
  if (data.length === 0) return undefined;
  return data[0];
}

export async function getUserByName(userName: string) {
  const data = await db.select().from(users).where(eq(users.name, userName));
  if (data.length === 0) return undefined;
  return data[0];
}

