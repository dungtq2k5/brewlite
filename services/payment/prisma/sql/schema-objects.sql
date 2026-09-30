-- rdm-spec §5: payment's rows, exactly. Idempotent — safe to run on
-- every deploy (conventions §7.1).

-- P-1: amount_vnd >= MIN_PAYABLE_VND (10,000) in @brewlite/contracts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_ck'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_amount_ck
      CHECK (amount_vnd >= 10000);
  END IF;
END $$;

-- P-1: SUCCEEDED <=> succeeded_at.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payments_succeeded_ck'
  ) THEN
    ALTER TABLE payments
      ADD CONSTRAINT payments_succeeded_ck
      CHECK ((status = 'SUCCEEDED') = (succeeded_at IS NOT NULL));
  END IF;
END $$;

-- P-1: at most one PENDING payment per order at a time — CreatePayment's advisory
-- lock serialises writers, but the index is the actual guarantee (§4).
CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_per_order
  ON payments (order_id) WHERE status = 'PENDING';

-- outbox_events: the relay's only query (rdm-spec §2.7, 05b).
CREATE INDEX IF NOT EXISTS outbox_events_unpublished_idx
  ON outbox_events (id) WHERE published_at IS NULL;
