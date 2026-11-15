package dev.financial.app.transactions;

import com.fasterxml.jackson.annotation.JsonFormat;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CategorizedTransaction(
    UUID eventId,
    int schemaVersion,
    UUID transactionId,
    UUID accountId,
    @JsonFormat(shape = JsonFormat.Shape.STRING) BigDecimal amount,
    String currency,
    String direction,
    String description,
    String category,
    String categorizerVersion,
    String rulesetVersion,
    Instant occurredAt) {}
