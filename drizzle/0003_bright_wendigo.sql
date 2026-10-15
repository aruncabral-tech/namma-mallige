ALTER TABLE `owners` ADD `account_type` text DEFAULT 'business' NOT NULL;--> statement-breakpoint
ALTER TABLE `owners` ADD `mpin_hash` text;--> statement-breakpoint
ALTER TABLE `owners` ADD `google_sheet_url` text DEFAULT '' NOT NULL;