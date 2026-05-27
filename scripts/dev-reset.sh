#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo "🔄 Resetting Watchdog dev environment..."

echo "  Stopping Docker..."
docker-compose stop postgres 2>/dev/null || true
docker-compose rm -f postgres 2>/dev/null || true
docker volume rm watchdog_postgres_data 2>/dev/null || true

echo "  Starting fresh Postgres..."
docker-compose up -d postgres

echo "  Waiting for Postgres..."
until docker-compose exec -T postgres pg_isready -U watchdog > /dev/null 2>&1; do sleep 2; done

echo "  Running migrations..."
cd apps/backend && npx prisma migrate deploy

echo "  Seeding database..."
npx prisma db seed

echo ""
echo "✅ Reset complete. Run 'npm run dev:full' to start everything."
