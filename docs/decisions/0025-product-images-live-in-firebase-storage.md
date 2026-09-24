# 0025 — Product images live in Firebase Storage and are uploaded through catalog

**Status:** Accepted · **Date:** 2026-09-24 · **Supersedes:** — · **Superseded by:** —

## Context

Admins upload product photos; every menu view shows them. The team wants Firebase (GCP) for storage. Images are few (tens of products), small, and uploaded only by admins.

The reference project had clients upload directly to the bucket through signed URLs, keeping bytes out of the services. That needs signed-URL support in the local emulator (uncertain for the Firebase Storage emulator), bucket CORS, and a confirm step. User-supplied filenames and declared content types cannot be trusted either way.

## Decision

- An admin uploads through the gateway (`multipart/form-data`, at most 2 MB). The gateway passes the bytes to catalog over gRPC.
- catalog **checks the magic bytes** — JPEG, PNG or WebP only, never trusting the extension or declared type — writes `products/<productId>/<newId>.<ext>` with `firebase-admin`, stores the object path on the product, and deletes the previous image.
- Clients read images from the public Firebase Storage URL built from `STORAGE_PUBLIC_BASE_URL`. **Storage security rules allow public read of `products/**` and deny every write**; the Admin SDK bypasses rules, so only catalog can write.
- Locally the **Firebase Storage emulator** stands in for the bucket, on the same port inside and outside its container.

## Consequences

- One code path for local and real storage; no signed URLs, no bucket CORS, no confirm step.
- Object names are always server-generated.
- **Cost:** image bytes cross two processes (gateway, catalog) and a gRPC message — fine at 2 MB and a handful of uploads a day, wrong for user-generated media at scale.
- **Cost:** no resizing; admins are asked for a reasonably sized image, and `next/image` optimises delivery.
- **Cost:** a real deployment needs a Firebase project and a service-account credential for catalog.

## See also

- [0027](./0027-host-ports-sit-in-the-2xxxx-range.md) — the emulator's ports.
- [0005](./0005-grpc-for-synchronous-calls-and-jetstream-for-events.md) — the gRPC hop the bytes take.
