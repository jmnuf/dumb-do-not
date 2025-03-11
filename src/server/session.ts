import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import type { Cookie } from "elysia";
import { Buffer } from "node:buffer";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { env } from "../env";
import { db, sessions } from "./db";

const IV_LENGTH = 16;

export const SESSION_COOKIE = "X-DumbDoNot-User";
export const SESSION_COOKIE_SCHEMA = z.object({
  session: z.coerce.number(),
  user: z.object({
    id: z.coerce.number(),
    name: z.string(),
  }),
});
export type SessionCookie = z.infer<typeof SESSION_COOKIE_SCHEMA>;
export type Cookies = Record<string, Cookie<string | undefined>>;
export type SessionStatus = "none" | "expired" | "active" | "invalid";

function getSessionDataFromCookie(userSessionCookie: string | undefined) {
  if (!userSessionCookie) {
    return false;
  }
  const userSessionResult = decryptCookie(userSessionCookie);
  if (!userSessionResult.success) {
    return null;
  }
  return userSessionResult.data;
}

async function checkSessionData(sessionData: z.infer<typeof SESSION_COOKIE_SCHEMA>, cookies: Cookies): Promise<SessionStatus> {
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
  if (activeSession.userId != sessionData.user.id) {
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
  const sessionData = getSessionDataFromCookie(cookie.value);
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

export const encryptCookie = (data: SessionCookie) => {
  const stringifiedData = JSON.stringify(data);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(
    "aes-256-cbc",
    Buffer.from(env.ENCRYPTION_KEY),
    iv
  );
  let encrypted = cipher.update(stringifiedData);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

const decryptCookie = (encryptedData: string) => {
  const [ivHex, encryptedTextHex] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encryptedText = Buffer.from(encryptedTextHex, "hex");
  const decipher = createDecipheriv(
    "aes-256-cbc",
    Buffer.from(env.ENCRYPTION_KEY),
    iv
  );
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  const data = JSON.parse(decrypted.toString());
  return SESSION_COOKIE_SCHEMA.safeParse(data);
};

