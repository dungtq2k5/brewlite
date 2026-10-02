// nest-common is a shared library, not a service — it has no `.env` of its own. Its
// integration suite only needs the test broker, so it reads that one variable directly,
// defaulting to the `nats-test` Compose service's host port (conventions §16.2's dotenv
// pattern doesn't apply — there's nothing else to read).
export const NATS_URL_TEST = process.env.NATS_URL_TEST ?? 'nats://localhost:24223';
