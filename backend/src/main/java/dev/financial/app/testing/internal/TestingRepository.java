package dev.financial.app.testing.internal;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

interface TestingRepository extends Repository<ResetAudit, UUID> {
  record Result(
      UUID id,
      String reference,
      String description,
      String amount,
      String category,
      String status,
      String severity) {}

  @Query(
      """
  select t.id,t.source_transaction_ref reference,t.description,t.amount::text amount,t.category_code category,
   coalesce(e.outcome,'PENDING') status,coalesce(e.severity,'NONE') severity
  from financial_transaction t left join fraud_evaluation e on e.transaction_id=t.id
  where t.source_transaction_ref like :prefix order by t.occurred_at,t.id limit 20
  """)
  List<Result> results(String prefix);

  @Modifying
  @Query(
      "insert into demo_reset_audit(id,reset_by,reset_at,removed_transactions) values(:id,:actor,:at,:count)")
  void audit(UUID id, String actor, Instant at, long count);
}
