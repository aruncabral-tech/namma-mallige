CREATE TABLE `auth_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `book_daily_prices` (
	`owner_id` text NOT NULL,
	`date` text NOT NULL,
	`jasmine_rate` real NOT NULL,
	`pink_rate` real NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `date`),
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `owner_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`auth_version` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_owner_sessions_owner` ON `owner_sessions` (`owner_id`);--> statement-breakpoint
CREATE TABLE `owners` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_name` text NOT NULL,
	`phone` text NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`password_hash` text NOT NULL,
	`recovery_hash` text NOT NULL,
	`auth_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `owners_phone_unique` ON `owners` (`phone`);--> statement-breakpoint
ALTER TABLE `bills` ADD `owner_id` text DEFAULT 'existing-book' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_bills_owner_updated` ON `bills` (`owner_id`,`updated_at`);