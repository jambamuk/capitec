--liquibase formatted sql
--changeset finance:003
CREATE TABLE fraud_ruleset (
 version BIGSERIAL PRIMARY KEY,
 rules JSONB NOT NULL,
 created_by VARCHAR(100) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO fraud_ruleset(rules,created_by) VALUES
('[{"code":"HIGH_VALUE_DEBIT","name":"High value debit","type":"AMOUNT_GREATER_THAN","enabled":true,"direction":"DEBIT","amount":"5000.00","matchValue":null},
   {"code":"RESTRICTED_MERCHANT","name":"Restricted merchant","type":"MERCHANT_EQUALS","enabled":true,"direction":"DEBIT","amount":null,"matchValue":"Restricted Shop"}]','system');
CREATE TABLE fraud_rule_configuration (
 id SMALLINT PRIMARY KEY CHECK(id=1),
 active_version BIGINT NOT NULL REFERENCES fraud_ruleset(version)
);
INSERT INTO fraud_rule_configuration VALUES(1,1);
-- One decision per transaction. Replaying an event must not silently apply a newer configuration.
CREATE UNIQUE INDEX fraud_one_evaluation_per_transaction ON fraud_evaluation(transaction_id);
