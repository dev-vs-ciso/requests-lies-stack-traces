#!/bin/sh
set -e

# Seed a disposable working database from the pristine snapshot baked into the
# image. Because /app/data is NOT a volume, recreating the container gives a fresh
# copy — which is exactly how "Reseed" works (docker compose up --force-recreate).
mkdir -p /app/data
if [ ! -f /app/data/app.db ]; then
  echo "Seeding working database from pristine snapshot..."
  cp /app/prisma/pristine.db /app/data/app.db
fi

exec "$@"
