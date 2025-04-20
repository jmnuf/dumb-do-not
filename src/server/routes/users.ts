import { sql, eq } from "drizzle-orm";
import { hash, compare, genSalt } from "../encryption";
import { db, users, notebooks, sessions } from "../db/index.ts";
import { env } from "../../env.ts";
import { publicNotebooksByUser } from "./notebooks.ts";
import { encryptCookie, handleSessionCookieCheck, SESSION_COOKIE } from "../session.ts";
import { z } from "zod";
import { fromError } from "zod-validation-error";
import { Res, Result } from "@jmnuf/results";
import { summonAncientOne } from "@jmnuf/ao/ancients";

const pipe = <T, R>(result: Result<T>, mapFn: (value: T) => R) => result.ok ? Res.syncCall(() => mapFn(result.value)) : result;

const validBody = async <T>(request: Request, s: { parse: (data: any) => T }) => {
  const body = await Res.asyncCall(async () => {
    const contentType = request.headers.get("content-type");
    if (contentType && contentType.startsWith("multipart/form-data")) {
      const formData = await request.formData();
      const data = {} as Record<string, unknown>;
      for (const [key, val] of formData.entries()) {
        data[key] = val;
      }
      console.log("[INFO] Read form data", data);
      return data as unknown;
    }
    if (contentType && contentType.startsWith("application/json")) {
      return (await request.json()) as unknown;
    }
    throw new Error("Unsupported body content type");
  });

  const result = pipe(body, s.parse.bind(s));
  if (!result.ok && result.error instanceof z.ZodError) {
    result.error = fromError(result.error);
  }

  return result;
};

export const user = summonAncientOne({ prefix: "/user" })
  .get("/isauthed", async ({ cookies, error }) => {
    const cookieResult = await handleSessionCookieCheck(
      cookies,
      () => ([200, { authed: false }] as const),
      () => ([401, { message: "Invalid cookie set" }] as const),
    );
    if (cookieResult.handled) {
      const [code, data] = cookieResult.response;
      if (code === 200) {
        return data;
      }
      const msg = JSON.stringify(data);
      return error(code, msg);
    }
    const session = cookieResult.session;
    const data = await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, sql`${session.user.id}`));
    if (data.length === 0) return error(400, JSON.stringify({ message: "No session for user with such id was found" }));
    const user = data[0];
    return { authed: true, session: { id: session.id, user: user } } as const;
  })
  .post("/new", async ({ cookies, request, error }) => {
    const bodyRes = await validBody(request, z.object({ username: z.string().min(3).max(26), password: z.string().min(4) }));
    if (!bodyRes.ok) {
      const err = bodyRes.error;
      const response = "details" in err ? { message: err.message, details: err.details } : { message: err.message };
      throw error(400, JSON.stringify(response));
    }
    const body = bodyRes.value;
    const name = body.username;
    const existingUsers = await db.select({ name: users.name }).from(users).where(eq(users.name, sql`${name}`));
    if (existingUsers.length >= 1) {
      return { created: false, message: "Username already in use" };
    }
    const salt = await genSalt();
    const password = await hash(body.password, salt);
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
  })
  .post("/login", async ({ cookies, request, error }) => {
    const bodyRes = await validBody(request, z.object({ username: z.string(), password: z.string() }));
    if (!bodyRes.ok) {
      const err = bodyRes.error;
      error(400, JSON.stringify({ message: err.message }));
      throw err;
    }
    const body = bodyRes.value;

    const cookie = cookies[SESSION_COOKIE];
    const checkResult = await handleSessionCookieCheck(
      cookies,
      () => true,
      () => cookie.remove(),
    );
    if (checkResult.handled == false) {
      return { ok: true, user: checkResult.session.user, message: "already logged into an account" as string };
    }

    const user = await getUserByName(body.username);
    if (!user) return { ok: false, message: "No user with such a name" };
    const aligned = await compare(body.password, user.password);
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
  })
  // .guard({ params: t.Object({ userId: t.Integer(), }), })
  .get("/:userId/notebooks", async ({ cookies, query, params, error }) => {
    const userIdRes = Res.syncCall(() => {
      const n = parseInt(params.userId);
      if (Number.isNaN(n)) throw new Error();
      if (!Number.isFinite(n)) throw new Error();
      return n;
    });
    if (!userIdRes.ok) return error(400, JSON.stringify({ message: userIdRes.error.message }));
    const userId = userIdRes.value;

    const { limit, offset } = ((lim, off) => {
      let limit = 25;
      let offset = 0;

      if (lim) {
        if (Array.isArray(lim)) lim = lim[0]!;
        const nl = parseInt(lim);
        if (!Number.isNaN(nl) && Number.isFinite(nl) && nl > 0) {
          limit = nl;
        }
      }
      if (off) {
        if (Array.isArray(off)) off = off[0]!;
        const no = parseInt(off);
        if (!Number.isNaN(no) && Number.isFinite(no) && no > 0) {
          offset = no;
        }
      }

      offset += 1;
      return { limit, offset };
    })(query.limit, query.offset);

    const cookieResult = await handleSessionCookieCheck(
      cookies,
      async (session) => {
        const list = await publicNotebooksByUser({ userId, limit, offset });
        return { list, session };
      },
      () => error(400, JSON.stringify({ message: "User not found" })),
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

