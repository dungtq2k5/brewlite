-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_no" BIGSERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "subtotal_vnd" INTEGER NOT NULL,
    "promo_discount_vnd" INTEGER NOT NULL DEFAULT 0,
    "points_redeemed" INTEGER NOT NULL DEFAULT 0,
    "points_discount_vnd" INTEGER NOT NULL DEFAULT 0,
    "total_vnd" INTEGER NOT NULL,
    "promotion_id" UUID,
    "promo_code" VARCHAR(32),
    "note" VARCHAR(200),
    "idempotency_key" UUID NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "current_payment_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "paid_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" VARCHAR(16),
    "cancel_note" VARCHAR(200),
    "refund_status" VARCHAR(16) NOT NULL DEFAULT 'NONE',
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "line_no" SMALLINT NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_en" VARCHAR(100) NOT NULL,
    "product_name_vi" VARCHAR(100) NOT NULL,
    "size" VARCHAR(1) NOT NULL,
    "base_price_vnd" INTEGER NOT NULL,
    "size_delta_vnd" INTEGER NOT NULL,
    "toppings" JSONB NOT NULL DEFAULT '[]',
    "unit_price_vnd" INTEGER NOT NULL,
    "qty" SMALLINT NOT NULL,
    "line_total_vnd" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "from_status" VARCHAR(16),
    "to_status" VARCHAR(16) NOT NULL,
    "actor_type" VARCHAR(16) NOT NULL,
    "actor_user_id" UUID,
    "note" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "subject" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "request_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_user_id_id_idx" ON "orders"("user_id", "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_user_idempotency_key" ON "orders"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_line_no_key" ON "order_items"("order_id", "line_no");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_id_idx" ON "order_status_history"("order_id", "id");

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
