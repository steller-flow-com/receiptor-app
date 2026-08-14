CREATE TABLE "indexer_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_hash" text NOT NULL,
	"payer" text NOT NULL,
	"payee" text NOT NULL,
	"asset" text NOT NULL,
	"amount" text NOT NULL,
	"service_id" text NOT NULL,
	"ts" text NOT NULL,
	"side" text NOT NULL,
	"account" text NOT NULL,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"receipt_hash" text PRIMARY KEY NOT NULL,
	"payer" text NOT NULL,
	"payee" text NOT NULL,
	"asset" text NOT NULL,
	"amount" text NOT NULL,
	"service_id" text NOT NULL,
	"nonce" text NOT NULL,
	"ts" text NOT NULL,
	"ledger" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"tx_hash" text NOT NULL,
	"op_index" integer NOT NULL,
	"payer" text NOT NULL,
	"payee" text NOT NULL,
	"asset" text NOT NULL,
	"amount" text NOT NULL,
	"ledger" integer NOT NULL,
	CONSTRAINT "settlements_tx_hash_op_index_pk" PRIMARY KEY("tx_hash","op_index")
);
--> statement-breakpoint
CREATE INDEX "ledger_payee_idx" ON "ledger_entries" USING btree ("payee");--> statement-breakpoint
CREATE INDEX "receipts_payee_idx" ON "receipts" USING btree ("payee");--> statement-breakpoint
CREATE INDEX "settlements_payee_idx" ON "settlements" USING btree ("payee");