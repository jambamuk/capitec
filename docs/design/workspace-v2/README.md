# Operations workspace: research and implementation

Research and concept review: 11 November 2026. This is an independent assessment application inspired by Capitec's public brand, not a Capitec product or an assertion of access to its internal design system.

## Evidence and scope

- [Capitec business online banking](https://www.capitecbank.co.za/business/transact/online-banking/) supports account visibility, transaction access, dashboard personalisation and self-service documents. Those are relevant patterns for a financial operations workspace.
- [Capitec spending guidance](https://www.capitecbank.co.za/were-here-to-help/how-to/how-to-track-your-spending/) uses all activity, Money In/Money Out and transaction detail. We use that vocabulary and preserve exact money values.
- [Capitec personal online banking](https://www.capitecbank.co.za/personal/transact/online-banking/) includes statement downloads and transaction history. Our statement workflow remains account-scoped PDF delivery.
- [Stripe's transaction review guidance](https://docs.stripe.com/radar/transaction-reviews) supports a queue-to-detail workflow with payment context and recorded decisions. We adopt prioritisation and review notes; this application has no payment blocking, refund execution or machine-learning risk score.
- Official [shadcn components](https://ui.shadcn.com/docs/components) provide the interaction primitives. TanStack Router owns URL filters; Query owns server state, preloading, refresh and error recovery.

The automated public-site browser encountered a verification page. Its screenshot/CSS was excluded from brand evidence. The accessible official pages, public imagery and existing researched brand tokens informed the concepts. Exact internal Capitec styling is not claimed.

## Route responsibilities

| Route | User goal | Interaction and components |
| --- | --- | --- |
| Overview | Understand recent activity and outstanding reviews | Account/period filters, chart cards, exact-value tables, linked drilldowns; live refresh with visible pause and retry. Existing count/value, source, category and fraud charts retained. |
| Transactions | Find and inspect a financial movement; reconcile filtered totals | Search description/reference, inclusive amount range, date/account/category/source/direction filters, summary cards, cursor table, detail sheet, filtered CSV. Filters live in the URL. |
| Fraud checks | Prioritise and resolve the review queue | Review-status and priority filters, selected row, payment sheet, original rule evidence, outcome selection and required note. Recorded outcomes are Reviewed, Cleared or Escalated; none executes a payment action. |
| Fraud rules | Configure clear, versioned decision criteria | Existing rule cards, condition editor sheets, optimistic version checking and unsaved-change guard. Keep rules separate from reviewing individual payments. |
| Statements | Store and share an account statement securely | Account-scoped upload and document table; create/copy/download link; active-links sheet with issuer/expiry and revocation, available after reload. Never reconstruct a bearer URL from its stored hash. |
| Testing | Exercise source delivery, rules and reports | Existing event forms, scenarios, source controls and protected reset; API explorer now includes the same text/amount filters. Kept separate at the bottom of navigation. |

## Concepts and review decisions

Generated references: [transactions](transactions-concept.png) and [fraud review](fraud-concept.png). Exact prompts are in [prompts.json](prompts.json). All figures and people in these images are fictional; these are not screenshots of a running application.

Retain: white navigation, pale blue workspace, navy hierarchy, blue primary actions, restrained red priority indicators, grouped navigation, spacious filters and a contextual review sheet.

Correct during implementation: the transaction concept has inconsistent illustrative footer counts and an unnecessary portrait. Real result counts come from the API; use an initial avatar instead. Keep accessible named buttons, real empty/error/loading states, accurate cursor navigation and responsive fields. The fraud sheet records an operator decision, preserving the original automated evaluation. Do not imply payment execution or a separate escalation service.

Rendered-screen review led to one further iteration: transaction and fraud filters now expand on demand on small screens. Keeping every filter expanded pushed the payment list below the first mobile screen. A shared shadcn Collapsible keeps one form mounted, preserves applied URL filters and avoids duplicate IDs; desktop controls remain visible. The current-page breadcrumb is plain text so it does not duplicate the navigation link for assistive technology.

Shared styling lives in `frontend/src/index.css`: brand, surface, text, border, selected-state and chart tokens. shadcn primitives consume semantic tokens; feature files do not hard-code brand colours. Shell, input and button primitives supply consistent navigation and control dimensions. Source settings and financial data are not altered by a visual refresh.

Actual implementation screenshots: [transactions](implemented-transactions.png), [mobile](implemented-mobile.png), [fraud review](implemented-fraud-review.png). These show the preserved local synthetic demo, with 64 transactions at capture time. The fraud image shows a local, unsaved outcome selection; no review was submitted during capture. Automated acceptance screenshots in `test-results/` use separate disposable fixtures.

## Reliability and performance boundaries

- Search is literal, case-insensitive substring matching across description, source reference and supplied payment reference. `%` and `_` are literal characters. SQL uses bound parameters. Existing account/date indexes restrict scans; no unmeasured full-text/search infrastructure is added. Large-scale substring search needs measured query plans and an appropriate text index before increasing data retention.
- Lists, summaries, breakdowns and CSV use the same authorized predicate. Amount filters use Java `BigDecimal`, inclusive bounds and at most two decimal places. Default/maximum report range remains 366 days.
- CSV exports are bounded to 10,000 rows and fail with 422 if exceeded, rather than silently truncating. One repeatable-read transaction creates a consistent export; quoting and formula neutralisation protect spreadsheet consumers. The bounded byte response avoids asynchronous streaming errors after headers are committed.
- Priority is part of the fraud cursor fingerprint. Reviews are append-once, operator-only, with immutable original evidence; concurrent/duplicate review returns 409. Migration 009 gives existing reviews the Reviewed outcome.
- Active-link pages return metadata only, at most 25 rows per page, with account authorization, no-store responses, cursor scope and server-clock expiry. Revoked/expired grants disappear. The original secret is available only when issued. The browser refreshes the sheet every two seconds; the server always enforces expiry on download.
- Existing module boundaries, Kafka delivery/recovery, optional modules and exact-value chart calculations are retained. This pass does not establish bank-scale throughput or production certification.
