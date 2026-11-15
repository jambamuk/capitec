package dev.financial.app.fraud.internal;

import dev.financial.app.fraud.internal.persistence.EvaluationRepository;
import dev.financial.app.fraud.internal.persistence.FraudReview;
import dev.financial.app.fraud.internal.persistence.ReviewRepository;
import dev.financial.app.transactions.TransactionQueries;
import java.time.Clock;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Records the operator's review without changing the original fraud decision. */
@Service
@ConditionalOnProperty(name = "app.fraud-enabled", havingValue = "true")
class FraudReviewService {
  private final TransactionQueries transactions;
  private final EvaluationRepository evaluations;
  private final ReviewRepository reviews;
  private final Clock clock;

  FraudReviewService(
      TransactionQueries transactions,
      EvaluationRepository evaluations,
      ReviewRepository reviews,
      Clock clock) {
    this.transactions = transactions;
    this.evaluations = evaluations;
    this.reviews = reviews;
    this.clock = clock;
  }

  @Transactional
  public FraudReview review(
      UUID transactionId, String note, ReviewOutcome outcome, Authentication auth) {
    if (auth.getAuthorities().stream()
        .noneMatch(authority -> authority.getAuthority().equals("ROLE_OPERATOR")))
      throw new ResponseStatusException(
          HttpStatus.FORBIDDEN, "Only operators can review flagged payments.");
    if (note == null || note.isBlank() || note.length() > 1000)
      throw new IllegalArgumentException("A review note of 1 to 1000 characters is required");
    transactions.get(transactionId, auth);
    requireFlaggedPayment(transactionId);
    var review =
        new FraudReview(
            transactionId,
            auth.getName(),
            note.strip(),
            clock.instant(),
            outcome == null ? ReviewOutcome.REVIEWED : outcome);
    if (reviews.insertIfAbsent(review) == 0)
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "This payment has already been reviewed.");
    return review;
  }

  private void requireFlaggedPayment(UUID transactionId) {
    var evaluation =
        evaluations
            .findByTransactionId(transactionId)
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.CONFLICT, "Payment has not been checked yet."));
    if (!"FLAGGED".equals(evaluation.outcome()))
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment does not require review.");
  }
}
