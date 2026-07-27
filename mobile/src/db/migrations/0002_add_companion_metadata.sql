CREATE TABLE `companion_metadata` (
	`user_id` text PRIMARY KEY NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`coins` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`current_outfit_id` text,
	`owned_outfits` text DEFAULT '[]' NOT NULL,
	`memory` text DEFAULT '{}' NOT NULL,
	`is_hidden` integer DEFAULT 0 NOT NULL,
	`reduce_animations` integer DEFAULT 0 NOT NULL,
	`mute_sounds` integer DEFAULT 0 NOT NULL,
	`assets_version` text,
	`install_status` text DEFAULT 'none' NOT NULL,
	`last_active_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
