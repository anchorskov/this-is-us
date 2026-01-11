════════════════════════════════════════════════════════════════════════════════
VOTERS_ADDR_NORM LAT/LNG MIGRATION - COMPLETE IMPLEMENTATION PACKAGE
════════════════════════════════════════════════════════════════════════════════

Project: this-is-us.org
Database: WY_DB (Wyoming voter database)
Table: voters_addr_norm (274,656 rows)
Status: Ready for deployment
Created: December 9, 2025

════════════════════════════════════════════════════════════════════════════════
📋 QUICK START
════════════════════════════════════════════════════════════════════════════════

For the impatient: Read this first, then jump to IMPLEMENTATION_SUMMARY.md

Migration file ready:
  ✓ worker/migrations_wy/0014_add_lat_lng_to_voters_addr_norm.sql

Apply migration:
  cd /home/anchor/projects/this-is-us/worker
  ./scripts/wr d1 migrations apply WY_DB --local

Verify it worked:
  ./scripts/wr d1 execute WY_DB --local --command ".schema voters_addr_norm"

Then follow IMPLEMENTATION_SUMMARY.md phases 2-5.

════════════════════════════════════════════════════════════════════════════════
📚 DOCUMENTATION ROADMAP
════════════════════════════════════════════════════════════════════════════════

File                              Purpose                        Audience
─────────────────────────────────────────────────────────────────────────────

IMPLEMENTATION_SUMMARY.md          ← START HERE (5 phases overview)       Everyone
  - Schema after migration
  - 5-phase workflow (apply → export → geocode → import → integrate)
  - CSV schemas (input/output)
  - Quick commands
  - Implementation roadmap (4 weeks)

GEOCODING_WORKFLOW.md              Detailed technical guide       Developers
  - Complete SQL migration code
  - Step-by-step export/geocode/import process
  - 7 practical WSL commands with examples
  - Helper function code (getVerifiedUserLocation)
  - Data population strategy
  - Runtime integration patterns

GEOCODING_VISUAL_GUIDE.md          Flowcharts and diagrams        Visual learners
  - End-to-end architecture diagram
  - CSV flow detail (JSON → CSV → geocode → import)
  - Data flow by voter state (unverified → verified → geocoded)
  - Key metrics and performance estimates
  - Status distribution expectations

VOTERS_ADDR_NORM_CHECKLIST.txt     Quick reference + troubleshooting    Quick lookup
  - Final schema summary
  - All commands in one place
  - CSV schemas
  - Phase breakdown with checkboxes
  - Troubleshooting Q&A

HELPER_SCRIPTS.js                  Reusable Node.js helpers       Automation
  1. export_for_geocoding.js - Convert JSON → CSV
  2. split_for_census.js - Split into 10k chunks
  3. import_geocoding_results.js - Load results into D1
  4. validate_geocoding.js - Check results before import
  5. merge_geocoding_batches.js - Combine batch results

0014_add_lat_lng_to_voters_addr_norm.sql   THE MIGRATION FILE       All
  - Adds lat and lng columns
  - Creates 2 indexes
  - Includes helpful comments
  - Ready to deploy

════════════════════════════════════════════════════════════════════════════════
🎯 WHAT THIS ACCOMPLISHES
════════════════════════════════════════════════════════════════════════════════

BEFORE MIGRATION:
  • voters_addr_norm: 11 columns (no lat/lng)
  • Verified voters have address + district info
  • Frontend must ask for device location for proximity features
  • No cached coordinates in database
  • Repeated location requests = poor UX + privacy concerns

AFTER MIGRATION + GEOCODING:
  • voters_addr_norm: 13 columns (+ lat, lng)
  • Verified voters have cached coordinates from Census data
  • Frontend can use verified address coordinates
  • No device location prompt needed for verified residents
  • Faster, more private, better UX
  • Enables proximity-based features (map, nearest rep, locale info)
  • Ready for "My Location" feature with county badge

════════════════════════════════════════════════════════════════════════════════
📊 BY THE NUMBERS
════════════════════════════════════════════════════════════════════════════════

Table: voters_addr_norm
  Records: 274,656
  Current size: ~200-300 MB (depends on index size)
  After migration: ~220-340 MB (2 REAL columns + 2 indexes)
  
Schema:
  Current columns: 11
  New columns: +2 (lat, lng)
  Total after: 13
  
  Current indexes: 1
  New indexes: +2 (lat/lng, geocoded)
  Total after: 4

Geocoding effort:
  Rows to geocode: ~274,656
  Census batch limit: 10,000 per call
  API calls needed: ~28
  Expected time: 30-60 minutes (includes wait time)
  Expected success rate: 87-95% (typical Census geocoding)

Data distribution after geocoding:
  ✓ Geocoded successfully (OK): ~240k-260k rows
  ✗ No match (NO_MATCH): ~10k-20k rows
  ✗ Errors/other: ~5k rows

Performance impact:
  Query by voter_id: No change (PRIMARY KEY)
  Query by lat/lng: NEW (enables proximity searches)
  Query by district: Can add indexes if needed (OPTIONAL)
  Index storage: +50-100 MB for lat/lng indexes

