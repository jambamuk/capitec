# Business code review

This is a manual responsibility and control-flow review, with an explicit decision for every handwritten production source file. It is not a claim that tests prove the absence of defects. The accompanying [JSON inventory](business-code-review.json) binds each entry to its SHA-256 source hash so a later change can be identified.

## Scope and review standard

Reviewed all backend and mock-source Java files, frontend feature/components/query/routing/helpers, and theme CSS. Reviewed the Liquibase schema/configuration separately for keys, uniqueness, indexes, profiles and deployment limits. Existing migrations were not rewritten. Generated `routeTree.gen.ts`, shadcn primitives under `components/ui`, lockfiles, static assets, test fixtures and build outputs are not application business logic; they are excluded from this table. Tests and Docker build configuration are verified by the execution suite.

For each file: identify one owner; trace inputs, validation, state changes and errors; keep SQL in repositories; prefer explicit records and named steps over casts or nullable decision flags; retain useful small code rather than split every function into a class. Pure evaluator classes are warranted by configurable conditions, while provider adapters remain three readable branches in one normalizer.

## Changes and ownership

- Fraud reads, review commands, HTTP views, rule eligibility/evidence and individual condition evaluation now have separate responsibilities.
- Ingestion normalizes provider facts before a short transactional writer validates replay identity and publishes a durable module event.
- Accounts owns customer authorization. Transactions owns financial facts/category/history. Fraud owns revisions/decisions/evidence/reviews. Statements owns file metadata, storage and grants. Testing owns scenario orchestration/reset audit. Platform owns shared technical infrastructure.
- Demo reset calls `FraudDemoReset` and `TransactionDemoReset` in the same transaction; it no longer deletes their tables directly. `TestingRepository.results` is a deliberate read-only diagnostic join across transaction/fraud tables. It is confined to the demo module; it is not a second business write path. Reporting joins into account/source mapping tables are also read-only. Overview owns report orchestration; Transactions and Fraud retain their reporting projections and writes.
- Shared `PageCursor` rejects malformed dates as 400 errors. Statement lists now paginate. Merchant breakdowns prefer supplied merchant names. File cleanup streams directory entries and retains original failures.
- Feature folders own page/query/editor code. File routes own preload decisions. Query owns server-state caching. Router owns URL filters/navigation. shadcn owns UI primitives.

## Extension points

1. **New fraud condition:** add a `RuleConfiguration.Type`, a Spring `FraudRuleEvaluator` component, relevant validation in `RuleValidator`, and the frontend condition fields/description. Add boundary/missing-data tests and a Kafka acceptance case. The registry fails startup for missing or duplicate implementations. Persisted old criteria are unchanged.
2. **New provider:** add its topic/source mapping and payload decoder in `SourceNormalizer`, topic configuration, source-account mappings through Liquibase, and a mock contract fixture. Shared financial/context validation and `TransactionWriter` idempotency remain unchanged.
3. **New report:** extend the transaction query/repository fragment with bound parameters and an allowlisted group expression, then expose it in the controller/OpenAPI. Do not put SQL in HTTP or UI code.
4. **New storage backend:** replace the concrete private storage adapter and its reconciliation semantics, keeping authorization and link-grant decisions in the statements module. Introduce an interface when a second implementation is actually needed; an object store's copy/commit semantics are not assumed to equal a local atomic move.
5. **New UI route:** add a file under `src/routes`, colocate page/query code under its feature, preload the same `queryOptions` consumed by Suspense, and use shared error/skeleton/shadcn components. The generated tree is tool-owned.

## Verification and limits

The [verification record](verification.json) contains executed results. Java tests enforce module boundaries and prevent SQL in business services. Docker acceptance covers real Kafka/PostgreSQL, authorization, exact amounts, replay, immutable decisions, file validation/link security, browser flows and failure recovery. New checks exercise malformed cursor timestamps, statement page scope, supplied merchant grouping, parallel query startup, skeletons, route preloading, retry and user cache isolation.

Maintainability is a review judgment, not a line-count target. Explicit SQL and form fields are retained where they communicate the contract better than a generic abstraction. This remains a single-instance assessment deployment: no capacity benchmark, bank production certification, distributed reset, malware scanning or complete late-event watermark guarantee is claimed. See the README for deployment and scaling boundaries.

