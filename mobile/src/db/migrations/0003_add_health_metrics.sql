CREATE TABLE `health_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`metric_type` text NOT NULL,
	`value` text NOT NULL,
	`logged_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now'))
);
CREATE INDEX `idx_health_metrics_user_id` ON `health_metrics` (`user_id`);
CREATE INDEX `idx_health_metrics_logged_at` ON `health_metrics` (`logged_at`);
