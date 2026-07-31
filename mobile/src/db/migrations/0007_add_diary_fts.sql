-- Isolated FTS5 virtual table. Kept in its own migration so that if FTS5 is
-- unavailable on a given build, only this migration fails and the diary tables
-- created by 0006 still persist.

CREATE VIRTUAL TABLE IF NOT EXISTS `diary_fts` USING fts5(
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
