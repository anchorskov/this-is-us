PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0001_add_events_table.sql','2025-12-15 16:26:41');
INSERT INTO "d1_migrations" VALUES(2,'0002_add_contact_fields.sql','2025-12-15 16:26:41');
INSERT INTO "d1_migrations" VALUES(3,'0003_add_pdf_key_to_events.sql','2025-12-15 16:26:41');
INSERT INTO "d1_migrations" VALUES(4,'0004_add_description_pdfhash.sql','2025-12-15 16:26:41');
INSERT INTO "d1_migrations" VALUES(5,'0005_add_preferences.sql','2025-12-15 16:26:41');
INSERT INTO "d1_migrations" VALUES(6,'0006_seed_topic_index.sql','2025-12-15 16:26:41');
INSERT INTO "d1_migrations" VALUES(7,'0007_create_user_preferences.sql','2025-12-15 22:47:00');
INSERT INTO "d1_migrations" VALUES(8,'0008_add_city_state_to_user_preferences.sql','2025-12-15 22:47:00');
INSERT INTO "d1_migrations" VALUES(9,'0009_add_timestamp_to_user_topic_prefs.sql','2025-12-15 22:47:00');
INSERT INTO "d1_migrations" VALUES(10,'0010_add_voters_addr_norm_test_fixture.sql','2025-12-15 22:47:00');
INSERT INTO "d1_migrations" VALUES(11,'0011_create_hot_topics.sql','2025-12-15 22:47:01');
INSERT INTO "d1_migrations" VALUES(12,'0012_add_match_metadata_to_hot_topic_civic_items.sql','2025-12-15 22:47:30');
INSERT INTO "d1_migrations" VALUES(13,'0013_migrate_hot_topics_schema.sql','2025-12-15 22:47:35');
INSERT INTO "d1_migrations" VALUES(14,'0014_migrate_hot_topic_civic_items_schema.sql','2025-12-15 22:47:35');
INSERT INTO "d1_migrations" VALUES(15,'0015_add_match_criteria_json_to_hot_topics.sql','2025-12-15 22:47:36');
INSERT INTO "d1_migrations" VALUES(16,'0016_create_townhall_posts.sql','2025-12-15 22:47:36');
INSERT INTO "d1_migrations" VALUES(17,'0017_align_preferences_to_hot_topics.sql','2025-12-15 22:47:36');
INSERT INTO "d1_migrations" VALUES(18,'0018_create_townhall_replies.sql','2025-12-15 22:47:36');
INSERT INTO "d1_migrations" VALUES(19,'0019_add_county_to_townhall_posts.sql','2025-12-15 22:47:36');
INSERT INTO "d1_migrations" VALUES(20,'0020_update_hot_topics_keywords.sql','2025-12-15 22:52:09');
INSERT INTO "d1_migrations" VALUES(21,'0021_create_podcast_uploads.sql','2025-12-15 22:52:09');
INSERT INTO "d1_migrations" VALUES(22,'0022_add_summary_to_podcast_uploads.sql','2025-12-15 22:52:09');
INSERT INTO "d1_migrations" VALUES(23,'0025_update_hot_topics_for_test_data.sql','2025-12-15 22:52:43');
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT       NOT NULL,
  date DATE       NOT NULL,
  location TEXT   NOT NULL,
  pdf_url TEXT    NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
