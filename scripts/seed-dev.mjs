// Fills a running development stack with a believable café — one command, any fresh clone.
//
//   pnpm seed:dev          plan: what `apply` would create; writes nothing
//   pnpm seed:dev:apply    the base seeds (accounts, menu), then the demo data
//
// The demo data goes in through the gateway's API, so every invariant holds (stock, outbox events,
// payments, refunds, points). The one thing the API cannot do is say *when*: it stamps everything
// "now", so afterwards each demo order is moved back to its planned day and hour with one SQL
// transaction per database (timestamps only, development only).
//
// Rate limits are real and the script stays under them rather than clearing Redis keys:
//   - IP-keyed (AUTH): every request carries its own X-Forwarded-For (the gateway trusts one hop).
//   - user-keyed (ORDER_WRITE 20/min, PAYMENT 10/min): one order per customer every ~12 s, the eight
//     customers in parallel.
/* global fetch, setTimeout */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  DEMO_CUSTOMERS,
  DEMO_DOMAIN,
  offsetMs,
  orderingShiftSql,
  paymentShiftSql,
  planDemo,
  readEnvText,
  summarize,
} from './seed-dev-lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.SEED_BASE_URL ?? 'http://localhost:23100/api/v1';
const APPLY = process.argv.includes('--apply');
const ORDER_GAP_MS = 12_500; // 5 orders a minute per customer: 10 ORDER_WRITE and 10 PAYMENT calls

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const say = (line = '') => console.log(line);
const readEnv = (service) => {
  const file = path.join(ROOT, 'services', service, '.env');
  return existsSync(file) ? readEnvText(readFileSync(file, 'utf8')) : null;
};

// ---------------------------------------------------------------- preconditions

const SERVICES = ['catalog', 'gateway', 'identity', 'ordering', 'payment'];

function preconditions() {
  const problems = [];
  const envs = Object.fromEntries(SERVICES.map((s) => [s, readEnv(s)]));
  for (const [service, env] of Object.entries(envs)) {
    if (!env)
      problems.push(
        `services/${service}/.env is missing — copy .env.example (README, quick start).`,
      );
    else if (env.NODE_ENV === 'production') {
      problems.push(
        `services/${service}/.env says NODE_ENV=production — the demo seed is for development only.`,
      );
    }
  }
  const provider = envs.payment?.PAYMENT_PROVIDER;
  if (envs.payment && provider !== 'fake') {
    problems.push(
      'Demo orders are paid with the fake provider — set PAYMENT_PROVIDER=fake in services/payment/.env and restart payment.',
    );
  }
  const password = envs.identity?.SEED_ACCOUNT_PASSWORD;
  if (envs.identity && !password) {
    problems.push(
      'Set SEED_ACCOUNT_PASSWORD in services/identity/.env — the staff and admin accounts sign in with it.',
    );
  }
  for (const service of ['identity', 'catalog']) {
    const seed = path.join(ROOT, 'services', service, 'dist', 'prisma', 'seed');
    if (!existsSync(seed))
      problems.push(`services/${service} is not built — run pnpm build first.`);
  }
  return { problems, password, envs };
}

// ---------------------------------------------------------------- http

let counter = 0;
const nextIp = () => {
  const n = ++counter + Math.floor(Math.random() * 60_000);
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
};

