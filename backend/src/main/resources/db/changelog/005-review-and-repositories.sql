--liquibase formatted sql
--changeset finance:005
alter table fraud_evaluation add column account_id uuid references account(id);
update fraud_evaluation e set account_id = s.account_id
from financial_transaction t join source_account s on s.id = t.source_account_id
where t.id = e.transaction_id;
alter table fraud_evaluation alter column account_id set not null;
create index fraud_account_completed on fraud_evaluation(account_id, completed_at desc, id desc);
create table fraud_review (
  transaction_id uuid primary key references fraud_evaluation(transaction_id),
  reviewed_by varchar(100) not null,
  note varchar(1000) not null,
  reviewed_at timestamptz not null
);
alter table statement add column version bigint not null default 0;
alter table download_grant add column version bigint not null default 0;
