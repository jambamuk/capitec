import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { Kafka, logLevel } from "kafkajs";
import { request } from "@playwright/test";
import pg from "pg";

// Used only by the isolated Compose test project. Never run against the normal demo.
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const snapshotPath = "/artifacts/reset-recovery.json";
const counts = async () =>
  (
    await db.query(`select
  (select count(*)::int from financial_transaction) transactions,
  (select count(*)::int from demo_reset_audit) resets`)
  ).rows[0];
try {
  if (process.argv[2] === "rewind") {
    const admin = new Kafka({
      clientId: "reset-recovery",
      brokers: ["kafka:9092"],
      logLevel: logLevel.ERROR,
    }).admin();
    await admin.connect();
    try {
      const checkpoints = await db.query(
        "select partition_key from processing_checkpoint",
      );
      assert.equal(checkpoints.rowCount, 12);
      await writeFile(snapshotPath, JSON.stringify(await counts()));
      for (const topic of [
        "mock.bank.transactions.v1",
        "mock.card.transactions.v1",
        "mock.wallet.transactions.v1",
        "transactions.categorized.v1",
      ]) {
        await admin.setOffsets({
          groupId:
            topic === "transactions.categorized.v1"
              ? "fraud-engine-v1"
              : "aggregation-v1",
          topic,
          partitions: [0, 1, 2].map((partition) => ({
            partition,
            offset: "0",
          })),
        });
      }
      console.log(
        "Rewound test consumer groups after reset while the application was stopped",
      );
    } finally {
      await admin.disconnect();
    }
  } else if (process.argv[2] === "assert") {
    const before = JSON.parse(await readFile(snapshotPath, "utf8"));
    // The ordinary recovery check first waits for its one newly queued transaction.
    // All post-reset records are duplicates; pre-reset offsets must remain ignored.
    await new Promise((resolve) => setTimeout(resolve, 3500));
    assert.deepEqual(await counts(), {
      ...before,
      transactions: before.transactions + 1,
    });
    const resurrected = await db.query(`select t.id from financial_transaction t
      join processing_checkpoint c on c.partition_key=t.origin_topic || ':' || t.origin_partition
      where t.origin_offset < c.next_offset`);
    assert.equal(resurrected.rowCount, 0);
    console.log(
      "Persisted reset cutoffs prevented old transactions returning after restart and offset rewind",
    );
  } else if (process.argv[2] === "unavailable") {
    const api = await request.newContext({ baseURL: process.env.BASE_URL });
    try {
      const csrf = await (await api.get("/api/csrf")).json();
      assert.equal(
        (
          await api.post("/api/session", {
            form: { username: "operator", password: "operator-demo" },
            headers: { [csrf.headerName]: csrf.token },
          })
        ).status(),
        204,
      );
      const before = await counts();
      const token = await (await api.get("/api/csrf")).json();
      const response = await api.post("/api/v1/testing/reset", {
        data: { confirmation: "RESET ALL TRANSACTIONS" },
        headers: { [token.headerName]: token.token },
      });
      assert.equal(response.status(), 503);
      assert.deepEqual(await counts(), before);
      const states = await (await api.get("/api/v1/testing/sources")).json();
      assert.equal(
        states.find((source) => source.source === "WALLET_PROVIDER").error,
        "Source unavailable",
      );
      assert.equal(
        (await api.get("http://bank-source:8080/control")).status(),
        403,
      );
      console.log(
        "Unavailable source blocked reset without deleting transactions or recording a successful reset",
      );
    } finally {
      await api.dispose();
    }
  } else throw new Error("Expected rewind, assert or unavailable");
} finally {
  await db.end();
}
