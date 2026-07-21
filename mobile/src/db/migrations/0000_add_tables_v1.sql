CREATE TABLE `chat_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`participant_count` integer DEFAULT 0 NOT NULL,
	`last_message` text,
	`last_message_at` text,
	`unread_count` integer DEFAULT 0 NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cycle_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`period_start_date` text NOT NULL,
	`period_end_date` text,
	`flow_intensity` text,
	`symptoms` text DEFAULT '[]',
	`mood_tags` text DEFAULT '[]',
	`energy_level` integer,
	`notes` text,
	`is_correction` integer DEFAULT false,
	`corrected_prediction_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cycle_entries_user_id` ON `cycle_entries` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_cycle_entries_period_start` ON `cycle_entries` (`period_start_date`);--> statement-breakpoint
CREATE INDEX `idx_cycle_entries_synced_at` ON `cycle_entries` (`synced_at`);--> statement-breakpoint
CREATE TABLE `emergency_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`phone_number` text NOT NULL,
	`relationship` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`contact_user_id` text,
	`contact_user_id_linked_at` text,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_emergency_contacts_user_id` ON `emergency_contacts` (`user_id`);--> statement-breakpoint
CREATE TABLE `family_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`linked_user_id` text,
	`status` text NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_family_links_user_id` ON `family_links` (`user_id`);--> statement-breakpoint
CREATE TABLE `feature_flags` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT false NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `health_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`total_journal_entries` integer DEFAULT 0 NOT NULL,
	`total_mood_logs` integer DEFAULT 0 NOT NULL,
	`average_mood_intensity` integer,
	`most_common_mood` text,
	`recommendation` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_health_insights_user_id` ON `health_insights` (`user_id`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`content` text,
	`mood` text,
	`sentiment_score` integer,
	`sentiment_label` text,
	`entry_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_journal_entries_user_id` ON `journal_entries` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_entries_entry_date` ON `journal_entries` (`entry_date`);--> statement-breakpoint
CREATE TABLE `mood_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mood` text NOT NULL,
	`intensity` integer NOT NULL,
	`notes` text,
	`logged_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_mood_logs_user_id` ON `mood_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_mood_logs_logged_at` ON `mood_logs` (`logged_at`);--> statement-breakpoint
CREATE TABLE `nurse_contents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`category` text NOT NULL,
	`tags` text,
	`body` text,
	`references` text,
	`published_at` text NOT NULL,
	`updated_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `onboarding_data` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`age` integer NOT NULL,
	`height_cm` integer NOT NULL,
	`weight_kg` integer NOT NULL,
	`stress_level` text NOT NULL,
	`exercise_frequency` text NOT NULL,
	`sleep_hours` integer NOT NULL,
	`diet` text NOT NULL,
	`current_cycle_start` text NOT NULL,
	`current_cycle_length` integer NOT NULL,
	`current_period_length` integer NOT NULL,
	`current_symptoms` text DEFAULT '[]' NOT NULL,
	`past_cycles` text DEFAULT '[]' NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`predicted_next_period_start` text NOT NULL,
	`predicted_period_end` text,
	`predicted_fertile_window_start` text,
	`predicted_fertile_window_end` text,
	`model_type` text NOT NULL,
	`confidence_score` integer,
	`confidence_label` text,
	`training_data_points` integer DEFAULT 0 NOT NULL,
	`prediction_window_days` integer,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_predictions_user_id` ON `predictions` (`user_id`);--> statement-breakpoint
CREATE TABLE `pregnancy_daily_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`symptoms` text,
	`mood` text,
	`weight_kg` integer,
	`blood_pressure_systolic` integer,
	`blood_pressure_diastolic` integer,
	`notes` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pregnancy_daily_logs_user_id` ON `pregnancy_daily_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `pregnancy_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week` integer NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`is_completed` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pregnancy_milestones_user_id` ON `pregnancy_milestones` (`user_id`);--> statement-breakpoint
CREATE TABLE `pregnancy_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`due_date` text,
	`weeks_pregnant` integer NOT NULL,
	`trimester` integer NOT NULL,
	`baby_name` text,
	`blood_type` text,
	`allergies` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pregnancy_profiles_user_id` ON `pregnancy_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `pregnancy_recommendations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`week` integer NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`priority` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_pregnancy_recommendations_user_id` ON `pregnancy_recommendations` (`user_id`);--> statement-breakpoint
CREATE TABLE `sos_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`triggered_at` text NOT NULL,
	`latitude` integer NOT NULL,
	`longitude` integer NOT NULL,
	`location_accuracy_m` integer,
	`sms_status` text NOT NULL,
	`cancelled_at` text,
	`resolved_at` text,
	`false_alarm` integer DEFAULT false NOT NULL,
	`manual_intervention_needed` integer DEFAULT false NOT NULL,
	`trigger_source` text,
	`is_active` integer DEFAULT true NOT NULL,
	`deleted_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sos_alerts_user_id` ON `sos_alerts` (`user_id`);--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`direction` text NOT NULL,
	`status` text NOT NULL,
	`operations_count` integer DEFAULT 0 NOT NULL,
	`conflicts_count` integer DEFAULT 0 NOT NULL,
	`errors_count` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sync_log_user_id` ON `sync_log` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`phone_number` text,
	`display_name` text,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`provider` text DEFAULT 'local' NOT NULL,
	`onboarding_completed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`last_login_at` text,
	`synced_at` text NOT NULL
);
