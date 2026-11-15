package dev.financial.app.statements.internal;

import static dev.financial.app.statements.internal.PrivateStatementStorage.unavailable;

import dev.financial.app.accounts.AccountAccess;
import dev.financial.app.platform.AppProperties;
import dev.financial.app.platform.PageCursor;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(name = "app.statements-enabled", havingValue = "true")
public class DownloadLinkService {
  public record Grant(UUID id, String downloadUrl, Instant expiresAt) {}

  public record Download(Path path, String filename, long size) {}

  public record ActiveLinks(
      List<DownloadGrantRepository.ActiveLink> items, String nextCursor, Instant asOf) {}

  public ActiveLinks active(UUID statementId, String cursor, Authentication auth) {
    var statement =
        statements.findById(statementId).orElseThrow(PrivateStatementStorage::unavailable);
    accounts.require(statement.accountId(), auth);
    String fingerprint =
        Integer.toHexString(Objects.hash(statementId, auth.getName(), "active-links"));
    Instant now = clock.instant();
    var position = PageCursor.read(cursor, fingerprint, now);
    var found =
        grants.findActive(
            statementId, now, position.asOf(), position.afterTime(), position.afterId(), 26);
    boolean more = found.size() > 25;
    var items = more ? found.subList(0, 25) : found;
    String next = more ? position.next(items.getLast().createdAt(), items.getLast().id()) : null;
    return new ActiveLinks(items, next, position.asOf());
  }

  private final DownloadGrantRepository grants;
  private final StatementRepository statements;
  private final AccountAccess accounts;
  private final PrivateStatementStorage storage;
  private final RequestLimiter limiter;
  private final Clock clock;
  private final Duration ttl;
  private final SecureRandom random = new SecureRandom();

  public DownloadLinkService(
      DownloadGrantRepository grants,
      StatementRepository statements,
      AccountAccess accounts,
      PrivateStatementStorage storage,
      RequestLimiter limiter,
      Clock clock,
      AppProperties properties) {
    this.grants = grants;
    this.statements = statements;
    this.accounts = accounts;
    this.storage = storage;
    this.limiter = limiter;
    this.clock = clock;
    this.ttl = properties.linkTtl();
    if (ttl.compareTo(Duration.ofSeconds(1)) < 0 || ttl.compareTo(Duration.ofMinutes(5)) > 0)
      throw new IllegalArgumentException("Link TTL must be 1 second to 5 minutes");
  }

  public Grant issue(UUID statementId, Authentication auth) {
    var statement =
        statements.findById(statementId).orElseThrow(PrivateStatementStorage::unavailable);
    accounts.require(statement.accountId(), auth);
    if (!"AVAILABLE".equals(statement.status())) throw unavailable();
    limiter.check("issue:" + auth.getName(), 20);
    byte[] secret = new byte[32];
    random.nextBytes(secret);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(secret);
    Instant now = clock.instant(), expires = now.plus(ttl);
    UUID id = UUID.randomUUID();
    grants.save(
        new DownloadGrant(
            id,
            statementId,
            hash(token.getBytes(StandardCharsets.UTF_8)),
            auth.getName(),
            now,
            expires,
            null,
            null));
    return new Grant(id, "/downloads/" + token, expires);
  }

  public void revoke(UUID grantId, Authentication auth) {
    var grant = grants.findById(grantId).orElseThrow(PrivateStatementStorage::unavailable);
    var statement =
        statements.findById(grant.statementId()).orElseThrow(PrivateStatementStorage::unavailable);
    accounts.require(statement.accountId(), auth);
    grants.revoke(grantId, clock.instant());
  }

  public Download download(String token, String client) {
    limiter.check("download:" + client, 120);
    if (token.length() != 43 || !token.matches("[A-Za-z0-9_-]+")) throw unavailable();
    var file =
        grants
            .findDownload(hash(token.getBytes(StandardCharsets.UTF_8)), clock.instant())
            .orElseThrow(PrivateStatementStorage::unavailable);
    Path path = storage.resolve(file.storageKey());
    if (!Files.isRegularFile(path)) throw unavailable();
    return new Download(path, file.filename(), file.sizeBytes());
  }

  private static String hash(byte[] value) {
    try {
      return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
  }
}
