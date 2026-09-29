/**
 * Product decisions, not implementation details — product-overview §8, plus the bounds
 * the edge validates and a column enforces (conventions §3.2: one constant, never a
 * number typed twice). `STAFF_BOARD_STATUSES` and the locales live in `enums.ts`.
 * Durations are milliseconds, written as arithmetic.
 */

// product-overview §8
export const ORDER_UNPAID_TTL_MS = 15 * 60_000;
export const PAYMENT_WINDOW_MS = 35 * 60_000;
export const CHECKOUT_SESSION_TTL_MS = 30 * 60_000;
export const RESERVATION_ORPHAN_TTL_MS = 3 * 60 * 60_000;
export const MAX_LINES_PER_ORDER = 20;
export const MAX_QTY_PER_LINE = 10;
export const MAX_TOPPINGS_PER_LINE = 3;
export const ORDER_NOTE_MAX_LENGTH = 200;
export const MIN_PAYABLE_VND = 10_000;
export const MAX_ORDER_TOTAL_VND = 5_000_000;
export const LOYALTY_EARN_STEP_VND = 10_000;
export const LOYALTY_POINT_VALUE_VND = 1_000;
export const LOYALTY_MAX_REDEEM_PERCENT = 50;
export const ACCESS_TOKEN_TTL_MS = 15 * 60_000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
export const MENU_CACHE_TTL_MS = 5 * 60_000;
export const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const LOCK_REASON_MAX_LENGTH = 255;
export const MAX_LOCK_DURATION_DAYS = 365;

// rdm-spec §1.3, §1.6
export const MAX_PRICE_VND = 10_000_000;
export const STOCK_RESERVE_MAX_RETRIES = 5;

// api-endpoints-plan §0.4
export const MAX_MENU_PRODUCTS = 200;
export const MAX_MENU_CATEGORIES = 50;
export const MAX_ADMIN_TOPPINGS = 100;
export const STAFF_BOARD_MAX_ORDERS = 100;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// api-endpoints-plan §1.1
export const PASSWORD_MIN_BYTES = 8;
export const PASSWORD_MAX_BYTES = 72;

// I-1 email, full_name
export const EMAIL_MAX_LENGTH = 254;
export const FULL_NAME_MAX_LENGTH = 100;

// C-1, C-4 name_*
export const CATEGORY_NAME_MAX_LENGTH = 60;
export const TOPPING_NAME_MAX_LENGTH = 60;

// C-2 name_*, description_*; O-2 product_name_*
export const PRODUCT_NAME_MAX_LENGTH = 100;
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 500;

// O-1 cancel_note, O-3 note
export const CANCEL_NOTE_MAX_LENGTH = 200;

// O-4 code, O-1 promo_code
export const PROMO_CODE_PATTERN = /^[A-Z0-9]{3,32}$/;
export const PROMO_CODE_MAX_LENGTH = 32;

// O-4 description
export const PROMO_DESCRIPTION_MAX_LENGTH = 200;

// architecture §5 — shared by the access-token signer and every verifier
export const JWT_ISSUER = 'brewlite-identity';
export const JWT_AUDIENCE = 'brewlite-gateway';
