import assert from "node:assert/strict";
import { Kafka, logLevel } from "kafkajs";
import pg from "pg";

const [mode, reference] = process.argv.slice(2);
if (mode === "publish") {
  const kafka = new Kafka({
    clientId: "recovery-check",
    brokers: ["kafka:9092"],
    logLevel: logLevel.ERROR,
  });
  const producer = kafka.producer();
  await producer.connect();
  try {
    await producer.send({
      topic: "mock.wallet.transactions.v1",
      messages: [
        {
          key: "wallet-account-1042",
          value: JSON.stringify({
            eventId: reference,
            schemaVersion: 1,
            source: "WALLET_PROVIDER",
            sourceAccountRef: "wallet-account-1042",
            occurredAt: "2026-11-09T10:00:00Z",
            payload: {
              reference,
              counterparty: "Recovery check",
              signedAmount: "-1.00",
              currency: "ZAR",
            },
          }),
        },
      ],
    });
    console.log(`Published ${reference} while a dependency was stopped`);
  } finally {
    await producer.disconnect();
  }
} else if (mode === "assert") {
  const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const deadline = Date.now() + 90000;
    let verified = false;
    while (Date.now() < deadline) {
      const result = await db.query(
        `select count(*)::int count from financial_transaction t
        join fraud_evaluation f on f.transaction_id=t.id where t.source_transaction_ref=$1`,
        [reference],
      );
      if (result.rows[0].count === 1) {
        verified = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.ok(
      verified,
      `${reference} must recover and complete fraud evaluation exactly once`,
    );
    const duplicates =
      await db.query(`select source_account_id,source_transaction_ref from financial_transaction
      group by source_account_id,source_transaction_ref having count(*)>1`);
    assert.equal(duplicates.rowCount, 0);
    console.log(
      `Verified ${reference}: one transaction and one persisted evaluation`,
    );
  } finally {
    await db.end();
  }
} else {
  throw new Error("Expected publish or assert and a reference");
}
