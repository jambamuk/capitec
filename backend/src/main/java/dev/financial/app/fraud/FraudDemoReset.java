package dev.financial.app.fraud;

import dev.financial.app.fraud.internal.persistence.EvaluationRepository;
import dev.financial.app.fraud.internal.persistence.ReviewRepository;
import dev.financial.app.fraud.internal.persistence.RuleResultRepository;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Demo administration API. The caller must hold the processing gate and reset transaction. */
@Service
@Profile("demo")
public class FraudDemoReset {
  private final EvaluationRepository evaluations;
  private final ReviewRepository reviews;
  private final RuleResultRepository results;

  public FraudDemoReset(
      EvaluationRepository evaluations, ReviewRepository reviews, RuleResultRepository results) {
    this.evaluations = evaluations;
    this.reviews = reviews;
    this.results = results;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void clear() {
    results.clearDemoData();
    reviews.clearDemoData();
    evaluations.clearDemoData();
  }
}