function uuidv7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ms = BigInt(Date.now());
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** One call; a 429 waits what the gateway asks (or 15 s) and tries again, up to three times. */
async function call(method, route, { token, body, headers = {} } = {}) {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(BASE + route, {
      method,
      headers: {
        'X-Forwarded-For': nextIp(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 429 && attempt < 3) {
      await sleep((Number(response.headers.get('retry-after')) || 15) * 1000);
      continue;
    }
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    return { status: response.status, json, data: json?.data, code: json?.error?.code };
  }
}

async function expect(label, response, ...ok) {
  if (!ok.includes(response.status)) {
    throw new Error(
      `${label} failed (${response.status}${response.code ? ` ${response.code}` : ''})`,
    );
  }
  return response.data;
}

const sessions = new Map();
async function login(email, password) {
  const res = await call('POST', '/auth/login', { body: { email, password } });
  if (res.status === 401 && email.endsWith('@brewlite.test')) {
    throw new Error(
      `${email} exists, but not with the SEED_ACCOUNT_PASSWORD in services/identity/.env — the identity seed never changes an existing account, so the password it was first created with still applies. Put that one back (or, on a development database you can lose, start over: docker compose down -v, then the quick start from step 5).`,
    );
  }
  const data = await expect(`sign in as ${email}`, res, 200);
  sessions.set(email, { password, token: data.accessToken, userId: data.user.id });
  return sessions.get(email);
}

/** A call as `email`, signing in again if the access token has expired. */
async function as(email, method, route, options = {}) {
  const session = sessions.get(email);
  let res = await call(method, route, { ...options, token: session.token });
  if (res.status === 401) {
    await login(email, session.password);
    res = await call(method, route, { ...options, token: sessions.get(email).token });
  }
  return res;
}

// ---------------------------------------------------------------- the café

const ago = (days) => new Date(Date.now() - days * 86_400_000).toISOString();
const ahead = (days) => new Date(Date.now() + days * 86_400_000).toISOString();

const PROMOTIONS = (orderCounts) => [
  {
    code: 'WELCOME10',
    description: 'Welcome — 10% off a first order',
    discountType: 'PERCENT',
    discountValue: 10,
    startsAt: ago(60),
    endsAt: ahead(365),
    maxUses: null,
    perUserLimit: 1,
  },
  {
    code: 'SUMMER15',
    description: 'Summer — 15% off, ended',
    discountType: 'PERCENT',
    discountValue: 15,
    maxDiscountVnd: 20_000,
    minSubtotalVnd: 50_000,
    startsAt: ago(75),
    endsAt: ago(35),
    maxUses: 200,
    perUserLimit: 1,
  },
  {
    code: 'COFFEE20K',
    description: '₫20,000 off — used up',
    discountType: 'FIXED',
    discountValue: 20_000,
    minSubtotalVnd: 50_000,
    startsAt: ago(40),
    endsAt: ahead(300),
    maxUses: orderCounts.COFFEE20K,
    perUserLimit: 1,
  },
  {
    code: 'TET2027',
    description: 'Tết — 20% off, scheduled',
    discountType: 'PERCENT',
    discountValue: 20,
    maxDiscountVnd: 30_000,
    startsAt: ahead(30),
    endsAt: ahead(45),
    maxUses: null,
    perUserLimit: 1,
  },
];

async function catalogForOrders() {
  const list = (await expect('list the menu', await call('GET', '/products'), 200)) ?? [];
  const staff = await as('staff@brewlite.test', 'GET', '/staff/products');
  const counted = new Set((staff.data ?? []).filter((p) => p.stockQty !== null).map((p) => p.id));
  // Products on sale and not counted: the demo never drains a stock count the shop is watching.
  const usable = list.filter((p) => !p.isSoldOut && !counted.has(p.id));
  const products = [];
  for (const p of usable) {
    const detail = await expect('read a product', await call('GET', `/products/${p.id}`), 200);
    products.push({
      id: p.id,
      sizes: detail.sizes ?? [],
      toppings: detail.toppings ?? [],
      fromPrice: p.fromPriceVnd,
    });
  }
  if (products.length === 0)
    throw new Error('no product on sale without a stock count — run the base seeds first');
  return products;
}

/** Lines until the subtotal reaches `minSubtotal` — products, sizes and toppings from the plan's picks. */
function linesFor(order, catalog, attempt = 0) {
  let pick = attempt * 5;
  const target = order.minSubtotal + attempt * 25_000; // a quote that says *below the minimum* asks for more
  const next = () => order.picks[pick++ % order.picks.length];
  const lines = [];
  let subtotal = 0;
  for (let n = 0; n < 4 && subtotal < target; n++) {
    const product = catalog[Math.floor(next() * catalog.length)];
    const size = product.sizes[Math.floor(next() * product.sizes.length)];
    const free = product.toppings.slice(0, 3);
    const toppingIds =
      free.length > 0 && next() < 0.4 ? [free[Math.floor(next() * free.length)].id] : [];
    const qty = next() < 0.3 ? 2 : 1;
    const price =
      (product.fromPrice ?? 0) +
      (size?.priceDeltaVnd ?? 0) +
      toppingIds.reduce((sum, id) => sum + (free.find((t) => t.id === id)?.priceVnd ?? 0), 0);
    subtotal += price * qty;
    lines.push({ productId: product.id, size: size.size, toppingIds, qty });
  }
  return lines;
}

async function waitFor(label, read, done, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > until) throw new Error(`${label}: timed out`);
    await sleep(500);
  }
}

