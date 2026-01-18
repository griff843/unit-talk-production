#!/bin/bash
# Apply all Supabase migrations to local Postgres in order

set -e

echo "=== APPLYING ALL MIGRATIONS TO LOCAL POSTGRES ==="
echo ""

MIGRATIONS_DIR="supabase/migrations"
DB_USER="postgres"
DB_NAME="unit_talk_dev"
CONTAINER="unit-talk-postgres"

# Count migrations
TOTAL=$(ls -1 $MIGRATIONS_DIR/*.sql | wc -l)
echo "Found $TOTAL migration files"
echo ""

SUCCESS=0
FAILED=0

# Apply each migration in sorted order
for migration in $(ls $MIGRATIONS_DIR/*.sql | sort); do
  filename=$(basename "$migration")
  echo "[$((SUCCESS + FAILED + 1))/$TOTAL] Applying: $filename"

  # Copy migration to container
  docker cp "$migration" "$CONTAINER:/tmp/current_migration.sql"

  # Apply migration
  if docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/current_migration.sql > /dev/null 2>&1; then
    echo "  ✅ SUCCESS"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ❌ FAILED"
    FAILED=$((FAILED + 1))
    # Show error
    docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -f /tmp/current_migration.sql 2>&1 | head -20
  fi

  echo ""
done

echo "=== MIGRATION SUMMARY ==="
echo "✅ Success: $SUCCESS"
echo "❌ Failed: $FAILED"
echo "Total: $TOTAL"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "✅ ALL MIGRATIONS APPLIED SUCCESSFULLY"
  exit 0
else
  echo "❌ SOME MIGRATIONS FAILED"
  exit 1
fi
