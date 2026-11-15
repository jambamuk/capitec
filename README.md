# Transaction aggregation

A Java assessment application that combines transactions from three financial providers into one searchable account view. The primary submission is **Project 1: Transaction Aggregation API**. Fraud review and secure PDF statements are optional extensions.

## Run

Install Docker with Compose 2.24.4 or newer, then run:

```sh
docker compose up --build -d --wait
```

Open [localhost:8080](http://localhost:8080). The first build downloads Java and frontend dependencies; allow about 6 GB of Docker memory.

| Username | Password | Access |
| --- | --- | --- |
| `operator` | `operator-demo` | All demo accounts, fraud reviews/rules and statement uploads |
| `amina` | `customer-demo` | Amina's account information and statements |
| `ben` | `customer-demo` | Ben's account information and statements |

These identities and transactions are synthetic. Copy [.env.example](.env.example) to `.env` to change local settings. Existing database users retain their passwords until explicitly changed. The application binds to localhost; PostgreSQL and Kafka are private to the Compose network.

The workspace provides an overview, transaction search/filtering and CSV export, fraud checks with review notes, and statement download links. Technical diagnostics and event-generation controls are available through the operator API, outside the user interface.

To run only the primary assessment:

```sh
docker compose -f compose.yaml -f compose.core.yaml up --build -d --wait
```

## Documentation

- [Architecture](docs/architecture.md): stack choices, modules, processing, security and scaling boundaries.
- [Data model and ERDs](docs/data-model.md): transaction, fraud and statement relationships.
- [API contracts](docs/contracts.md): source events, retrieval, rules and document delivery.
- [Assessment coverage](docs/requirements.md): requirements mapped to implementation and tests.

The authenticated operator can use [OpenAPI](http://localhost:8080/api-docs). Copyable request fixtures are in [docs/examples](docs/examples/).

## Verify

Run the isolated Docker suite (it creates and removes its own test volumes):

```powershell
pwsh -NoProfile -File scripts/verify.ps1
```

Linux/macOS: `sh scripts/verify.sh`. The suite covers Java unit/module tests, browser/API workflows, Kafka replay, application/database recovery, continuous sources and the core-only configuration. CI runs the same script. Logs and screenshots are written to ignored `test-results/`; GitHub Actions retains the results as artifacts.

For frontend-only changes, run `npm ci`, then `npm run lint`, `npm run format:check`, `npm test` and `npm run build` in `frontend/` (use `npm.cmd` in Windows PowerShell).

## Repository

```text
backend/       Spring Boot modules, schema migrations and Java tests
frontend/      React application, shared UI and frontend tests
mock-sources/  Three independently running provider simulators
e2e/           Playwright, API and recovery tests
scripts/       Verification and API inspection commands
docs/          Architecture, ERDs, contracts and assessment mapping
```

Use `docker compose logs --tail=100 app` to investigate startup or processing failures. If no transactions appear, check the date filters and `docker compose logs bank-source card-source wallet-source`. Set `APP_PORT` if 8080 is occupied. `docker compose down` stops the application while retaining data; adding `--volumes` deletes that project's data.

This is an independent assessment application, not an official Capitec product. The included logo and visual styling reference Capitec's public branding. The deployment is a single-instance demonstration; production limits are explicit in the architecture guide.
