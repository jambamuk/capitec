# Data model

The [Liquibase migrations](../backend/src/main/resources/db/changelog/) are the schema source of truth. Diagrams show business fields; framework and maintenance tables are listed below.

## Transactions

```mermaid
erDiagram
    CUSTOMER ||--o{ ACCOUNT : owns
    ACCOUNT ||--o{ SOURCE_ACCOUNT : maps_to
    SOURCE_ACCOUNT ||--o{ FINANCIAL_TRANSACTION : supplies
    CATEGORY ||--o{ FINANCIAL_TRANSACTION : classifies

    CUSTOMER {
        uuid id PK
        varchar auth_subject UK
        varchar display_name
    }
    ACCOUNT {
        uuid id PK
        uuid customer_id FK
        varchar masked_number
        char currency
    }
    SOURCE_ACCOUNT {
        uuid id PK
        uuid account_id FK
        varchar source_code "unique with external_account_ref"
        varchar external_account_ref
    }
    CATEGORY {
        varchar code PK
        varchar display_name
    }
    FINANCIAL_TRANSACTION {
        uuid id PK
        uuid source_account_id FK
        varchar source_transaction_ref "unique with source_account_id"
        decimal amount "positive NUMERIC(19,2), ZAR initially"
        char currency
        varchar direction "DEBIT or CREDIT"
        varchar description
        varchar category_code FK
        varchar categorizer_version
        varchar input_hash
        varchar first_event_id
        varchar origin_topic
        int origin_partition
        bigint origin_offset
        timestamptz occurred_at
        jsonb payment_details "typed context; null for legacy feed"
        timestamptz recorded_at
    }
```

## Fraud and reviews

```mermaid
erDiagram
    FINANCIAL_TRANSACTION ||--o| FRAUD_EVALUATION : evaluated_under
    FRAUD_RULESET ||--o| FRAUD_RULE_CONFIGURATION : active_revision
    FRAUD_EVALUATION ||--o{ RULE_RESULT : contains
    FRAUD_EVALUATION ||--o| FRAUD_REVIEW : reviewed
    ACCOUNT ||--o{ FRAUD_EVALUATION : scopes

    FINANCIAL_TRANSACTION {
        uuid id PK
    }
    FRAUD_EVALUATION {
        uuid id PK
        uuid transaction_id FK,UK
        uuid account_id FK
        varchar ruleset_version "immutable configuration version retained in decision"
        varchar outcome "FLAGGED or NOT_FLAGGED; missing row means pending"
        varchar severity "NONE LOW MEDIUM HIGH"
        timestamptz evidence_as_of "available-history snapshot cutoff"
        timestamptz completed_at
    }
    RULE_RESULT {
        uuid id PK
        uuid evaluation_id FK
        varchar rule_code "unique with evaluation_id"
        varchar rule_version
        varchar result "MATCHED NOT_MATCHED NOT_APPLICABLE DISABLED INSUFFICIENT_DATA"
        jsonb criteria_snapshot
        jsonb observed_values
        varchar explanation
    }
    FRAUD_RULESET {
        bigint version PK
        jsonb rules "validated definitions, immutable revision"
        varchar created_by
        timestamptz created_at
    }
    FRAUD_RULE_CONFIGURATION {
        smallint id PK "singleton, always 1"
        bigint active_version FK
    }
    FRAUD_REVIEW {
        uuid transaction_id PK,FK
        varchar reviewed_by
        varchar note
        timestamptz reviewed_at
        varchar outcome "REVIEWED, CLEARED or ESCALATED"
    }
```

## Statements and download links

```mermaid
erDiagram
    ACCOUNT ||--o{ STATEMENT : has
    STATEMENT ||--o{ DOWNLOAD_GRANT : authorizes

    ACCOUNT {
        uuid id PK
        uuid customer_id FK
    }
    STATEMENT {
        uuid id PK
        bigint version
        uuid account_id FK
        varchar storage_key UK
        varchar filename
        bigint size_bytes
        varchar sha256
        varchar status "STAGING AVAILABLE FAILED"
        varchar uploaded_by
        timestamptz created_at
    }
    DOWNLOAD_GRANT {
        uuid id PK
        bigint version
        uuid statement_id FK
        varchar token_hash UK
        varchar issued_by
        timestamptz created_at
        timestamptz expires_at
        timestamptz revoked_at "nullable"
    }
```

## Supporting tables

- `users` and `authorities`: Spring Security credentials and roles. `customer.auth_subject` maps a login to its customer.
- `event_publication`: Spring Modulith durable event delivery records.
- `processing_checkpoint` and `demo_reset_audit`: demo reset/replay control and test provenance.

Transaction identity is unique by source account and provider transaction reference. Amounts use positive `NUMERIC(19,2)` with a separate direction. Each transaction has at most one completed fraud evaluation and one review. Statement and download-grant version columns support Spring Data JDBC persistence.
