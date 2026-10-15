CREATE TABLE `subscription_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`identity` text NOT NULL,
	`account_type` text NOT NULL,
	`months` integer NOT NULL,
	`amount` integer NOT NULL,
	`mode` text NOT NULL,
	`created_at` integer NOT NULL,
	`paid_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_subscription_orders_identity_paid` ON `subscription_orders` (`identity`,`paid_at`);--> statement-breakpoint
CREATE INDEX `idx_subscription_orders_owner_created` ON `subscription_orders` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`identity` text PRIMARY KEY NOT NULL,
	`trial_ends_at` integer NOT NULL
);