/** One demo order, from the quote to its planned lifecycle. Returns what the time shift needs. */
async function runOrder(order, email, catalog, counts, warnings) {
  // Quote first (it validates the lines and the code, and reserves nothing). A refusal asks for
  // other lines — a bigger subtotal, a different drink — before the code is given up.
  let promo = order.promo;
  let body;
  for (let attempt = 0; ; attempt++) {
    body = {
      items: linesFor(order, catalog, attempt),
      ...(order.note ? { note: order.note } : {}),
    };
    // A quote takes the lines and the code only — the note belongs to the order (`.strict()`).
    const quote = await as(email, 'POST', '/orders/quote', {
      body: { items: body.items, ...(promo ? { promoCode: promo } : {}) },
    });
    if (quote.status === 200) break;
    if (quote.status === 400) {
      throw new Error(
        `the quote request was refused as malformed (${quote.code}) — a bug in this script`,
      );
    }
    if (attempt === 3) {
      if (!promo) throw new Error(`could not quote an order (${quote.status} ${quote.code ?? ''})`);
      warnings.push(
        `${promo} could not be applied for ${email} (${quote.code ?? quote.status}) — that order has no code`,
      );
      promo = null;
      attempt = -1;
    }
  }
  const placed = await expect(
    'place an order',
    await as(email, 'POST', '/orders', {
      body: { ...body, ...(promo ? { promoCode: promo } : {}) },
      headers: { 'Idempotency-Key': uuidv7() },
    }),
    201,
  );
  const id = placed.id;
  if (promo) counts[promo] = (counts[promo] ?? 0) + 1;

  if (order.kind === 'customer-cancel') {
    await expect('cancel an unpaid order', await as(email, 'POST', `/orders/${id}/cancel`), 200);
  } else {
    const payment = await expect(
      'start a payment',
      await as(email, 'POST', '/payments', {
        body: { orderId: id },
        headers: { 'Idempotency-Key': uuidv7() },
      }),
      201,
    );
    if (payment.provider !== 'FAKE') {
      throw new Error(
        'payment is not on the fake provider — set PAYMENT_PROVIDER=fake and restart payment',
      );
    }
    await expect(
      'confirm the payment',
      await as(email, 'POST', `/payments/${payment.id}/fake-confirm`, {
        body: { outcome: 'SUCCEEDED' },
      }),
      200,
    );
    // The order learns it was paid from an event, a moment later.
    const read = async () => (await as(email, 'GET', `/orders/${id}`)).data;
    await waitFor('the order to be paid', read, (o) => o?.status === 'PAID');
    const staff = (to) =>
      as('staff@brewlite.test', 'POST', `/staff/orders/${id}/status`, { body: { to } });
    const steps = {
      'live-PREPARING': ['PREPARING'],
      'live-READY': ['PREPARING', 'READY'],
      COMPLETED: ['PREPARING', 'READY', 'COMPLETED'],
    };
    for (const to of steps[order.kind] ?? [])
      await expect(`move an order to ${to}`, await staff(to), 200);
    if (order.kind === 'staff-cancel') {
      await expect(
        'cancel a paid order',
        await as('staff@brewlite.test', 'POST', `/staff/orders/${id}/cancel`, {
          body: { note: 'Hết nguyên liệu' },
        }),
        200,
      );
      await waitFor(
        'the refund to start',
        read,
        (o) => o?.refundStatus && o.refundStatus !== 'NONE',
      );
    }
  }
  const final = (await as(email, 'GET', `/orders/${id}`)).data;
  return {
    orderId: id,
    createdAt: new Date(final.createdAt),
    target: order.target,
    kind: order.kind,
  };
}

