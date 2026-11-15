# Route responsibilities and interaction design

The operator's job is to see incoming financial activity, investigate a payment or a fraud flag, maintain the checking policy, and deliver account statements. The customer sees only their authorized accounts. A dashboard is an entry point into these tasks, not a replacement for the detailed lists.

The [11 November workspace refinement](design/workspace-v2/README.md) adds researched Capitec references, reviewed transaction/fraud concepts, grouped navigation and shared styling. Transactions now includes literal description/reference search, inclusive amount bounds and filtered CSV export. Fraud checks adds priority filtering and recorded review dispositions. Statements adds a paginated active-link sheet for revocation after reload. Existing overview charts, rule editing and source controls retain their responsibilities.

## Decisions by route

| Route | Primary question | Interaction and shadcn components |
| --- | --- | --- |
| `/overview` | What changed, and what needs attention? | Cards for totals, Toggle Group for Today/7/30 days and Count/Value, Chart for activity, category spending, review status and arrivals. Account filter scopes every panel. Collapsible tables expose exact values. Links open the same account/date cohort in Transactions or Fraud checks. Pause freezes automatic refresh; explicit Refresh remains available. |
| `/transactions` | Find and understand a payment | URL-backed account/date/category/source/direction filters; bounded Table pages, exact amount formatting, shared detail Sheet. Totals follow the filters. First-page live updates can be paused while reading; historical cursor pages do not move. Reset clears filters except account. |
| `/fraud` | Which checks need review, and why? | Review status, account and date filters, priority and status in a Table, row/button opens an evidence/review Sheet. Immutable review outcomes remain visible. Live updates can be paused while investigating. The overview passes the date cohort explicitly. |
| `/fraud-rules` | What policy is active, and what will my edit change? | Cards show the actual condition and enabled/priority state. A Sheet provides explicit fields for each condition. A local draft has an Unsaved changes Badge, Save and Discard. Reload is disabled while dirty. Alert Dialog protects route navigation; browser unload protection covers closing/reloading the tab. Saves retain optimistic version checking. |
| `/statements` | Find a document and share it securely | Operator upload is grouped in a Card, distinct from the account-filtered Table. File size and availability are visible. The generated link Card names its document and shows expiry. Copy/download stop being offered after expiry; server expiry remains authoritative. Revoke stays explicit. |
| `/testing` | Reproduce a scenario and inspect its result | Existing Tabs separate event composition, live transactions and API exploration. Source controls show the current interval rather than an unrelated hard-coded draft. Destructive reset retains typed confirmation. Diagnostic identifiers and request JSON stay here. |

The sidebar remains the application-level navigation. Tabs are used only for related tasks inside Testing. Normal operational pages do not explain Kafka, database schemas, processing implementation or internal identifiers.

## Why these chart forms

- **Lines** show how credits and debits change over time. Count and value are separate selectable measures with the same period buckets, rather than unrelated dual axes. Money out has a dashed line as well as a different color.
- **Horizontal bars**, sorted by spending, support category comparison. Each category has an accessible transaction link in its data table.
- **Donut plus labelled counts** shows four mutually exclusive states: not flagged, needs review, reviewed and awaiting check. The center counts transactions, not completed checks. Pending is neutral; red is reserved for review attention. A fraud flag is not labelled confirmed fraud.
- **Stacked columns** show transactions received per minute from the three mock providers. Receipt time is different from payment time: an old payment received now appears here, but not in today's payment totals.

Each chart uses shadcn's Recharts integration with accessibility enabled, no animated transitions during live polling, and a full exact-value table. Empty money-out periods have a real empty state. Quiet arrival minutes are zero-filled rather than hidden. The latest arrival timestamp is shown even when the stream is quiet; auto-refresh status describes browser refresh, not a promise that providers are running.

## Data and performance contract

`GET /api/v1/overview?days=7&accountId=<optional UUID>` returns a bounded report. `days` must be 1, 7 or 30. Calendar boundaries and display labels use Africa/Johannesburg. The response includes the date interval, observation cutoff, activity bucket size, totals, sparse activity/category/arrival series, last receipt time and fraud counts (null when fraud is disabled).

The overview module orchestrates public reporting APIs owned by Transactions and Fraud. Accounts determines the authorized scope. Spring Data JDBC repository projections calculate the aggregates in PostgreSQL under one repeatable-read transaction. Money remains decimal text in the API. The browser converts values to Number only for drawing geometry; exact labels/tables keep the original decimal values. A Liquibase migration indexes receipt-time lookups. Read-only reporting joins do not grant cross-module write ownership.

TanStack Query polls a single overview request every three seconds while the page is active. It does not poll in background tabs. The same query definition serves the file-route loader and Suspense component; a page-shaped skeleton covers initial loading. Cached data remains visible with an error indicator after a refresh failure, and its timestamp remains the last successful report. Pause disables interval, focus and reconnect refresh; a request already in flight may finish. Filters still load the newly requested scope. Chart code is loaded in the overview route chunk.

This is a bounded SQL reporting design for the submitted deployment, not a demonstrated bank-scale throughput claim. At higher volume, measure query plans and latency, then consider incremental reporting tables or streaming aggregates before adding more infrastructure. `asOf` describes this read, not an end-to-end Kafka watermark. Fraud may still be pending; historical decisions are not rewritten for late events.

## References and concept

- [shadcn Chart](https://ui.shadcn.com/docs/components/radix/chart): composition, tooltips, legends and accessibility.
- [shadcn Table](https://ui.shadcn.com/docs/components/radix/table), [Sheet](https://ui.shadcn.com/docs/components/radix/sheet), [Toggle Group](https://ui.shadcn.com/docs/components/radix/toggle-group), [Collapsible](https://ui.shadcn.com/docs/components/radix/collapsible), [Alert Dialog](https://ui.shadcn.com/docs/components/radix/alert-dialog): installed component conventions.
- [TanStack navigation blocking](https://tanstack.com/router/latest/docs/guide/navigation-blocking): resolver-based draft navigation protection.
- [Nielsen Norman Group: dashboard visual attributes](https://www.nngroup.com/articles/dashboards-preattentive/): prioritize clear comparisons and deliberate visual emphasis.
- [GOV.UK tables](https://design-system.service.gov.uk/components/table/): comparable, labelled rows and columns.
- [Capitec business online banking](https://www.capitecbank.co.za/business/transact/online-banking/): public visual reference. This assessment is Capitec-inspired, not an official Capitec product or approved brand implementation.

The [generated concept](design/overview/concept.png) uses illustrative data. The implementation corrects its pending-state color and transaction-total wording and uses API data throughout. [Generation record](design/overview/provenance.json).

Actual implementation: [desktop](design/overview/implemented.png) and [mobile](design/overview/implemented-mobile.png). These screenshots show the preserved local demo history with the sources paused, so the recent-arrival chart is quiet. Continuous arrival updates are exercised separately against the disposable Docker test environment.

[Live-demo screenshot](design/overview/live-demo.png): real API data from the isolated acceptance environment with all three mock sources running. Its figures belong to the test fixtures, not the preserved local history.
