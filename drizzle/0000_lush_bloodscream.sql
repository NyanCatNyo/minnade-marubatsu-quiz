CREATE TABLE `answers` (
	`group_id` text NOT NULL,
	`number` integer NOT NULL,
	`choice` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`group_id`, `number`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`phase` text DEFAULT 'setup' NOT NULL,
	`current` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_owner_id` ON `events` (`owner`,`id`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_groups_event_name` ON `groups` (`event_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_groups_token` ON `groups` (`token_hash`);--> statement-breakpoint
CREATE TABLE `questions` (
	`event_id` text NOT NULL,
	`number` integer NOT NULL,
	`category` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	PRIMARY KEY(`event_id`, `number`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
