-- Ensure AI tags are idempotent per bill/topic
-- Adds unique index on (item_id, topic_slug) to prevent duplicates

CREATE UNIQUE INDEX IF NOT EXISTS civic_item_ai_tags_item_topic_unique
  ON civic_item_ai_tags (item_id, topic_slug);
