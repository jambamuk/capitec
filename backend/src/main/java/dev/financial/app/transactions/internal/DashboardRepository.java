package dev.financial.app.transactions.internal;

import dev.financial.app.transactions.TransactionDashboard.*;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

/** Aggregate projections only: never transfer a full transaction history to the browser. */
public interface DashboardRepository extends Repository<StoredTransaction, UUID> {
  String SCOPE =
      """
      from financial_transaction t join source_account s on s.id=t.source_account_id
      where s.account_id in (:accounts) and t.occurred_at >= :from and t.occurred_at < :until
        and t.recorded_at <= :asOf
      """;

  @Query(
      """
      select count(*) transaction_count,
        coalesce(sum(t.amount) filter(where t.direction='CREDIT'),0)::numeric(38,2)::text money_in,
        coalesce(sum(t.amount) filter(where t.direction='DEBIT'),0)::numeric(38,2)::text money_out
      """
          + SCOPE)
  Totals totals(List<UUID> accounts, Instant from, Instant until, Instant asOf);

  @Query(
      """
      select date_trunc(:bucket,t.occurred_at at time zone 'Africa/Johannesburg') at time zone 'Africa/Johannesburg' at,
        count(*) filter(where t.direction='CREDIT') credits,
        count(*) filter(where t.direction='DEBIT') debits,
        coalesce(sum(t.amount) filter(where t.direction='CREDIT'),0)::numeric(38,2)::text money_in,
        coalesce(sum(t.amount) filter(where t.direction='DEBIT'),0)::numeric(38,2)::text money_out
      """
          + SCOPE
          + " group by 1 order by 1")
  List<Activity> activity(
      List<UUID> accounts, Instant from, Instant until, Instant asOf, String bucket);

  @Query(
      "select t.category_code category,sum(t.amount)::numeric(38,2)::text amount "
          + SCOPE
          + " and t.direction='DEBIT' group by t.category_code order by sum(t.amount) desc,t.category_code")
  List<Spending> spending(List<UUID> accounts, Instant from, Instant until, Instant asOf);

  @Query(
      """
      select date_trunc('minute',t.recorded_at) at,s.source_code source,count(*) count
      from financial_transaction t join source_account s on s.id=t.source_account_id
      where s.account_id in (:accounts) and t.recorded_at >= :receivedFrom and t.recorded_at <= :asOf
      group by 1,2 order by 1,2
      """)
  List<Arrival> arrivals(List<UUID> accounts, Instant receivedFrom, Instant asOf);

  @Query(
      """
      select max(t.recorded_at) from financial_transaction t join source_account s on s.id=t.source_account_id
      where s.account_id in (:accounts) and t.recorded_at <= :asOf
      """)
  Instant lastReceived(List<UUID> accounts, Instant asOf);
}
