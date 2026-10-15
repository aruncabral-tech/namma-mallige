CREATE TABLE `bill_access` (
	`bill_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`recipient_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bill_access_token_hash_unique` ON `bill_access` (`token_hash`);--> statement-breakpoint
CREATE TABLE `bill_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`bill_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`access_hash` text NOT NULL,
	`bill_version` integer NOT NULL,
	`day_index` integer,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `owners`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_bill_corrections_owner_status_created` ON `bill_corrections` (`owner_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_bill_corrections_access_created` ON `bill_corrections` (`access_hash`,`created_at`);