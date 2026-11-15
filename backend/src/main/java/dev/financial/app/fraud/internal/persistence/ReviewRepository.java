package dev.financial.app.fraud.internal.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.Repository;

public interface ReviewRepository extends Repository<FraudReview, UUID> {
  Optional<FraudReview> findById(UUID transactionId);

  @Query("select * from fraud_review where transaction_id in (:transactionIds)")
  List<FraudReview> findAllByTransactionIds(List<UUID> transactionIds);

  @Modifying
  @Query(
      """
      insert into fraud_review(transaction_id, reviewed_by, note, reviewed_at, outcome)
      values(:#{#review.transactionId}, :#{#review.reviewedBy}, :#{#review.note}, :#{T(java.sql.Timestamp).from(#review.reviewedAt)}, :#{#review.outcome.name()})
      on conflict(transaction_id) do nothing
      """)
  int insertIfAbsent(FraudReview review);

  @Modifying
  @Query("delete from fraud_review")
  int clearDemoData();
}
