import { sql, eq } from "drizzle-orm";
import { db, sessions } from "./db";
import { z } from "zod";
import type { Cookie } from "elysia";

export const SESSION_COOKIE = "X-DumbDoNot-User";
export const SESSION_COOKIE_SCHEMA = z.object({
  session: z.coerce.number(),
  user: z.coerce.number(),
});
export type SessionCookie = z.infer<typeof SESSION_COOKIE_SCHEMA>;
export type Cookies = Record<string, Cookie<string | undefined>>;
export type SessionStatus = "none" | "expired" | "active" | "invalid";

export async function getSessionDataFromCookie(userSessionCookie: string | undefined) {
  if (!userSessionCookie) {
    return false;
  }
  const userSessionResult = SESSION_COOKIE_SCHEMA.safeParse(userSessionCookie);
  if (!userSessionResult.success) {
    return null;
  }
  return userSessionResult.data;
}

export async function checkSessionData(sessionData: z.infer<typeof SESSION_COOKIE_SCHEMA>, cookies: Cookies): Promise<SessionStatus> {
  const activeSession = (
    await db.select({
      now: sql<number>`(unixepoch())`.mapWith((v) => new Date(v)).as("now"),
      killAt: sessions.killAt, userId: sessions.userId,
    })
      .from(sessions)
      .where(eq(sessions.id, sql`${sessionData.session}`))
  )[0];

  let sessionIsValid = true;
  if (activeSession.now.getTime() >= activeSession.killAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sql`${sessionData.session}`));
    sessionIsValid = false;
  }

  if (!activeSession || !sessionIsValid) {
    delete cookies[SESSION_COOKIE];
    return "expired";
  }
  if (activeSession.userId != sessionData.user) {
    delete cookies[SESSION_COOKIE];
    return "invalid";
  }

  return "active";
}

export async function handleSessionCookieCheck<TUnAuthed, TUnAuthorized>(
  cookies: Cookies,
  onUnAuthed: (session: SessionStatus) => TUnAuthed,
  onUnAuthorized: () => TUnAuthorized
) {
  const cookie = cookies[SESSION_COOKIE];
  const sessionData = await getSessionDataFromCookie(cookie.value);
  if (sessionData === null) {
    const response = await onUnAuthorized();
    return { handled: true, response } as const;
  }
  if (sessionData === false) {
    const response = await onUnAuthed("none");
    return { handled: true, response } as const;
  }

  const session = await checkSessionData(sessionData, cookies);
  if (session === "invalid" || session === "none") {
    let response = await onUnAuthorized();
    return { handled: true, response } as const;
  }
  if (session === "expired") {
    const response = await onUnAuthed(session);
    return { handled: true, response } as const;
  }

  return { handled: false, session: { id: sessionData.session, user: sessionData.user, status: session } } as const;
}
