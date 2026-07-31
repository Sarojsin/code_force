-- Repair migration: 0005 originally shipped without statement-breakpoint markers,
-- so drizzle's migrator executed only the FIRST statement
-- (CREATE TABLE diaries) and silently skipped diary_pages, diary_page_objects,
-- diary_media, diary_assets, and diary_fts. This migration recreates the missing
-- tables with IF NOT EXISTS so both fresh and previously-broken installs converge.

CREATE TABLE IF NOT EXISTS `diary_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`diary_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`page_date` text NOT NULL,
	`memory_title` text,
	`memory_tags` text DEFAULT '[]',
	`memory_people` text DEFAULT '[]',
	`memory_location` text,
	`memory_weather` text,
	`memory_mood` text,
	`version` integer DEFAULT 1 NOT NULL,
	`is_favorite` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text,
	`updated_at` text,
	`synced_at` text,
	FOREIGN KEY (`diary_id`) REFERENCES `diaries`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diary_pages_diary_id` ON `diary_pages` (`diary_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diary_pages_page_date` ON `diary_pages` (`page_date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diary_pages_diary_page` ON `diary_pages` (`diary_id`, `page_number`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `diary_page_objects` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`object_type` text NOT NULL,
	`text_content` text,
	`font_family` text,
	`font_size` integer,
	`color` text,
	`text_alignment` text,
	`media_id` text,
	`caption` text,
	`thumbnail_s3_key` text,
	`video_duration_sec` integer,
	`sticker_id` text,
	`metadata` text DEFAULT '{}',
	`position_x` integer NOT NULL,
	`position_y` integer NOT NULL,
	`width` integer,
	`height` integer,
	`rotation` integer DEFAULT 0,
	`z_index` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text,
	`updated_at` text,
	`synced_at` text,
	FOREIGN KEY (`page_id`) REFERENCES `diary_pages`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diary_page_objects_page_id` ON `diary_page_objects` (`page_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `diary_media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`media_type` text NOT NULL,
	`file_size_bytes` integer NOT NULL,
	`mime_type` text NOT NULL,
	`s3_key` text,
	`thumbnail_s3_key` text,
	`upload_status` text DEFAULT 'local' NOT NULL,
	`duration_sec` integer,
	`width` integer,
	`height` integer,
	`local_file_path` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text,
	`updated_at` text,
	`synced_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diary_media_user_id` ON `diary_media` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `diary_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`asset_version` text,
	`install_status` text DEFAULT 'none' NOT NULL,
	`installed_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_diary_assets_user_id` ON `diary_assets` (`user_id`);
