package dev.financial.app.transactions.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("financial_transaction")
public record StoredTransaction(
    @Id UUID id,
    UUID sourceAccountId,
    String sourceTransactionRef,
    BigDecimal amount,
    String currency,
    String direction,
    String description,
    String categoryCode,
    String categorizerVersion,
    String inputHash,
    String firstEventId,
    String originTopic,
    int originPartition,
    long originOffset,
    Instant occurredAt,
    Instant recordedAt,
    String paymentDetails) {}
