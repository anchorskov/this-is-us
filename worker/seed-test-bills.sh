#!/bin/bash

# Seed test Wyoming bills into WY_DB for testing bill summary analyzer

cd "$(dirname "$0")"

echo "🌱 Seeding test bills into WY_DB..."

# Current timestamp
NOW=$(date -u +'%Y-%m-%dT%H:%M:%SZ')

npx wrangler d1 execute WY_DB --local --command "
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

echo "✅ Seeding complete! Bills ready for scanning."
