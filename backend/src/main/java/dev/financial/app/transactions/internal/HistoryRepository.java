package dev.financial.app.transactions.internal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface HistoryRepository extends Repository<StoredTransaction, UUID> {
  record Totals(long count, BigDecimal total) {}

  @Query(
      """
      select count(*) count, coalesce(sum(t.amount), 0) total
      from financial_transaction t join source_account s on s.id = t.source_account_id
      where s.account_id = :accountId and t.currency = :currency
        and (:direction = 'ANY' or t.direction = :direction)
        and t.occurred_at > :start and t.occurred_at <= :end and t.recorded_at <= :cutoff
      """)
  Totals summarizeWindow(
      UUID accountId,
      String currency,
      String direction,
      Instant start,
      Instant end,
      Instant cutoff);
}
