--liquibase formatted sql
--changeset finance:006
-- Modulith persists listener identifiers. Keep pending publications deliverable after moving the adapter.
update event_publication
set listener_id = 'dev.financial.app.transactions.internal.CategorizedPublisher.publish(dev.financial.app.transactions.CategorizedTransaction)'
where listener_id = 'dev.financial.app.transactions.CategorizedPublisher.publish(dev.financial.app.transactions.CategorizedTransaction)';
