-- Admin balance adjustments carry an Idempotency-Key so a retried request is applied once.
ALTER TABLE "ledger_entries" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ledger_entries_actor_id_idempotency_key_key" ON "ledger_entries"("actor_id", "idempotency_key");
