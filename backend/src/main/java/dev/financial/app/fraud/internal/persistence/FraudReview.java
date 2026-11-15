package dev.financial.app.fraud.internal.persistence;

import dev.financial.app.fraud.internal.ReviewOutcome;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("fraud_review")
public record FraudReview(
    @Id UUID transactionId,
    String reviewedBy,
    String note,
    Instant reviewedAt,
    ReviewOutcome outcome) {}
