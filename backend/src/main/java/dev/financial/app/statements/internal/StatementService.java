package dev.financial.app.statements.internal;

import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.platform.PageCursor;
import java.io.IOException;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
@ConditionalOnProperty(name = "app.statements-enabled", havingValue = "true")
public class StatementService {
  public record Document(
      UUID id, UUID accountId, String filename, long sizeBytes, String status, Instant createdAt) {}

  private final StatementRepository repository;
  private final AccountAccess accounts;
  private final PrivateStatementStorage storage;
  private final RequestLimiter limiter;
  private final Clock clock;

  public StatementService(
      StatementRepository repository,
      AccountAccess accounts,
      PrivateStatementStorage storage,
      RequestLimiter limiter,
      Clock clock) {
    this.repository = repository;
    this.accounts = accounts;
    this.storage = storage;
    this.limiter = limiter;
    this.clock = clock;
  }

  public record Page(List<Document> items, String nextCursor, Instant asOf) {}

  public Page list(UUID accountId, int limit, String cursor, Authentication auth) {
    if (limit < 1 || limit > 100)
      throw new IllegalArgumentException("Page size must be between 1 and 100");
    var scope = accounts.scope(accountId, null, auth);
    String fingerprint = Integer.toHexString(Objects.hash("statements", accountId, auth.getName()));
    var position = PageCursor.read(cursor, fingerprint, clock.instant());
    if (scope.isEmpty()) return new Page(List.of(), null, position.asOf());
    var found =
        repository.findPage(
            scope, position.asOf(), position.afterTime(), position.afterId(), limit + 1);
    boolean hasNext = found.size() > limit;
    var page = hasNext ? found.subList(0, limit) : found;
    String next = hasNext ? position.next(page.getLast().createdAt(), page.getLast().id()) : null;
    return new Page(page.stream().map(this::document).toList(), next, position.asOf());
  }

  public Document upload(UUID accountId, MultipartFile file, Authentication auth)
      throws IOException {
    if (auth.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_OPERATOR")))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Only operators can upload statements.");
    accounts.require(accountId, auth);
    limiter.check("upload:" + auth.getName(), 20);
    var staged = storage.stage(file);
    Instant createdAt = clock.instant();
    try {
      repository.save(
          new StatementRecord(
              staged.id(),
              accountId,
              staged.key(),
              staged.filename(),
              staged.size(),
              staged.checksum(),
              "STAGING",
              auth.getName(),
              createdAt,
              null));
      storage.publish(staged);
      repository.completeUpload(staged.id(), "AVAILABLE");
      return new Document(
          staged.id(), accountId, staged.filename(), staged.size(), "AVAILABLE", createdAt);
    } finally {
      try {
        storage.discard(staged);
      } catch (IOException cleanupFailure) {
        // Reconciliation retries abandoned temporary files without hiding the upload's outcome.
        org.slf4j.LoggerFactory.getLogger(StatementService.class)
            .warn("Could not discard staged statement {}", staged.id(), cleanupFailure);
      }
    }
  }

  private Document document(StatementRecord row) {
    return new Document(
        row.id(), row.accountId(), row.filename(), row.sizeBytes(), row.status(), row.createdAt());
  }
}
