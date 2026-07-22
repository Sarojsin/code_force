CREATE TABLE `snooze_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`predicted_cycle_id` text NOT NULL,
	`snoozed_at` text NOT NULL,
	`day_offset` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_snooze_events_user_id` ON `snooze_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_snooze_events_predicted_cycle_id` ON `snooze_events` (`predicted_cycle_id`);
