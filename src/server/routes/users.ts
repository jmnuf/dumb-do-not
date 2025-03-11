import { Elysia, t } from "elysia";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, users, notebooks, sessions } from "../db";
import { publicNotebooksByUser } from "./notebooks";
import { encryptCookie, handleSessionCookieCheck, SESSION_COOKIE } from "../session";

export const user = new Elysia({ prefix: "/user" })
  .get("/authed", async ({ cookie: cookies, error }) => {
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      () => ({ authed: false } as const),
      () => error(400),
    );
    if (cookieResult.handled) {
      return cookieResult.response;
    }
    const session = cookieResult.session;
    const data = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, sql`${session.user}`));
    if (data.length === 0) return error(400);
    const user = data[0];
    return { authed: true, session: { id: session.id, user: user } } as const;
  })
  .post("/new", async ({ cookie: cookies, body }) => {
    const name = body.username;
    const existingUsers = await db.select({ name: users.name }).from(users).where(eq(users.name, sql`${name}`));
    if (existingUsers.length >= 1) {
      return { created: false, message: "Username already in use" } as const;
    }
    const salt = await bcrypt.genSalt(12);
    const password = await bcrypt.hash(body.password, salt);
    const userResult = await db.insert(users).values({ name, salt, password }).returning({ id: users.id });
    if (userResult.length === 0) {
      return { created: false, message: "Failed to create user" } as const;
    }
    const user = userResult[0];
    const sessionResult = await db.insert(sessions)
      .values({ userId: user.id })
      .returning({ id: sessions.id })
      .then((result) => ({ ok: true, data: result[0] } as const))
      .catch((err) => ({ ok: false, error: err as Error } as const));
    const response = {
      created: true,
      id: user.id,
      sessionCreated: true,
      message: "User created"
    } as { created: true, id: number, sessionCreated: boolean, message: string };
    if (!sessionResult.ok) {
      response.sessionCreated = false;
    } else {
      cookies[SESSION_COOKIE].value = encryptCookie({
        session: sessionResult.data.id,
        user: { id: user.id, name },
      });
    }
    return response;
  }, { body: t.Object({ username: t.String(), password: t.String() }) })
  .post("/login", async ({ cookie: cookies, body }) => {
    const cookie = cookies[SESSION_COOKIE];
    // TODO: Maybe actually validate that it's a real account
    const checkResult = await handleSessionCookieCheck(
      cookies,
      () => true,
      () => cookie.remove(),
    );
    if (checkResult.session) {
      return { ok: true, user: checkResult.session.user, message: "already logged into an account" as string } as const;
    }

    const user = await getUserByName(body.username);
    if (!user) return { ok: false, message: "No user with such a name" };
    const aligned = await bcrypt.compare(body.password, user.password);
    if (!aligned) {
      return { ok: false, message: "Incorrect password" as string } as const;
    }
    const results = await db.insert(sessions).values({ userId: user.id }).returning({ id: sessions.id });
    if (results.length === 0) {
      return { ok: false, message: "Server failed to create session data" as string } as const;
    }
    const sessionId = results[0].id;
    const userData = { id: user.id, name: user.name };
    cookie.value = encryptCookie({
      session: sessionId,
      user: userData,
    });
    return { ok: true, message: "Succesfully logged in" as string, user: userData } as const;
  }, { body: t.Object({ username: t.String(), password: t.String() }) })
  .guard({ params: t.Object({ userId: t.Integer() }) })
  .get("/:userId/notebooks", async ({ cookie: cookies, params: { userId }, error }) => {
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      async (session) => {
        const data = await publicNotebooksByUser(userId);
        return { data, session } as const;
      },
      () => error(400),
    );
    if (cookieResult.handled) {
      return cookieResult.response;
    }

    const session = cookieResult.session;

    if (session.user.id != userId) {
      const data = await publicNotebooksByUser(userId);

      return { data, session };
    }

    const data = await db.select({ id: notebooks.id, name: notebooks.name })
      .from(notebooks)
      .where(eq(notebooks.ownerId, sql`${userId}`));
    return { data, session } as const
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