════════════════════════════════════════════════════════════════════════════════
🚀 RECOMMENDED READING ORDER
════════════════════════════════════════════════════════════════════════════════

For Project Managers / Non-technical:
  1. This file (overview)
  2. GEOCODING_VISUAL_GUIDE.md (see the big picture)
  3. IMPLEMENTATION_SUMMARY.md (timeline and phases)

For Developers / Implementation:
  1. IMPLEMENTATION_SUMMARY.md (phases overview)
  2. GEOCODING_WORKFLOW.md (detailed technical steps)
  3. HELPER_SCRIPTS.js (code to run)
  4. VOTERS_ADDR_NORM_CHECKLIST.txt (reference during work)

For DevOps / Database:
  1. IMPLEMENTATION_SUMMARY.md (schema + commands)
  2. 0014_add_lat_lng_to_voters_addr_norm.sql (the migration)
  3. VOTERS_ADDR_NORM_CHECKLIST.txt (quick reference)

For QA / Testing:
  1. GEOCODING_VISUAL_GUIDE.md (understand data flow)
  2. HELPER_SCRIPTS.js line 4: validate_geocoding.js (validation)
  3. VOTERS_ADDR_NORM_CHECKLIST.txt troubleshooting section

════════════════════════════════════════════════════════════════════════════════
✅ THE 5-PHASE WORKFLOW (Quick Overview)
════════════════════════════════════════════════════════════════════════════════

PHASE 1: APPLY MIGRATION (1 day)
  □ Deploy worker/migrations_wy/0014_add_lat_lng_to_voters_addr_norm.sql
  □ Verify lat and lng columns exist
  □ Confirm indexes created
  Duration: < 5 minutes
  Downtime: None (ALTER TABLE is fast in D1)

PHASE 2: EXPORT DATA (1 day)
  □ Query voters_addr_norm WHERE lat IS NULL OR lng IS NULL
  □ Export to JSON, then convert to CSV
  □ Save to data/voters_addr_norm_to_geocode.csv (~40-50 MB)
  Duration: ~20 minutes
  Downtime: None

PHASE 3: GEOCODE (3-7 days)
  □ Submit CSV to U.S. Census Batch Geocoder
  □ Split into ~28 chunks of 10k rows
  □ Monitor for completion
  □ Receive geocoded results with lat, lng, status
  Duration: 30-60 min active, but wait time varies
  Cost: FREE (Census service has no charge)

PHASE 4: IMPORT RESULTS (1 day)
  □ Validate geocoded CSV (use validate_geocoding.js)
  □ Run import script to UPDATE voters_addr_norm
  □ Verify ~240k-260k rows now have lat/lng
  Duration: 30 seconds to 5 minutes depending on batch size
  Downtime: None (UPDATE runs in background)

PHASE 5: INTEGRATE RUNTIME (2-3 days)
  □ Add getVerifiedUserLocation() helper
  □ Update voters.js to call helper after verification
  □ Test API returns coordinates
  □ Deploy to production
  Duration: 2-4 hours development
  Downtime: Brief during deployment

Total elapsed time: ~2-3 weeks (mostly waiting for Census service)
Total active work: ~8-12 hours

════════════════════════════════════════════════════════════════════════════════
📁 FILE MANIFEST
════════════════════════════════════════════════════════════════════════════════

New files created (in worker/):
  ✓ migrations_wy/0014_add_lat_lng_to_voters_addr_norm.sql
  ✓ IMPLEMENTATION_SUMMARY.md
  ✓ GEOCODING_WORKFLOW.md
  ✓ GEOCODING_VISUAL_GUIDE.md
  ✓ VOTERS_ADDR_NORM_CHECKLIST.txt
  ✓ HELPER_SCRIPTS.js
  ✓ INDEX.md (this file)

Existing files to modify (future phases):
  - src/lib/voterVerification.mjs (add getVerifiedUserLocation)
  - src/routes/voters.js (use helper in handler)

Data files to create (during workflow):
  - data/voters_addr_norm_to_geocode.json (exported)
  - data/voters_addr_norm_to_geocode.csv (converted)
  - data/voters_addr_norm_geocoded.csv (from Census)

════════════════════════════════════════════════════════════════════════════════
🔗 INTEGRATION POINTS
════════════════════════════════════════════════════════════════════════════════

Database Layer (D1):
  • voters_addr_norm table gains lat/lng columns
  • New indexes enable proximity queries
  • No breaking changes to existing queries

API Layer (worker/src/routes/voters.js):
  • handleVoterLookup() now calls getVerifiedUserLocation()
  • Optional: return coordinates in response (add ?include_coordinates=true)
  • Existing clients unaffected (backward compatible)

Helper Functions (worker/src/lib/voterVerification.mjs):
  • Add getVerifiedUserLocation(env, voterId)
  • Query voters_addr_norm + wy_city_county join
  • Return: { voterId, homeLocation, districts, coordinates }

Frontend Integration:
  • After voter verification, check if coordinates available
  • If coordinates exist: use for map, proximity features, county badge
  • If coordinates null: optionally request device location
  • No breaking changes to existing verification flow

