package dev.financial.app.transactions.internal;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.CrudRepository;

public interface TransactionRepository
    extends CrudRepository<StoredTransaction, UUID>, TransactionReports {
  // PostgreSQL's conflict handling preserves replay safety under concurrent delivery.
  @Modifying
  @Query(
      """
      insert into financial_transaction (
        id, source_account_id, source_transaction_ref, amount, currency, direction,
        description, category_code, categorizer_version, input_hash, first_event_id,
        origin_topic, origin_partition, origin_offset, occurred_at, payment_details)
      values (
        :#{#transaction.id}, :#{#transaction.sourceAccountId}, :#{#transaction.sourceTransactionRef},
        :#{#transaction.amount}, :#{#transaction.currency}, :#{#transaction.direction},
        :#{#transaction.description}, :#{#transaction.categoryCode}, :#{#transaction.categorizerVersion},
        :#{#transaction.inputHash}, :#{#transaction.firstEventId}, :#{#transaction.originTopic},
        :#{#transaction.originPartition}, :#{#transaction.originOffset}, :#{T(java.sql.Timestamp).from(#transaction.occurredAt)},
        cast(:#{#transaction.paymentDetails} as jsonb))
      on conflict (source_account_id, source_transaction_ref) do nothing
      """)
  int insertIfAbsent(StoredTransaction transaction);

  Optional<StoredTransaction> findBySourceAccountIdAndSourceTransactionRef(
      UUID sourceAccountId, String sourceTransactionRef);

  @Modifying
  @Query(
      "delete from event_publication where event_type='dev.financial.app.transactions.CategorizedTransaction'")
  int clearDemoPublications();
}
