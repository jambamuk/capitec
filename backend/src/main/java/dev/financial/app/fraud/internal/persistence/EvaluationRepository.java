package dev.financial.app.fraud.internal.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface EvaluationRepository extends Repository<EvaluationRecord, UUID> {
  boolean existsByTransactionId(UUID transactionId);

  Optional<EvaluationRecord> findByTransactionId(UUID transactionId);

  @Query("select transaction_timestamp()")
  Instant observationTime();

  @Modifying
  @Query(
      """
      insert into fraud_evaluation(id, transaction_id, account_id, ruleset_version, outcome, severity, evidence_as_of)
      values(:#{#evaluation.id}, :#{#evaluation.transactionId}, :#{#evaluation.accountId},
        :#{#evaluation.rulesetVersion}, :#{#evaluation.outcome}, :#{#evaluation.severity}, :#{T(java.sql.Timestamp).from(#evaluation.evidenceAsOf)})
      on conflict(transaction_id) do nothing
      """)
  int insertIfAbsent(EvaluationRecord evaluation);

  @Query(
      """
      select e.* from fraud_evaluation e
      join financial_transaction t on t.id=e.transaction_id
      left join fraud_review r on r.transaction_id = e.transaction_id
      where e.account_id in (:accountIds) and e.completed_at <= :asOf
        and (cast(:from as timestamptz) is null or t.occurred_at >= :from)
        and (cast(:until as timestamptz) is null or t.occurred_at < :until)
        and (:severity = 'ALL' or e.severity = :severity)
        and (:reviewStatus = 'ALL'
          or (:reviewStatus = 'NEEDS_REVIEW' and e.outcome = 'FLAGGED' and r.transaction_id is null)
          or (:reviewStatus = 'REVIEWED' and r.transaction_id is not null))
        and (cast(:afterTime as timestamptz) is null or (e.completed_at, e.id) < (:afterTime, :afterId))
      order by e.completed_at desc, e.id desc limit :limit
      """)
  List<EvaluationRecord> findPage(
      List<UUID> accountIds,
      String reviewStatus,
      String severity,
      Instant from,
      Instant until,
      Instant asOf,
      Instant afterTime,
      UUID afterId,
      int limit);

  @Modifying
  @Query("delete from fraud_evaluation")
  int clearDemoData();
}
