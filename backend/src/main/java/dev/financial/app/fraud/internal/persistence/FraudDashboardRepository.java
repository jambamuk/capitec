package dev.financial.app.fraud.internal.persistence;

import dev.financial.app.fraud.FraudDashboard.Counts;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface FraudDashboardRepository extends Repository<EvaluationRecord, UUID> {
  // Read-only projection over the transaction cohort; the fraud module never writes transaction
  // facts.
  @Query(
      """
      select count(*) filter(where e.outcome='NOT_FLAGGED') not_flagged,
        count(*) filter(where e.outcome='FLAGGED' and r.transaction_id is null) needs_review,
        count(*) filter(where r.transaction_id is not null) reviewed,
        count(*) filter(where e.id is null) pending,
        count(*) filter(where e.outcome='FLAGGED' and e.severity='HIGH' and r.transaction_id is null) high_priority
      from financial_transaction t join source_account s on s.id=t.source_account_id
      left join fraud_evaluation e on e.transaction_id=t.id and e.completed_at <= :asOf
      left join fraud_review r on r.transaction_id=t.id and r.reviewed_at <= :asOf
      where s.account_id in (:accounts) and t.occurred_at >= :from and t.occurred_at < :until
        and t.recorded_at <= :asOf
      """)
  Counts counts(List<UUID> accounts, Instant from, Instant until, Instant asOf);
}
