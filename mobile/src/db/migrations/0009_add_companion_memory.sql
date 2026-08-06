CREATE TABLE `companion_memory` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_companion_memory_created_at` ON `companion_memory` (`created_at`);--> statement-breakpoint
ALTER TABLE `companion_metadata` ADD `relationship_level` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `companion_metadata` ADD `last_seen_at` integer;
