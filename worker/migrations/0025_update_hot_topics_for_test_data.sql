-- Migration 0025: Update hot_topics to match test dataset
-- Keeps 7 existing topics, updates 3 others to match our actual bill data
-- No data loss, no FK violations

-- Keep these 7 as-is (IDs 1-7):
-- 1. property-tax-relief
-- 2. water-rights
-- 3. education-funding
-- 4. energy-permitting
-- 5. public-safety-fentanyl
-- 6. housing-land-use
-- 7. reproductive-health

-- Update row 8 from "rural-healthcare-hospitals" to "healthcare-access"
UPDATE hot_topics SET slug='healthcare-access', title='Healthcare Access & Medicaid', summary='Medicaid coverage, hospital services, EMS funding, and healthcare provider support.', priority=70 WHERE id=8;

-- Update row 9 from "property-rights-eminent-domain" to "criminal-justice-reform"
UPDATE hot_topics SET slug='criminal-justice-reform', title='Criminal Justice & Public Safety', summary='Crime amendments, penalties, law enforcement resources, and public safety initiatives.', priority=100 WHERE id=9;

-- Update row 10 from "state-lands-grazing" to "child-safety-education"
UPDATE hot_topics SET slug='child-safety-education', title='Child Safety & Education', summary='Minor protection, school safety, curriculum oversight, and K-12 education initiatives.', priority=90 WHERE id=10;

-- Deactivate unused topics (rows 11-12)
UPDATE hot_topics SET is_active=0 WHERE id IN (11, 12);
