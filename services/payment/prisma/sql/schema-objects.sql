-- rdm-spec §5: payment's rows, exactly. Idempotent — safe to run on
-- every deploy (conventions §7.1).

-- P-1: amount_vnd >= MIN_PAYABLE_VND (15,000) in @brewlite/contracts.
DO $$
BEGIN
  -- Replaced, not skipped: the minimum has changed once (Stripe's floor), and a bare
  -- IF NOT EXISTS would keep the old value on a database that already has the constraint.
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_ck;
  ALTER TABLE payments
    ADD CONSTRAINT payments_amount_ck
    CHECK (amount_vnd >= 15000);
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

-- P-2: the status and reason sets.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'refunds_status_ck'
  ) THEN
    ALTER TABLE refunds
      ADD CONSTRAINT refunds_status_ck
      CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'refunds_reason_ck'
  ) THEN
    ALTER TABLE refunds
      ADD CONSTRAINT refunds_reason_ck
      CHECK (reason IN ('STAFF_CANCELLED', 'ORDER_NOT_PAYABLE'));
  END IF;
END $$;

-- outbox_events: the relay's only query (rdm-spec §2.7, 05b).
CREATE INDEX IF NOT EXISTS outbox_events_unpublished_idx
  ON outbox_events (id) WHERE published_at IS NULL;
