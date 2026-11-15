# Assessment coverage

Primary submission: **Project 1 - Transaction Aggregation API**. Fraud processing and PDF delivery are optional extensions, disabled with `compose.core.yaml`.

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Multiple financial sources | Three independent Java simulators, Kafka topics and provider adapters | Normalizer tests; three-source and continuous-event acceptance |
| Aggregate and categorize | Exact decimals, provider identity constraints, MCC/description categorization and fallback | Categorizer tests; exact totals, duplicate and conflicting-event scenarios |
| Retrieval API | Account-scoped lists/details, date/category/source filters, keyset pages, search, summary, breakdowns and CSV | Ownership, pagination, filter consistency and export tests |
| User interface | Overview, searchable transactions, fraud investigation/rules and statements; no developer console | Desktop/mobile workflows, navigation, loading/recovery and diagnostic-disclosure regression |
| Fraud extension | Seven typed rule conditions, immutable revision/evidence and recorded review outcomes | Rule boundary tests; window, replay, conflict and review acceptance |
| Statement extension | Bounded private PDF upload, hashed short-lived tokens and revocation | PDF validation, ownership, tampering, expiry and revocation tests |
| Reproducible delivery | Multi-stage non-root image, Compose, migrations and isolated CI suite | `scripts/verify.ps1` / `scripts/verify.sh` |
| Documentation | Setup, architecture/stack decisions, ERDs and API contracts | Linked from README; schema and OpenAPI remain authoritative |

Executable acceptance scenarios are in [e2e/tests/application.spec.js](../e2e/tests/application.spec.js); recovery and live checks are in [e2e](../e2e/). Java tests live under [backend/src/test](../backend/src/test/). The [private repository](https://github.com/jambamuk/capitec) requires reviewer access.

See [architecture limits](architecture.md#capacity-and-scaling) for single-instance deployment, available-history fraud semantics and unbenchmarked capacity.
