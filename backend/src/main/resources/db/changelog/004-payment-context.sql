--liquibase formatted sql
--changeset demo:004-payment-context
alter table financial_transaction add column payment_details jsonb;
alter table fraud_evaluation add column severity varchar(10) not null default 'NONE';
alter table fraud_evaluation add column evidence_as_of timestamptz;
create index transaction_velocity on financial_transaction(source_account_id,direction,occurred_at) include(amount);
update fraud_evaluation set severity='MEDIUM' where outcome='FLAGGED';
-- Only advance the untouched starter configuration. Operator-authored versions remain active.
with upgraded as (
  insert into fraud_ruleset(rules,created_by)
  select r.rules || '[
    {"code":"RAPID_PAYMENTS","name":"Rapid outgoing payments","type":"VELOCITY_COUNT","enabled":true,"direction":"DEBIT","windowMinutes":5,"countThreshold":8,"severity":"HIGH"},
    {"code":"SPEND_WINDOW","name":"High cumulative spend","type":"VELOCITY_AMOUNT","enabled":true,"direction":"DEBIT","windowMinutes":60,"amount":"50000.00","severity":"HIGH"},
    {"code":"NEW_BENEFICIARY","name":"Large payment to a new beneficiary","type":"NEW_BENEFICIARY_PAYMENT","enabled":true,"direction":"DEBIT","windowMinutes":60,"amount":"5000.00","severity":"HIGH"},
    {"code":"FOREIGN_ONLINE","name":"Large overseas online purchase","type":"FOREIGN_ONLINE_PAYMENT","enabled":true,"direction":"DEBIT","matchValue":"ZA","amount":"2500.00","severity":"MEDIUM"}
  ]'::jsonb,'system:payment-context'
  from fraud_ruleset r join fraud_rule_configuration c on c.active_version=r.version
  where c.id=1 and r.version=1
  returning version
)
update fraud_rule_configuration set active_version=upgraded.version from upgraded where id=1;

--changeset demo:004-source-accounts context:demo
insert into source_account(id,account_id,source_code,external_account_ref) values
 ('30000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000002','CARD_PROCESSOR','card-account-2075'),
 ('30000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000002','WALLET_PROVIDER','wallet-account-2075');
