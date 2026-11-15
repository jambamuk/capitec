package dev.financial.app.statements.internal;

import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name = "app.statements-enabled", havingValue = "true")
public class StatementMaintenance {
  private final StatementRepository statements;
  private final DownloadGrantRepository grants;
  private final PrivateStatementStorage storage;
  private final RequestLimiter limiter;
  private final Clock clock;

  public StatementMaintenance(
      StatementRepository statements,
      DownloadGrantRepository grants,
      PrivateStatementStorage storage,
      RequestLimiter limiter,
      Clock clock) {
    this.statements = statements;
    this.grants = grants;
    this.storage = storage;
    this.limiter = limiter;
    this.clock = clock;
  }

  @Scheduled(fixedDelay = 60000)
  public void reconcile() throws IOException {
    var cutoff = clock.instant().minus(Duration.ofMinutes(15));
    for (var statement : statements.findStaleUploads(cutoff)) {
      try {
        statements.completeUpload(
            statement.id(),
            storage.matches(statement.storageKey(), statement.sha256()) ? "AVAILABLE" : "FAILED");
      } catch (IOException failure) {
        // A temporary filesystem error must not mark a document failed or block other repairs.
        org.slf4j.LoggerFactory.getLogger(StatementMaintenance.class)
            .warn("Could not reconcile statement {}", statement.id(), failure);
      }
    }
    storage.removeAbandonedUploads(cutoff);
    grants.deleteExpired(clock.instant().minus(Duration.ofDays(7)));
    limiter.removeExpired();
  }
}
