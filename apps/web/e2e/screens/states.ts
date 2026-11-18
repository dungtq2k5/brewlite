/**
 * The state map (D08 handoff §4) as data: every designed state the screens suite draws, at the
 * widths its Figma frames exist for. `frame` is the frame's height — taller than the viewport
 * means the baseline is the full page (handoff §3.4). A width with no frame (`null`) is still
 * baselined, and marked *no frame* in the review. A `skip` carries its reason.
 *
 * `states.test.ts` holds this list and the specs together: every drawn state has exactly one
 * `look()`, and every `look()` names a state here.
 *
 * Plain, erasable TypeScript (no enums): `review.mjs` imports it with Node's type stripping.
 */
export type Width = 390 | 1024 | 1280;

/** The viewport each width is drawn at. */
export const VIEWPORT: Record<Width, { width: number; height: number }> = {
  390: { width: 390, height: 844 },
  1024: { width: 1024, height: 768 },
  1280: { width: 1280, height: 900 },
};

export interface DrawnState {
  route: string;
  /** Per width: the Figma node and its frame's height, or `null` for a width with no frame. */
  widths: Partial<Record<Width, { node: string; frame: number } | null>>;
}
export interface SkippedState {
  route: string;
  skip: string;
  widths?: Partial<Record<Width, { node: string; frame: number } | null>>;
}
export type State = DrawnState | SkippedState;

const at390 = (node: string, frame = 844) => ({ 390: { node, frame } });
const SERVER_FETCH = 'server-side fetch — the browser cannot hold it (handoff: not reachable)';
const GATEWAY_DOWN = 'needs the gateway down — not in the shared stack (handoff)';

export const STATES: Record<string, State> = {
  // Customer — menu (D02, D06, D07)
  'customer-menu-guest': {
    route: '/',
    widths: { 390: { node: '123:21', frame: 844 }, 1280: { node: '123:2740', frame: 900 } },
  },
  'customer-menu-guest-vi': { route: '/', widths: { ...at390('123:1157'), 1280: null } },
  'customer-menu-signed-in': { route: '/', widths: { ...at390('123:1677'), 1280: null } },
  'customer-menu-no-hero': { route: '/', widths: { ...at390('123:2180'), 1280: null } },
  'customer-menu-scrolled': { route: '/', widths: { ...at390('48:629'), 1280: null } },
  'customer-menu-photos': { route: '/', widths: { ...at390('48:1177'), 1280: null } },
  'customer-menu-loading': { route: '/', skip: SERVER_FETCH, widths: at390('51:2179') },
  'customer-menu-all-sold-out': { route: '/', widths: { ...at390('123:2293'), 1280: null } },
  'customer-menu-failed': { route: '/', skip: GATEWAY_DOWN, widths: at390('51:2758') },
  'customer-menu-added': { route: '/', widths: at390('51:2808') },
  'customer-menu-search-results': {
    route: '/',
    widths: { 390: { node: '123:2236', frame: 844 }, 1280: { node: '116:6073', frame: 900 } },
  },
  'customer-menu-search-accentless': { route: '/', widths: at390('116:4120') },
  'customer-menu-search-vi': { route: '/', widths: at390('116:4607') },
  'customer-menu-search-no-results': { route: '/', widths: at390('116:5093') },
  'customer-menu-search-no-results-vi': { route: '/', widths: at390('116:5583') },

  // Customer — product (D03)
  'customer-product-default': {
    route: '/products/[id]',
    widths: { 390: { node: '52:2800', frame: 1101 }, 1280: { node: '55:4958', frame: 900 } },
  },
  'customer-product-two-toppings': { route: '/products/[id]', widths: at390('52:2921', 1101) },
  'customer-product-two-toppings-vi': { route: '/products/[id]', widths: at390('52:3151', 1101) },
  'customer-product-topping-limit': { route: '/products/[id]', widths: at390('52:3033', 1133) },
  'customer-product-sold-out': { route: '/products/[id]', widths: at390('53:3323', 893) },
  'customer-product-one-size': { route: '/products/[id]', widths: at390('53:3411') },
  'customer-product-quantity-max': { route: '/products/[id]', widths: at390('53:3477', 907) },
  'customer-product-cart-full': { route: '/products/[id]', widths: at390('53:3587', 949) },
  'customer-product-loading': {
    route: '/products/[id]',
    skip: SERVER_FETCH,
    widths: at390('53:3700'),
  },
  'customer-product-not-found': { route: '/products/[id]', widths: at390('53:3750') },
  'customer-product-failed': {
    route: '/products/[id]',
    skip: GATEWAY_DOWN,
    widths: at390('53:3801'),
  },

  // Customer — cart (D03)
  'customer-cart-empty': { route: '/cart', widths: { ...at390('54:3523'), 1280: null } },
  'customer-cart-guest': { route: '/cart', widths: { ...at390('54:3580'), 1280: null } },
  'customer-cart-signed-in': { route: '/cart', widths: { ...at390('54:3687'), 1280: null } },
  'customer-cart-signed-in-vi': { route: '/cart', widths: at390('54:3863') },
  'customer-cart-full': { route: '/cart', widths: at390('54:4042') },
  'customer-cart-undo': { route: '/cart', widths: at390('54:4982') },
};

export const isSkipped = (state: State): state is SkippedState => 'skip' in state;
