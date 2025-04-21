import { sql } from "drizzle-orm";
import { int, index, unique, sqliteTableCreator, text } from "drizzle-orm/sqlite-core";

const createTable = sqliteTableCreator((name) => `DumbDoNot_${name}`);

export const users = createTable("users", {
  id: text("id", { length: 64 }).primaryKey(),
  name: text("name", { length: 256 }).unique().notNull(),
  password: text("password", { length: 256 }).notNull(),
  salt: text("salt", { length: 256 }).notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).$onUpdate(() => new Date()).notNull(),
}, (table) => [index("name_index").on(table.name)]);

export const sessions = createTable("sessions", {
  id: text("id", { length: 64 }).primaryKey(),
  userId: text("user_id", { length: 64 }).references(() => users.id).unique().notNull(),
  killAt: int("kill_at", { mode: "timestamp" }).default(sql`(unixepoch()+60*60)`).notNull(),
}, (table) => [index("user_index").on(table.userId)]);

export const notes = createTable("notes", {
  id: text("id", { length: 64 }).primaryKey(),
  name: text("name", { length: 256 }).default('My Note').notNull(),
  content: text("content").notNull(),
  public: int("public", { mode: "boolean" }).default(false).notNull(),
  notebookId: text("notebook_id", { length: 64 }).references(() => notebooks.id).notNull(),
  ownerId: text("owner_id", { length: 64 }).references(() => users.id).notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).$onUpdate(() => new Date()).notNull(),
}, (table) => [unique("owner_note_names").on(table.ownerId, table.name)]);

export const todos = createTable("todos", {
  id: text("id", { length: 64 }).primaryKey(),
  name: text("name", { length: 256 }).notNull(),
  description: text("content").notNull(),
  done: int("done", { mode: "boolean" }).default(false).notNull(),
  public: int("public", { mode: "boolean" }).default(false).notNull(),
  noteId: text("note_id", { length: 64 }).references(() => notes.id),
  ownerId: text("owner_id", { length: 64 }).references(() => users.id).notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).$onUpdate(() => new Date()).notNull(),
});

export const notebooks = createTable("notebooks", {
  id: text("id", { length: 64 }).primaryKey(),
  name: text("name", { length: 256 }).default("My Notebook").notNull(),
  ownerId: text("owner_id", { length: 64 }).references(() => users.id),
  public: int("public", { mode: "boolean" }).default(false).notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: int("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).$onUpdate(() => new Date()).notNull(),
}, (table) => [unique("onwer_book_names").on(table.ownerId, table.name)]);

