--liquibase formatted sql
--changeset finance:001
CREATE TABLE users (username VARCHAR(100) PRIMARY KEY, password VARCHAR(200) NOT NULL, enabled BOOLEAN NOT NULL);
CREATE TABLE authorities (username VARCHAR(100) NOT NULL REFERENCES users(username), authority VARCHAR(50) NOT NULL, PRIMARY KEY(username, authority));
CREATE TABLE customer (id UUID PRIMARY KEY, auth_subject VARCHAR(100) UNIQUE NOT NULL, display_name VARCHAR(120) NOT NULL);
CREATE TABLE account (id UUID PRIMARY KEY, customer_id UUID NOT NULL REFERENCES customer(id), masked_number VARCHAR(20) NOT NULL, currency CHAR(3) NOT NULL CHECK(currency='ZAR'));
CREATE INDEX account_customer_idx ON account(customer_id,id);
CREATE TABLE source_account (id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES account(id), source_code VARCHAR(40) NOT NULL, external_account_ref VARCHAR(100) NOT NULL, UNIQUE(source_code, external_account_ref));
CREATE INDEX source_account_account_idx ON source_account(account_id,id);
CREATE TABLE category (code VARCHAR(40) PRIMARY KEY, display_name VARCHAR(60) NOT NULL);
INSERT INTO category VALUES ('INCOME','Income'),('GROCERIES','Groceries'),('SHOPPING','Shopping'),('TRANSPORT','Transport'),('SUBSCRIPTIONS','Subscriptions'),('UNCATEGORIZED','Uncategorized');
CREATE TABLE financial_transaction (
 id UUID PRIMARY KEY, source_account_id UUID NOT NULL REFERENCES source_account(id),
 source_transaction_ref VARCHAR(150) NOT NULL, amount NUMERIC(19,2) NOT NULL CHECK(amount>0),
 currency CHAR(3) NOT NULL CHECK(currency='ZAR'), direction VARCHAR(6) NOT NULL CHECK(direction IN ('DEBIT','CREDIT')),
 description VARCHAR(200) NOT NULL, category_code VARCHAR(40) NOT NULL REFERENCES category(code),
 categorizer_version VARCHAR(20) NOT NULL, input_hash VARCHAR(64) NOT NULL, first_event_id VARCHAR(150) NOT NULL,
 origin_topic VARCHAR(200) NOT NULL, origin_partition INT NOT NULL, origin_offset BIGINT NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(source_account_id,source_transaction_ref));
CREATE INDEX transaction_page_idx ON financial_transaction(source_account_id,occurred_at DESC,id DESC);
CREATE TABLE event_publication (
 id UUID PRIMARY KEY, listener_id TEXT NOT NULL, event_type TEXT NOT NULL, serialized_event TEXT NOT NULL,
 publication_date TIMESTAMP WITH TIME ZONE NOT NULL, completion_date TIMESTAMP WITH TIME ZONE);
CREATE INDEX event_publication_incomplete_idx ON event_publication(publication_date) WHERE completion_date IS NULL;
CREATE TABLE fraud_evaluation (
 id UUID PRIMARY KEY, transaction_id UUID NOT NULL REFERENCES financial_transaction(id), ruleset_version VARCHAR(20) NOT NULL,
 outcome VARCHAR(20) NOT NULL CHECK(outcome IN ('FLAGGED','NOT_FLAGGED')),
 completed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(), UNIQUE(transaction_id,ruleset_version));
CREATE TABLE rule_result (
 id UUID PRIMARY KEY, evaluation_id UUID NOT NULL REFERENCES fraud_evaluation(id), rule_code VARCHAR(50) NOT NULL,
 rule_version VARCHAR(20) NOT NULL, result VARCHAR(20) NOT NULL, criteria_snapshot JSONB NOT NULL,
 observed_values JSONB NOT NULL, explanation VARCHAR(500) NOT NULL, UNIQUE(evaluation_id,rule_code));
CREATE TABLE statement (
 id UUID PRIMARY KEY, account_id UUID NOT NULL REFERENCES account(id), storage_key VARCHAR(100) UNIQUE NOT NULL,
 filename VARCHAR(150) NOT NULL, size_bytes BIGINT NOT NULL CHECK(size_bytes>0), sha256 VARCHAR(64) NOT NULL,
 status VARCHAR(20) NOT NULL CHECK(status IN ('STAGING','AVAILABLE','FAILED')),
 uploaded_by VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp());
CREATE INDEX statement_account_idx ON statement(account_id,created_at DESC,id DESC);
CREATE TABLE download_grant (
 id UUID PRIMARY KEY, statement_id UUID NOT NULL REFERENCES statement(id), token_hash VARCHAR(64) UNIQUE NOT NULL,
 issued_by VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ, CHECK(expires_at>created_at));
CREATE INDEX download_grant_expiry_idx ON download_grant(expires_at);
