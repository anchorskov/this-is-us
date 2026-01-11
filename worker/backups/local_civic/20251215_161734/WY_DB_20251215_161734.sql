PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0001_create_base_schema.sql','2025-12-15 16:26:39');
INSERT INTO "d1_migrations" VALUES(2,'0002_add_normalization_tables.sql','2025-12-15 16:26:39');
INSERT INTO "d1_migrations" VALUES(3,'0003_update_city_county_schema.sql','2025-12-15 16:26:39');
INSERT INTO "d1_migrations" VALUES(4,'0004_populate_city_county_lookup.sql','2025-12-15 16:26:39');
INSERT INTO "d1_migrations" VALUES(5,'0005_drop_unused_columns.sql','2025-12-15 16:26:39');
INSERT INTO "d1_migrations" VALUES(6,'0006_create_civic_items.sql','2025-12-15 22:47:47');
INSERT INTO "d1_migrations" VALUES(7,'0007_create_user_ideas.sql','2025-12-15 22:47:47');
INSERT INTO "d1_migrations" VALUES(8,'0008_create_votes.sql','2025-12-15 22:47:47');
INSERT INTO "d1_migrations" VALUES(9,'0009_add_civic_item_ai_tags.sql','2025-12-15 22:47:47');
INSERT INTO "d1_migrations" VALUES(10,'0010_add_reason_summary_to_civic_item_ai_tags.sql','2025-12-15 22:47:48');
INSERT INTO "d1_migrations" VALUES(11,'0011_add_ai_summary_fields_to_civic_items.sql','2025-12-15 22:47:48');
INSERT INTO "d1_migrations" VALUES(12,'0012_create_bill_sponsors.sql','2025-12-15 22:47:48');
INSERT INTO "d1_migrations" VALUES(13,'0013_create_wy_legislators.sql','2025-12-15 22:48:19');
INSERT INTO "d1_migrations" VALUES(14,'0014_add_lat_lng_to_voters_addr_norm.sql','2025-12-15 22:48:19');
INSERT INTO "d1_migrations" VALUES(15,'0015_update_whitehall_coordinates.sql','2025-12-15 22:48:19');
INSERT INTO "d1_migrations" VALUES(16,'0015_create_civic_item_sources.sql','2025-12-15 22:48:19');
INSERT INTO "d1_migrations" VALUES(17,'0016_import_geocoded_coordinates.sql','2025-12-15 22:48:20');
INSERT INTO "d1_migrations" VALUES(18,'0017_import_expanded_geocoded_coordinates.sql','2025-12-15 22:48:25');
INSERT INTO "d1_migrations" VALUES(19,'0018_create_verified_users.sql','2025-12-15 22:48:26');
INSERT INTO "d1_migrations" VALUES(20,'0019_create_civic_item_verification.sql','2025-12-15 22:48:26');
INSERT INTO "d1_migrations" VALUES(21,'0020_add_openstates_person_id_to_bill_sponsors.sql','2025-12-15 22:48:46');
INSERT INTO "d1_migrations" VALUES(22,'0021_add_structural_fields_to_civic_item_verification.sql','2025-12-15 22:48:59');
INSERT INTO "d1_migrations" VALUES(23,'0022_populate_wy_legislators.sql','2025-12-15 22:48:59');
INSERT INTO "d1_migrations" VALUES(24,'0023_add_lso_hydration_fields.sql','2025-12-15 22:48:59');
INSERT INTO "d1_migrations" VALUES(25,'0024_add_unique_civic_item_ai_tags.sql','2025-12-15 22:48:59');
INSERT INTO "d1_migrations" VALUES(26,'0025_create_civic_item_sources.sql','2025-12-15 22:48:59');
CREATE TABLE voters (
  voter_id TEXT PRIMARY KEY
);
CREATE TABLE wy_city_county (
  id INTEGER PRIMARY KEY,
  city TEXT NOT NULL,
  county TEXT NOT NULL,
  state TEXT DEFAULT 'WY'
, city_norm TEXT, county_norm TEXT, city_raw TEXT, county_raw TEXT);
INSERT INTO "wy_city_county" VALUES(1,'LARAMIE','ALBANY','WY','LARAMIE','ALBANY','LARAMIE','ALBANY');
INSERT INTO "wy_city_county" VALUES(2,'RAWLINS','CARBON','WY','RAWLINS','CARBON','RAWLINS','CARBON');
INSERT INTO "wy_city_county" VALUES(3,'ROCK SPRINGS','SWEETWATER','WY','ROCK SPRINGS','SWEETWATER','ROCK SPRINGS','SWEETWATER');
INSERT INTO "wy_city_county" VALUES(4,'GREEN RIVER','SWEETWATER','WY','GREEN RIVER','SWEETWATER','GREEN RIVER','SWEETWATER');
INSERT INTO "wy_city_county" VALUES(5,'PINEDALE','SUBLETTE','WY','PINEDALE','SUBLETTE','PINEDALE','SUBLETTE');
INSERT INTO "wy_city_county" VALUES(6,'JACKSON','TETON','WY','JACKSON','TETON','JACKSON','TETON');
INSERT INTO "wy_city_county" VALUES(7,'CODY','PARK','WY','CODY','PARK','CODY','PARK');
INSERT INTO "wy_city_county" VALUES(8,'POWELL','PARK','WY','POWELL','PARK','POWELL','PARK');
INSERT INTO "wy_city_county" VALUES(9,'THERMOPOLIS','HOT SPRINGS','WY','THERMOPOLIS','HOT SPRINGS','THERMOPOLIS','HOT SPRINGS');
INSERT INTO "wy_city_county" VALUES(10,'WORLAND','WASHAKIE','WY','WORLAND','WASHAKIE','WORLAND','WASHAKIE');
INSERT INTO "wy_city_county" VALUES(11,'TEN SLEEP','WASHAKIE','WY','TEN SLEEP','WASHAKIE','TEN SLEEP','WASHAKIE');
INSERT INTO "wy_city_county" VALUES(12,'BUFFALO','JOHNSON','WY','BUFFALO','JOHNSON','BUFFALO','JOHNSON');
INSERT INTO "wy_city_county" VALUES(13,'KAYCEE','JOHNSON','WY','KAYCEE','JOHNSON','KAYCEE','JOHNSON');
INSERT INTO "wy_city_county" VALUES(14,'SHERIDAN','SHERIDAN','WY','SHERIDAN','SHERIDAN','SHERIDAN','SHERIDAN');
INSERT INTO "wy_city_county" VALUES(15,'DAYTON','SHERIDAN','WY','DAYTON','SHERIDAN','DAYTON','SHERIDAN');
INSERT INTO "wy_city_county" VALUES(16,'GILLETTE','CAMPBELL','WY','GILLETTE','CAMPBELL','GILLETTE','CAMPBELL');
INSERT INTO "wy_city_county" VALUES(17,'WRIGHT','CAMPBELL','WY','WRIGHT','CAMPBELL','WRIGHT','CAMPBELL');
INSERT INTO "wy_city_county" VALUES(18,'RECLUSE','CAMPBELL','WY','RECLUSE','CAMPBELL','RECLUSE','CAMPBELL');
INSERT INTO "wy_city_county" VALUES(19,'ARVADA','CAMPBELL','WY','ARVADA','CAMPBELL','ARVADA','CAMPBELL');
INSERT INTO "wy_city_county" VALUES(20,'NEWCASTLE','WESTON','WY','NEWCASTLE','WESTON','NEWCASTLE','WESTON');
INSERT INTO "wy_city_county" VALUES(21,'UPTON','WESTON','WY','UPTON','WESTON','UPTON','WESTON');
INSERT INTO "wy_city_county" VALUES(22,'SUNDANCE','CROOK','WY','SUNDANCE','CROOK','SUNDANCE','CROOK');
INSERT INTO "wy_city_county" VALUES(23,'MOORCROFT','CROOK','WY','MOORCROFT','CROOK','MOORCROFT','CROOK');
INSERT INTO "wy_city_county" VALUES(24,'DEVILS TOWER','CROOK','WY','DEVILS TOWER','CROOK','DEVILS TOWER','CROOK');
INSERT INTO "wy_city_county" VALUES(25,'GILLETTE','CAMPBELL','WY','GILLETTE','CAMPBELL','GILLETTE','CAMPBELL');
INSERT INTO "wy_city_county" VALUES(26,'LOVELL','BIG HORN','WY','LOVELL','BIG HORN','LOVELL','BIG HORN');
INSERT INTO "wy_city_county" VALUES(27,'BASIN','BIG HORN','WY','BASIN','BIG HORN','BASIN','BIG HORN');
INSERT INTO "wy_city_county" VALUES(28,'GREYBULL','BIG HORN','WY','GREYBULL','BIG HORN','GREYBULL','BIG HORN');
INSERT INTO "wy_city_county" VALUES(29,'CASPER','NATRONA','WY','CASPER','NATRONA','CASPER','NATRONA');
INSERT INTO "wy_city_county" VALUES(30,'MILLS','NATRONA','WY','MILLS','NATRONA','MILLS','NATRONA');
INSERT INTO "wy_city_county" VALUES(31,'EVANSTON','UINTA','WY','EVANSTON','UINTA','EVANSTON','UINTA');
INSERT INTO "wy_city_county" VALUES(32,'LYMAN','UINTA','WY','LYMAN','UINTA','LYMAN','UINTA');
INSERT INTO "wy_city_county" VALUES(33,'MOUNTAIN VIEW','UINTA','WY','MOUNTAIN VIEW','UINTA','MOUNTAIN VIEW','UINTA');
INSERT INTO "wy_city_county" VALUES(34,'CHEYENNE','LARAMIE','WY','CHEYENNE','LARAMIE','CHEYENNE','LARAMIE');
INSERT INTO "wy_city_county" VALUES(35,'LARAMIE','ALBANY','WY','LARAMIE','ALBANY','LARAMIE','ALBANY');
INSERT INTO "wy_city_county" VALUES(104,'CHEYENNE','LARAMIE','WY','CHEYENNE','LARAMIE','CHEYENNE','LARAMIE');
INSERT INTO "wy_city_county" VALUES(129,'CASPER','NATRONA','WY','CASPER','NATRONA','CASPER','NATRONA');
INSERT INTO "wy_city_county" VALUES(168,'ROCK SPRINGS','SWEETWATER','WY','ROCK SPRINGS','SWEETWATER','ROCK SPRINGS','SWEETWATER');
CREATE TABLE streets_index (
  id INTEGER PRIMARY KEY,
  city_county_id INTEGER NOT NULL REFERENCES wy_city_county(id),
  street_prefix TEXT,
  street_core TEXT NOT NULL,
  street_type TEXT,
  street_suffix TEXT,
  street_canonical TEXT NOT NULL,
  raw_address TEXT
);
CREATE TABLE tmp_voter_street (
  voter_id TEXT PRIMARY KEY REFERENCES voters(voter_id),
  streets_index_id INTEGER REFERENCES streets_index(id)
);
CREATE TABLE voters_addr_norm (
  voter_id TEXT PRIMARY KEY,
  addr1 TEXT,
  city TEXT NOT NULL,
  senate TEXT,
  house TEXT,
  city_county_id INTEGER REFERENCES wy_city_county(id),
  street_index_id INTEGER REFERENCES streets_index(id),
  addr_raw TEXT,
  fn TEXT,
  ln TEXT,
  zip TEXT,
  state TEXT
, lat REAL, lng REAL);
CREATE TABLE voter_phones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voter_id TEXT NOT NULL REFERENCES voters(voter_id),
  phone_number TEXT NOT NULL,
  phone_type TEXT,
  is_primary INTEGER DEFAULT 0
);
CREATE TABLE voters_raw (
  voter_id TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  ra_city TEXT,
  ra_zip TEXT,
  county TEXT,
  precinct TEXT,
  house TEXT,
  senate TEXT
);
CREATE TABLE voters_norm (
  voter_id TEXT PRIMARY KEY,
  party_form5 TEXT,
  reg_year INTEGER
);
CREATE TABLE IF NOT EXISTS "v_best_phone_old" (
  voter_id TEXT PRIMARY KEY,
  phone_e164 TEXT
);
CREATE TABLE IF NOT EXISTS "streets_index_old" (
  city_county_id INTEGER NOT NULL,
  street_prefix TEXT,
  street_core TEXT NOT NULL,
  street_type TEXT,
  street_suffix TEXT,
  street_canonical TEXT NOT NULL,
  raw_address TEXT
);
CREATE TABLE civic_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  source TEXT NOT NULL,
  level TEXT NOT NULL,
  jurisdiction_key TEXT NOT NULL,
  bill_number TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL,
  legislative_session TEXT,
  chamber TEXT,
  ballot_type TEXT,
  measure_code TEXT,
  election_date TEXT,
  external_ref_id TEXT,
  external_url TEXT,
  text_url TEXT,
  category TEXT,
  subject_tags TEXT,
  location_label TEXT,
  introduced_at TEXT,
  last_action TEXT,
  last_action_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  up_votes INTEGER NOT NULL DEFAULT 0,
  down_votes INTEGER NOT NULL DEFAULT 0
