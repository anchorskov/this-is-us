-- Migration 0041: Archive hot_topics_staging tables (dead code removal)
-- Purpose: Remove unused staging workflow tables and audit logs
-- 
-- Context: hot_topics_staging was created for AI analysis workflow (AI → staging → admin review → production)
-- but the actual implementation uses hot_topics_draft instead (admin UI → draft → publish).
-- 
-- hot_topics_staging is NOT used in production code:
--   - hotTopicsValidator.mjs uses it (but this module is also unused)
--   - No endpoints query it
--   - No admin UI depends on it
--
-- Decision: Keep hot_topics_draft (actively used in adminHotTopics.mjs and UI)
-- 
-- This migration archives the tables by dropping them. If reverting is needed,
-- refer to migration 0036_create_hot_topics_staging.sql to recreate.

-- ════════════════════════════════════════════════════════════════════════════════
-- Drop unused staging tables
-- ════════════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS hot_topics_review_audit;
DROP TABLE IF EXISTS hot_topics_staging;

-- ════════════════════════════════════════════════════════════════════════════════
-- Keep hot_topics_draft and hot_topic_civic_items_draft (actively used)
-- ════════════════════════════════════════════════════════════════════════════════
-- These tables power the admin UI hot topics edit/review workflow in adminHotTopics.mjs
-- Endpoints:
--   - GET /api/admin/hot-topics/drafts
--   - POST /api/admin/hot-topics/drafts/:topicId
--   - POST /api/admin/hot-topics/publish
--   - POST /api/admin/hot-topics/reject