, sponsor TEXT, contact_email TEXT, contact_phone TEXT, lat REAL, lng REAL, pdf_key TEXT);
CREATE TABLE topic_index (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE
);
INSERT INTO "topic_index" VALUES(1,'Immigration','immigration');
INSERT INTO "topic_index" VALUES(2,'Public Land Sales','public-land-sales');
INSERT INTO "topic_index" VALUES(3,'Women''s Rights','womens-rights');
INSERT INTO "topic_index" VALUES(4,'Rake Backs','rake-backs');
INSERT INTO "topic_index" VALUES(5,'Voting Access','voting-access');
INSERT INTO "topic_index" VALUES(6,'Criminal Justice Reform','justice-reform');
INSERT INTO "topic_index" VALUES(7,'Campaign Finance','campaign-finance');
INSERT INTO "topic_index" VALUES(8,'Gun Policy','gun-policy');
INSERT INTO "topic_index" VALUES(9,'Healthcare','healthcare');
INSERT INTO "topic_index" VALUES(10,'Education Equity','education-equity');
CREATE TABLE topic_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  proposed_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', 
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE user_preferences (
  firebase_uid TEXT PRIMARY KEY,
  email TEXT,
  theme TEXT,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
, city TEXT, state TEXT);
CREATE TABLE voters_addr_norm (
  voter_id TEXT PRIMARY KEY,
  ln TEXT,
  fn TEXT,
  addr1 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  senate TEXT,
  house TEXT,
  city_county_id INTEGER,
  street_index_id INTEGER,
  addr_raw TEXT
);
INSERT INTO "voters_addr_norm" VALUES('WY-001','SMITH','JOHN','123 MAIN ST','CHEYENNE','WY','82001','SD-01','HD-01',104,NULL,'123 MAIN ST CHEYENNE WY 82001');
INSERT INTO "voters_addr_norm" VALUES('WY-002','SMITH','JANE','456 ELK AVE','CASPER','WY','82601','SD-02','HD-02',129,NULL,'456 ELK AVE CASPER WY 82601');
INSERT INTO "voters_addr_norm" VALUES('WY-003','JOHNSON','ROBERT','789 LODGE RD','LARAMIE','WY','82070','SD-01','HD-03',1,NULL,'789 LODGE RD LARAMIE WY 82070');
INSERT INTO "voters_addr_norm" VALUES('WY-004','JOHNSON','MARY','321 PARK LN','GILLETTE','WY','82716','SD-03','HD-04',25,NULL,'321 PARK LN GILLETTE WY 82716');
INSERT INTO "voters_addr_norm" VALUES('WY-005','WILLIAMS','DAVID','654 RIDGE WAY','ROCK SPRINGS','WY','82901','SD-02','HD-05',168,NULL,'654 RIDGE WAY ROCK SPRINGS WY 82901');
CREATE TABLE wy_city_county (
  id INTEGER PRIMARY KEY,
  city_raw TEXT NOT NULL,
  county_raw TEXT NOT NULL,
  city_norm TEXT NOT NULL,
  county_norm TEXT NOT NULL
);
INSERT INTO "wy_city_county" VALUES(1,'LARAMIE','ALBANY','LARAMIE','ALBANY');
INSERT INTO "wy_city_county" VALUES(25,'GILLETTE','CAMPBELL','GILLETTE','CAMPBELL');
INSERT INTO "wy_city_county" VALUES(104,'CHEYENNE','LARAMIE','CHEYENNE','LARAMIE');
INSERT INTO "wy_city_county" VALUES(129,'CASPER','NATRONA','CASPER','NATRONA');
INSERT INTO "wy_city_county" VALUES(168,'ROCK SPRINGS','SWEETWATER','ROCK SPRINGS','SWEETWATER');
CREATE TABLE hot_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  badge TEXT,
  image_url TEXT,
  cta_label TEXT,
  cta_url TEXT,
  priority INTEGER DEFAULT 100,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