, ai_summary TEXT, ai_key_points TEXT, ai_summary_version TEXT, ai_summary_generated_at TEXT);
INSERT INTO "civic_items" VALUES('test-hb22','bill','lso','statewide','WY','HB 22','Property Tax Assessment Cap','Establishes annual caps on property tax assessment increases at 3% or inflation, whichever is lower, to prevent sudden tax spikes on homeowners.','introduced','2025','lower',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-15T23:06:59Z','2025-12-15T23:06:59Z',0,0,'This bill aims to limit how much property taxes can increase each year. The increase would be capped at either 3% or the rate of inflation, whichever is lower, to help prevent large tax jumps for homeowners.','["Establishes a cap on property tax assessment increases at 3% annually.","Limits tax increases to the rate of inflation if it is lower than 3%."]',NULL,'2025-12-15 23:08:26');
INSERT INTO "civic_items" VALUES('test-hb164','bill','lso','statewide','WY','HB 164','Groundwater Withdrawal Permits','Establishes new permitting process for groundwater withdrawal in high-demand regions with impact assessments for competing water uses.','in_committee','2025','lower',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-15T23:06:59Z','2025-12-15T23:06:59Z',0,0,'This bill creates a new process for getting permits to take groundwater in areas where water is in high demand. It also requires checking how this water use might affect other water needs.','["Creates a new permitting process for groundwater withdrawal in high-demand areas.","Requires impact assessments for competing water uses."]',NULL,'2025-12-15 23:08:32');
INSERT INTO "civic_items" VALUES('test-sf174','bill','lso','statewide','WY','SF 174','K-12 Education Funding Formula','Revises school funding distribution to increase per-pupil spending and boost support for rural districts and special education.','introduced','2025','upper',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-15T23:06:59Z','2025-12-15T23:06:59Z',0,0,'This bill changes how schools in Wyoming get their funding. It aims to give more money per student and provide extra support for rural schools and special education.','["Increases per-pupil spending in schools.","Boosts financial support for rural districts and special education programs."]',NULL,'2025-12-15 23:08:38');
INSERT INTO "civic_items" VALUES('test-hb286','bill','lso','statewide','WY','HB 286','Renewable Energy Transmission Permitting','Streamlines permitting for transmission lines connecting renewable energy projects to the grid with expedited review timelines.','pending_vote','2025','lower',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-15T23:06:59Z','2025-12-15T23:06:59Z',0,0,'The bill aims to make it easier and faster to get approval for building transmission lines that connect renewable energy projects to the power grid.','["Streamlines the permitting process for transmission lines.","Expedites review timelines for connecting renewable energy projects to the grid."]',NULL,'2025-12-15 23:08:44');
INSERT INTO "civic_items" VALUES('test-sf89','bill','lso','statewide','WY','SF 89','Fentanyl Interdiction and Treatment','Provides funding for fentanyl interdiction and expands access to medication-assisted treatment and recovery services.','introduced','2025','upper',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2025-12-15T23:06:59Z','2025-12-15T23:06:59Z',0,0,'This bill provides money to help stop the illegal use of fentanyl and makes it easier for people to get treatment and recovery services for addiction.','["Provides funding for efforts to stop illegal fentanyl use.","Expands access to treatment and recovery services for addiction."]',NULL,'2025-12-15 23:08:49');
CREATE TABLE user_ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT REFERENCES civic_items(id),
  author_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  up_votes INTEGER NOT NULL DEFAULT 0,
  down_votes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  value INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, target_type, target_id)
);
CREATE TABLE civic_item_ai_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,            
  topic_slug TEXT NOT NULL,         
  confidence REAL NOT NULL,
  trigger_snippet TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
, reason_summary TEXT);
INSERT INTO "civic_item_ai_tags" VALUES(1,'test-hb22','property-tax-relief',0.95,'Establishes a cap on property tax assessment increases at 3% annually','2025-12-15 23:08:29','This bill directly addresses property tax relief by capping annual assessment increases, which helps prevent large tax jumps for homeowners. This is a significant concern for Wyomingites facing rising property taxes.');
INSERT INTO "civic_item_ai_tags" VALUES(2,'test-hb164','water-rights',0.85,'Creates a new permitting process for groundwater withdrawal in high-demand areas.','2025-12-15 23:08:35','The bill directly addresses water allocation by establishing a new permitting process for groundwater withdrawal, which is crucial in high-demand areas. This aligns with water rights and drought planning as it aims to balance competing water needs.');
INSERT INTO "civic_item_ai_tags" VALUES(3,'test-sf174','education-funding',0.85,'Increases per-pupil spending in schools','2025-12-15 23:08:40','The bill directly addresses changes in the funding formula for K-12 education, increasing per-student funding and providing additional support for rural and special education. This is a clear match for education funding, as it impacts how schools are financed and aims to address disparities in educational resources.');
INSERT INTO "civic_item_ai_tags" VALUES(4,'test-hb286','energy-permitting',0.85,'Streamlines the permitting process for transmission lines','2025-12-15 23:08:47','The bill focuses on expediting the approval process for transmission lines, which is directly related to energy permitting and grid reliability. This is important for Wyomingites as it facilitates the integration of renewable energy sources into the power grid, potentially enhancing energy reliability and supporting clean energy initiatives.');
INSERT INTO "civic_item_ai_tags" VALUES(5,'test-sf89','public-safety-fentanyl',0.9,'Provides funding for efforts to stop illegal fentanyl use.','2025-12-15 23:08:52','The bill directly addresses the issue of fentanyl by providing funding for interdiction and expanding access to treatment and recovery services. This aligns with public safety efforts to combat opioid trafficking and addiction, which is a significant concern for Wyomingites.');
CREATE TABLE bill_sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civic_item_id TEXT NOT NULL,                
  sponsor_name TEXT NOT NULL,                 
  sponsor_role TEXT NOT NULL,                 
  sponsor_district TEXT,                      
  chamber TEXT,                               
  contact_email TEXT,                         
  contact_phone TEXT,                         
  contact_website TEXT,                       
  created_at TEXT NOT NULL,                   
  updated_at TEXT NOT NULL, openstates_person_id TEXT,                   
  FOREIGN KEY (civic_item_id) REFERENCES civic_items(id) ON DELETE CASCADE
);
CREATE TABLE wy_legislators (
  voter_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  chamber TEXT NOT NULL,
  district INTEGER,
  city TEXT,
  county TEXT,
  party TEXT,
  affiliations TEXT,
  campaign_website TEXT,
  official_profile_url TEXT,
  phone TEXT,
  email TEXT,
  updated TEXT
);
CREATE TABLE civic_item_sources (
  civic_item_id TEXT PRIMARY KEY,
  best_doc_url TEXT,                          
  best_doc_kind TEXT,                         
  status TEXT NOT NULL DEFAULT 'pending',     
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),  
  notes TEXT,                                 
  last_error TEXT,                            
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO "civic_item_sources" VALUES('test-hb22',NULL,NULL,'missing','2025-12-15T23:08:07.527Z',NULL,NULL,'2025-12-15 23:08:07','2025-12-15 23:08:07');
INSERT INTO "civic_item_sources" VALUES('test-hb164',NULL,NULL,'missing','2025-12-15T23:08:08.370Z',NULL,NULL,'2025-12-15 23:08:08','2025-12-15 23:08:08');
INSERT INTO "civic_item_sources" VALUES('test-sf174',NULL,NULL,'missing','2025-12-15T23:08:09.186Z',NULL,NULL,'2025-12-15 23:08:09','2025-12-15 23:08:09');
INSERT INTO "civic_item_sources" VALUES('test-hb286',NULL,NULL,'missing','2025-12-15T23:08:09.985Z',NULL,NULL,'2025-12-15 23:08:09','2025-12-15 23:08:09');
INSERT INTO "civic_item_sources" VALUES('test-sf89',NULL,NULL,'missing','2025-12-15T23:08:10.810Z',NULL,NULL,'2025-12-15 23:08:10','2025-12-15 23:08:10');
CREATE TABLE verified_users (
  user_id TEXT PRIMARY KEY,
  voter_id TEXT NOT NULL UNIQUE,
  county TEXT,
  house TEXT,
  senate TEXT,
  verified_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'verified',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
  
  FOREIGN KEY (voter_id) REFERENCES voters_addr_norm(voter_id) ON DELETE RESTRICT
);
CREATE TABLE civic_item_verification (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civic_item_id INTEGER NOT NULL,
  check_type TEXT NOT NULL,
  topic_match INTEGER NOT NULL,
  summary_safe INTEGER NOT NULL,
  issues TEXT,
  model TEXT NOT NULL,
  confidence REAL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
, is_wyoming INTEGER, has_summary INTEGER, has_wyoming_sponsor INTEGER, structural_ok INTEGER, structural_reason TEXT, has_lso_summary INTEGER, has_lso_text INTEGER, lso_text_source TEXT, review_status TEXT);
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',26);
INSERT INTO "sqlite_sequence" VALUES('civic_item_ai_tags',5);
CREATE INDEX idx_voters_addr_norm_city ON voters_addr_norm(city);
CREATE INDEX idx_voter_phones_voter_id ON voter_phones(voter_id);
CREATE INDEX idx_streets_index_city_county ON streets_index(city_county_id);
CREATE INDEX idx_civic_items_scope ON civic_items(level, jurisdiction_key);
CREATE INDEX idx_civic_items_kind_status ON civic_items(kind, status);
CREATE INDEX idx_civic_items_category ON civic_items(category);
CREATE INDEX idx_user_ideas_item ON user_ideas(item_id);
CREATE INDEX idx_user_ideas_author ON user_ideas(author_user_id);
CREATE INDEX idx_votes_target ON votes(target_type, target_id);
CREATE INDEX civic_item_ai_tags_item_topic
  ON civic_item_ai_tags (item_id, topic_slug);
CREATE INDEX idx_bill_sponsors_civic_item ON bill_sponsors(civic_item_id);
CREATE INDEX idx_bill_sponsors_sponsor_name ON bill_sponsors(sponsor_name);
CREATE INDEX idx_bill_sponsors_district ON bill_sponsors(sponsor_district);
CREATE INDEX idx_wy_legislators_chamber_district ON wy_legislators(chamber, district);
CREATE INDEX idx_wy_legislators_name ON wy_legislators(name);
CREATE INDEX idx_voters_addr_norm_lat_lng
ON voters_addr_norm(lat, lng)
WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX idx_voters_addr_norm_geocoded
ON voters_addr_norm(voter_id)
WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX civic_item_sources_status ON civic_item_sources(status, checked_at);
CREATE INDEX idx_verified_users_voter_id ON verified_users(voter_id);
CREATE INDEX idx_verified_users_status ON verified_users(status);
CREATE INDEX idx_verified_users_user_status ON verified_users(user_id, status);
CREATE INDEX idx_civic_item_verification_latest
  ON civic_item_verification(civic_item_id, created_at DESC);
CREATE INDEX idx_civic_item_verification_status
  ON civic_item_verification(status);
CREATE UNIQUE INDEX idx_civic_item_verification_unique
  ON civic_item_verification(civic_item_id, check_type);
CREATE INDEX idx_bill_sponsors_person_id
  ON bill_sponsors(openstates_person_id);
CREATE INDEX idx_civic_item_verification_structural
  ON civic_item_verification(structural_ok, status);
CREATE INDEX idx_civic_item_verification_lso_ready
  ON civic_item_verification(review_status, status);
CREATE UNIQUE INDEX civic_item_ai_tags_item_topic_unique
  ON civic_item_ai_tags (item_id, topic_slug);
CREATE TRIGGER civic_item_sources_update_timestamp
AFTER UPDATE ON civic_item_sources
BEGIN
  UPDATE civic_item_sources SET updated_at = datetime('now') WHERE civic_item_id = NEW.civic_item_id;
END;
CREATE VIEW v_best_phone AS
SELECT 
  voter_id,
  phone_number,
  phone_type
FROM voter_phones
WHERE is_primary = 1
OR (
  voter_id IN (
    SELECT voter_id FROM voter_phones 
    GROUP BY voter_id 
    HAVING COUNT(*) = 1
  )
);