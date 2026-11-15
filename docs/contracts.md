# Transaction and fraud contracts

The serving API models account information. Its GET requests use query parameters, not JSON bodies. Ingestion is a separate Kafka boundary: each provider has its own representation, normalized into the same exact-decimal transaction model. This is an assessment contract, not Capitec's internal API.

## What makes the payload realistic

Open Banking's public [transaction resource](https://openbankinguk.github.io/read-write-api-site3/v3.1.4/resources-and-data-models/aisp/transactions.html) distinguishes monetary direction, booking status/time, value date and merchant information. This project borrows those concepts without claiming conformance to that specification. Currency, amount and direction remain separate; merchant identity is separate from the provider's narrative description. A booking timestamp is not the ingestion timestamp.

The v2 source envelope adds a typed `payload.payment`. [Copyable card event](examples/enriched-card-event.json): a GBP-country merchant can still bill a ZAR settlement amount; no exchange rate or original currency is invented. MCC `5732` drives the SHOPPING category even if the merchant's name has never been seen. Only the last four card digits are accepted. Authentication evidence records what the source supplied and does not imply fraud is impossible.

The same envelope supports transfers with `counterparty: { id, name, beneficiaryCreatedAt }`. The optional creation timestamp comes from the trusted source's beneficiary records. It is not guessed from the first payment seen in this application. Missing data stays null and rules that need it return INSUFFICIENT_DATA.

Stable provider reference + source account is the idempotency key. Event ID identifies a delivery, not a new financial movement. Metadata participates in the normalized content hash. Reordered JSON properties do not change identity. Reusing an identity with a different amount or merchant country is quarantined rather than silently overwriting financial facts.

## A retrieval request

```http
GET /api/v1/transactions?from=2026-11-10&toExclusive=2026-11-11&direction=DEBIT&source=CARD_PROCESSOR&limit=25
Accept: application/json
Cookie: JSESSIONID=<authenticated session>
```

All authorized accounts are included unless `accountId` or `customerId` narrows the request. Responses contain `items`, `nextCursor` and `asOf`. Each item includes:

```json
{
  "id": "8bb6b9f1-9013-4bf3-88d0-19ca1acb86f2",
  "accountId": "20000000-0000-0000-0000-000000000001",
  "customerId": "10000000-0000-0000-0000-000000000001",
  "description": "Online electronics",
  "source": "CARD_PROCESSOR",
  "sourceTransactionId": "card-20261110-93821",
  "amount": "3299.95",
  "currency": "ZAR",
  "direction": "DEBIT",
  "category": "SHOPPING",
  "categorizerVersion": "2",
  "occurredAt": "2026-11-10T10:14:28Z",
  "recordedAt": "2026-11-10T10:14:31Z",
  "payment": {
    "status": "BOOKED",
    "type": "CARD_PURCHASE",
    "channel": "ECOMMERCE",
    "bookedAt": "2026-11-10T10:14:30Z",
    "valueDate": "2026-11-10",
    "paymentReference": "purchase-93821",
    "merchant": {
      "id": "merchant-uk-18",
      "name": "Online electronics",
      "categoryCode": "5732",
      "country": "GB"
    },
    "counterparty": null,
    "instrument": { "lastFour": "1042", "authentication": "THREE_DS" }
  }
}
```

This is an illustrative item, not a claim that this exact ID exists. Open a transaction in the UI or use the authenticated OpenAPI page to inspect actual responses. Money stays a string at the boundary to avoid binary floating-point errors. `GET /api/v1/transaction-summary` and `/api/v1/breakdowns?groupBy=DAY` accept the same filters and aggregate exact amounts in SQL. Net movement is not an account balance. Date boundaries use Africa/Johannesburg; timestamps are UTC.

## Configuring a compound rule

Fetch `/api/v1/fraud-rules` first. PUT replaces the full rule collection; use its current version and retain any other rules you want to keep. For example:

