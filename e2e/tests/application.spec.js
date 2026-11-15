import { test, expect, request as requestFactory } from "@playwright/test";
import { Kafka, logLevel } from "kafkajs";
import pg from "pg";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { randomUUID } from "node:crypto";

const account = "20000000-0000-0000-0000-000000000001";
const otherAccount = "20000000-0000-0000-0000-000000000002";
const kafka = new Kafka({
  clientId: "acceptance",
  brokers: (process.env.KAFKA_BROKERS || "kafka:9092").split(","),
  logLevel: logLevel.ERROR,
});
const producer = kafka.producer();
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let operator;
let customer;
let other;
let deadLetters = [];
let deadConsumer;
async function login(username, password) {
  const api = await requestFactory.newContext({
    baseURL: process.env.BASE_URL,
  });
  const csrf = await (await api.get("/api/csrf")).json();
  const response = await api.post("/api/session", {
    form: { username, password },
    headers: { [csrf.headerName]: csrf.token },
  });
  expect(response.status()).toBe(204);
  return api;
}
async function mutate(api, method, path, options = {}) {
  const csrf = await (await api.get("/api/csrf")).json();
  return api[method](path, {
    ...options,
    headers: { ...options.headers, [csrf.headerName]: csrf.token },
  });
}
async function pdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 500]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Synthetic account statement", {
    x: 30,
    y: 450,
    size: 16,
    font,
  });
  return Buffer.from(await doc.save());
}
async function summary(api = operator) {
  const r = await api.get("/api/v1/transaction-summary?accountId=" + account);
  expect(r.ok()).toBeTruthy();
  return r.json();
}
async function send(topic, value) {
  await producer.send({
    topic,
    messages: [
      {
        key: "wallet-account-1042",
        value: typeof value === "string" ? value : JSON.stringify(value),
      },
    ],
  });
}
const walletEvent = {
  eventId: "e2e-wallet-unique",
  schemaVersion: 1,
  source: "WALLET_PROVIDER",
  sourceAccountRef: "wallet-account-1042",
  occurredAt: "2026-11-09T09:00:00Z",
  payload: {
    reference: "e2e-wallet-unique",
    counterparty: "Mystery merchant",
    signedAmount: "-17.25",
    currency: "ZAR",
  },
};
test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  operator = await login("operator", "operator-demo");
  customer = await login("amina", "customer-demo");
  other = await login("ben", "customer-demo");
  await producer.connect();
  deadConsumer = kafka.consumer({ groupId: "acceptance-dlt-" + Date.now() });
  await deadConsumer.connect();
  await deadConsumer.subscribe({
    topic: "transactions.raw.dlt.v1",
    fromBeginning: true,
  });
  await deadConsumer.run({
    eachMessage: async ({ message }) => {
      deadLetters.push(message.value?.toString());
    },
  });
});
test.afterAll(async () => {
  await producer.disconnect();
  await deadConsumer?.disconnect();
  await db.end();
  await operator?.dispose();
  await customer?.dispose();
  await other?.dispose();
});
test("three sources aggregate exact totals and fraud checks persist", async () => {
  await expect.poll(async () => (await summary()).transactionCount).toBe(3);
  const totals = await summary();
  expect(totals).toMatchObject({
    moneyIn: "25000.00",
    moneyOut: "5942.50",
    netFlow: "19057.50",
  });
  const rows = await (
    await operator.get("/api/v1/transactions?accountId=" + account)
  ).json();
  expect(new Set(rows.items.map((t) => t.source)).size).toBe(3);
  const card = rows.items.find((t) => t.description === "GadgetHub");
  await expect
    .poll(
      async () =>
        (
          await (
            await operator.get(
              "/api/v1/transactions/" + card.id + "/fraud-evaluation",
            )
          ).json()
        ).status,
    )
    .toBe("FLAGGED");
  const fraud = await (
    await operator.get("/api/v1/transactions/" + card.id + "/fraud-evaluation")
  ).json();
  expect(fraud.rules).toHaveLength(6);
  expect(fraud.coverage).toBe("PARTIAL");
  expect(
    fraud.rules.find((r) => r.ruleCode === "HIGH_VALUE_DEBIT").result,
  ).toBe("MATCHED");
  const categories = await (
    await operator.get(
      "/api/v1/breakdowns?accountId=" + account + "&groupBy=CATEGORY",
    )
  ).json();
  expect(categories.items.find((b) => b.name === "GROCERIES").moneyOut).toBe(
    "842.50",
  );
});
test("duplicate delivery is safe; poison and conflicting events are quarantined", async () => {
  await send("mock.wallet.transactions.v1", walletEvent);
  await send("mock.wallet.transactions.v1", walletEvent);
  await expect.poll(async () => (await summary()).transactionCount).toBe(4);
  expect((await summary()).moneyOut).toBe("5959.75");
  await send("mock.wallet.transactions.v1", {
    ...walletEvent,
    payload: { ...walletEvent.payload, signedAmount: "-18.00" },
  });
  await send("mock.wallet.transactions.v1", "{not-json");
  await expect.poll(() => deadLetters.length).toBeGreaterThanOrEqual(2);
  expect((await summary()).transactionCount).toBe(4);
  expect((await summary()).moneyOut).toBe("5959.75");
  const duplicates = await db.query(
    "select count(*)::int count from financial_transaction where source_transaction_ref='e2e-wallet-unique'",
  );
  expect(duplicates.rows[0].count).toBe(1);
});
test("pagination, date validation and ownership are enforced by the API", async () => {
  const first = await (
    await customer.get("/api/v1/transactions?accountId=" + account + "&limit=1")
  ).json();
  expect(first.items).toHaveLength(1);
  expect(first.nextCursor).toBeTruthy();
  const second = await (
    await customer.get(
      "/api/v1/transactions?accountId=" +
        account +
        "&limit=1&cursor=" +
        encodeURIComponent(first.nextCursor),
    )
  ).json();
  expect(second.items[0].id).not.toBe(first.items[0].id);
  expect(
    (await other.get("/api/v1/transactions/" + first.items[0].id)).status(),
  ).toBe(404);
  expect(
    (
      await customer.get("/api/v1/transactions?accountId=" + otherAccount)
    ).status(),
  ).toBe(404);
  expect(
    (await customer.get("/api/v1/transactions?limit=10000")).status(),
  ).toBe(400);
  expect(
    (
      await customer.get(
        "/api/v1/transaction-summary?from=2026-11-10&toExclusive=2026-11-01",
      )
    ).status(),
  ).toBe(400);
  expect(
    (
      await customer.post(
        "/api/v1/statements/" + first.items[0].id + "/download-links",
      )
    ).status(),
  ).toBe(403);
});
test("browser: sign in, filter transactions, explain fraud, upload and download PDF", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/transactions");
  await page.getByLabel("Username", { exact: true }).fill("operator");
  await page.getByLabel("Password", { exact: true }).fill("operator-demo");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Transactions", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("FreshMart", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Account filter", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByRole("cell").filter({ hasText: "Ben Mokoena" }),
  ).toBeVisible();
  await page
    .getByLabel("Account filter", { exact: true })
    .selectOption(otherAccount);
  await expect(page.getByText("GadgetHub", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("cell").filter({ hasText: "Ben Mokoena" }),
  ).toBeVisible();
  await page.getByLabel("Account filter", { exact: true }).selectOption("");
  await page.getByLabel("Category", { exact: true }).selectOption("GROCERIES");
  await expect(page.getByText("GadgetHub", { exact: true })).toHaveCount(0);
  await expect(page.getByText("FreshMart", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await page.screenshot({
    path: "/artifacts/transactions.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Fraud checks", exact: true }).click();
  await page.getByRole("button", { name: "Review GadgetHub" }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByText("Amount exceeds ZAR 5000.00.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/artifacts/fraud.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByLabel("Review note", { exact: true })
    .fill("Customer contacted; payment confirmed.");
  await page
    .getByRole("button", { name: "Mark as reviewed", exact: true })
    .click();
  await expect(
    page.getByText("Reviewed by operator", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByLabel("Review status", { exact: true })
    .selectOption("REVIEWED");
  await expect(
    page.getByRole("button", { name: "Review GadgetHub" }),
  ).toBeVisible();
  await page
    .getByLabel("Review status", { exact: true })
    .selectOption("NEEDS_REVIEW");
  await expect(
    page.getByRole("button", { name: "Review GadgetHub" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Statements", exact: true }).click();
  await page
    .getByLabel("Upload account", { exact: true })
    .selectOption(account);
  await page.getByLabel("Upload a statement").setInputFiles({
    name: "browser-statement.pdf",
    mimeType: "application/pdf",
    buffer: await pdf(),
  });
  await page.getByRole("button", { name: "Upload PDF", exact: true }).click();
  await expect(
    page.getByText("Statement uploaded", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create download link" })
    .first()
    .click();
  await expect(page.getByLabel("Download link", { exact: true })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download PDF" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("browser-statement.pdf");
  await page.screenshot({
    path: "/artifacts/statements.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/artifacts/mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("link", { name: "Transactions", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Transactions", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});
test("PDF validation, customer isolation, tampering, revocation and expiry", async () => {
  const invalid = await mutate(operator, "post", "/api/v1/statements", {
    multipart: {
      accountId: account,
      file: {
        name: "fake.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a PDF"),
      },
    },
  });
  expect(invalid.status()).toBe(400);
  const document = await mutate(operator, "post", "/api/v1/statements", {
    multipart: {
      accountId: account,
      file: {
        name: "api-statement.pdf",
        mimeType: "application/pdf",
        buffer: await pdf(),
      },
    },
  });
  expect(document.status()).toBe(201);
  const { id } = await document.json();
  expect(
    (
      await mutate(
        other,
        "post",
        "/api/v1/statements/" + id + "/download-links",
      )
    ).status(),
  ).toBe(404);
  const grant = await (
    await mutate(
      customer,
      "post",
      "/api/v1/statements/" + id + "/download-links",
    )
  ).json();
  const anonymous = await requestFactory.newContext({
    baseURL: process.env.BASE_URL,
  });
  const downloaded = await anonymous.get(grant.downloadUrl);
  expect(downloaded.status()).toBe(200);
  expect(downloaded.headers()["cache-control"]).toContain("no-store");
  expect((await downloaded.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await anonymous.get("/downloads/" + "x".repeat(43))).status()).toBe(
    404,
  );
  expect(
    (
      await mutate(customer, "delete", "/api/v1/download-links/" + grant.id)
    ).status(),
  ).toBe(204);
  expect((await anonymous.get(grant.downloadUrl)).status()).toBe(404);
  const expiring = await (
    await mutate(
      customer,
      "post",
      "/api/v1/statements/" + id + "/download-links",
    )
  ).json();
  await expect
    .poll(async () => (await anonymous.get(expiring.downloadUrl)).status(), {
      timeout: 10000,
      intervals: [1000],
    })
    .toBe(404);
  const stored = await db.query(
    "select token_hash from download_grant where id=$1",
    [expiring.id],
  );
  expect(stored.rows[0].token_hash).not.toContain(
    expiring.downloadUrl.split("/").pop(),
  );
  await anonymous.dispose();
});

test("aggregation API covers all authorized accounts, grouping and common filters", async () => {
  const all = await (await operator.get("/api/v1/transaction-summary")).json();
  expect(all).toMatchObject({
    transactionCount: 5,
    moneyIn: "37000.00",
    moneyOut: "5959.75",
    netFlow: "31040.25",
  });
  const mine = await (await customer.get("/api/v1/transaction-summary")).json();
  expect(mine.transactionCount).toBe(4);
  const ben = await (await other.get("/api/v1/transaction-summary")).json();
  expect(ben).toMatchObject({ transactionCount: 1, moneyIn: "12000.00" });
  const grouped = await (
    await operator.get("/api/v1/breakdowns?groupBy=ACCOUNT")
  ).json();
  expect(grouped.items).toHaveLength(2);
  expect(grouped.items.find((row) => row.name === otherAccount).moneyIn).toBe(
    "12000.00",
  );
  for (const group of ["CATEGORY", "MERCHANT", "SOURCE", "DAY", "MONTH"]) {
    const result = await (
      await operator.get(
        "/api/v1/breakdowns?groupBy=" +
          group +
          "&direction=DEBIT&category=GROCERIES",
      )
    ).json();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      moneyOut: "842.50",
      moneyIn: "0.00",
      transactionCount: 1,
    });
  }
});

test("operators configure rules; new events use new revisions and replays retain their decision", async ({
  browser,
}) => {
  const initial = await (await operator.get("/api/v1/fraud-rules")).json();
  expect((await customer.get("/api/v1/fraud-rules")).status()).toBe(403);
  const body = { expectedVersion: initial.version, rules: initial.rules };
  expect(
    (
      await mutate(customer, "put", "/api/v1/fraud-rules", { data: body })
    ).status(),
  ).toBe(403);
  expect(
    (
      await mutate(operator, "put", "/api/v1/fraud-rules", {
        data: { ...body, rules: [{ ...initial.rules[0], amount: "-1" }] },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await mutate(operator, "put", "/api/v1/fraud-rules", {
        data: { ...body, rules: [initial.rules[0], initial.rules[0]] },
      })
    ).status(),
  ).toBe(400);
  const context = await browser.newContext({
    storageState: await operator.storageState(),
  });
  const page = await context.newPage();
  await page.goto("/fraud-rules");
  await page
    .getByRole("button", { name: "Edit " + initial.rules[0].name, exact: true })
    .click();
  await page.locator("#value-HIGH_VALUE_DEBIT").fill("10000.00");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit " + initial.rules[1].name, exact: true })
    .click();
  await page.locator("#enabled-RESTRICTED_MERCHANT").uncheck();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Add rule", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit New rule", exact: true })
    .click();
  const added = page.getByRole("dialog");
  await added.getByLabel("Rule name", { exact: true }).fill("Groceries check");
  await added
    .getByLabel("Condition", { exact: true })
    .selectOption("CATEGORY_EQUALS");
  await added.getByLabel("Category", { exact: true }).selectOption("GROCERIES");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save rules", exact: true }).click();
  await expect(page.getByText("Rules saved", { exact: true })).toBeVisible();
  const saved = await (await operator.get("/api/v1/fraud-rules")).json();
  expect(saved.rules).toHaveLength(initial.rules.length + 1);
  expect(saved.rules[0].amount).toBe("10000.00");
  expect(saved.rules[1].enabled).toBe(false);
  expect(
    (
      await mutate(operator, "put", "/api/v1/fraud-rules", { data: body })
    ).status(),
  ).toBe(409);
  expect(
    (
      await (
        await operator.get("/api/v1/fraud-rules/" + initial.version)
      ).json()
    ).rules[0].amount,
  ).toBe("5000.00");
  await page.screenshot({
    path: "/artifacts/fraud-rules.png",
    fullPage: true,
    animations: "disabled",
  });

  const event = {
    ...walletEvent,
    eventId: "rules-value",
    payload: {
      ...walletEvent.payload,
      reference: "rules-value",
      counterparty: "GadgetHub",
      signedAmount: "-6000.00",
    },
  };
  const evaluate = async (value) => {
    await send("mock.wallet.transactions.v1", value);
    let id;
    await expect
      .poll(async () => {
        const result = await db.query(
          "select id from financial_transaction where source_transaction_ref=$1",
          [value.payload.reference],
        );
        id = result.rows[0]?.id;
        return Boolean(id);
      })
      .toBe(true);
    await expect
      .poll(
        async () =>
          (
            await (
              await operator.get(
                "/api/v1/transactions/" + id + "/fraud-evaluation",
              )
            ).json()
          ).status,
      )
      .not.toBe("PENDING");
    return {
      id,
      evaluation: await (
        await operator.get("/api/v1/transactions/" + id + "/fraud-evaluation")
      ).json(),
    };
  };
  const first = await evaluate(event);
  expect(first.evaluation).toMatchObject({
    status: "NOT_FLAGGED",
    rulesetVersion: String(saved.version),
  });
  const category = await evaluate({
    ...event,
    eventId: "rules-category",
    payload: {
      ...event.payload,
      reference: "rules-category",
      counterparty: "FreshMart",
      signedAmount: "-2.00",
    },
  });
  expect(category.evaluation.status).toBe("FLAGGED");
  const disabled = await evaluate({
    ...event,
    eventId: "rules-disabled",
    payload: {
      ...event.payload,
      reference: "rules-disabled",
      counterparty: "Restricted Shop",
      signedAmount: "-2.00",
    },
  });
  expect(disabled.evaluation.status).toBe("NOT_FLAGGED");
  expect(
    disabled.evaluation.rules.find((r) => r.ruleCode === "RESTRICTED_MERCHANT")
      .result,
  ).toBe("DISABLED");
  const next = await (
    await mutate(operator, "put", "/api/v1/fraud-rules", {
      data: {
        expectedVersion: saved.version,
        rules: saved.rules.map((r) =>
          r.code === "HIGH_VALUE_DEBIT" ? { ...r, amount: "1000.00" } : r,
        ),
      },
    })
  ).json();
  const publication = await db.query(
    "select serialized_event from event_publication where serialized_event::jsonb->>'transactionId'=$1 limit 1",
    [first.id],
  );
  expect(publication.rowCount).toBe(1);
  await producer.send({
    topic: "transactions.categorized.v1",
    messages: [{ key: account, value: publication.rows[0].serialized_event }],
  });
  // This next evaluation is a barrier on the same account partition after the replay.
  const second = await evaluate({
    ...event,
    eventId: "rules-value-new",
    payload: { ...event.payload, reference: "rules-value-new" },
  });
  expect(second.evaluation).toMatchObject({
    status: "FLAGGED",
    rulesetVersion: String(next.version),
  });
  await send("mock.wallet.transactions.v1", event);
  expect(
    (
      await (
        await operator.get(
          "/api/v1/transactions/" + first.id + "/fraud-evaluation",
        )
      ).json()
    ).rulesetVersion,
  ).toBe(String(saved.version));
  expect(
    (
      await db.query(
        "select count(*)::int count from fraud_evaluation where transaction_id=$1",
        [first.id],
      )
    ).rows[0].count,
  ).toBe(1);
  const stored = await (await operator.get("/api/v1/fraud-rules")).json();
  expect(stored.version).toBe(next.version);
  await context.close();
});

const richRules = [
  {
    code: "COUNT",
    name: "Rapid payments",
    type: "VELOCITY_COUNT",
    enabled: true,
    direction: "DEBIT",
    windowMinutes: 5,
    countThreshold: 2,
    severity: "HIGH",
  },
  {
    code: "SUM",
    name: "Rolling spend",
    type: "VELOCITY_AMOUNT",
    enabled: true,
    direction: "DEBIT",
    windowMinutes: 5,
    amount: "10000.00",
    severity: "HIGH",
  },
  {
    code: "BENEFICIARY",
    name: "New beneficiary",
    type: "NEW_BENEFICIARY_PAYMENT",
    enabled: true,
    direction: "DEBIT",
    windowMinutes: 60,
    amount: "5000.00",
    severity: "HIGH",
  },
  {
    code: "FOREIGN",
    name: "Foreign ecommerce",
    type: "FOREIGN_ONLINE_PAYMENT",
    enabled: true,
    direction: "DEBIT",
    matchValue: "ZA",
    amount: "2500.00",
    severity: "MEDIUM",
  },
];
function richEvent(
  ref,
  amount,
  at,
  accountRef = "wallet-account-1042",
  paymentPatch = {},
) {
  return {
    eventId: "evt-" + ref,
    schemaVersion: 2,
    source: "WALLET_PROVIDER",
    sourceAccountRef: accountRef,
    occurredAt: at,
    payload: {
      reference: ref,
      counterparty: "Online electronics",
      signedAmount: "-" + amount,
      currency: "ZAR",
      payment: {
        status: "BOOKED",
        type: "CARD_PURCHASE",
        channel: "POS",
        bookedAt: at,
        valueDate: at.slice(0, 10),
        paymentReference: ref,
        merchant: {
          id: "merchant-01",
          name: "Online electronics",
          categoryCode: "5732",
          country: "ZA",
        },
        instrument: { lastFour: "1042", authentication: "PIN" },
        ...paymentPatch,
      },
    },
  };
}
async function evaluateRich(event) {
  await send("mock.wallet.transactions.v1", event);
  let id;
  await expect
    .poll(async () => {
      const rows = await db.query(
        "select id from financial_transaction where source_transaction_ref=$1",
        [event.payload.reference],
      );
      id = rows.rows[0]?.id;
      return Boolean(id);
    })
    .toBe(true);
  await expect
    .poll(
      async () =>
        (
          await (
            await operator.get(
              "/api/v1/transactions/" + id + "/fraud-evaluation",
            )
          ).json()
        ).status,
    )
    .not.toBe("PENDING");
  return {
    id,
    tx: await (await operator.get("/api/v1/transactions/" + id)).json(),
    evaluation: await (
      await operator.get("/api/v1/transactions/" + id + "/fraud-evaluation")
    ).json(),
  };
}

test("rolling windows exclude other accounts, future and boundary events; duplicates do not inflate evidence", async () => {
  const current = await (await operator.get("/api/v1/fraud-rules")).json();
  const save = await mutate(operator, "put", "/api/v1/fraud-rules", {
    data: { expectedVersion: current.version, rules: richRules },
  });
  expect(save.status()).toBe(200);
  const version = (await save.json()).version;
  for (const invalid of [
    { ...richRules[0], windowMinutes: null },
    { ...richRules[0], windowMinutes: 1441 },
    { ...richRules[3], matchValue: "XX" },
    { ...richRules[2], direction: "ANY" },
  ]) {
    expect(
      (
        await mutate(operator, "put", "/api/v1/fraud-rules", {
          data: { expectedVersion: version, rules: [invalid] },
        })
      ).status(),
    ).toBe(400);
  }
  await evaluateRich(
    richEvent(
      "window-other",
      "9999.00",
      "2026-11-10T09:59:58Z",
      "wallet-account-2075",
    ),
  );
  await evaluateRich(
    richEvent("window-expired", "20000.00", "2026-11-10T09:55:00Z"),
  );
  await evaluateRich(
    richEvent("window-future", "30000.00", "2026-11-10T10:01:00Z"),
  );
  const firstEvent = richEvent(
    "window-first",
    "4500.00",
    "2026-11-10T09:59:00Z",
  );
  await evaluateRich(firstEvent);
  await evaluateRich(firstEvent);
  const second = await evaluateRich(
    richEvent("window-second", "6000.00", "2026-11-10T10:00:00Z"),
  );
  const count = second.evaluation.rules.find((r) => r.ruleCode === "COUNT");
  expect(count).toMatchObject({
    result: "NOT_MATCHED",
    observed: {
      transactionCount: 2,
      totalAmount: "10500.00",
      includesCurrentTransaction: true,
    },
  });
  expect(second.evaluation.rules.find((r) => r.ruleCode === "SUM").result).toBe(
    "MATCHED",
  );
  expect(second.evaluation).toMatchObject({
    severity: "HIGH",
    action: "REVIEW",
    coverage: "COMPLETE",
  });
  const third = await evaluateRich(
    richEvent("window-third", "500.00", "2026-11-10T10:00:01Z"),
  );
  expect(
    third.evaluation.rules.find((r) => r.ruleCode === "COUNT"),
  ).toMatchObject({
    result: "MATCHED",
    observed: { transactionCount: 3, totalAmount: "11000.00" },
  });
  expect(third.tx.category).toBe("SHOPPING");
  expect(third.tx.categorizerVersion).toBe("2");
  expect(third.tx.payment).toMatchObject({
    status: "BOOKED",
    merchant: { categoryCode: "5732", country: "ZA" },
    instrument: { lastFour: "1042" },
  });
  expect((await other.get("/api/v1/transactions/" + third.id)).status()).toBe(
    404,
  );
  const conflicted = {
    ...firstEvent,
    payload: {
      ...firstEvent.payload,
      payment: {
        ...firstEvent.payload.payment,
        merchant: { ...firstEvent.payload.payment.merchant, country: "GB" },
      },
    },
  };
  const before = deadLetters.length;
  await send("mock.wallet.transactions.v1", conflicted);
  await expect.poll(() => deadLetters.length).toBeGreaterThan(before);
  expect(
    (
      await db.query(
        "select count(*)::int count from financial_transaction where source_transaction_ref='window-first'",
      )
    ).rows[0].count,
  ).toBe(1);
});

test("compound rules, rich transaction UI and shared theme work on desktop and mobile", async ({
  browser,
}) => {
  const transfer = await evaluateRich(
    richEvent(
      "context-beneficiary",
      "6000.00",
      "2026-11-10T12:00:00Z",
      undefined,
      {
        type: "TRANSFER",
        channel: "MOBILE",
        merchant: null,
        instrument: null,
        counterparty: {
          id: "supplier-1",
          name: "New supplier",
          beneficiaryCreatedAt: "2026-11-10T11:50:00Z",
        },
      },
    ),
  );
  expect(
    transfer.evaluation.rules.find((r) => r.ruleCode === "BENEFICIARY"),
  ).toMatchObject({
    result: "MATCHED",
    observed: { beneficiaryAgeSeconds: 600 },
  });
  const abroad = await evaluateRich(
    richEvent(
      "context-overseas",
      "3000.00",
      "2026-11-10T13:00:00Z",
      undefined,
      {
        channel: "ECOMMERCE",
        merchant: {
          id: "merchant-uk",
          name: "Online electronics",
          categoryCode: "5732",
          country: "GB",
        },
        instrument: { lastFour: "1042", authentication: "THREE_DS" },
      },
    ),
  );
  expect(
    abroad.evaluation.rules.find((r) => r.ruleCode === "FOREIGN").result,
  ).toBe("MATCHED");
  expect(abroad.evaluation.severity).toBe("MEDIUM");
  // A lower amount and a domestic country each prevent the combined rule matching.
  const small = await evaluateRich(
    richEvent("context-small", "2500.00", "2026-11-10T14:00:00Z", undefined, {
      channel: "ECOMMERCE",
      merchant: { id: "uk", name: "Shop", categoryCode: "5732", country: "GB" },
    }),
  );
  expect(
    small.evaluation.rules.find((r) => r.ruleCode === "FOREIGN").result,
  ).toBe("NOT_MATCHED");
  const domestic = await evaluateRich(
    richEvent(
      "context-domestic",
      "3000.00",
      "2026-11-10T15:00:00Z",
      undefined,
      { channel: "ECOMMERCE" },
    ),
  );
  expect(
    domestic.evaluation.rules.find((r) => r.ruleCode === "FOREIGN").result,
  ).toBe("NOT_MATCHED");
  const context = await browser.newContext({
    storageState: await operator.storageState(),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/transactions");
  await page
    .getByRole("button", {
      name: "View transaction Online electronics",
      exact: true,
    })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("South Africa", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("textbox")).toHaveCount(0);
  await page.screenshot({
    path: "/artifacts/payment-detail.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/fraud-rules");
  await page
    .getByRole("button", { name: "Edit Rapid payments", exact: true })
    .click();
  await expect(page.locator("#window-COUNT")).toHaveValue("5");
  await expect(page.locator("#count-COUNT")).toHaveValue("2");
  await page.locator("#window-COUNT").fill("10");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save rules", exact: true }).click();
  await expect(page.getByText("Rules saved", { exact: true })).toBeVisible();
  expect(
    (await (await operator.get("/api/v1/fraud-rules")).json()).rules[0]
      .windowMinutes,
  ).toBe(10);
  expect(
    (
      await (
        await operator.get(
          "/api/v1/transactions/" + abroad.id + "/fraud-evaluation",
        )
      ).json()
    ).rulesetVersion,
  ).toBe(abroad.evaluation.rulesetVersion);
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--brand-blue")
        .trim(),
    ),
  ).toBe("#2f70ef");
  await page.screenshot({
    path: "/artifacts/capitec-rules.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Toggle Sidebar" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/artifacts/capitec-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
  await context.close();
});

test("review ownership, validation and original evidence survive review and replay", async () => {
  const flagged = (
    await db.query(
      "select transaction_id from fraud_evaluation where outcome='FLAGGED' and transaction_id in (select transaction_id from fraud_review) limit 1",
    )
  ).rows[0].transaction_id;
  const url = "/api/v1/transactions/" + flagged;
  const before = await (await operator.get(url + "/fraud-evaluation")).json();
  expect(before.review.note).toBe("Customer contacted; payment confirmed.");
  expect(
    (
      await mutate(customer, "post", url + "/fraud-review", {
        data: { note: "Cannot review" },
      })
    ).status(),
  ).toBe(403);
  expect((await other.get(url + "/fraud-evaluation")).status()).toBe(404);
  expect(
    (
      await mutate(operator, "post", url + "/fraud-review", {
        data: { note: "Duplicate" },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await mutate(operator, "post", url + "/fraud-review", {
        data: { note: " " },
      })
    ).status(),
  ).toBe(400);
  const unflagged = (
    await db.query(
      "select transaction_id from fraud_evaluation where outcome='NOT_FLAGGED' limit 1",
    )
  ).rows[0].transaction_id;
  expect(
    (
      await mutate(
        operator,
        "post",
        "/api/v1/transactions/" + unflagged + "/fraud-review",
        { data: { note: "Not flagged" } },
      )
    ).status(),
  ).toBe(409);
  const event = (
    await db.query(
      "select serialized_event from event_publication where serialized_event::jsonb->>'transactionId'=$1 limit 1",
      [flagged],
    )
  ).rows[0].serialized_event;
  await producer.send({
    topic: "transactions.categorized.v1",
    messages: [{ key: account, value: event }],
  });
  await evaluateRich(
    richEvent("review-replay-barrier", "1.00", "2026-11-10T16:00:00Z"),
  );
  const after = await (await operator.get(url + "/fraud-evaluation")).json();
  expect(after).toEqual(before);
  const page = await (
    await operator.get("/api/v1/fraud-evaluations?reviewStatus=ALL&limit=1")
  ).json();
  expect(page.items).toHaveLength(1);
  const next = await (
    await operator.get(
      "/api/v1/fraud-evaluations?reviewStatus=ALL&limit=1&cursor=" +
        encodeURIComponent(page.nextCursor),
    )
  ).json();
  expect(next.items[0].transaction.id).not.toBe(page.items[0].transaction.id);
  expect(
    (
      await customer.get(
        "/api/v1/fraud-evaluations?reviewStatus=ALL&cursor=" +
          encodeURIComponent(page.nextCursor),
      )
    ).status(),
  ).toBe(400);
});

test("statement pages are complete, scoped and reject malformed cursor dates", async () => {
  const first = await (await customer.get("/api/v1/statements?limit=1")).json();
  expect(first.items).toHaveLength(1);
  expect(first.nextCursor).toBeTruthy();
  const second = await (
    await customer.get(
      "/api/v1/statements?limit=1&cursor=" +
        encodeURIComponent(first.nextCursor),
    )
  ).json();
  expect(second.items).toHaveLength(1);
  expect(second.items[0].id).not.toBe(first.items[0].id);
  expect(second.asOf).toBe(first.asOf);
  expect(second.items[0].accountId).toBe(account);
  expect(
    (
      await other.get(
        "/api/v1/statements?cursor=" + encodeURIComponent(first.nextCursor),
      )
    ).status(),
  ).toBe(400);
  expect((await customer.get("/api/v1/statements?limit=101")).status()).toBe(
    400,
  );
  for (const endpoint of [
    "/api/v1/statements",
    "/api/v1/transactions",
    "/api/v1/fraud-evaluations",
  ]) {
    const firstPage = await (await operator.get(endpoint + "?limit=1")).json();
    expect(firstPage.nextCursor, endpoint).toBeTruthy();
    const parts = Buffer.from(firstPage.nextCursor, "base64url")
      .toString()
      .split("|");
    parts[0] = "not-a-timestamp";
    const malformed = Buffer.from(parts.join("|")).toString("base64url");
    expect(
      (await operator.get(endpoint + "?cursor=" + malformed)).status(),
      endpoint,
    ).toBe(400);
  }
});

test("merchant aggregates use supplied merchant facts rather than payment narration", async () => {
  const event = richEvent(
    "merchant-report-" + randomUUID(),
    "123.45",
    "2026-11-09T15:00:00Z",
    "wallet-account-1042",
    {
      merchant: {
        id: "report-merchant",
        name: "Named merchant",
        categoryCode: "5732",
        country: "ZA",
      },
    },
  );
  event.payload.counterparty = "Payment narrative that differs from merchant";
  await evaluateRich(event);
  const response = await operator.get(
    "/api/v1/breakdowns?groupBy=MERCHANT&limit=100",
  );
  expect(response.ok()).toBeTruthy();
  const report = await response.json();
  expect(
    report.items.find((row) => row.name === "Named merchant"),
  ).toMatchObject({ transactionCount: 1, moneyOut: "123.45" });
  expect(
    report.items.some((row) => row.name === event.payload.counterparty),
  ).toBe(false);
});

test("SPA file routes show skeletons, load independent queries together and recover from errors", async ({
  page,
}) => {
  const browserSession = await login("operator", "operator-demo");
  await page
    .context()
    .addCookies((await browserSession.storageState()).cookies);
  await browserSession.dispose();
  const requests = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(
    /\/api\/v1\/(transactions|transaction-summary|categories)(\?|$)/,
    async (route) => {
      requests.push(new URL(route.request().url()).pathname);
      await gate;
      await route.continue();
    },
  );
  await page.goto("/transactions");
  await expect(
    page.getByRole("status", { name: "Loading page" }),
  ).toBeVisible();
  await expect.poll(() => new Set(requests).size).toBe(3);
  // All three requests started before any response was released: no query waterfall.
  expect(requests).toHaveLength(3);
  await page.screenshot({
    path: "/artifacts/loading-skeleton.png",
    animations: "disabled",
  });
  release();
  await expect(
    page.getByRole("heading", { name: "Transactions", exact: true }),
  ).toBeVisible();
  await page.unroute(
    /\/api\/v1\/(transactions|transaction-summary|categories)(\?|$)/,
  );
  await page.evaluate(() => {
    window.navigationMarker = "same-document";
  });
  await page.getByRole("link", { name: "Statements", exact: true }).hover();
  await expect
    .poll(async () =>
      page.evaluate(() =>
        performance
          .getEntriesByType("resource")
          .some((entry) => entry.name.includes("/assets/statements-")),
      ),
    )
    .toBe(true);
  await page.getByRole("link", { name: "Statements", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Statements", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.navigationMarker)).toBe(
    "same-document",
  );
  await page
    .getByRole("button", { name: "Create download link" })
    .first()
    .click();
  const link = page.getByLabel("Download link", { exact: true });
  await expect(link).toBeVisible();
  const url = await link.inputValue();
  await page.getByRole("button", { name: "Revoke download link" }).click();
  await expect(link).toHaveCount(0);
  expect((await operator.get(url)).status()).toBe(404);

  let fail = true;
  await page.route("**/api/v1/transaction-summary?*", (route) =>
    fail
      ? route.fulfill({
          status: 503,
          contentType: "application/problem+json",
          body: JSON.stringify({ detail: "Temporary reporting outage" }),
        })
      : route.continue(),
  );
  await page.goto("/transactions?category=GROCERIES");
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Transactions", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(
    "GROCERIES",
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Username", { exact: true }).fill("ben");
  await page.getByLabel("Password", { exact: true }).fill("customer-demo");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Transactions", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fraud rules", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("cell").filter({ hasText: "Amina" })).toHaveCount(
    0,
  );
});

function testRequest(patch = {}) {
  return {
    requestId: randomUUID(),
    accountId: account,
    source: "CARD_PROCESSOR",
    amount: "6000.00",
    description: "Workspace purchase",
    direction: "DEBIT",
    type: "CARD_PURCHASE",
    channel: "POS",
    occurredAt: new Date().toISOString(),
    count: 1,
    spacingSeconds: 1,
    merchant: "GadgetHub",
    merchantCategory: "5732",
    country: "ZA",
    beneficiary: "Test supplier",
    beneficiaryAgeMinutes: 10,
    ...patch,
  };
}
async function publishTest(body) {
  const response = await mutate(operator, "post", "/api/v1/testing/events", {
    data: body,
  });
  expect(response.status()).toBe(202);
  const receipt = await response.json();
  expect(receipt.error).toBeNull();
  expect(receipt.accepted).toHaveLength(body.count);
  return receipt;
}
async function testResults(body) {
  let results;
  await expect
    .poll(async () => {
      results = await (
        await operator.get("/api/v1/testing/events/" + body.requestId)
      ).json();
      return (
        results.length === body.count &&
        results.every((row) => row.status !== "PENDING")
      );
    })
    .toBe(true);
  return results;
}
async function resetDemo() {
  const response = await mutate(operator, "post", "/api/v1/testing/reset", {
    data: { confirmation: "RESET ALL TRANSACTIONS" },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

test("testing controls enforce access, pause sources and reset all transaction data safely", async () => {
  test.setTimeout(90000);
  expect((await customer.get("/api/v1/testing/sources")).status()).toBe(403);
  expect(
    (
      await mutate(customer, "post", "/api/v1/testing/reset", {
        data: { confirmation: "RESET ALL TRANSACTIONS" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await operator.post("/api/v1/testing/reset", {
        data: { confirmation: "RESET ALL TRANSACTIONS" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await mutate(operator, "post", "/api/v1/testing/reset", {
        data: { confirmation: "no" },
      })
    ).status(),
  ).toBe(400);
  const initial = (await summary()).transactionCount;
  for (const patch of [
    { count: 21 },
    { amount: "-1.00" },
    { country: "XX" },
    { merchant: null },
  ]) {
    expect(
      (
        await mutate(operator, "post", "/api/v1/testing/events", {
          data: testRequest(patch),
        })
      ).status(),
    ).toBe(400);
  }
  expect((await summary()).transactionCount).toBe(initial);
  expect(
    (
      await mutate(operator, "put", "/api/v1/testing/sources", {
        data: { paused: false, intervalMs: 1 },
      })
    ).status(),
  ).toBe(400);
  const start = await mutate(operator, "put", "/api/v1/testing/sources", {
    data: { paused: false, intervalMs: 500 },
  });
  expect(start.status()).toBe(200);
  expect(
    (await start.json()).every(
      (source) => source.paused === false && source.intervalMs === 500,
    ),
  ).toBe(true);
  await expect
    .poll(async () => (await summary()).transactionCount)
    .toBeGreaterThan(initial);
  const stopped = await mutate(operator, "put", "/api/v1/testing/sources", {
    data: { paused: true, intervalMs: 500 },
  });
  expect(stopped.status()).toBe(200);
  expect((await stopped.json()).every((source) => source.paused === true)).toBe(
    true,
  );

  const keptCounts = async () =>
    (
      await db.query(`select
    (select count(*)::int from account) accounts,
    (select count(*)::int from statement) statements,
    (select count(*)::int from fraud_ruleset) rulesets,
    (select count(*)::int from fraud_rule_configuration) rules`)
    ).rows[0];
  const kept = await keptCounts();
  // Queue a batch immediately before resetting, exercising in-flight ingestion and publications.
  await publishTest(testRequest({ count: 20, amount: "1.00" }));
  const reset = await resetDemo();
  expect(reset.sourcesPaused).toBe(true);
  expect(reset.removedTransactions).toBeGreaterThan(0);
  for (const table of [
    "financial_transaction",
    "rule_result",
    "fraud_review",
    "fraud_evaluation",
    "event_publication",
  ]) {
    expect(
      (await db.query(`select count(*)::int count from ${table}`)).rows[0]
        .count,
    ).toBe(0);
  }
  expect(await keptCounts()).toEqual(kept);
  expect(
    (await db.query("select count(*)::int count from processing_checkpoint"))
      .rows[0].count,
  ).toBe(12);
  expect(
    (
      await db.query(
        "select reset_by,removed_transactions from demo_reset_audit order by reset_at desc limit 1",
      )
    ).rows[0],
  ).toMatchObject({
    reset_by: "operator",
    removed_transactions: String(reset.removedTransactions),
  });
  // Long enough for delayed Kafka delivery and Modulith completion to become visible.
  await new Promise((resolve) => setTimeout(resolve, 3500));
  expect((await summary()).transactionCount).toBe(0);
});

test("workspace excludes developer tools and hides server diagnostics", async ({ page }) => {
  await page.context().addCookies((await operator.storageState()).cookies);
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Testing", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Incoming transactions chart")).toHaveCount(0);
  await page.route("**/api/v1/overview?*", route => route.fulfill({
    status: 500, contentType: "application/problem+json",
    body: JSON.stringify({ detail: "SQL failure at /private/database: secret_password" }),
  }));
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Please try again shortly");
  await expect(page.locator("body")).not.toContainText("secret_password");
  await expect(page.locator("body")).not.toContainText("/private/database");
});

test("testing event batches retain exact amounts across sources and exercise contextual and velocity rules", async () => {
  for (const source of ["CORE_BANK", "CARD_PROCESSOR", "WALLET_PROVIDER"]) {
    const body = testRequest({ source, amount: "12.34", direction: "CREDIT" });
    await publishTest(body);
    const rows = await testResults(body);
    expect(rows[0].amount).toBe("12.34");
    expect(rows[0].status).toBe("NOT_FLAGGED");
  }
  expect((await summary()).moneyIn).toBe("37.02");
  const rapid = testRequest({ count: 3, amount: "100.00" });
  await publishTest(rapid);
  const rapidRows = await testResults(rapid);
  const third = await (
    await operator.get(
      `/api/v1/transactions/${rapidRows[2].id}/fraud-evaluation`,
    )
  ).json();
  expect(third.rules.find((rule) => rule.ruleCode === "COUNT")).toMatchObject({
    result: "MATCHED",
    observed: { transactionCount: 3, totalAmount: "300.00" },
  });
  for (const [patch, code] of [
    [
      { source: "CORE_BANK", type: "TRANSFER", channel: "MOBILE" },
      "BENEFICIARY",
    ],
    [{ channel: "ECOMMERCE", country: "GB", amount: "3000.00" }, "FOREIGN"],
  ]) {
    const body = testRequest(patch);
    await publishTest(body);
    const rows = await testResults(body);
    const evidence = await (
      await operator.get(`/api/v1/transactions/${rows[0].id}/fraud-evaluation`)
    ).json();
    expect(evidence.rules.find((rule) => rule.ruleCode === code).result).toBe(
      "MATCHED",
    );
  }
});

test("overview reconciles scoped aggregates, pending checks and receipt time independently of payment time", async ({
  request,
}) => {
  expect((await request.get("/api/v1/overview")).status()).toBe(401);
  expect(
    (await customer.get("/api/v1/overview?accountId=" + otherAccount)).status(),
  ).toBe(404);
  for (const days of ["0", "2", "31", "bad"]) {
    expect((await operator.get("/api/v1/overview?days=" + days)).status()).toBe(
      400,
    );
  }
  const before = await (await customer.get("/api/v1/overview?days=1")).json();
  const oldPayment = testRequest({
    occurredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    amount: "19.37",
    source: "WALLET_PROVIDER",
  });
  await publishTest(oldPayment);
  await testResults(oldPayment);
  const after = await (await customer.get("/api/v1/overview?days=1")).json();
  expect(after.transactions.totals).toEqual(before.transactions.totals);
  expect(
    after.transactions.lastReceivedAt > before.transactions.lastReceivedAt,
  ).toBe(true);
  expect(
    after.transactions.arrivals.some(
      (row) => row.source === "WALLET_PROVIDER" && row.count > 0,
    ),
  ).toBe(true);

  // An intentionally un-evaluated persisted transaction proves pending is a separate state.
  const pendingId = randomUUID();
  await db.query(
    `insert into financial_transaction(id,source_account_id,source_transaction_ref,amount,currency,direction,description,category_code,categorizer_version,input_hash,first_event_id,origin_topic,origin_partition,origin_offset,occurred_at)
    values($1::uuid,'30000000-0000-0000-0000-000000000001',$2,0.01,'ZAR','DEBIT','Pending fixture','UNCATEGORIZED','test','test',$2,'test',0,0,now())`,
    [pendingId, pendingId],
  );
  try {
    for (const days of [1, 7, 30]) {
      const response = await customer.get("/api/v1/overview?days=" + days);
      expect(response.status()).toBe(200);
      const report = await response.json();
      const filters = new URLSearchParams({
        from: report.from,
        toExclusive: report.toExclusive,
      });
      const totals = await (
        await customer.get("/api/v1/transaction-summary?" + filters)
      ).json();
      expect(report.transactions.totals).toEqual({
        transactionCount: totals.transactionCount,
        moneyIn: totals.moneyIn,
        moneyOut: totals.moneyOut,
      });
      const f = report.fraud;
      expect(f.notFlagged + f.needsReview + f.reviewed + f.pending).toBe(
        totals.transactionCount,
      );
      expect(f.pending).toBe(1);
      expect(
        report.transactions.activity.reduce(
          (sum, row) => sum + row.credits + row.debits,
          0,
        ),
      ).toBe(totals.transactionCount);
      const raw = await db.query(
        `select count(*)::int count from financial_transaction t join source_account s on s.id=t.source_account_id where s.account_id=$1 and t.recorded_at between $2 and $3`,
        [account, report.receivedFrom, report.asOf],
      );
      expect(
        report.transactions.arrivals.reduce((sum, row) => sum + row.count, 0),
      ).toBe(raw.rows[0].count);
      const checks = await (
        await customer.get(
          "/api/v1/fraud-evaluations?" +
            filters +
            "&reviewStatus=NEEDS_REVIEW&limit=100",
        )
      ).json();
      expect(checks.items).toHaveLength(f.needsReview);
      for (const item of checks.items) {
        expect(item.transaction.accountId).toBe(account);
        expect(Date.parse(item.transaction.occurredAt)).toBeGreaterThanOrEqual(
          Date.parse(report.from + "T00:00:00+02:00"),
        );
      }
    }
  } finally {
    await db.query("delete from financial_transaction where id=$1", [
      pendingId,
    ]);
  }
  expect(
    (await customer.get("/api/v1/fraud-evaluations?from=2026-01-01")).status(),
  ).toBe(400);
  expect(
    (
      await customer.get(
        "/api/v1/fraud-evaluations?from=2026-01-02&toExclusive=2026-01-01",
      )
    ).status(),
  ).toBe(400);
});

test("overview charts have exact data views, scoped drilldowns, recoverable live errors and mobile layout", async ({
  page,
}) => {
  await page.context().addCookies((await operator.storageState()).cookies);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/overview?*", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/");
  await expect(
    page.getByRole("status", { name: "Loading overview" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/overview?*");
  await expect(page.getByLabel("Transaction activity chart")).toBeVisible();
  await expect(page.getByLabel("Incoming transactions chart")).toHaveCount(0);
  await expect(page.getByLabel("Fraud review status chart")).toBeVisible();
  await page.getByRole("radio", { name: "Value", exact: true }).click();
  await expect(page.getByText("Rand value by day · SAST")).toBeVisible();
  await page
    .getByRole("button", {
      name: "View transaction activity data",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("columnheader", { name: "Credits", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "View transaction activity data",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Account filter", { exact: true })
    .selectOption(account);
  await page.getByRole("radio", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/days=1/);
  await page
    .getByRole("link", { name: "Review flagged transactions", exact: true })
    .click();
  await expect(page.getByLabel("Review status")).toHaveValue("NEEDS_REVIEW");
  expect(new URL(page.url()).searchParams.get("from")).toBeTruthy();
  await expect(page.getByLabel("Account filter", { exact: true })).toHaveValue(
    account,
  );
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("link", { name: "View transactions", exact: true })
    .click();
  expect(new URL(page.url()).searchParams.get("toExclusive")).toBeTruthy();
  await page
    .getByLabel("Source", { exact: true })
    .selectOption("CARD_PROCESSOR");
  await page.getByLabel("Direction", { exact: true }).selectOption("DEBIT");
  await expect(page).toHaveURL(/source=CARD_PROCESSOR/);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.route("**/api/v1/overview?*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/problem+json",
      body: JSON.stringify({ detail: "Reporting temporarily unavailable" }),
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByText("Updates unavailable", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Transaction activity chart")).toBeVisible();
  await page.unroute("**/api/v1/overview?*");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(
    page.getByText("Auto-refresh on", { exact: true }),
  ).toBeVisible();
  await page.goto("/overview?days=1");
  await expect(
    page.getByRole("radio", { name: "Today", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.goto("/overview?days=2");
  await expect(
    page.getByRole("button", { name: "Clear filters", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/artifacts/overview-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/artifacts/overview-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

test("rule edits are protected on navigation and expired statement links are clearly marked", async ({
  page,
}) => {
  const fixture = await mutate(operator, "post", "/api/v1/statements", {
    multipart: {
      accountId: account,
      file: {
        name: "Link expiry example.pdf",
        mimeType: "application/pdf",
        buffer: await pdf(),
      },
    },
  });
  expect(fixture.status()).toBe(201);
  await page.context().addCookies((await operator.storageState()).cookies);
  await page.goto("/fraud-rules");
  await expect(
    page.getByRole("button", { name: "Save rules", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: /^Edit / })
    .first()
    .click();
  await page
    .getByLabel("Rule name", { exact: true })
    .fill("Unsaved test change");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByText("Unsaved changes", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reload rules", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(
    page.getByText("Unsaved test change", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard and leave", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Fraud rules", exact: true }).click();
  await expect(
    page.getByText("Unsaved test change", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Statements", exact: true }).click();
  await page
    .getByRole("button", { name: "Create download link" })
    .first()
    .click();
  await expect(
    page.getByText("Download link ready", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Link expired", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByRole("button", { name: "Copy", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Download PDF", exact: true }),
  ).toHaveCount(0);
});

test("transaction search, exact amount ranges and CSV export share authorized filters", async ({ page }) => {
  const body = testRequest({ description: '=Workspace CSV, "literal_100%"', amount: "73.25", count: 2 });
  await publishTest(body);
  await testResults(body);
  const filters = new URLSearchParams({ q: 'literal_100%', minAmount: '73.25', maxAmount: '73.25', direction: 'DEBIT', source: 'CARD_PROCESSOR' });
  const listed = await (await customer.get('/api/v1/transactions?' + filters)).json();
  expect(listed.items).toHaveLength(2);
  const totals = await (await customer.get('/api/v1/transaction-summary?' + filters)).json();
  expect(totals.transactionCount).toBe(2);
  expect(totals.moneyOut).toBe('146.50');
  const groups = await (await customer.get('/api/v1/breakdowns?' + filters)).json();
  expect(groups.items.reduce((n, row) => n + row.transactionCount, 0)).toBe(2);
  const csv = await customer.get('/api/v1/transactions/export?' + filters);
  expect(csv.status()).toBe(200);
  expect(csv.headers()['cache-control']).toContain('no-store');
  expect(await csv.text()).toContain('"\'=Workspace CSV, ""literal_100%"""');
  expect((await (await other.get('/api/v1/transactions?' + filters)).json()).items).toEqual([]);
  expect((await other.get('/api/v1/transactions/export?accountId=' + account)).status()).toBe(404);
  for (const invalid of ['minAmount=-1', 'minAmount=0.001', 'minAmount=5&maxAmount=4', 'q=' + 'x'.repeat(121)]) {
    expect((await operator.get('/api/v1/transactions?' + invalid)).status()).toBe(400);
    expect((await operator.get('/api/v1/transactions/export?' + invalid)).status()).toBe(400);
  }
  const first = await (await operator.get('/api/v1/transactions?' + filters + '&limit=1')).json();
  expect(first.nextCursor).toBeTruthy();
  expect((await operator.get('/api/v1/transactions?cursor=' + first.nextCursor)).status()).toBe(400);
  await page.context().addCookies((await operator.storageState()).cookies);
  await page.goto('/transactions');
  await page.getByLabel('Search transactions', { exact: true }).fill('literal_100%');
  await page.getByLabel('Minimum amount (R)', { exact: true }).fill('73.25');
  await page.getByLabel('Maximum amount (R)', { exact: true }).fill('73.25');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('row')).toHaveCount(3);
  await page.reload();
  await expect(page.getByLabel('Search transactions', { exact: true })).toHaveValue('literal_100%');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('transactions.csv');
  await page.screenshot({ path: '/artifacts/workspace-transactions.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Search transactions', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Search transactions', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('Search transactions', { exact: true })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("priority filtering and recorded review outcomes preserve original rule evidence", async ({ page }) => {
  const body = testRequest({ description: 'Workspace priority review', amount: '9000.00', channel: 'ECOMMERCE', country: 'GB' });
  await publishTest(body);
  const [result] = await testResults(body);
  const url = '/api/v1/transactions/' + result.id;
  const before = await (await operator.get(url + '/fraud-evaluation')).json();
  expect(before.status).toBe('FLAGGED');
  const high = await (await operator.get('/api/v1/fraud-evaluations?severity=HIGH&reviewStatus=NEEDS_REVIEW')).json();
  expect(high.items.length).toBeGreaterThan(0);
  expect(high.items.every(row => row.severity === 'HIGH')).toBe(true);
  expect((await operator.get('/api/v1/fraud-evaluations?severity=INVALID')).status()).toBe(400);
  expect((await mutate(operator, 'post', url + '/fraud-review', { data: { note: 'Invalid disposition', outcome: 'BLOCKED' } })).status()).toBe(400);
  await page.context().addCookies((await operator.storageState()).cookies);
  await page.goto('/fraud?severity=HIGH&reviewStatus=NEEDS_REVIEW');
  await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('HIGH');
  await page.getByRole('button', { name: 'Review Workspace priority review', exact: true }).click();
  await page.getByRole('radio', { name: 'Cleared', exact: true }).click();
  await page.getByLabel('Review note', { exact: true }).fill('Customer verified the purchase.');
  await expect(page.getByRole('radio', { name: 'Cleared', exact: true })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'Mark as reviewed', exact: true })).toBeEnabled();
  await page.screenshot({ path: '/artifacts/workspace-fraud-review.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Mark as reviewed', exact: true }).click();
  await expect(page.getByText('Reviewed by operator', { exact: true })).toBeVisible();
  await expect(page.getByText('Cleared', { exact: true })).toBeVisible();
  const after = await (await operator.get(url + '/fraud-evaluation')).json();
  expect(after.review.outcome).toBe('CLEARED');
  expect(after.rules).toEqual(before.rules);
  expect(after.status).toBe(before.status);
  expect((await mutate(operator, 'post', url + '/fraud-review', { data: { note: 'Replace review', outcome: 'ESCALATED' } })).status()).toBe(409);
});

test("active statement links survive navigation without disclosing tokens and remain revocable", async ({ page }) => {
  const uploaded = await mutate(operator, 'post', '/api/v1/statements', {
    multipart: { accountId: account, file: { name: 'Managed links.pdf', mimeType: 'application/pdf', buffer: await pdf() } },
  });
  const statement = await uploaded.json();
  const path = `/api/v1/statements/${statement.id}/download-links`;
  const issued = await (await mutate(operator, 'post', path)).json();
  // Keep this single fixture active for the browser test; the normal test profile deliberately uses a 3-second TTL.
  await db.query("update download_grant set expires_at=now()+interval '2 minutes' where id=$1", [issued.id]);
  const active = await (await customer.get(path)).json();
  expect(active.items).toHaveLength(1);
  expect(Object.keys(active.items[0]).sort()).toEqual(['createdAt', 'expiresAt', 'id', 'issuedBy']);
  expect(JSON.stringify(active)).not.toContain(issued.downloadUrl);
  expect((await other.get(path)).status()).toBe(404);
  expect((await mutate(other, 'delete', '/api/v1/download-links/' + issued.id)).status()).toBe(404);
  await page.context().addCookies((await operator.storageState()).cookies);
  await page.goto('/statements');
  await page.reload();
  await page.getByRole('row').filter({ hasText: statement.filename }).getByRole('button', { name: 'Manage links', exact: true }).click();
  await expect(page.getByText('Created by operator', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/artifacts/workspace-statement-links.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Revoke link', exact: true }).click();
  await expect(page.getByText('No active links', { exact: true })).toBeVisible();
  expect((await operator.get(issued.downloadUrl)).status()).toBe(404);
  expect((await (await customer.get(path)).json()).items).toEqual([]);
});
