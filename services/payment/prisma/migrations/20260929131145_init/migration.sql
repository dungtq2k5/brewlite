-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_vnd" INTEGER NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "method" VARCHAR(16),
    "idempotency_key" UUID NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "stripe_checkout_session_id" VARCHAR(255),
    "stripe_payment_intent_id" VARCHAR(255),
    "failure_reason" VARCHAR(16),
    "expires_at" TIMESTAMPTZ(3),
    "succeeded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_key" ON "payments"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_user_idempotency_key" ON "payments"("user_id", "idempotency_key");
