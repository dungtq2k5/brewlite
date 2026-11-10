// The pure parts of `scripts/seed-dev.mjs` — the PRNG, the plan of the demo café, the time shift
// and the .env reader — kept apart so they can be tested without a stack (seed-dev.spec.mjs).

/** A tiny seeded PRNG (mulberry32): the same seed makes the same café on every machine. */
export function makeRng(seed) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

/** `KEY=value` lines of a `.env` file as an object — read, never loaded into `process.env`. */
export function readEnvText(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, ''); // dotenv's rule: an unquoted value ends at ` #`
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

const VN = 'Asia/Ho_Chi_Minh';

/** `'YYYY-MM-DD'` — the business day (Vietnam time) an instant falls on. */
export function businessDay(instant) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: VN,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(instant)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

export function shiftDay(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The instant of `hh:mm` on a business day, in Vietnam time (UTC+7 all year). */
export const vietnamTime = (day, hour, minute) =>
  new Date(`${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`);

// Opening hours 07:00–21:00; busier at 8–9 and 14–16.
const HOURS = [
  [7, 3],
  [8, 6],
  [9, 6],
  [10, 3],
  [11, 3],
  [12, 3],
  [13, 3],
  [14, 6],
  [15, 6],
  [16, 5],
  [17, 3],
  [18, 2],
  [19, 2],
  [20, 1],
];

export function pickHour(rng) {
  const total = HOURS.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng.int(total);
  for (const [hour, weight] of HOURS) {
    if (roll < weight) return hour;
    roll -= weight;
  }
  return HOURS[0][0];
}

export const DEMO_DOMAIN = 'demo.brewlite.test';

export const DEMO_CUSTOMERS = [
  { name: 'Nguyễn Thu Hà', email: 'ha.nguyen', locale: 'vi' },
  { name: 'Trần Minh Khoa', email: 'khoa.tran', locale: 'vi' },
  { name: 'Lê Hoàng Nam', email: 'nam.le', locale: 'en' },
  { name: 'Phạm Quỳnh Anh', email: 'anh.pham', locale: 'en' },
  { name: 'Võ Ngọc Mai', email: 'mai.vo', locale: 'en' },
  { name: 'Đặng Gia Huy', email: 'huy.dang', locale: 'en' },
  { name: 'Bùi Thanh Tâm', email: 'tam.bui', locale: 'en' },
  { name: 'Hoàng Bảo Ngọc', email: 'ngoc.hoang', locale: 'en' },
].map((c) => ({ ...c, email: `${c.email}@${DEMO_DOMAIN}` }));

const NOTES = ['Ít đá, ít ngọt', 'Không đường', 'Thêm đá', 'Ít ngọt', 'Giao ra bàn gần cửa sổ'];

/**
 * The demo café as a plan — no I/O. ~72 orders: five live on today's board (PAID, PREPARING,
 * READY), five completed earlier today, three paid orders cancelled by staff, four cancelled by the
 * customer before paying, the rest completed over the previous 29 days (one a day at least).
 * `target: null` means *leave it where the API put it* (today's); otherwise the order is moved back
 * to that instant. `picks` are floats in [0, 1) the runner turns into products, sizes and toppings.
 */
export function planDemo({ now, seed = 2026, customers = DEMO_CUSTOMERS.length }) {
  const rng = makeRng(seed);
  const today = businessDay(now);
  const orders = [];
  const add = (kind, daysAgo, extra = {}) => {
    const day = shiftDay(today, -daysAgo);
    orders.push({
      kind,
      daysAgo,
      target: daysAgo === 0 ? null : vietnamTime(day, pickHour(rng), rng.int(60)),
      customer: 0,
      picks: Array.from({ length: 12 }, () => rng.next()),
      note: rng.chance(0.2) ? rng.pick(NOTES) : null,
      promo: null,
      minSubtotal: 30_000,
      ...extra,
    });
  };

  for (const kind of ['PAID', 'PAID', 'PREPARING', 'PREPARING', 'READY']) add(`live-${kind}`, 0);
  for (let i = 0; i < 5; i++) add('COMPLETED', 0);
  for (let i = 0; i < 3; i++) add('staff-cancel', 1 + rng.int(25));
  for (let i = 0; i < 4; i++) add('customer-cancel', 1 + rng.int(25));
  for (let day = 1; day <= 29; day++) add('COMPLETED', day); // a sale on every one of the 29 days
  for (let i = 0; i < 26; i++) {
    const day = 1 + rng.int(29);
    const weekend = [0, 6].includes(new Date(`${shiftDay(today, -day)}T00:00:00Z`).getUTCDay());
    add('COMPLETED', weekend && rng.chance(0.5) ? day : 1 + rng.int(29));
  }

  // Customers: round-robin over a shuffle, so the five live orders sit with five different people.
  const order = Array.from({ length: customers }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  orders.forEach((o, i) => (o.customer = order[i % customers]));

  // WELCOME10: each customer's oldest completed order. COFFEE20K: three completed orders of three
  // customers, big enough for its ₫50,000 minimum.
  const firstOf = new Map();
  for (const o of orders.filter((x) => x.kind === 'COMPLETED' && x.daysAgo > 0)) {
    const best = firstOf.get(o.customer);
    if (!best || o.daysAgo > best.daysAgo) firstOf.set(o.customer, o);
  }
  for (const o of firstOf.values()) o.promo = 'WELCOME10';
  const coffee = [];
  for (const o of orders) {
    if (coffee.length === 3) break;
    if (
      o.kind === 'COMPLETED' &&
      o.daysAgo > 3 &&
      !o.promo &&
      !coffee.some((c) => c.customer === o.customer)
    ) {
      o.promo = 'COFFEE20K';
      o.minSubtotal = 55_000;
      coffee.push(o);
    }
  }

  // Each customer's orders oldest first: ids are time-ordered, and the history lists by id.
  const queues = Array.from({ length: customers }, () => []);
  for (const o of orders) queues[o.customer].push(o);
  for (const q of queues) q.sort((a, b) => b.daysAgo - a.daysAgo);
  return { orders, queues };
}

/** What the plan holds, by kind — the table `seed:dev` prints. */
export function summarize(plan) {
  const count = (pred) => plan.orders.filter(pred).length;
  return {
    total: plan.orders.length,
    live: count((o) => o.kind.startsWith('live-')),
    completed: count((o) => o.kind === 'COMPLETED'),
    staffCancelled: count((o) => o.kind === 'staff-cancel'),
    customerCancelled: count((o) => o.kind === 'customer-cancel'),
    withPromo: count((o) => o.promo),
    days: new Set(plan.orders.map((o) => o.daysAgo)).size,
  };
}

/** How far back an order that was just created must move to land on `target`, in milliseconds. */
export const offsetMs = (createdAt, target) =>
  Math.max(0, Math.round(createdAt.getTime() - target.getTime()));

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function rows(moves) {
  for (const m of moves) {
    if (!uuid.test(m.orderId) || !Number.isFinite(m.ms))
      throw new Error(`bad move ${JSON.stringify(m)}`);
  }
  return moves.map((m) => `('${m.orderId}', ${m.ms})`).join(',\n  ');
}

/**
 * One transaction on the **ordering** database: every timestamp of each order moves by the same
 * amount, so their order and every CHECK hold. Only the ids given are touched.
 */
export function orderingShiftSql(moves) {
  if (moves.length === 0) return '';
  const back = (table, col, alias) =>
    `${col} = ${alias}.${col} - make_interval(secs => s.ms / 1000.0)`;
  return `BEGIN;
CREATE TEMP TABLE shift (order_id uuid, ms bigint) ON COMMIT DROP;
INSERT INTO shift VALUES
  ${rows(moves)};
UPDATE orders o SET
  ${['created_at', 'updated_at', 'paid_at', 'cancelled_at', 'expires_at'].map((c) => back('orders', c, 'o')).join(',\n  ')}
FROM shift s WHERE o.id = s.order_id;
UPDATE order_status_history h SET ${back('h', 'created_at', 'h')}
FROM shift s WHERE h.order_id = s.order_id;
UPDATE loyalty_transactions l SET ${back('l', 'created_at', 'l')}
FROM shift s WHERE l.order_id = s.order_id;
COMMIT;
`;
}

/** The same on the **payment** database: its payments and refunds. */
export function paymentShiftSql(moves) {
  if (moves.length === 0) return '';
  const back = (col, alias) => `${col} = ${alias}.${col} - make_interval(secs => s.ms / 1000.0)`;
  return `BEGIN;
CREATE TEMP TABLE shift (order_id uuid, ms bigint) ON COMMIT DROP;
INSERT INTO shift VALUES
  ${rows(moves)};
UPDATE payments p SET
  ${['created_at', 'updated_at', 'succeeded_at', 'expires_at'].map((c) => back(c, 'p')).join(',\n  ')}
FROM shift s WHERE p.order_id = s.order_id;
UPDATE refunds r SET
  ${['created_at', 'updated_at'].map((c) => back(c, 'r')).join(',\n  ')}
FROM shift s WHERE r.order_id = s.order_id;
COMMIT;
`;
}