The frontend follows the official [file-routing](https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing), [external-data-loading](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading), [Suspense](https://tanstack.com/query/latest/docs/framework/react/guides/suspense) and [shadcn skeleton](https://ui.shadcn.com/docs/components/radix/skeleton) guidance. Spring structure follows [Modulith ownership](https://docs.spring.io/spring-modulith/reference/fundamentals.html) and the repository guidance linked in the README.

## File-by-file decisions


### accounts

| File | Review decision |
| --- | --- |
| [AccountAccess.java](../backend/src/main/java/dev/financial/app/accounts/AccountAccess.java) | Single authorization and provider-account resolution API; callers cannot broaden customer scope. |
| [AccountRecord.java](../backend/src/main/java/dev/financial/app/accounts/internal/AccountRecord.java) | Small account aggregate; customer information is a read projection, not an unbounded child collection. |
| [AccountRepository.java](../backend/src/main/java/dev/financial/app/accounts/internal/AccountRepository.java) | Parameterized visibility/source lookups; SQL confined to persistence. |
| [AccountsController.java](../backend/src/main/java/dev/financial/app/accounts/internal/AccountsController.java) | Thin authenticated account-list adapter. |
| [package-info.java](../backend/src/main/java/dev/financial/app/accounts/package-info.java) | Declares the module and allowed dependencies; verified by Spring Modulith architecture tests. |

### bootstrap

| File | Review decision |
| --- | --- |
| [FinanceApplication.java](../backend/src/main/java/dev/financial/app/FinanceApplication.java) | Boot entry point only; component scan rooted above business modules. |

### fraud

| File | Review decision |
| --- | --- |
| [FraudDashboard.java](../backend/src/main/java/dev/financial/app/fraud/FraudDashboard.java) | Public fraud count contract; pending is explicit and empty authorized scopes return zeros. |
| [FraudDemoReset.java](../backend/src/main/java/dev/financial/app/fraud/FraudDemoReset.java) | New demo-only fraud API owns deletion order: rule results, reviews, evaluations. |
| [FraudController.java](../backend/src/main/java/dev/financial/app/fraud/internal/FraudController.java) | Thin HTTP adapter now delegates reads and review commands to separate use cases. |
| [FraudEvaluationQueries.java](../backend/src/main/java/dev/financial/app/fraud/internal/FraudEvaluationQueries.java) | Bounded authorized reads; priority validation and cursor scope, batched evidence/review lookup without per-row queries. |
| [FraudListener.java](../backend/src/main/java/dev/financial/app/fraud/internal/FraudListener.java) | Categorized-event adapter delegates transaction processing; gate applies persisted reset cutoffs. |
| [FraudProcessor.java](../backend/src/main/java/dev/financial/app/fraud/internal/FraudProcessor.java) | Refactored into validate, evaluateRules and saveDecision; one database transaction and cached repeated windows. |
| [FraudReviewService.java](../backend/src/main/java/dev/financial/app/fraud/internal/FraudReviewService.java) | Operator-only append-once review with required note and explicit/default outcome; automated evidence is never rewritten. |
| [FraudRules.java](../backend/src/main/java/dev/financial/app/fraud/internal/FraudRules.java) | Replaced condition switch/nullable boolean flow with registered evaluators; common eligibility and evidence assembly remain here. |
| [FraudViews.java](../backend/src/main/java/dev/financial/app/fraud/internal/FraudViews.java) | New response records separate API projections from command logic and persistence mappings. |
| [EvaluationRecord.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/EvaluationRecord.java) | Immutable persisted decision and observation cutoff. |
| [EvaluationRepository.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/EvaluationRepository.java) | Atomic one-decision insert, scoped keyset pages, and fraud-owned reset deletion. |
| [FraudDashboardRepository.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/FraudDashboardRepository.java) | Read-only transaction-cohort projection; disjoint review states and high-priority subset, never a cross-module write. |
| [FraudReview.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/FraudReview.java) | One immutable review record per transaction. |
| [ReviewRepository.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/ReviewRepository.java) | Atomic insert-if-absent and batched lookup; owner-local reset deletion. |
| [RuleResultRecord.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/RuleResultRecord.java) | Immutable per-rule criteria and observed JSON snapshots. |
| [RuleResultRepository.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/RuleResultRepository.java) | Explicit evidence insertion and bounded evaluation lookup; owner-local reset deletion. |
| [RulesetRepository.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/RulesetRepository.java) | Revision insertion and compare-and-set active version in the caller transaction. |
| [StoredRuleset.java](../backend/src/main/java/dev/financial/app/fraud/internal/persistence/StoredRuleset.java) | Immutable revision mapping; JSON remains confined to configuration persistence. |
| [ReviewOutcome.java](../backend/src/main/java/dev/financial/app/fraud/internal/ReviewOutcome.java) | Explicit recorded dispositions shared by the review command and persistence; no implied payment execution or notification. |
| [RuleConfiguration.java](../backend/src/main/java/dev/financial/app/fraud/internal/RuleConfiguration.java) | Immutable revisions and optimistic activation; stale edits return conflict instead of overwriting another operator. |
| [RuleController.java](../backend/src/main/java/dev/financial/app/fraud/internal/RuleController.java) | Operator-only current/version/save routes; Bean Validation at the HTTP boundary. |
| [AmountRule.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/AmountRule.java) | Pure strict greater-than comparison; no money conversion to floating point. |
| [CategoryRule.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/CategoryRule.java) | Pure category-code comparison. |
| [ForeignOnlineRule.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/ForeignOnlineRule.java) | Early returns for missing/inapplicable facts; explicit ecommerce/country/amount conjunction. |
| [FraudRuleEvaluator.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/FraudRuleEvaluator.java) | Explicit internal extension point; startup fails if an enum condition has zero or multiple implementations. |
| [MerchantRule.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/MerchantRule.java) | Pure case-insensitive exact merchant comparison with legacy description fallback. |
| [NewBeneficiaryRule.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/NewBeneficiaryRule.java) | Early returns for missing/inapplicable facts; explicit age-and-amount conjunction. |
| [RuleCheck.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/RuleCheck.java) | Typed rule outcomes distinguish disabled, inapplicable, missing-data, matched and not-matched checks. |
| [RuleContext.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/RuleContext.java) | Small immutable evaluation context; shares amount comparison and merchant fallback without persistence dependencies. |
| [RuleValidator.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/RuleValidator.java) | Extracted required-field, amount, comparison-value and window validation; irrelevant settings normalized away. |
| [VelocityRule.java](../backend/src/main/java/dev/financial/app/fraud/internal/rules/VelocityRule.java) | Shares count/amount window logic; records exact totals, bounds and inclusion semantics. |
| [package-info.java](../backend/src/main/java/dev/financial/app/fraud/package-info.java) | Declares the module and allowed dependencies; verified by Spring Modulith architecture tests. |

### ingestion

| File | Review decision |
| --- | --- |
| [SourceNormalizer.java](../backend/src/main/java/dev/financial/app/ingestion/internal/SourceNormalizer.java) | Extracted provider decoding and payment-context validation; exact decimals and integral schema-version range checks. |
| [TransactionListener.java](../backend/src/main/java/dev/financial/app/ingestion/internal/TransactionListener.java) | Kafka transport adapter delegates parsing and transactional acceptance through the reset gate. |
| [package-info.java](../backend/src/main/java/dev/financial/app/ingestion/package-info.java) | Declares the module and allowed dependencies; verified by Spring Modulith architecture tests. |

### overview

| File | Review decision |
| --- | --- |
| [OverviewController.java](../backend/src/main/java/dev/financial/app/overview/internal/OverviewController.java) | Thin authenticated GET adapter; optional account and validated days parameters. |
| [OverviewService.java](../backend/src/main/java/dev/financial/app/overview/internal/OverviewService.java) | Authorizes scope, bounds period to 1/7/30 days, distinguishes event and receipt time, orchestrates both modules in one repeatable-read snapshot. |
| [package-info.java](../backend/src/main/java/dev/financial/app/overview/package-info.java) | Declares the module and allowed dependencies; verified by Spring Modulith architecture tests. |

### platform

| File | Review decision |
| --- | --- |
| [ApiErrors.java](../backend/src/main/java/dev/financial/app/platform/ApiErrors.java) | Central sanitized validation/status translation; no stack traces or SQL returned to callers. |
| [AppProperties.java](../backend/src/main/java/dev/financial/app/platform/AppProperties.java) | Boot configuration binding for feature toggles, storage, TTL and business timezone. |
| [DemoUsers.java](../backend/src/main/java/dev/financial/app/platform/DemoUsers.java) | Demo-profile identity seeding only; existing persisted passwords are not overwritten. |
| [CheckpointRepository.java](../backend/src/main/java/dev/financial/app/platform/internal/CheckpointRepository.java) | Parameterized checkpoint upsert and startup read. |
| [ProcessingCheckpoint.java](../backend/src/main/java/dev/financial/app/platform/internal/ProcessingCheckpoint.java) | Independent persisted partition offset aggregate. |
| [KafkaConfiguration.java](../backend/src/main/java/dev/financial/app/platform/KafkaConfiguration.java) | Explicit topics, dead letters and differentiated retry policy; bounded infrastructure recovery. |
| [package-info.java](../backend/src/main/java/dev/financial/app/platform/package-info.java) | Declares the module and allowed dependencies; verified by Spring Modulith architecture tests. |
| [PageCursor.java](../backend/src/main/java/dev/financial/app/platform/PageCursor.java) | New common keyset codec; rejects malformed dates, future cutoff and changed scope as request errors. |
| [PlatformConfiguration.java](../backend/src/main/java/dev/financial/app/platform/PlatformConfiguration.java) | Shared Clock and standard Spring infrastructure beans. |
| [ProcessingGate.java](../backend/src/main/java/dev/financial/app/platform/ProcessingGate.java) | Single-instance reset fence and persisted cutoffs; no claim of cluster-wide reset coordination. |
| [SecurityConfiguration.java](../backend/src/main/java/dev/financial/app/platform/SecurityConfiguration.java) | Spring Security owns sessions, CSRF, endpoint roles and browser headers; localhost demo policy documented. |
| [SessionController.java](../backend/src/main/java/dev/financial/app/platform/SessionController.java) | Session identity/feature flags and CSRF endpoint; no financial business logic. |
| [WebRoutes.java](../backend/src/main/java/dev/financial/app/platform/WebRoutes.java) | Explicit SPA forward routes; API paths remain Spring controller routes. |

### statements

| File | Review decision |
| --- | --- |
| [DownloadGrant.java](../backend/src/main/java/dev/financial/app/statements/internal/DownloadGrant.java) | Versioned hash/expiry/revocation aggregate; plaintext token is not persisted. |
| [DownloadGrantRepository.java](../backend/src/main/java/dev/financial/app/statements/internal/DownloadGrantRepository.java) | Spring Data grant persistence; parameterized active metadata pages, indexed statement/date access and revocation/expiry checks. |
| [DownloadLinkService.java](../backend/src/main/java/dev/financial/app/statements/internal/DownloadLinkService.java) | Account-scoped issue, metadata listing, revocation and expiry; list never returns token hashes or bearer URLs. Fixed-size cursor pages and server time. |
| [PrivateStatementStorage.java](../backend/src/main/java/dev/financial/app/statements/internal/PrivateStatementStorage.java) | Private bounded streaming, PDF parsing and atomic publish; directory cleanup streams entries; preserves original failures. |
| [RequestLimiter.java](../backend/src/main/java/dev/financial/app/statements/internal/RequestLimiter.java) | Bounded local limiter with expiry cleanup; explicitly single-instance, not a distributed security boundary. |
| [StatementController.java](../backend/src/main/java/dev/financial/app/statements/internal/StatementController.java) | Thin multipart/list/link adapters and file-backed response; no-store attachment downloads. |
| [StatementMaintenance.java](../backend/src/main/java/dev/financial/app/statements/internal/StatementMaintenance.java) | Retries interrupted uploads; one filesystem error no longer blocks other stale statements; scheduled expiry cleanup. |
| [StatementRecord.java](../backend/src/main/java/dev/financial/app/statements/internal/StatementRecord.java) | Small versioned metadata aggregate; PDF bytes are outside the database. |
| [StatementRepository.java](../backend/src/main/java/dev/financial/app/statements/internal/StatementRepository.java) | Scoped statement keyset query and conditional STAGING transition; nullable Version supports assigned UUID insert. |
| [StatementService.java](../backend/src/main/java/dev/financial/app/statements/internal/StatementService.java) | Authorized bounded upload orchestration; replaced latest-100 cap with keyset pagination; cleanup cannot hide upload outcome. |
| [package-info.java](../backend/src/main/java/dev/financial/app/statements/package-info.java) | Declares the module and allowed dependencies; verified by Spring Modulith architecture tests. |

### testing

| File | Review decision |
| --- | --- |
| [MockSources.java](../backend/src/main/java/dev/financial/app/testing/internal/MockSources.java) | Fixed internal endpoints, shared control key and bounded timeouts; failed pause prevents reset. |
| [ResetAudit.java](../backend/src/main/java/dev/financial/app/testing/internal/ResetAudit.java) | Explicit actor/time/count audit row for destructive demo reset. |
| [TestEventFactory.java](../backend/src/main/java/dev/financial/app/testing/internal/TestEventFactory.java) | Pure deterministic envelopes per provider; repeated request IDs preserve business references and facts. |
| [TestEventRequest.java](../backend/src/main/java/dev/financial/app/testing/internal/TestEventRequest.java) | Bean Validation bounds scenario fields and batch size before publication. |
| [TestingController.java](../backend/src/main/java/dev/financial/app/testing/internal/TestingController.java) | Demo-only operator endpoints; validated batches, interval bounds and exact reset confirmation. |
| [TestingRepository.java](../backend/src/main/java/dev/financial/app/testing/internal/TestingRepository.java) | Owns reset audit writes; one intentional read-only cross-module diagnostic projection, documented below. |
| [TestingService.java](../backend/src/main/java/dev/financial/app/testing/internal/TestingService.java) | Coordinates pause, offsets, reset transaction and partial Kafka receipts; reset mutations now call module APIs; restores interrupt flag. |
| [package-info.java](../backend/src/main/java/dev/financial/app/testing/package-info.java) | Declares the module and allowed dependencies; verified by Spring Modulith architecture tests. |

### transactions

| File | Review decision |
| --- | --- |
| [CategorizedTransaction.java](../backend/src/main/java/dev/financial/app/transactions/CategorizedTransaction.java) | Versioned immutable integration event; financial identity remains transaction ID. |
| [CategorizedPublisher.java](../backend/src/main/java/dev/financial/app/transactions/internal/CategorizedPublisher.java) | Durable Modulith listener waits for Kafka acknowledgement; retries incomplete publications and skips reset-deleted rows. |
| [CategoryRepository.java](../backend/src/main/java/dev/financial/app/transactions/internal/CategoryRepository.java) | Reference-data read repository; category membership validated before rule activation. |
| [DashboardRepository.java](../backend/src/main/java/dev/financial/app/transactions/internal/DashboardRepository.java) | Spring Data JDBC projections for exact totals, SAST activity, category spend and receipt-time arrivals; scope and cutoff on every query. |
| [HistoryRepository.java](../backend/src/main/java/dev/financial/app/transactions/internal/HistoryRepository.java) | One bounded account/time aggregation; lower bound exclusive, upper bound inclusive, observation cutoff explicit. |
| [StoredTransaction.java](../backend/src/main/java/dev/financial/app/transactions/internal/StoredTransaction.java) | Immutable row mapping; independent aggregate with no child-collection rewrite. |
| [TransactionCategorizer.java](../backend/src/main/java/dev/financial/app/transactions/internal/TransactionCategorizer.java) | Small deterministic direction/MCC/description rules with an explicit fallback; version retained with each transaction. |
| [TransactionController.java](../backend/src/main/java/dev/financial/app/transactions/internal/TransactionController.java) | HTTP parameters map to one filter record; aliases reuse the same query service. |
| [TransactionExport.java](../backend/src/main/java/dev/financial/app/transactions/internal/TransactionExport.java) | Single bounded CSV use case; repeatable-read account mapping, exact amounts, quoted fields and formula neutralisation. No SQL or unbounded streaming in the service. |
| [TransactionReports.java](../backend/src/main/java/dev/financial/app/transactions/internal/TransactionReports.java) | Repository fragment contract names scope and report operations explicitly. |
| [TransactionReportsImpl.java](../backend/src/main/java/dev/financial/app/transactions/internal/TransactionReportsImpl.java) | Bound parameters and allowlisted grouping; literal substring search escapes no SQL or wildcard syntax, amount predicates shared by all reports. |
| [TransactionRepository.java](../backend/src/main/java/dev/financial/app/transactions/internal/TransactionRepository.java) | Spring Data JDBC aggregate repository plus reporting fragment; atomic conflict detection and owner-local reset writes. |
| [package-info.java](../backend/src/main/java/dev/financial/app/transactions/package-info.java) | Declares the module and allowed dependencies; verified by Spring Modulith architecture tests. |
| [PaymentDetails.java](../backend/src/main/java/dev/financial/app/transactions/PaymentDetails.java) | Constructor validation protects booked payment facts; masked instruments and explicit missing legacy context. |
| [TransactionDashboard.java](../backend/src/main/java/dev/financial/app/transactions/TransactionDashboard.java) | Public transaction reporting contract; bounded aggregate records, empty-scope handling and no write ownership. |
| [TransactionDemoReset.java](../backend/src/main/java/dev/financial/app/transactions/TransactionDemoReset.java) | New demo-only module API owns transaction/publication deletion inside the reset transaction. |
| [TransactionHistory.java](../backend/src/main/java/dev/financial/app/transactions/TransactionHistory.java) | Validates categorized facts against stored facts; exposes bounded history without exposing repositories. |
| [TransactionQueries.java](../backend/src/main/java/dev/financial/app/transactions/TransactionQueries.java) | Authorization and common date/text/exact-amount bounds; list, totals, groups and bounded export share one scope. Cursor fingerprint includes every filter. |
| [TransactionWriter.java](../backend/src/main/java/dev/financial/app/transactions/TransactionWriter.java) | Refactored into accept, fingerprint, record construction, replay validation and publication; hash compatibility preserved. |

### mock-sources

| File | Review decision |
| --- | --- |
| [SourceApplication.java](../mock-sources/src/main/java/dev/financial/sources/SourceApplication.java) | Separate mock-source Boot process; startup seeding delegates to publisher. |
| [SourceControlController.java](../mock-sources/src/main/java/dev/financial/sources/SourceControlController.java) | Fixed control contract with constant-time key check; no public host port. |
| [SourcePublisher.java](../mock-sources/src/main/java/dev/financial/sources/SourcePublisher.java) | Three explicit synthetic contracts, synchronized pause/emission and bounded Kafka waits; runtime settings reset on restart. |

### frontend/shared

| File | Review decision |
| --- | --- |
| [account-filter.tsx](../frontend/src/components/account-filter.tsx) | URL-backed optional account filter clears pagination; never silently selects the first account. |
| [app-shell.tsx](../frontend/src/components/app-shell.tsx) | Session/account context and grouped responsive navigation; shared brand, avatar and current-page breadcrumb. Auth transitions clear financial caches. |
| [feedback.tsx](../frontend/src/components/feedback.tsx) | Shared error, empty and shadcn skeleton states; presentational only. |
| [filter-panel.tsx](../frontend/src/components/filter-panel.tsx) | One shared responsive shadcn Collapsible; mobile filters expand on demand while desktop controls remain visible, without duplicating forms or IDs. |
| [live-updates.tsx](../frontend/src/components/live-updates.tsx) | Shared truthful polling status, successful-read timestamp, pause/resume and explicit refresh controls; no provider-health claim. |
| [page-skeleton.tsx](../frontend/src/components/page-skeleton.tsx) | New accessible page-shaped shadcn skeleton while route queries load. |
| [route-error.tsx](../frontend/src/components/route-error.tsx) | New route error boundary resets Query errors and invalidates Router for a real retry. |
| [transaction-detail.tsx](../frontend/src/components/transaction-detail.tsx) | On-demand detail query and shared payment facts in a shadcn sheet; technical metadata stays out of the normal view. |

### frontend/fraud

| File | Review decision |
| --- | --- |
| [page.tsx](../frontend/src/features/fraud/page.tsx) | URL-scoped account/date/review/priority filtering, selectable review rows, pause/retry and cursor navigation. |
| [queries.ts](../frontend/src/features/fraud/queries.ts) | Single shared fraud-page query definition; cursor pages stop polling. |
| [review-sheet.tsx](../frontend/src/features/fraud/review-sheet.tsx) | Original rule evidence and payment context remain distinct from operator outcome/note; successful review invalidates affected report caches. |

### frontend/fraud-rules

| File | Review decision |
| --- | --- |
| [page.tsx](../frontend/src/features/fraud-rules/page.tsx) | Operator guard, local draft and optimistic version save; dirty badge, discard, guarded navigation and reload disabled while dirty. |
| [queries.ts](../frontend/src/features/fraud-rules/queries.ts) | Explicitly refreshed configuration; focus/reconnect reload disabled so background reads cannot destroy drafts. |
| [rule-card.tsx](../frontend/src/features/fraud-rules/rule-card.tsx) | Explicit shadcn field controls per condition; shared cached categories; no dynamic form framework. |
| [rule-summary.ts](../frontend/src/features/fraud-rules/rule-summary.ts) | Exhaustive typed condition presentation; actual thresholds/windows visible before opening the editor. |
| [types.ts](../frontend/src/features/fraud-rules/types.ts) | Typed condition union, configuration shape and readable field/condition descriptions. |
| [unsaved-changes.tsx](../frontend/src/features/fraud-rules/unsaved-changes.tsx) | Router resolver plus browser unload guard; shadcn dialog explicitly keeps edits or discards navigation draft. |

### frontend/overview

| File | Review decision |
| --- | --- |
| [activity-chart.tsx](../frontend/src/features/overview/activity-chart.tsx) | Count/value toggle, labelled credit/debit lines and exact monetary table/tooltip; live animation disabled. |
| [arrival-chart.tsx](../frontend/src/features/overview/arrival-chart.tsx) | Three-source stacked minute chart, zero-filled quiet periods and explicit latest receipt timestamp. |
| [chart-card.tsx](../frontend/src/features/overview/chart-card.tsx) | Shared shadcn card and collapsible data-table composition; chart-specific content stays in each chart. |
| [chart-data.ts](../frontend/src/features/overview/chart-data.ts) | Pure SAST bucket filling; receipt and occurrence time kept separate; Number conversion only for geometry. |
| [fraud-chart.tsx](../frontend/src/features/overview/fraud-chart.tsx) | Disjoint fraud state chart with labelled counts, neutral pending and date-scoped review link; optional-module guard. |
| [page.tsx](../frontend/src/features/overview/page.tsx) | Single Suspense report, URL filters, pause/focus/reconnect policy, stale-refresh error visibility and drilldown composition. |
| [queries.ts](../frontend/src/features/overview/queries.ts) | Typed bounded report, account/period query identity, shared loader and component query with cancellation. |
| [skeleton.tsx](../frontend/src/features/overview/skeleton.tsx) | Accessible overview-shaped loading state using installed shadcn skeletons. |
| [spending-chart.tsx](../frontend/src/features/overview/spending-chart.tsx) | Ranked spending projection, exact tooltip/table values, category/date/account drilldowns and honest empty state. |

### frontend/statements

| File | Review decision |
| --- | --- |
| [link-manager.tsx](../frontend/src/features/statements/link-manager.tsx) | On-demand authorized metadata sheet with skeleton, retryable query, paging, live expiry and server-confirmed revocation; no reconstructed secrets. |
| [page.tsx](../frontend/src/features/statements/page.tsx) | Authorized upload and short-lived delivery; link manager composes persistent grant revocation while issued secrets remain local to the current screen. |
| [queries.ts](../frontend/src/features/statements/queries.ts) | Shared statement query includes account and cursor in cache identity. |

### frontend/testing

| File | Review decision |
| --- | --- |
| [api-explorer.tsx](../frontend/src/features/testing/api-explorer.tsx) | Explicit authenticated report requests; shared text/amount filter contract, response status/timing and cursor inspection confined to testing. |
| [event-composer.tsx](../frontend/src/features/testing/event-composer.tsx) | Scenario presets and editable explicit fields; replay reuses exact request; completed results/evidence stop polling. |
| [live-transactions.tsx](../frontend/src/features/testing/live-transactions.tsx) | Independent latest-ten polling with true pause/resume and shared detail sheet. |
| [stream-controls.tsx](../frontend/src/features/testing/stream-controls.tsx) | Separate source status, configuration and destructive reset mutations; explicit confirmation and failure visibility. |
| [types.ts](../frontend/src/features/testing/types.ts) | Typed event requests, acknowledgements and observed outcomes. |
| [workspace.tsx](../frontend/src/features/testing/workspace.tsx) | Operator/demo guard; local tabs organize independent diagnostic workflows; resets remount stale scenario state. |

### frontend/transactions

| File | Review decision |
| --- | --- |
| [export-button.tsx](../frontend/src/features/transactions/export-button.tsx) | Shared report filters and API error handling; user-triggered bounded blob download with pending state and object URL cleanup. |
| [page.tsx](../frontend/src/features/transactions/page.tsx) | Parallel report queries, shared filters, totals, export, cursor table and payment sheet. Search/export responsibilities extracted into small feature components. |
| [queries.ts](../frontend/src/features/transactions/queries.ts) | Shared query keys/functions for loaders and components; abort signals, reference-data caching and first-page polling. |
| [search-form.tsx](../frontend/src/features/transactions/search-form.tsx) | Focused submitted text/amount form; Router stores applied filters and resets cursor. Exact decimal input remains a string. |

### frontend/shared

| File | Review decision |
| --- | --- |
| [use-mobile.ts](../frontend/src/hooks/use-mobile.ts) | shadcn sidebar media-query hook with listener cleanup. |
| [index.css](../frontend/src/index.css) | Semantic brand/surface/text/chart/selection tokens and shared primitive styling; no feature-level brand hex colours. |
| [api.ts](../frontend/src/lib/api.ts) | One same-origin transport handles CSRF and ProblemDetail/session failures; JSON and CSV callers share response validation. |
| [dates.ts](../frontend/src/lib/dates.ts) | Small explicit calendar-shift and South African date helpers. |
| [labels.ts](../frontend/src/lib/labels.ts) | Small presentation-label helper; no internal IDs converted into business decisions. |
| [query-client.ts](../frontend/src/lib/query-client.ts) | Single QueryClient with explicit freshness, retry and focus policy. |
| [search.ts](../frontend/src/lib/search.ts) | Small URL filter whitelist, retaining exact string amounts entered through the UI and accepting numeric URL values. |
| [session-queries.ts](../frontend/src/lib/session-queries.ts) | Shared session and username-keyed account queries with abort support; anonymous 401 maps to null. |
| [types.ts](../frontend/src/lib/types.ts) | Shared server DTO types; money stays a string and nullable payment facts stay explicit. |
| [utils.ts](../frontend/src/lib/utils.ts) | Standard shadcn class-name merge helper. |
| [main.tsx](../frontend/src/main.tsx) | React/Query/Router bootstrap only. |
| [router.tsx](../frontend/src/router.tsx) | Generated route tree, intent preloading, Query cache ownership, pending/error defaults and scroll restoration. |
| [__root.tsx](../frontend/src/routes/__root.tsx) | Root session-before-load, account loader and shared boundaries; feature loaders run independent reads in parallel. |
| [fraud-rules.tsx](../frontend/src/routes/fraud-rules.tsx) | File route preloads operator configuration and categories together. |
| [fraud.tsx](../frontend/src/routes/fraud.tsx) | File route preloads only when fraud is enabled; search drives loader dependencies. |
| [index.tsx](../frontend/src/routes/index.tsx) | Canonical root redirect before page rendering. |
| [overview.tsx](../frontend/src/routes/overview.tsx) | File route uses the shared report query and overview-shaped Suspense skeleton; chart component chunk is lazy. |
| [statements.tsx](../frontend/src/routes/statements.tsx) | File route preloads scoped page only when statements are enabled. |
| [testing.tsx](../frontend/src/routes/testing.tsx) | File route lazily loads the workspace; diagnostics fetch only for mounted controls. |
| [transactions.tsx](../frontend/src/routes/transactions.tsx) | File route starts list/summary/categories together using shared query definitions. |