════════════════════════════════════════════════════════════════════════════════
❓ COMMON QUESTIONS
════════════════════════════════════════════════════════════════════════════════

Q: When should we do this?
A: Anytime after the current sprint. It's a schema change, so best during a
   planned maintenance window. The actual workflow spans 2-3 weeks (mostly
   waiting for Census). No production impact once migration is deployed.

Q: Will this break existing code?
A: No. The migration adds optional columns (default NULL). Existing queries
   continue to work. New code should check if lat/lng exists before using.

Q: What if some voters can't be geocoded?
A: Normal. Census typically matches 87-95% of addresses. The rest (NO_MATCH)
   will have lat/lng = NULL. Frontend can fall back to device location request
   for these users.

Q: Can we geocode incrementally?
A: Yes. You can import results in batches as Census completes each chunk.
   Each UPDATE is independent, so no coordination needed.

Q: What about privacy?
A: Geocoding uses the address voters provided in the registration system,
   not device location. Much better privacy profile.

Q: How do we test this?
A: 1) Apply migration locally, verify schema
   2) Export sample rows, geocode manually via Census website
   3) Validate results with validate_geocoding.js
   4) Import to test D1 instance
   5) Test getVerifiedUserLocation() returns coordinates
   6) Verify API response includes lat/lng

Q: What's the cost?
A: FREE. U.S. Census Batch Geocoder is a free service. No API keys required.

Q: Can we rollback if something goes wrong?
A: Yes. Migration can be reversed (DROP COLUMN), but best to keep data
   integrity. If import fails partway, just re-run with remaining rows.

Q: Where's the code for the helper function?
A: See GEOCODING_WORKFLOW.md section 4 (getVerifiedUserLocation code sample).
   Also in HELPER_SCRIPTS.js for context.

════════════════════════════════════════════════════════════════════════════════
🎓 TECHNICAL CONTEXT
════════════════════════════════════════════════════════════════════════════════

Why lat/lng in the database?

The design calls for:
  1. Verified voters should have known location (from voters_addr_norm)
  2. That location should have coordinates (for proximity features)
  3. Frontend should use verified coordinates (not device location)
  4. This reduces geolocation prompts and improves privacy

Traditional approach: Ask user for device location every time
This approach: Store verified address coordinates, ask device location only if needed

Data source: U.S. Census Batch Geocoder
  • Official government geocoding service
  • Free (no cost to this project)
  • High accuracy (~87-95% for Wyoming addresses)
  • Results are public domain
  • Processes bulk addresses (10k per batch)

Schema design: REAL columns for latitude/longitude
  • Standard floating-point storage (8 bytes each)
  • Sufficient precision for all practical purposes (0.1mm accuracy)
  • Compatible with standard GIS/mapping libraries
  • Easy to export to other systems

Index strategy:
  • Partial indexes (WHERE NOT NULL) to keep index lean
  • Only index rows that are actually geocoded
  • Enables fast proximity queries for mapped features

════════════════════════════════════════════════════════════════════════════════
📞 NEXT STEPS FOR JIMMY
════════════════════════════════════════════════════════════════════════════════

1. Read IMPLEMENTATION_SUMMARY.md (10 minutes)
   → Understand the 5 phases and timeline

2. Review 0014_add_lat_lng_to_voters_addr_norm.sql (2 minutes)
   → Confirm migration looks good

3. Get approval for schema change (manager/team)
   → Ensure this aligns with sprint goals

4. Plan for Phase 1 (apply migration)
   → Schedule a maintenance window or do during low traffic

5. Execute Phases 2-5 following GEOCODING_WORKFLOW.md
   → Reference commands in VOTERS_ADDR_NORM_CHECKLIST.txt

6. After Phase 4 (import complete), integrate into runtime code
   → Add helper function and update handlers

7. Test thoroughly before production deployment
   → See GEOCODING_VISUAL_GUIDE.md data flow section

════════════════════════════════════════════════════════════════════════════════
📌 KEY TAKEAWAYS
════════════════════════════════════════════════════════════════════════════════

✅ Migration file is ready: worker/migrations_wy/0014_add_lat_lng_to_voters_addr_nom.sql

✅ Complete documentation provided:
   • 5-phase workflow overview
   • Detailed technical guide with code
   • Visual diagrams and flowcharts
   • Quick reference with all commands
   • Reusable helper scripts

✅ Clear timeline:
   • Phase 1 (apply migration): < 1 day
   • Phase 2 (export): < 1 day
   • Phase 3 (geocode): 3-7 days (mostly wait time)
   • Phase 4 (import): < 1 day
   • Phase 5 (integrate): 2-3 days

✅ No breaking changes:
   • Backward compatible (optional columns, default NULL)
   • Existing queries continue to work
   • New features are additive

✅ Free and safe:
   • Census Batch Geocoder costs nothing
   • Rollback possible (DROP COLUMN)
   • Can test locally first

════════════════════════════════════════════════════════════════════════════════

Questions? Review the appropriate document above or reach out to the team.

Start with IMPLEMENTATION_SUMMARY.md and go from there!

════════════════════════════════════════════════════════════════════════════════
