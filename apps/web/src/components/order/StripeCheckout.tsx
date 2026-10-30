'use client';

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

const KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Once, at module level: `loadStripe` appends Stripe.js to the page and must not run per render.
const stripePromise = KEY ? loadStripe(KEY) : null;

/** Whether card payments are configured on this build — `PaymentFrame` shows *unavailable* if not. */
export const hasStripeKey = Boolean(KEY);

/** Stripe's embedded form for the payment's session. Its inside is Stripe's; ours is the frame. */
export function StripeCheckout({ clientSecret }: Readonly<{ clientSecret: string }>) {
  if (!stripePromise) return null;
  return (
    <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
      <EmbeddedCheckout />
    </EmbeddedCheckoutProvider>
  );
}
