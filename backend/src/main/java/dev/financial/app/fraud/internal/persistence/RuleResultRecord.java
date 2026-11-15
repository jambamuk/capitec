package dev.financial.app.fraud.internal.persistence;

import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("rule_result")
public record RuleResultRecord(
    @Id UUID id,
    UUID evaluationId,
    String ruleCode,
    String ruleVersion,
    String result,
    String criteriaSnapshot,
    String observedValues,
    String explanation) {}
