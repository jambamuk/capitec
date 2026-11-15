package dev.financial.app.fraud.internal.persistence;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("fraud_evaluation")
public record EvaluationRecord(
    @Id UUID id,
    UUID transactionId,
    UUID accountId,
    String rulesetVersion,
    String outcome,
    String severity,
    Instant completedAt,
    Instant evidenceAsOf) {}
