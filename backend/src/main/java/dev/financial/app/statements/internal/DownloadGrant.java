package dev.financial.app.statements.internal;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.relational.core.mapping.Table;

@Table("download_grant")
public record DownloadGrant(
    @Id UUID id,
    UUID statementId,
    String tokenHash,
    String issuedBy,
    Instant createdAt,
    Instant expiresAt,
    Instant revokedAt,
    @Version Long version) {}
