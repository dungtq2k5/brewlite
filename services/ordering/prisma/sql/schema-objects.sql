-- rdm-spec §5, ordering O-1 … O-6 and outbox_events rows. Idempotent — safe to run on
-- every deploy (conventions §7.1).

-- O-1: the order number starts at 1000 and never goes backwards on a re-run.
DO $$
BEGIN
  IF (SELECT last_value FROM orders_order_no_seq) < 1000 THEN
    PERFORM setval('orders_order_no_seq', 1000, false);
  END IF;
END $$;

-- O-1: the status set.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_ck'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_status_ck
      CHECK (status IN ('PENDING', 'PAYMENT_FAILED', 'PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'));
  END IF;
END $$;

-- O-1: total arithmetic; total_vnd >= MIN_PAYABLE_VND (10,000) in @brewlite/contracts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_total_ck'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_total_ck
      CHECK (total_vnd = subtotal_vnd - promo_discount_vnd - points_discount_vnd);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_min_payable_ck'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_min_payable_ck
      CHECK (total_vnd >= 10000);
  END IF;
END $$;

-- O-1: promotion_id and promo_code move together.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_promo_snapshot_ck'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_promo_snapshot_ck
      CHECK ((promotion_id IS NULL) = (promo_code IS NULL));
  END IF;
END $$;

-- O-1: CANCELLED <=> cancelled_at <=> cancel_reason.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_cancel_ck'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_cancel_ck
      CHECK (
        (status = 'CANCELLED') = (cancelled_at IS NOT NULL)
        AND (cancelled_at IS NULL) = (cancel_reason IS NULL)
      );
  END IF;
END $$;

-- O-1: the staff board's query.
CREATE INDEX IF NOT EXISTS orders_board_idx
  ON orders (status, id) WHERE status IN ('PAID', 'PREPARING', 'READY');

-- O-1: orders-expire's query (05b).
CREATE INDEX IF NOT EXISTS orders_unpaid_expiry_idx
  ON orders (expires_at) WHERE status IN ('PENDING', 'PAYMENT_FAILED');

-- O-2: line arithmetic; qty bounds — MAX_QTY_PER_LINE (10) in @brewlite/contracts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_qty_ck'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_qty_ck
      CHECK (qty BETWEEN 1 AND 10);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_line_total_ck'
  ) THEN
    ALTER TABLE order_items
      ADD CONSTRAINT order_items_line_total_ck
      CHECK (line_total_vnd = unit_price_vnd * qty);
  END IF;
END $$;

-- O-3: a CUSTOMER or STAFF actor carries a user id.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_status_history_actor_ck'
  ) THEN
    ALTER TABLE order_status_history
      ADD CONSTRAINT order_status_history_actor_ck
      CHECK ((actor_type IN ('CUSTOMER', 'STAFF')) = (actor_user_id IS NOT NULL));
  END IF;
END $$;

-- outbox_events: the relay's only query (rdm-spec §2.7, 05b).
CREATE INDEX IF NOT EXISTS outbox_events_unpublished_idx
  ON outbox_events (id) WHERE published_at IS NULL;

-- O-4: code is stored upper-case (case-insensitive at the edge, product-overview §6.5).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_code_upper_ck'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_code_upper_ck
      CHECK (code = upper(code));
  END IF;
END $$;

-- O-4: discount_value bounds per discount_type.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_value_ck'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_value_ck
      CHECK (
        (discount_type = 'PERCENT' AND discount_value BETWEEN 1 AND 100)
        OR (discount_type = 'FIXED' AND discount_value > 0)
      );
  END IF;
END $$;

-- O-4: a cap only makes sense on a PERCENT discount.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_cap_ck'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_cap_ck
      CHECK (max_discount_vnd IS NULL OR discount_type = 'PERCENT');
  END IF;
END $$;

-- O-4: the window is never empty or inverted.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_window_ck'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_window_ck
      CHECK (ends_at > starts_at);
  END IF;
END $$;

-- O-4: the database's own floor against an over-use — the row lock (§3.3) is the mechanism, this is the backstop.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_uses_ck'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_uses_ck
      CHECK (used_count >= 0 AND (max_uses IS NULL OR used_count <= max_uses));
  END IF;
END $$;

-- O-4: deleted_at and deleted_by_id move together (conventions §7.3).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotions_deleted_by_ck'
  ) THEN
    ALTER TABLE promotions
      ADD CONSTRAINT promotions_deleted_by_ck
      CHECK ((deleted_at IS NULL) = (deleted_by_id IS NULL));
  END IF;
END $$;

-- O-5: a balance never goes negative (product-overview §6.6).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_accounts_balance_ck'
  ) THEN
    ALTER TABLE loyalty_accounts
      ADD CONSTRAINT loyalty_accounts_balance_ck
      CHECK (balance >= 0);
  END IF;
END $$;

-- O-6: a zero-point transaction is never written.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_transactions_points_ck'
  ) THEN
    ALTER TABLE loyalty_transactions
      ADD CONSTRAINT loyalty_transactions_points_ck
      CHECK (points <> 0);
  END IF;
END $$;
