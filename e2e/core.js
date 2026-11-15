import { chromium, request, expect } from "@playwright/test";

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
expect(await (await api.get("/api/me")).json()).toMatchObject({
  fraudEnabled: false,
  statementsEnabled: false,
});
expect((await api.get("/api/v1/transactions")).status()).toBe(200);
const overview = await api.get("/api/v1/overview");
expect(overview.status()).toBe(200);
expect((await overview.json()).fraud).toBeNull();
expect((await api.get("/api/v1/fraud-evaluations")).status()).toBe(404);
expect(
  (
    await api.get(
      "/api/v1/statements?accountId=20000000-0000-0000-0000-000000000001",
    )
  ).status(),
).toBe(404);
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    storageState: await api.storageState(),
  });
  const page = await context.newPage();
  await page.goto(process.env.BASE_URL + "/transactions");
  await expect(
    page.getByRole("heading", { name: "Transactions", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Fraud checks", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Fraud rules", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Statements", exact: true }),
  ).toHaveCount(0);
  await page.goto(process.env.BASE_URL + "/overview");
  await expect(page.getByLabel("Transaction activity chart")).toBeVisible();
  await expect(page.getByLabel("Fraud review status chart")).toHaveCount(0);
  console.log(
    "PASS: primary assessment works with fraud and statements disabled, through API and browser",
  );
} finally {
  await browser.close();
  await api.dispose();
}
