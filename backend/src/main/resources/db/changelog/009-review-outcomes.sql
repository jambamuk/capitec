--liquibase formatted sql
--changeset financial:009-review-outcomes
alter table fraud_review add column outcome varchar(16) not null default 'REVIEWED';
alter table fraud_review add constraint fraud_review_outcome_valid
  check (outcome in ('REVIEWED', 'CLEARED', 'ESCALATED'));
create index download_grant_active_statement on download_grant(statement_id, created_at desc, id desc)
  where revoked_at is null;
