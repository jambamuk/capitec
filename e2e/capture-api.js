// Capture actual responses and a browser smoke check from a running demo.
import fs from "node:fs/promises";
import { request, chromium, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";

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
const account = "20000000-0000-0000-0000-000000000001";
const scope = `accountId=${account}&from=2026-11-01&toExclusive=2026-11-10`;
const examples = [];
async function capture(path) {
  const result = await api.get(path);
  expect(result.status()).toBe(200);
  const response = await result.json();
  examples.push({ request: "GET " + path, status: result.status(), response });
  return response;
}
await expect
  .poll(
    async () =>
      (await (await api.get(`/api/v1/transaction-summary?${scope}`)).json())
        .transactionCount,
  )
  .toBeGreaterThanOrEqual(3);
await capture("/api/v1/customers");
await capture("/api/v1/accounts");
await capture("/api/v1/transaction-summary");
await capture("/api/v1/breakdowns?groupBy=ACCOUNT");
await capture("/api/v1/fraud-rules");
let live;
await expect
  .poll(
    async () => {
      live = (
        await (await api.get("/api/v1/transactions?limit=25")).json()
      ).items.find((t) => t.payment);
      return Boolean(live);
    },
    { timeout: 30000 },
  )
  .toBe(true);
await capture("/api/v1/transactions/" + live.id);
await expect
  .poll(
    async () =>
      (
        await (
          await api.get("/api/v1/transactions/" + live.id + "/fraud-evaluation")
        ).json()
      ).status,
  )
  .not.toBe("PENDING");
await capture("/api/v1/transactions/" + live.id + "/fraud-evaluation");
const transactions = await capture(`/api/v1/transactions?${scope}`);
await capture(`/api/v1/transactions/${transactions.items[0].id}`);
await capture(`/api/v1/transaction-summary?${scope}`);
for (const grouping of [
  "CATEGORY",
  "MERCHANT",
  "SOURCE",
  "ACCOUNT",
  "DAY",
  "MONTH",
])
  await capture(`/api/v1/breakdowns?${scope}&groupBy=${grouping}`);
await capture("/api/v1/categories");
await capture(`/api/v1/fraud-evaluations?accountId=${account}`);
await capture(
  `/api/v1/transactions/${transactions.items[0].id}/fraud-evaluation`,
);
const schema = await (await api.get("/v3/api-docs")).json();
expect(Object.keys(schema.paths).length).toBeGreaterThan(15);
expect((await api.get("/actuator/prometheus")).status()).toBe(200);

const pdf = await PDFDocument.create();
const sheet = pdf.addPage([595, 842]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
sheet.drawText("SYNTHETIC ACCOUNT STATEMENT", {
  x: 45,
  y: 780,
  size: 18,
  font,
});
sheet.drawText("Amina Dlamini | Account ending 1042 | November 2026", {
  x: 45,
  y: 740,
  size: 11,
  font,
});
sheet.drawText(
  "Salary +25,000.00 ZAR | FreshMart -842.50 ZAR | GadgetHub -5,100.00 ZAR",
  { x: 45, y: 700, size: 10, font },
);
sheet.drawText(
  "Sample data for the assessment demo. This is not a bank-issued statement.",
  { x: 45, y: 650, size: 10, font },
);
const bytes = Buffer.from(await pdf.save());
await fs.writeFile("/artifacts/sample-statement.pdf", bytes);
const documents = await (
  await api.get(`/api/v1/statements?accountId=${account}`)
).json();
if (documents.items.length === 0) {
  const token = await (await api.get("/api/csrf")).json();
  const upload = await api.post("/api/v1/statements", {
    headers: { [token.headerName]: token.token },
    multipart: {
      accountId: account,
      file: {
        name: "sample-statement.pdf",
        mimeType: "application/pdf",
        buffer: bytes,
      },
    },
  });
  expect(upload.status()).toBe(201);
  examples.push({
    request: "POST /api/v1/statements (accountId and sample PDF)",
    status: 201,
    response: await upload.json(),
  });
}
await capture(`/api/v1/statements?accountId=${account}`);
await fs.writeFile(
  "/artifacts/api-examples.json",
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      note: "Actual demo responses, including all-account aggregates and rule configuration. The stream continues during capture, so separate responses can have different cutoffs. Session and bearer tokens are omitted.",
      examples,
    },
    null,
    2,
  ) + "\n",
);

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    storageState: await api.storageState(),
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.BASE_URL + "/transactions");
  await expect(
    page.getByText("FreshMart", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByLabel("Transaction totals")).toBeVisible();
  await page.screenshot({
    path: "/artifacts/demo-transactions.png",
    fullPage: true,
    animations: "disabled",
  });
  // Check resolved semantic colours, not only token names.
  const contrasts = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    const luminance = (token) => {
      let hex = style.getPropertyValue(token).trim().replace("#", "");
      if (hex.length === 3) hex = [...hex].map((c) => c + c).join("");
      if (!/^[0-9a-f]{6}$/i.test(hex))
        throw new Error("Unexpected colour value for " + token + ": " + hex);
      const rgb = [0, 2, 4]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    return [
      ["--foreground", "--background"],
      ["--muted-foreground", "--background"],
      ["--primary-foreground", "--primary"],
      ["--primary-foreground", "--primary-hover"],
      ["--sidebar-foreground", "--sidebar"],
      ["--sidebar-accent-foreground", "--sidebar-accent"],
    ].map(([a, b]) => ({
      pair: a + "/" + b,
      ratio:
        (Math.max(luminance(a), luminance(b)) + 0.05) /
        (Math.min(luminance(a), luminance(b)) + 0.05),
    }));
  });
  for (const contrast of contrasts)
    expect(contrast.ratio, contrast.pair).toBeGreaterThanOrEqual(4.5);
  await page
    .getByRole("button", { name: /^View transaction / })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("cell", { name: "Customer", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByRole("textbox")).toHaveCount(0);
  expect((await dialog.boundingBox()).width).toBeGreaterThanOrEqual(540);
  await page.screenshot({
    path: "/artifacts/demo-payment-detail.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Fraud rules", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Edit / }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: "/artifacts/demo-rules.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("link", { name: "Fraud checks", exact: true }).click();
  await page
    .getByLabel("Review status", { exact: true })
    .selectOption("NEEDS_REVIEW");
  await page
    .getByRole("button", { name: /^Review / })
    .first()
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Reasons for review" }),
  ).toBeVisible();
  await expect(page.getByLabel("Review note", { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole("dialog")
      .getByText(/rulesetVersion|INSUFFICIENT_DATA|API response/),
  ).toHaveCount(0);
  await page.screenshot({
    path: "/artifacts/demo-fraud-review.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto(process.env.BASE_URL + "/api-docs");
  await expect(page.locator(".swagger-ui").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/transactions",
    "/fraud",
    "/fraud-rules",
    "/statements",
  ]) {
    await page.goto(process.env.BASE_URL + route);
    await expect(
      page.getByRole("button", { name: "Toggle Sidebar" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.goto(process.env.BASE_URL + "/transactions");
  await page
    .getByRole("button", { name: /^View transaction / })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/artifacts/demo-mobile-payment.png",
    animations: "disabled",
  });
  expect(errors).toEqual([]);
  console.log(
    "PASS: six text contrast pairs >= 4.5:1; all four mobile routes fit; transaction details work at both widths",
  );
  console.log(
    `PASS: captured ${examples.length} real API responses, OpenAPI and metrics respond, normal demo browser works`,
  );
} finally {
  await browser.close();
  await api.dispose();
}
