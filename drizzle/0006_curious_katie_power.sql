ALTER TABLE `subscription_orders` ADD `reference` text;--> statement-breakpoint
ALTER TABLE `subscription_orders` ADD `review_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `subscription_orders` ADD `reviewed_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_orders_reference_unique` ON `subscription_orders` (`reference`);