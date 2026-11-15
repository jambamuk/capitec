package dev.financial.app.statements.internal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

public interface StatementRepository extends CrudRepository<StatementRecord, UUID> {
  @Query(
      """
      select * from statement where account_id in (:accounts) and created_at <= :asOf
        and (cast(:afterTime as timestamptz) is null or (created_at, id) < (:afterTime, :afterId))
      order by created_at desc, id desc limit :limit
      """)
  List<StatementRecord> findPage(
      List<UUID> accounts, Instant asOf, Instant afterTime, UUID afterId, int limit);

  @Query("select * from statement where status = 'STAGING' and created_at < :cutoff")
  List<StatementRecord> findStaleUploads(Instant cutoff);

  @Modifying
  @Query(
      "update statement set status = :status, version = version + 1 where id = :id and status = 'STAGING'")
  int completeUpload(UUID id, String status);
}
