-- worker/migrations/0022_add_summary_to_podcast_uploads.sql
ALTER TABLE podcast_uploads ADD COLUMN summary TEXT;
