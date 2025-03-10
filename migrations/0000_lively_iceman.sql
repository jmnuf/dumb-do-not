CREATE TABLE `DumbDoNot_notebooks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(256) DEFAULT 'My Notebook' NOT NULL,
	`owner_id` integer,
	`public` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `DumbDoNot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `DumbDoNot_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(256) DEFAULT 'My Note' NOT NULL,
	`content` text NOT NULL,
	`public` integer DEFAULT false NOT NULL,
	`notebook_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`notebook_id`) REFERENCES `DumbDoNot_notebooks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `DumbDoNot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `DumbDoNot_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`kill_at` integer DEFAULT (unixepoch()+60*60) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `DumbDoNot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `DumbDoNot_sessions_user_id_unique` ON `DumbDoNot_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_index` ON `DumbDoNot_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `DumbDoNot_todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(256) NOT NULL,
	`content` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`note_id` integer NOT NULL,
	`owner_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `DumbDoNot_notes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `DumbDoNot_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `DumbDoNot_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(256) NOT NULL,
	`password` text(256) NOT NULL,
	`salt` text(256) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `name_index` ON `DumbDoNot_users` (`name`);