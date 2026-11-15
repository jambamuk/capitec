package dev.financial.app.statements.internal;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

public interface DownloadGrantRepository extends CrudRepository<DownloadGrant, UUID> {
  record DownloadFile(String storageKey, String filename, long sizeBytes) {}

  record ActiveLink(UUID id, String issuedBy, Instant createdAt, Instant expiresAt) {}

  @Query(
      """
      select id, issued_by, created_at, expires_at from download_grant
      where statement_id = :statementId and revoked_at is null and expires_at > :now
        and created_at <= :asOf
        and (cast(:afterTime as timestamptz) is null or (created_at, id) < (:afterTime, :afterId))
      order by created_at desc, id desc limit :limit
      """)
  java.util.List<ActiveLink> findActive(
      UUID statementId, Instant now, Instant asOf, Instant afterTime, UUID afterId, int limit);

  @Query(
      """
      select s.storage_key,s.filename,s.size_bytes from download_grant g join statement s on s.id=g.statement_id
      where g.token_hash=:hash and g.expires_at>:now and g.revoked_at is null and s.status='AVAILABLE'
      """)
  Optional<DownloadFile> findDownload(String hash, Instant now);

  @Modifying
  @Query(
      "update download_grant set revoked_at = :now, version = version + 1 where id = :id and revoked_at is null")
  int revoke(UUID id, Instant now);

  @Modifying
  @Query("delete from download_grant where expires_at < :cutoff")
  int deleteExpired(Instant cutoff);
}
