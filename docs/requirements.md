# Assessment coverage

The submitted primary project is **1. Transaction Aggregation API**. Projects 2 and 3 are implemented as optional modules in the same repository. This preserves the assessment instruction to choose one project while demonstrating the complete connected workflow. Disable the extensions with `compose.core.yaml` to run the primary project independently.

## Requirements and evidence

| Brief requirement | Delivered capability | Executable evidence |
| --- | --- | --- |
| Multiple mock financial sources | Three independently running Java providers, three Kafka topics, decimal/minor-unit/signed contracts, continuous events, pause/rate controls | `application.spec.js`: three-source totals, malformed/conflicting events, test batches; `live.js`: live browser updates from all sources |
| Aggregate and categorize transactions | Source-account normalization, exact BigDecimal values, versioned MCC/description categorization, UNCATEGORIZED fallback, all authorized accounts by default | Java normalizer/categorizer tests; acceptance exact totals and category/source/direction filters |
| Extensive retrieval API | Customer/account discovery, scoped transaction list/detail, cursor pagination, summaries, six breakdown dimensions, literal reference/description search, exact amount ranges, bounded CSV export, OpenAPI and API explorer | Acceptance pagination, authorization, matching list/summary/group/export filters, formula neutralisation and explorer scenarios |
| Live overview and investigation | Consistent scoped report, period/account filters, four chart forms, exact-value tables, date-preserving drilldowns and pause/resume | Overview reconciliation, pending/late-payment/account-isolation scenarios; live source/browser checks; mobile and refresh-outage checks |
| Process categorized events for fraud | Separate categorized Kafka consumer; seven configurable condition types covering amount, merchant, category, rolling count/amount, new beneficiary and foreign ecommerce | Pure rule boundary tests and real Kafka contextual/window scenarios |
| Apply and store per-transaction criteria | Enabled/direction/threshold/window/severity settings; atomic version activation; immutable decision, criteria, observed facts and explanations for every rule | Invalid/stale rule saves, immutable revision lookup, duplicate/replay and original-evidence assertions |
| Retrieve fraud data | Scoped cursor list, review-state/priority filters, detail/evidence API, flagged-row sheet and one recorded operator review with outcome | Acceptance review ownership, duplicate/conflict handling, original-evidence preservation, priority filter and outcome interaction |
| Store PDF account statements | Authorized operator upload, 10 MB bound, readable unencrypted PDF validation, private persistent volume, metadata/checksum, paginated customer access | API/browser upload, invalid PDF rejection, storage cleanup/checksum tests and cross-customer isolation |
| Secure time-limited links | 256-bit random tokens, hash-only persistence, authorized issuance/revocation, active-link metadata pages, server-side expiry, attachment/no-store response | Anonymous redemption, tampering, expiry, revocation after reload, no-token metadata listing and customer isolation |
| Runnable Dockerfile | Multi-stage Java/frontend build, non-root runtime; same-origin SPA embedded in Spring Boot | Full suite builds and starts the Dockerfile runtime through Compose |
| Build/run/test README | Docker-only setup, credentials, isolated tests, contracts, architecture/ERD, ownership and operational limits | Commands in README and `scripts/verify.ps1` / `verify.sh` |
| GitHub link | Single local repository is prepared for submission | **Not published:** there is no configured Git remote or submission URL yet |

All acceptance references above are in [`e2e/tests/application.spec.js`](../e2e/tests/application.spec.js); additional checks are in [`e2e`](../e2e). Current execution results and artifact paths are recorded in [`verification.json`](verification.json). The [business-code review](business-code-review.md) lists the owner and review decision for every handwritten production source file in scope.

## Reliability claim

The implementation has tested behaviour for duplicate delivery, conflicting provider identity, invalid-event quarantine, application restart, a database outage, reset/replay cutoffs, optimistic configuration conflicts, authorization, bounded input, and download expiry/revocation. It uses Spring Data JDBC, Liquibase and Spring Modulith with architecture tests. The frontend is a file-routed TanStack Router/Query SPA with route preloading, Suspense, skeletons and retry handling.

This supports the three feature briefs. It does not establish bank-scale production readiness: throughput and high availability have not been benchmarked, window evidence includes committed available history rather than watermark-complete source history, and source feeds are deliberately disjoint. The demo uses one application instance, one broker, local PDF storage and local sessions/rate limits. Managed identity, TLS/secrets, redundant infrastructure, backup/restore, malware scanning and deployment-specific retention/alerting remain rollout concerns documented in the README. PDF parsing does not replace malware scanning, and fraud flags request review rather than authorizing or reversing payments.
