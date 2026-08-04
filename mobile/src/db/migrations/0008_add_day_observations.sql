CREATE TABLE `symptoms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`icon` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cycle_days` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`log_date` text NOT NULL,
	`mood` text,
	`mood_intensity` integer,
	`pain_level` integer,
	`energy_level` integer,
	`sleep_minutes` integer,
	`water_glasses` integer,
	`flow_level` text,
	`notes` text,
	`symptoms` text DEFAULT '[]' NOT NULL,
	`medications` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cycle_days_user_id` ON `cycle_days` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_cycle_days_log_date` ON `cycle_days` (`log_date`);--> statement-breakpoint
CREATE TABLE `day_symptoms` (
	`id` text PRIMARY KEY NOT NULL,
	`day_id` text NOT NULL,
	`symptom_id` text NOT NULL,
	`severity` integer DEFAULT 3 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_day_symptoms_day_id` ON `day_symptoms` (`day_id`);--> statement-breakpoint
CREATE INDEX `idx_day_symptoms_symptom_id` ON `day_symptoms` (`symptom_id`);--> statement-breakpoint
CREATE TABLE `day_medications` (
	`id` text PRIMARY KEY NOT NULL,
	`day_id` text NOT NULL,
	`medication_id` text NOT NULL,
	`dose` text,
	`taken_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_day_medications_day_id` ON `day_medications` (`day_id`);--> statement-breakpoint
CREATE INDEX `idx_day_medications_medication_id` ON `day_medications` (`medication_id`);