// ---------------------------------------------------------------- database

function psql(env, sql) {
  const url = new URL(env.DATABASE_URL);
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      decodeURIComponent(url.username),
      '-d',
      url.pathname.slice(1),
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
    ],
    { cwd: ROOT, input: sql, encoding: 'utf8' },
  );
  if (result.status !== 0)
    throw new Error(`psql on ${url.pathname.slice(1)} failed:\n${result.stderr}`);
}

/**
 * The two existing seeds, as they are — idempotent on their own: identity creates each role account
 * only when that email is missing, catalog the menu only when it is empty. The identity seed reads
 * `SEED_ACCOUNT_PASSWORD` from its environment (not from the `.env` file), so it is handed over here.
 */
function runBaseSeeds(password) {
  for (const service of ['identity', 'catalog']) {
    const result = spawnSync('pnpm', ['--silent', '--filter', `@brewlite/${service}`, 'seed:dev'], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, SEED_ACCOUNT_PASSWORD: password },
    });
    if (result.status !== 0)
      throw new Error(`the ${service} seed failed:\n${result.stdout}${result.stderr}`);
    const said = result.stdout.trim().split('\n').filter(Boolean).at(-1) ?? 'done';
    say(`  base seed · ${service}: ${said}`);
  }
}

/**
 * Whether the demo café is there. The marker is a demo customer **with an order**: customers and
 * promotions are created first and are safe to create again (`409` / `PROMO_CODE_TAKEN` are skipped),
 * so an apply interrupted before its orders is finished by the next one rather than mistaken for done.
 */
async function demoState() {
  const found = await as(
    'admin@brewlite.test',
    'GET',
    `/admin/users?q=${encodeURIComponent(`@${DEMO_DOMAIN}`)}&pageSize=100`,
  );
  const customers = (found.data ?? []).filter((u) => u.email.endsWith(`@${DEMO_DOMAIN}`));
  let orders = 0;
  for (const c of customers) {
    const res = await as('admin@brewlite.test', 'GET', `/admin/orders?userId=${c.id}&pageSize=1`);
    orders += res.json?.meta?.total ?? 0;
  }
  return { customers: customers.length, orders };
}

// ---------------------------------------------------------------- main

function printPlan(plan, state) {
  const s = summarize(plan);
  say('service   what                                              count');
  say('--------  ------------------------------------------------  -----');
  const row = (service, what, count) =>
    say(`${service.padEnd(8)}  ${what.padEnd(48)}  ${String(count).padStart(5)}`);
  row('identity', 'role accounts (admin@, staff@, customer@)', 3);
  row('catalog', 'menu — 30 products, 5 categories, toppings', '30');
  row('identity', `demo customers @${DEMO_DOMAIN}`, DEMO_CUSTOMERS.length);
  row('ordering', 'promotions (running, ended, used up, scheduled)', 4);
  row('ordering', `orders over ${s.days} days, ${s.withPromo} with a promo code`, s.total);
  row('ordering', "  live on today's board (PAID, PREPARING, READY)", s.live);
  row('ordering', '  completed', s.completed);
  row('ordering', '  cancelled by staff (refunded)', s.staffCancelled);
  row('ordering', '  cancelled by the customer before paying', s.customerCancelled);
  if (state) say(`\n${state}`);
}

