--liquibase formatted sql
--changeset finance:008
create index transaction_received on financial_transaction(source_account_id,recorded_at desc);
