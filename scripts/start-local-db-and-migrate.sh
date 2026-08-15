#!/usr/bin/env bash
set -euo pipefail

echo "Starting local Postgres and running migrations for Receiptor"

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker is not installed or not available in PATH. Install Docker or run migrations manually." >&2
  exit 1
fi

if ! docker ps -a --format '{{.Names}}' | grep -q '^receiptor-db$'; then
  echo "Creating Postgres container 'receiptor-db'..."
  docker run -d --name receiptor-db \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=receiptor \
    -p 5432:5432 postgres:15
else
  echo "Starting existing Postgres container 'receiptor-db'..."
  docker start receiptor-db || true
fi

echo "Waiting for Postgres to be ready on localhost:5432..."
for i in $(seq 1 30); do
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -q && break
  else
    if nc -z localhost 5432 >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 1
done

export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/receiptor"

echo "Running Drizzle migrations..."
pnpm --filter @receiptor/indexer migrate

echo "Migrations complete."

cat <<'EOF'
To start the services run in two terminals:

Terminal A:
  pnpm --filter @receiptor/indexer dev

Terminal B:
  pnpm --filter @receiptor/web dev

If you need the commands to run in background or via tmux/screen, tell me and I can provide an example.
EOF