async function main() {
  const { problems, password } = preconditions();
  const plan = planDemo({ now: new Date() });

  let ready = false;
  try {
    ready = (await fetch(`${new URL(BASE).origin}/health/ready`)).ok;
  } catch {
    ready = false;
  }
  if (!ready)
    problems.push(
      `The gateway does not answer at ${BASE} — start the stack (README, quick start).`,
    );

  if (!APPLY) {
    say('pnpm seed:dev — a plan; nothing is written.\n');
    let state = 'Run pnpm seed:dev:apply to create it.';
    for (const p of problems) say(`! ${p}`);
    if (problems.length > 0) say('');
    if (ready && password) {
      try {
        await login('admin@brewlite.test', password);
        const demo = await demoState();
        if (demo.orders > 0) state = 'Demo data already present — apply will write no demo data.';
        else if (demo.customers > 0) {
          state =
            'Demo customers exist without orders (an interrupted apply) — apply will finish the job.';
        }
      } catch {
        // The accounts may not exist yet; the plan is the same.
      }
    }
    printPlan(plan, state);
    return;
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`✗ ${p}`);
    process.exit(1);
  }

  say('pnpm seed:dev:apply\n');
  runBaseSeeds(password);
  await login('admin@brewlite.test', password);
  await login('staff@brewlite.test', password);

  const demo = await demoState();
  if (demo.orders > 0) {
    say(
      '\nDemo data already present — nothing written. (Starting over: docker compose down -v, then the quick start from step 5.)',
    );
    return finish();
  }
  if (demo.customers > 0)
    say('\n  demo customers exist without orders — finishing an interrupted apply');

  // Customers
  say('\n  demo customers');
  for (const c of DEMO_CUSTOMERS) {
    const res = await call('POST', '/auth/register', {
      body: { email: c.email, password, fullName: c.name, preferredLocale: c.locale },
    });
    await expect(`register ${c.email}`, res, 201, 409);
    await login(c.email, password);
  }

  // Promotions
  say('  promotions');
  const wanted = { COFFEE20K: plan.orders.filter((o) => o.promo === 'COFFEE20K').length };
  for (const promotion of PROMOTIONS(wanted)) {
    const res = await as('admin@brewlite.test', 'POST', '/admin/promotions', { body: promotion });
    if (res.code !== 'PROMO_CODE_TAKEN') await expect(`create ${promotion.code}`, res, 201);
  }

  // Orders: eight customers in parallel, each paced under the limits, oldest order first.
  say(`  orders — ${plan.orders.length} through the API (a few minutes)`);
  const catalog = await catalogForOrders();
  const counts = {};
  const warnings = [];
  const moves = [];
  let done = 0;
  await Promise.all(
    plan.queues.map(async (queue, index) => {
      const email = DEMO_CUSTOMERS[index].email;
      for (const order of queue) {
        const started = Date.now();
        const result = await runOrder(order, email, catalog, counts, warnings);
        moves.push({ ...result, userEmail: email });
        done += 1;
        if (done % 10 === 0 || done === plan.orders.length)
          say(`    ${done} / ${plan.orders.length}`);
        await sleep(Math.max(0, ORDER_GAP_MS - (Date.now() - started)));
      }
    }),
  );

  // The one write outside the API: when.
  say('  moving the older orders back in time');
  const shifts = moves
    .filter((m) => m.target)
    .map((m) => ({ orderId: m.orderId, ms: offsetMs(m.createdAt, m.target) }));
  const { envs } = preconditions();
  psql(envs.ordering, orderingShiftSql(shifts));
  psql(envs.payment, paymentShiftSql(shifts));

  say(`\n  ${moves.length} orders created, ${shifts.length} moved to their day.`);
  for (const w of warnings) say(`  ! ${w}`);
  finish();
}

function finish() {
  say('\nDone.');
  say('  Web         http://localhost:23000');
  say('  API docs    http://localhost:23100/docs');
  say(
    '  Accounts    admin@ / staff@ / customer@brewlite.test, and the demo customers @' +
      DEMO_DOMAIN,
  );
  say('              the password is SEED_ACCOUNT_PASSWORD (services/identity/.env)');
  say('  Sign in as staff@ to see the board.');
}

// Run when started from the command line; importing it (a one-off script, a test) runs nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\n✗ ${error.message}`);
    process.exit(1);
  });
}

export { catalogForOrders, login, runOrder };
