#!/bin/bash

# worker/seed-test-bills.sh
# Seed test Wyoming bills into WY_DB for testing bill summary analyzer
#
# ⚠️  GUARD: This script REQUIRES explicit opt-in via environment variable
#    to prevent accidental test data seeding in production contexts.
#
# Usage:
#    ALLOW_TEST_SEEDS=1 bash seed-test-bills.sh
#
# If run without ALLOW_TEST_SEEDS=1, will exit with error.

if [[ "${ALLOW_TEST_SEEDS:-}" != "1" ]]; then
  echo "❌ ERROR: Seeding test bills requires explicit approval."
  echo ""
  echo "This script seeds DEMO/TEST bills into your database."
  echo "If you intend to test with REAL Wyoming Legislature data,"
  echo "use the real-data-only test instead:"
  echo ""
  echo "  ./scripts/test-wyoleg-real-data-local.sh --reset"
  echo ""
  echo "To override and seed test bills anyway:"
  echo ""
  echo "  ALLOW_TEST_SEEDS=1 bash seed-test-bills.sh"
  echo ""
  exit 1
fi

cd "$(dirname "$0")"

echo "�� Seeding test bills into WY_DB..."
echo "⚠️  WARNING: This is DEMO data, not real Wyoming legislation."
echo ""

# Current timestamp
NOW=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

./scripts/wr d1 execute WY_DB --local --command "
INSERT INTO civic_items (
  id, kind, source, level, jurisdiction_key, bill_number, title, summary,
  status, legislative_session, chamber, created_at, updated_at, up_votes, down_votes
) VALUES
  ('test-hb22', 'bill', 'openstates', 'state', 'ocd-jurisdiction/country:us/state:wy/government', 'HB 22',
   'Property Tax Assessment Cap',
   'Establishes annual caps on property tax assessment increases at 3% or inflation, whichever is lower, to prevent sudden tax spikes on homeowners.',
   'introduced', '2025', 'lower', '$NOW', '$NOW', 0, 0),
  ('test-hb164', 'bill', 'openstates', 'state', 'ocd-jurisdiction/country:us/state:wy/government', 'HB 164',
   'Groundwater Withdrawal Permits',
   'Establishes new permitting process for groundwater withdrawal in high-demand regions with impact assessments for competing water uses.',
   'in_committee', '2025', 'lower', '$NOW', '$NOW', 0, 0),
  ('test-sf174', 'bill', 'openstates', 'state', 'ocd-jurisdiction/country:us/state:wy/government', 'SF 174',
   'K-12 Education Funding Formula',
   'Revises school funding distribution to increase per-pupil spending and boost support for rural districts and special education.',
   'introduced', '2025', 'upper', '$NOW', '$NOW', 0, 0),
  ('test-hb286', 'bill', 'openstates', 'state', 'ocd-jurisdiction/country:us/state:wy/government', 'HB 286',
   'Renewable Energy Transmission Permitting',
   'Streamlines permitting for transmission lines connecting renewable energy projects to the grid with expedited review timelines.',
   'pending_vote', '2025', 'lower', '$NOW', '$NOW', 0, 0),
  ('test-sf89', 'bill', 'openstates', 'state', 'ocd-jurisdiction/country:us/state:wy/government', 'SF 89',
   'Fentanyl Interdiction and Treatment',
   'Provides funding for fentanyl interdiction and expands access to medication-assisted treatment and recovery services.',
   'introduced', '2025', 'upper', '$NOW', '$NOW', 0, 0);
" 2>&1

echo ""
echo "✅ Seeding complete! Test bills ready for scanning."
echo "⚠️  Remember: This is DEMO data. For real data testing, use test-wyoleg-real-data-local.sh"
