import { sql } from "drizzle-orm";
import { int, index, sqliteTableCreator, text } from "drizzle-orm/sqlite-core";

const createTable = sqliteTableCreator((name) => `DumbDoNot_${name}`);

export const users = createTable("users", {
  id: int("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name", { length: 256 }).notNull(),
  password: text("password", { length: 256 }).notNull(),
  salt: text("salt", { length: 256 }).notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).$onUpdate(() => new Date()).notNull(),
}, (table) => [index("name_index").on(table.name)]);

export const sessions = createTable("sessions", {
  id: int("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: int("user_id").references(() => users.id).unique().notNull(),
  killAt: int("kill_at", { mode: "timestamp" }).default(sql`(unixepoch()+60*60)`).notNull(),
}, (table) => [index("user_index").on(table.userId)]);

export const notes = createTable("notes", {
  id: int("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name", { length: 256 }).default('My Note').notNull(),
  content: text("content").notNull(),
  public: int("public", { mode: "boolean" }).default(false).notNull(),
  notebookId: int("notebook_id").references(() => notebooks.id).notNull(),
  ownerId: int("owner_id").references(() => users.id).notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).$onUpdate(() => new Date()).notNull(),
});

export const todos = createTable("todos", {
  id: int("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name", { length: 256 }).notNull(),
  description: text("content").notNull(),
  done: int("done", { mode: "boolean" }).default(false).notNull(),
  noteId: int("note_id").references(() => notes.id).notNull(),
  ownerId: int("owner_id").references(() => users.id).notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).$onUpdate(() => new Date()).notNull(),
});

export const notebooks = createTable("notebooks", {
  id: int("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name", { length: 256 }).default("My Notebook").notNull(),
  ownerId: int("owner_id").references(() => users.id),
  public: int("public", { mode: "boolean" }).default(false).notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).$onUpdate(() => new Date()).notNull(),
});

