/** Stripe's refund `status` → ours; anything still settling (`pending`, `requires_action`) waits for a webhook. */
export function toRefundOutcome(
  status: string | null | undefined,
): 'SUCCEEDED' | 'PENDING' | 'FAILED' {
  if (status === 'succeeded') return 'SUCCEEDED';
  if (status === 'failed' || status === 'canceled') return 'FAILED';
  return 'PENDING';
}
