import { chromium, request, expect } from "@playwright/test";
import pg from "pg";

const api = await request.newContext({ baseURL: process.env.BASE_URL });
const csrf = await (await api.get("/api/csrf")).json();
expect(
  (
    await api.post("/api/session", {
      form: { username: "operator", password: "operator-demo" },
      headers: { [csrf.headerName]: csrf.token },
    })
  ).status(),
).toBe(204);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const browser = await chromium.launch();
try {
  const counts = async () =>
    (
      await db.query(`select s.source_code, count(*)::int total
    from financial_transaction t join source_account s on s.id=t.source_account_id
    group by s.source_code order by s.source_code`)
    ).rows;
  const before = await counts();
  expect(before).toHaveLength(3);
  const context = await browser.newContext({
    storageState: await api.storageState(),
  });
  const page = await context.newPage();
  const totals = [];
  const pages = [];
  page.on("response", async (response) => {
    if (response.status() !== 200) return;
    if (response.url().includes("/api/v1/transaction-summary?"))
      totals.push(await response.json());
    if (response.url().includes("/api/v1/transactions?"))
      pages.push(await response.json());
  });
  await page.goto(process.env.BASE_URL + "/transactions");
  await expect(
    page.getByRole("heading", { name: "Transactions", exact: true }),
  ).toBeVisible();
  await expect.poll(() => totals.length).toBeGreaterThan(0);
  await expect.poll(() => pages.length).toBeGreaterThan(0);
  const initialCount = totals.at(-1).transactionCount;
  const initialIds = new Set(pages.at(-1).items.map((row) => row.id));
  // No navigation, reload or Refresh click: this must happen through Query polling.
  await expect
    .poll(() => totals.at(-1).transactionCount, { timeout: 25000 })
    .toBeGreaterThan(initialCount);
  await expect
    .poll(() => pages.at(-1).items.some((row) => !initialIds.has(row.id)), {
      timeout: 25000,
    })
    .toBe(true);
  await expect(
    page
      .getByLabel("Transaction totals")
      .getByText(String(totals.at(-1).transactionCount), { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      async () => {
        const after = await counts();
        return before.every(
          (old) =>
            after.find((row) => row.source_code === old.source_code)?.total >
            old.total,
        );
      },
      { timeout: 25000 },
    )
    .toBe(true);
  await page.screenshot({
    path: "/artifacts/live-transactions.png",
    fullPage: true,
    animations: "disabled",
  });
  const overview = [];
  page.on("response", async (response) => {
    if (
      response.status() === 200 &&
      response.url().includes("/api/v1/overview?")
    )
      overview.push(await response.json());
  });
  await page.goto(process.env.BASE_URL + "/overview");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await expect.poll(() => overview.length).toBeGreaterThan(0);
  const first = overview.at(-1).transactions.totals.transactionCount;
  await expect
    .poll(() => overview.at(-1).transactions.totals.transactionCount, {
      timeout: 25000,
    })
    .toBeGreaterThan(first);
  for (const source of ["CORE_BANK", "CARD_PROCESSOR", "WALLET_PROVIDER"]) {
    expect(
      overview
        .at(-1)
        .transactions.arrivals.some(
          (row) => row.source === source && row.count > 0,
        ),
    ).toBe(true);
  }
  await page
    .getByRole("button", {
      name: "View incoming transactions data",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("columnheader", { name: "Wallet", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "View incoming transactions data",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Pause updates", exact: true })
    .click();
  // Allow a request already in flight to finish, then verify the interval stays stopped.
  await page.waitForTimeout(1000);
  const pausedRequests = overview.length;
  await page.waitForTimeout(6500);
  expect(overview).toHaveLength(pausedRequests);
  await page
    .getByRole("button", { name: "Resume updates", exact: true })
    .click();
  await expect
    .poll(() => overview.length, { timeout: 15000 })
    .toBeGreaterThan(pausedRequests);
  await page.screenshot({
    path: "/artifacts/live-overview.png",
    fullPage: true,
    animations: "disabled",
  });
  console.log(
    "PASS: overview totals and source arrivals update live; pause holds the view and resume catches up",
  );
  console.log(
    "PASS: all three continuous Kafka sources advance; browser rows and totals update without a refresh",
  );
  console.log(
    JSON.stringify({
      before,
      after: await counts(),
      initialCount,
      displayedCount: totals.at(-1).transactionCount,
    }),
  );
} finally {
  await browser.close();
  await db.end();
  await api.dispose();
}
