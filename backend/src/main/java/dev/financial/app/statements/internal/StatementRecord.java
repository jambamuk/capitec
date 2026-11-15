package dev.financial.app.statements.internal;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.relational.core.mapping.Table;

@Table("statement")
public record StatementRecord(
    @Id UUID id,
    UUID accountId,
    String storageKey,
    String filename,
    long sizeBytes,
    String sha256,
    String status,
    String uploadedBy,
    Instant createdAt,
    @Version Long version) {}