, match_criteria_json TEXT);
INSERT INTO "hot_topics" VALUES(1,'property-tax-relief','Property Tax Relief','property tax, mill levies, rising assessments, homeowner relief, exemptions, caps, senior tax relief','Taxes',NULL,'See current proposals','/hot-topics/property-tax-relief',10,1,'2025-12-15 22:47:35','2025-12-15 22:52:09',NULL);
INSERT INTO "hot_topics" VALUES(2,'water-rights','Water Rights & Drought Planning','water rights, irrigation, drought, reservoirs, storage, agricultural water, municipal water, river compacts, groundwater','Water',NULL,'View water bills','/hot-topics/water-rights',20,1,'2025-12-15 22:47:35','2025-12-15 22:52:09',NULL);
INSERT INTO "hot_topics" VALUES(3,'education-funding','Education Funding & Local Control','school funding, K-12 budgets, education spending, block grant, class sizes, teacher pay, curriculum oversight, local school boards','Education',NULL,'Review education bills','/hot-topics/education-funding',30,1,'2025-12-15 22:47:35','2025-12-15 22:52:09',NULL);
INSERT INTO "hot_topics" VALUES(4,'energy-permitting','Energy Permitting & Grid Reliability','energy projects, transmission lines, wind, solar, oil and gas, permits, siting, reclamation, bonding, environmental review','Energy',NULL,'Check energy bills','/hot-topics/energy-permitting',40,1,'2025-12-15 22:47:35','2025-12-15 22:52:09',NULL);
INSERT INTO "hot_topics" VALUES(5,'public-safety-fentanyl','Public Safety & Fentanyl Response','public safety, crime, theft, burglary, fentanyl, opioids, drug trafficking, sentencing, penalties, law enforcement','Safety',NULL,'See safety bills','/hot-topics/public-safety-fentanyl',50,1,'2025-12-15 22:47:35','2025-12-15 22:52:09',NULL);
INSERT INTO "hot_topics" VALUES(6,'housing-land-use','Housing & Land Use','housing costs, zoning, subdivision, land use, workforce housing, infill, infrastructure for housing, building codes, rental supply','Housing',NULL,'Explore housing bills','/hot-topics/housing-land-use',60,1,'2025-12-15 22:47:35','2025-12-15 22:52:09',NULL);
INSERT INTO "hot_topics" VALUES(7,'reproductive-health','Reproductive Health','pregnancy centers, reproductive health, prenatal care, counseling, abortion, crisis pregnancy, maternal services, patient rights','Health',NULL,NULL,NULL,100,1,'2025-12-15 22:52:09','2025-12-15 22:52:09',NULL);
INSERT INTO "hot_topics" VALUES(8,'healthcare-access','Healthcare Access & Medicaid','Medicaid coverage, hospital services, EMS funding, and healthcare provider support.','Health',NULL,NULL,NULL,70,1,'2025-12-15 22:52:09','2025-12-15 22:52:43',NULL);
INSERT INTO "hot_topics" VALUES(9,'criminal-justice-reform','Criminal Justice & Public Safety','Crime amendments, penalties, law enforcement resources, and public safety initiatives.','Property',NULL,NULL,NULL,100,1,'2025-12-15 22:52:09','2025-12-15 22:52:43',NULL);
INSERT INTO "hot_topics" VALUES(10,'child-safety-education','Child Safety & Education','Minor protection, school safety, curriculum oversight, and K-12 education initiatives.','Lands',NULL,NULL,NULL,90,1,'2025-12-15 22:52:09','2025-12-15 22:52:43',NULL);
INSERT INTO "hot_topics" VALUES(11,'clean-air-geoengineering','Clean Air & Geoengineering','clean air, air quality, emissions, geoengineering, cloud seeding, atmospheric modification, pollution, health impacts, sky experiments','Environment',NULL,NULL,NULL,100,0,'2025-12-15 22:52:09','2025-12-15 22:52:43',NULL);
INSERT INTO "hot_topics" VALUES(12,'guard-veterans-support','Guard & Veterans Support','national guard, reenlistment, bonuses, veteran benefits, military families, deployments, mental health for veterans, education benefits, retention','Service',NULL,NULL,NULL,100,0,'2025-12-15 22:52:09','2025-12-15 22:52:43',NULL);
CREATE TABLE hot_topic_civic_items (
  topic_id INTEGER NOT NULL REFERENCES hot_topics(id),
  civic_item_id INTEGER NOT NULL,
  match_score REAL,
  matched_terms_json TEXT,
  excerpt TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (topic_id, civic_item_id)
);
INSERT INTO "hot_topic_civic_items" VALUES(1,'test-hb22',NULL,NULL,NULL,'2025-12-15 23:08:29');
INSERT INTO "hot_topic_civic_items" VALUES(2,'test-hb164',NULL,NULL,NULL,'2025-12-15 23:08:35');
INSERT INTO "hot_topic_civic_items" VALUES(3,'test-sf174',NULL,NULL,NULL,'2025-12-15 23:08:40');
INSERT INTO "hot_topic_civic_items" VALUES(4,'test-hb286',NULL,NULL,NULL,'2025-12-15 23:08:47');
INSERT INTO "hot_topic_civic_items" VALUES(5,'test-sf89',NULL,NULL,NULL,'2025-12-15 23:08:52');
CREATE TABLE townhall_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt TEXT,
  created_at TEXT NOT NULL,
  r2_key TEXT,
  file_size INTEGER,
  expires_at TEXT,
  city TEXT DEFAULT '',
  state TEXT DEFAULT ''