```json
{
  "expectedVersion": 2,
  "rules": [
    {
      "code": "NEW_BENEFICIARY",
      "name": "Large payment to a recently added beneficiary",
      "type": "NEW_BENEFICIARY_PAYMENT",
      "enabled": true,
      "direction": "DEBIT",
      "amount": "5000.00",
      "windowMinutes": 60,
      "severity": "HIGH"
    },
    {
      "code": "RAPID_PAYMENTS",
      "name": "Rapid outgoing payments",
      "type": "VELOCITY_COUNT",
      "enabled": true,
      "direction": "DEBIT",
      "windowMinutes": 5,
      "countThreshold": 8,
      "severity": "HIGH"
    }
  ]
}
```

The first condition requires an outgoing transfer, an amount strictly greater than R5,000 and beneficiary age no more than 3,600 seconds. The second checks more than eight matching transactions in the rolling window, including the current one. These are controlled, typed templates rather than arbitrary expressions. Public systems such as [Stripe Radar](https://docs.stripe.com/radar/rules/reference) illustrate combined attribute conditions and distinct review/block actions; this service performs post-booking review only.

The fraud response includes the immutable rule revision, status, review action, highest matched severity, evidence coverage, completion time and evidence cutoff. Each rule has its own outcome, criteria object, observed values object and explanation. Velocity evidence contains the count, exact sum and time bounds; beneficiary evidence contains the known creation time and age. A flag requests investigation; it does not reverse or block the payment. Severity is a configured ordinal, not a probability.

## Fraud review API

`GET /api/v1/fraud-evaluations` accepts optional `accountId`, `customerId`, `reviewStatus` (`ALL`, `NEEDS_REVIEW`, `REVIEWED`), `limit` (1–100) and `cursor`. It lists completed checks in descending completion order. Each item contains the transaction, original decision status/severity and current review status. The opaque cursor is bound to the authenticated subject and filters. Reviews may change while paging; this is a live work queue, not an immutable snapshot of review state.

`POST /api/v1/transactions/{id}/fraud-review` is operator-only and requires a flagged transaction and a non-blank note of at most 1,000 characters:

```json
{ "note": "Customer contacted; payment confirmed." }
```

The response contains `transactionId`, `reviewedBy`, `note`, and `reviewedAt`. The existing evaluation endpoint includes this object under `review` (or `null`). The original rule evidence and decision remain unchanged. Duplicate review returns 409, non-flagged/pending transaction returns 409, invalid note returns 400, and customer attempts return 403. Reviewing acknowledges investigation; it does not change or reverse a booked payment.

## Statement delivery API

`GET /api/v1/statements` accepts optional `accountId`, `limit` (1–100, default 25) and `cursor`. It returns `{ items, nextCursor, asOf }`, ordered by upload time and ID. Each document has `id`, `accountId`, `filename`, `sizeBytes`, `status` and `createdAt`. Keep filters unchanged when following a cursor; authorization is checked on every request.

`POST /api/v1/statements` accepts multipart `accountId` and `file` from an operator. The file must be a readable, unencrypted PDF of at most 10 MB. Successful upload returns 201 with document metadata. Storage is private; a document ID is not a download capability.

`POST /api/v1/statements/{id}/download-links` returns 201 with `{ id, downloadUrl, expiresAt }`. The caller must be authorized for the account. The default lifetime is five minutes; configuration permits one second to five minutes. `DELETE /api/v1/download-links/{id}` revokes the capability and returns 204. The UI exposes creation, copy, download and revocation of the newly issued link.

`GET /downloads/{token}` is a bearer-capability endpoint: possession of a valid link permits download without a session. Every new request checks availability, expiry and revocation; unavailable/expired/revoked/tampered links return 404. Successful responses are PDF attachments with `Cache-Control: no-store`. A download already authorized before expiry may finish after expiry. The database stores only the token hash.

## Deliberate limits

- BOOKED movements only. Pending authorisations, reversals and ledger reconciliation need explicit lifecycle and linkage contracts; they are not represented as ordinary booked debits here.
- Mock source feeds are disjoint. Overlapping real card/ledger feeds would need cross-provider reconciliation before aggregation.
- Historical decisions use committed data available at evaluation time, with a repeatable database snapshot. Late arrivals do not retroactively change decisions. There is no claim of complete event-time windows across source topics.
- No account balance, FX conversion, machine learning, sanctions screening or production-calibrated thresholds is fabricated.
- The [Capitec public website](https://www.capitecbank.co.za/) is the visual reference. Palette tokens in `frontend/src/index.css` are an assessment interpretation, not an official exported design system.
