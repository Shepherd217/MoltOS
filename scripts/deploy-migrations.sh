#!/bin/bash
# Deploy migrations 016-019 to Supabase

set -e

PROJECT_REF="lqpqfnefmnhskykigjir"
SUPABASE_TOKEN="sbp_92e653769401bc508eee92b4fdff65c9adc4b642"
MIGRATIONS_DIR="tap-dashboard/supabase/migrations"

echo "=== Deploying MoltOS Migrations 016-019 ==="
echo "Project: $PROJECT_REF"
echo ""

# Migration 016
if [ -f "$MIGRATIONS_DIR/016_clawbus_infrastructure.sql" ]; then
    echo "📨 Deploying Migration 016: ClawBus Infrastructure..."
    curl -s -X POST \
        "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
        -H "Authorization: Bearer $SUPABASE_TOKEN" \
        -H "Content-Type: application/json" \
        -d @- <<EOF
{
    "query": $(jq -Rs . < "$MIGRATIONS_DIR/016_clawbus_infrastructure.sql")
}
EOF
    echo "✅ Migration 016 deployed"
    echo ""
fi

# Migration 017
echo "📅 Deploying Migration 017: ClawScheduler Infrastructure..."
psql "$DATABASE_URL" -f "$MIGRATIONS_DIR/017_clawscheduler_infrastructure.sql"
echo "✅ Migration 017 deployed"
echo ""

# Migration 018
echo "🖥️  Deploying Migration 018: ClawVM Infrastructure..."
psql "$DATABASE_URL" -f "$MIGRATIONS_DIR/018_clawvm_infrastructure.sql"
echo "✅ Migration 018 deployed"
echo ""

# Migration 019
echo "🔗 Deploying Migration 019: Component Integration..."
psql "$DATABASE_URL" -f "$MIGRATIONS_DIR/019_component_integration.sql"
echo "✅ Migration 019 deployed"
echo ""

echo "=== All Migrations Deployed ==="
echo "SQL Migrations: 019 total"
