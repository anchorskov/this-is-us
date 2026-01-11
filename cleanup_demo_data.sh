#!/bin/bash
set -euo pipefail

cd /home/anchor/projects/this-is-us/worker

echo "Cleaning demo data from local D1..."

# Delete test-% rows
./scripts/wr d1 execute WY_DB --local \
  --command "DELETE FROM civic_item_sources WHERE item_id IN (SELECT id FROM civic_items WHERE id LIKE 'test-%');" 2>/dev/null || true

./scripts/wr d1 execute WY_DB --local \
  --command "DELETE FROM civic_item_ai_tags WHERE item_id IN (SELECT id FROM civic_items WHERE id LIKE 'test-%');" 2>/dev/null || true

./scripts/wr d1 execute WY_DB --local \
  --command "DELETE FROM civic_items WHERE id LIKE 'test-%';" 2>/dev/null || true

# Delete Groundwater demo rows
./scripts/wr d1 execute WY_DB --local \
  --command "DELETE FROM civic_item_sources WHERE item_id IN (SELECT id FROM civic_items WHERE title LIKE '%Groundwater Withdrawal%');" 2>/dev/null || true

./scripts/wr d1 execute WY_DB --local \
  --command "DELETE FROM civic_item_ai_tags WHERE item_id IN (SELECT id FROM civic_items WHERE title LIKE '%Groundwater Withdrawal%');" 2>/dev/null || true

./scripts/wr d1 execute WY_DB --local \
  --command "DELETE FROM civic_items WHERE title LIKE '%Groundwater Withdrawal%';" 2>/dev/null || true

echo "Done. Demo data cleaned."