, county TEXT);
CREATE TABLE user_topic_prefs (
  user_id TEXT NOT NULL,
  topic_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, topic_id),
  FOREIGN KEY (topic_id) REFERENCES hot_topics(id)
);
CREATE TABLE townhall_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  author_user_id TEXT NOT NULL,
  author_voter_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  parent_reply_id INTEGER,

  FOREIGN KEY (thread_id) REFERENCES townhall_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_reply_id) REFERENCES townhall_replies(id) ON DELETE CASCADE
);
CREATE TABLE podcast_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_slug TEXT NOT NULL,
  episode_date TEXT NOT NULL,
  part_number INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP, summary TEXT,
  UNIQUE(guest_slug, episode_date, part_number),
  UNIQUE(r2_key),
  UNIQUE(sha256)
);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',23);
INSERT INTO "sqlite_sequence" VALUES('topic_index',10);
INSERT INTO "sqlite_sequence" VALUES('hot_topics',12);
CREATE INDEX idx_hot_topic_matches_topic_score 
ON hot_topic_civic_items(topic_id, match_score DESC);
CREATE INDEX idx_townhall_posts_created_at ON townhall_posts(created_at DESC);
CREATE INDEX idx_townhall_posts_city ON townhall_posts(city);
CREATE INDEX idx_townhall_replies_thread_status
  ON townhall_replies(thread_id, status)
  WHERE status = 'active';
CREATE INDEX idx_townhall_replies_author_user_id
  ON townhall_replies(author_user_id);
CREATE INDEX idx_townhall_replies_parent
  ON townhall_replies(parent_reply_id)
  WHERE parent_reply_id IS NOT NULL;
CREATE INDEX idx_townhall_replies_created_at
  ON townhall_replies(created_at DESC);
CREATE INDEX idx_townhall_posts_county
  ON townhall_posts(county);
CREATE INDEX idx_townhall_posts_county_created_at
  ON townhall_posts(county, created_at DESC);
CREATE TRIGGER trg_hot_topics_updated
AFTER UPDATE ON hot_topics
BEGIN
  UPDATE hot_topics
     SET updated_at = CURRENT_TIMESTAMP
   WHERE id = NEW.id;
END;
CREATE TRIGGER trg_user_topic_prefs_insert
AFTER INSERT ON user_topic_prefs
BEGIN
  UPDATE user_topic_prefs
     SET created_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
   WHERE user_id = NEW.user_id AND topic_id = NEW.topic_id;
END;
CREATE TRIGGER trg_user_topic_prefs_update
AFTER UPDATE ON user_topic_prefs
BEGIN
  UPDATE user_topic_prefs
     SET updated_at = CURRENT_TIMESTAMP
   WHERE user_id = NEW.user_id AND topic_id = NEW.topic_id;
END;