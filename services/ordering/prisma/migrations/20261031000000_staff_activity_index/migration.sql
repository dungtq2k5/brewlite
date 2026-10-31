-- CreateIndex
CREATE INDEX "order_status_history_actor_user_id_created_at_idx" ON "order_status_history"("actor_user_id", "created_at");
