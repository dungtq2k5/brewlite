# 0027 — Local host ports sit in the 2xxxx range

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

This machine runs other projects' stacks at the same time. Wayfare already publishes Postgres on 15433–15436, Redis on 16379, NATS on 14222 and 14223 (monitoring 18222), Jaeger on 4317–4318 and 16686, a GCS emulator on 4443, and Mailpit on 1025 and 8025; Synapsedesk has its own set. Default ports (5432, 6379, 4222, 3000) collide with whichever stack started first, and the failure is confusing — a service connecting happily to another project's database.

## Decision

Every host port BrewLite publishes is in the **2xxxx** range, and every container is named **`brewlite-<name>`**:

| Component | Host port |
| :---- | :---- |
| web (Next.js) | 23000 |
| gateway HTTP | 23100 |
| identity / catalog / ordering / payment ops HTTP | 23101 / 23102 / 23103 / 23104 |
| identity / catalog / ordering / payment gRPC | 25051 / 25052 / 25053 / 25054 |
| PostgreSQL | 25432 |
| Redis | 26379 |
| NATS client / monitoring | 24222 / 28222 |
| NATS test broker | 24223 |
| Firebase Emulator UI / Auth / Storage / Hub | 29000 / 29099 / 29199 / 29400 |

- Inside the Compose network, infrastructure keeps its default ports (`postgres:5432`, `redis:6379`, `nats:4222`).
- The **Firebase emulators listen on the same port inside and outside** their container: the Storage emulator writes its own host and port into URLs, and a remapped port produces URLs that point nowhere.
- gRPC ports sit below the OS ephemeral range (Linux 32768–60999).

## Consequences

- BrewLite runs beside the other stacks with no collision, and a wrong connection string fails instead of silently reaching another project.
- **Cost:** every tutorial's default port is wrong here; `.env.example` files and the README carry the real ones.
- **Cost:** the table is one more thing to keep in step with `compose.yaml` and architecture-and-tech-stack §1.2.

## See also

- [0007](./0007-one-postgres-server-with-a-database-per-service.md) — the one Postgres behind 25432.
- [0025](./0025-product-images-live-in-firebase-storage.md) — the emulator the same-port rule protects.
