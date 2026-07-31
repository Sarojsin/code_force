CREATE TABLE `diaries` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`cover_color` text DEFAULT 'primary' NOT NULL,
	`texture_id` text,
	`font_id` text,
	`page_count` integer DEFAULT 0 NOT NULL,
	`is_locked` integer DEFAULT false NOT NULL,
	`lock_type` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text,
	`updated_at` text,
	`synced_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_diaries_user_id` ON `diaries` (`user_id`);
--> statement-breakpoint
CREATE TABLE `diary_pages` (
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
CREATE INDEX `idx_diary_pages_diary_id` ON `diary_pages` (`diary_id`);
--> statement-breakpoint
CREATE INDEX `idx_diary_pages_page_date` ON `diary_pages` (`page_date`);
--> statement-breakpoint
CREATE INDEX `idx_diary_pages_diary_page` ON `diary_pages` (`diary_id`, `page_number`);
--> statement-breakpoint
CREATE TABLE `diary_page_objects` (
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
CREATE INDEX `idx_diary_page_objects_page_id` ON `diary_page_objects` (`page_id`);
--> statement-breakpoint
CREATE TABLE `diary_media` (
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
CREATE INDEX `idx_diary_media_user_id` ON `diary_media` (`user_id`);
--> statement-breakpoint
CREATE TABLE `diary_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`asset_version` text,
	`install_status` text DEFAULT 'none' NOT NULL,
	`installed_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_diary_assets_user_id` ON `diary_assets` (`user_id`);
--> statement-breakpoint
-- Diary FTS virtual table for instant local search
CREATE VIRTUAL TABLE `diary_fts` USING fts5(
	memory_title,
	memory_tags,
	memory_people,
	memory_location,
	memory_weather,
	text_content,
	caption,
	content='diary_pages',
	content_rowid='rowid'
);
