#!/bin/sh
# Runs only on an empty data directory (Postgres's own init-script convention) — editing
# this file changes nothing on an already-initialized volume; `docker compose down -v` first.
set -e

for svc in identity catalog ordering payment; do
  for suffix in "" "_test" "_shadow"; do
    db="brewlite_${svc}${suffix}"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-SQL
      SELECT 'CREATE DATABASE ${db}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\gexec
SQL
  done
done
