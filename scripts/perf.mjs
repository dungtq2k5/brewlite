// p95 < 500 ms at the gateway for every P0 route, on seed data (product-overview §9).
//
//   pnpm perf            (full `apps` stack up and seeded; PAYMENT_PROVIDER=fake)
//
// Rate limits are real and the script stays UNDER them rather than turning them off:
//   - IP-keyed classes (PUBLIC_READ, AUTH): every request carries its own X-Forwarded-For —
//     the gateway trusts exactly one hop (TRUST_PROXY_HOPS=1), as it will from the web server.
//   - user-keyed classes (AUTHENTICATED 300/min, ORDER_WRITE 20/min, PAYMENT 10/min): requests
//     are paced below them. A 429 anywhere is a script bug and fails the run.
// Local only: a CI runner's latency would measure the runner.
/* global fetch, setTimeout */
import { webcrypto as crypto } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import autocannon from 'autocannon';

const BASE = process.env.PERF_BASE_URL ?? 'http://localhost:23100/api/v1';
const PASSWORD = process.env.PERF_PASSWORD ?? process.env.SEED_ACCOUNT_PASSWORD;
const EMAILS = {
  customer: process.env.PERF_CUSTOMER_EMAIL ?? 'customer@brewlite.test',
  staff: process.env.PERF_STAFF_EMAIL ?? 'staff@brewlite.test',
  admin: process.env.PERF_ADMIN_EMAIL ?? 'admin@brewlite.test',
};
const READS_PER_ROUTE = Number(process.env.PERF_READS ?? 40);
const FLOWS = Number(process.env.PERF_FLOWS ?? 20);
const P95_LIMIT_MS = 500;
const USER_READ_GAP_MS = 250; // 4 req/s ≈ 240/min, under AUTHENTICATED's 300/min
const FLOW_GAP_MS = 15_000; // 4 flows/min: 16 ORDER_WRITE and 8 PAYMENT per minute

if (!PASSWORD) {
  console.error("Set PERF_PASSWORD (or SEED_ACCOUNT_PASSWORD) — the seeded accounts' password.");
  process.exit(2);
}

let counter = 0;
const nextIp = () => {
  const n = ++counter;
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function uuidv7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const results = [];

function percentile(sorted, p) {
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function record(name, samples, nonOk) {
  const sorted = [...samples].sort((a, b) => a - b);
  results.push({
    route: name,
    requests: samples.length,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    nonOk,
  });
}

async function timed(method, path, { token, body, headers = {}, ip = nextIp() } = {}) {
  const started = performance.now();
  const response = await fetch(BASE + path, {
    method,
    headers: {
      'X-Forwarded-For': ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const ms = performance.now() - started;
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, ms, json };
}

async function login(email) {
  const { status, json } = await timed('POST', '/auth/login', {
    body: { email, password: PASSWORD },
  });
  if (status !== 200) {
    throw new Error(
      `login as ${email} failed (${status}) — wrong PERF_PASSWORD, or the account is missing`,
    );
  }
  return json.data.accessToken;
}

/** Sequential, paced — the latency of a read, not the server's read throughput. */
async function paced(name, method, path, token) {
  const samples = [];
  let nonOk = 0;
  for (let i = 0; i < READS_PER_ROUTE; i++) {
    const { status, ms } = await timed(method, path, { token });
    samples.push(ms);
    if (status < 200 || status >= 300) nonOk++;
    await sleep(USER_READ_GAP_MS);
  }
  record(`${method} ${name}`, samples, nonOk);
}

function publicRead(path) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: BASE + path,
        connections: 10,
        amount: 200,
        requests: [
          {
            method: 'GET',
            setupRequest: (request) => {
              request.headers['x-forwarded-for'] = nextIp();
              return request;
            },
          },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        record(
          `GET ${path.replace(/[0-9a-f-]{36}/, ':id')}`,
          [],
          result.non2xx + result.errors + result.timeouts,
        );
        const last = results[results.length - 1];
        last.requests = result.requests.total;
        last.p50 = result.latency.p50;
        last.p95 = result.latency.p97_5 ?? result.latency.p99; // autocannon reports 97.5, not 95 — the safe side
        last.p99 = result.latency.p99;
        resolve();
      },
    );
    void instance;
  });
}

const productsResponse = await timed('GET', '/products');
const products = productsResponse.json?.data ?? [];
const product = products.find((p) => !p.isSoldOut);
if (!product) throw new Error('no purchasable product on the menu — seed first');
const detail = (await timed('GET', `/products/${product.id}`)).json.data;
const line = { productId: product.id, size: detail.sizes[0].size, toppingIds: [], qty: 1 };

console.log(`perf against ${BASE} — ${READS_PER_ROUTE} reads per user route, ${FLOWS} write flows`);

// Public reads: IP-keyed, a distinct address per request.
await publicRead('/categories');
await publicRead('/products');
await publicRead(`/products/${product.id}`);

