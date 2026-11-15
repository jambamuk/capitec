package dev.financial.app.testing.internal;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

@Table("demo_reset_audit")
record ResetAudit(@Id UUID id, String resetBy, Instant resetAt, long removedTransactions) {}
