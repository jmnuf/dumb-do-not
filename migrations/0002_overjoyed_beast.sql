PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_DumbDoNot_notebooks` (
	`id` text(64) PRIMARY KEY NOT NULL,
	`name` text(256) DEFAULT 'My Notebook' NOT NULL,
	`owner_id` text(64),
	`public` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `DumbDoNot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_DumbDoNot_notebooks`("id", "name", "owner_id", "public", "created_at", "updated_at") SELECT "id", "name", "owner_id", "public", "created_at", "updated_at" FROM `DumbDoNot_notebooks`;--> statement-breakpoint
DROP TABLE `DumbDoNot_notebooks`;--> statement-breakpoint
ALTER TABLE `__new_DumbDoNot_notebooks` RENAME TO `DumbDoNot_notebooks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `onwer_book_names` ON `DumbDoNot_notebooks` (`owner_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_DumbDoNot_notes` (
	`id` text(64) PRIMARY KEY NOT NULL,
	`name` text(256) DEFAULT 'My Note' NOT NULL,
	`content` text NOT NULL,
	`public` integer DEFAULT false NOT NULL,
	`notebook_id` text(64) NOT NULL,
	`owner_id` text(64) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `DumbDoNot_notebooks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `DumbDoNot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_DumbDoNot_notes`("id", "name", "content", "public", "notebook_id", "owner_id", "created_at", "updated_at") SELECT "id", "name", "content", "public", "notebook_id", "owner_id", "created_at", "updated_at" FROM `DumbDoNot_notes`;--> statement-breakpoint
DROP TABLE `DumbDoNot_notes`;--> statement-breakpoint
ALTER TABLE `__new_DumbDoNot_notes` RENAME TO `DumbDoNot_notes`;--> statement-breakpoint
CREATE UNIQUE INDEX `owner_note_names` ON `DumbDoNot_notes` (`owner_id`,`name`);--> statement-breakpoint
CREATE TABLE `__new_DumbDoNot_sessions` (
	`id` text(64) PRIMARY KEY NOT NULL,
	`user_id` text(64) NOT NULL,
	`kill_at` integer DEFAULT (unixepoch()+60*60) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `DumbDoNot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_DumbDoNot_sessions`("id", "user_id", "kill_at") SELECT "id", "user_id", "kill_at" FROM `DumbDoNot_sessions`;--> statement-breakpoint
DROP TABLE `DumbDoNot_sessions`;--> statement-breakpoint
ALTER TABLE `__new_DumbDoNot_sessions` RENAME TO `DumbDoNot_sessions`;--> statement-breakpoint
CREATE UNIQUE INDEX `DumbDoNot_sessions_user_id_unique` ON `DumbDoNot_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_index` ON `DumbDoNot_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_DumbDoNot_todos` (
	`id` text(64) PRIMARY KEY NOT NULL,
	`name` text(256) NOT NULL,
	`content` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`public` integer DEFAULT false NOT NULL,
	`note_id` text(64),
	`owner_id` text(64) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `DumbDoNot_notes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `DumbDoNot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_DumbDoNot_todos`("id", "name", "content", "done", "public", "note_id", "owner_id", "created_at", "updated_at") SELECT "id", "name", "content", "done", "public", "note_id", "owner_id", "created_at", "updated_at" FROM `DumbDoNot_todos`;--> statement-breakpoint
DROP TABLE `DumbDoNot_todos`;--> statement-breakpoint
ALTER TABLE `__new_DumbDoNot_todos` RENAME TO `DumbDoNot_todos`;--> statement-breakpoint
CREATE TABLE `__new_DumbDoNot_users` (
	`id` text(64) PRIMARY KEY NOT NULL,
	`name` text(256) NOT NULL,
	`password` text(256) NOT NULL,
	`salt` text(256) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_DumbDoNot_users`("id", "name", "password", "salt", "created_at", "updated_at") SELECT "id", "name", "password", "salt", "created_at", "updated_at" FROM `DumbDoNot_users`;--> statement-breakpoint
DROP TABLE `DumbDoNot_users`;--> statement-breakpoint
ALTER TABLE `__new_DumbDoNot_users` RENAME TO `DumbDoNot_users`;--> statement-breakpoint
CREATE UNIQUE INDEX `DumbDoNot_users_name_unique` ON `DumbDoNot_users` (`name`);--> statement-breakpoint
CREATE INDEX `name_index` ON `DumbDoNot_users` (`name`);