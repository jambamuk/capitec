package dev.financial.app.fraud.internal.persistence;

import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("fraud_ruleset")
public record StoredRuleset(@Id Long version, String rules, String createdBy, Instant createdAt) {}