// Customer
const customer = await login(EMAILS.customer);
const first = await timed('POST', '/orders', {
  token: customer,
  body: { items: [line] },
  headers: { 'Idempotency-Key': uuidv7() },
});
if (first.status !== 201) throw new Error(`could not place the setup order (${first.status})`);
const setupOrder = first.json.data.id;
const setupPayment = await timed('POST', '/payments', {
  token: customer,
  body: { orderId: setupOrder },
  headers: { 'Idempotency-Key': uuidv7() },
});
if (setupPayment.json?.data?.provider !== 'FAKE') {
  throw new Error(
    'payment is not on the fake provider — set PAYMENT_PROVIDER=fake for the perf run',
  );
}
const setupPaymentId = setupPayment.json.data.id;
await paced('/users/me', 'GET', '/users/me', customer);
await paced('/orders/me', 'GET', '/orders/me', customer);
await paced('/orders/:id', 'GET', `/orders/${setupOrder}`, customer);
await paced('/loyalty/me', 'GET', '/loyalty/me', customer);
await paced('/payments/:id', 'GET', `/payments/${setupPaymentId}`, customer);

// Staff and admin
const staff = await login(EMAILS.staff);
await paced('/staff/orders', 'GET', '/staff/orders', staff);
await paced('/staff/products', 'GET', '/staff/products', staff);
const admin = await login(EMAILS.admin);
for (const path of [
  '/admin/users',
  '/admin/promotions',
  '/admin/products',
  '/admin/categories',
  '/admin/toppings',
]) {
  await paced(path, 'GET', path, admin);
}

// Writes: two realistic flows, paced under ORDER_WRITE and PAYMENT.
const writes = { quote: [], place: [], pay: [], confirm: [], cancel: [] };
const bad = { quote: 0, place: 0, pay: 0, confirm: 0, cancel: 0 };
const note = (key, { status, ms }, ok) => {
  writes[key].push(ms);
  if (!ok.includes(status)) bad[key]++;
};
for (let i = 0; i < FLOWS; i++) {
  const t0 = performance.now();
  note(
    'quote',
    await timed('POST', '/orders/quote', { token: customer, body: { items: [line] } }),
    [200],
  );
  const placed = await timed('POST', '/orders', {
    token: customer,
    body: { items: [line] },
    headers: { 'Idempotency-Key': uuidv7() },
  });
  note('place', placed, [201]);
  const orderId = placed.json?.data?.id;
  if (orderId) {
    const paid = await timed('POST', '/payments', {
      token: customer,
      body: { orderId },
      headers: { 'Idempotency-Key': uuidv7() },
    });
    note('pay', paid, [201]);
    if (paid.json?.data?.id) {
      note(
        'confirm',
        await timed('POST', `/payments/${paid.json.data.id}/fake-confirm`, {
          token: customer,
          body: { outcome: 'SUCCEEDED' },
        }),
        [200],
      );
    }
  }
  const second = await timed('POST', '/orders', {
    token: customer,
    body: { items: [line] },
    headers: { 'Idempotency-Key': uuidv7() },
  });
  note('place', second, [201]);
  if (second.json?.data?.id) {
    note(
      'cancel',
      await timed('POST', `/orders/${second.json.data.id}/cancel`, { token: customer }),
      [200],
    );
  }
  await sleep(Math.max(0, FLOW_GAP_MS - (performance.now() - t0)));
}
record('POST /orders/quote', writes.quote, bad.quote);
record('POST /orders', writes.place, bad.place);
record('POST /payments', writes.pay, bad.pay);
record('POST /payments/:id/fake-confirm', writes.confirm, bad.confirm);
record('POST /orders/:id/cancel', writes.cancel, bad.cancel);

// Report
const pad = (value, width) => String(value).padEnd(width);
console.log(
  `\n${pad('route', 34)}${pad('reqs', 7)}${pad('p50', 9)}${pad('p95', 9)}${pad('p99', 9)}non-2xx`,
);
let failed = false;
for (const r of results) {
  const slow = r.p95 >= P95_LIMIT_MS;
  if (slow || r.nonOk > 0) failed = true;
  console.log(
    `${pad(r.route, 34)}${pad(r.requests, 7)}${pad(r.p50.toFixed(0), 9)}${pad(r.p95.toFixed(0), 9)}${pad(r.p99.toFixed(0), 9)}${r.nonOk}${slow ? '   <-- SLOW' : ''}${r.nonOk ? '   <-- ERRORS' : ''}`,
  );
}
console.log(
  failed
    ? `\nFAILED — a p95 ≥ ${P95_LIMIT_MS} ms or a non-2xx (429s included).`
    : `\nOK — every p95 < ${P95_LIMIT_MS} ms, no non-2xx.`,
);
process.exit(failed ? 1 : 0);
