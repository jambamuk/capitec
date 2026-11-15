package dev.financial.app.fraud.internal;

import com.fasterxml.jackson.databind.JsonNode;
import dev.financial.app.fraud.internal.persistence.FraudReview;
import dev.financial.app.transactions.TransactionQueries;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** HTTP read models; these are not persistence aggregates. */
final class FraudViews {
  private FraudViews() {}

  record RuleResult(
      String ruleCode,
      String ruleVersion,
      String result,
      JsonNode criteria,
      JsonNode observed,
      String explanation) {}

  record Evaluation(
      UUID transactionId,
      String status,
      String rulesetVersion,
      String severity,
      String action,
      String coverage,
      Instant completedAt,
      Instant evidenceAsOf,
      List<RuleResult> rules,
      FraudReview review) {}

  record ListedTransaction(
      TransactionQueries.Item transaction, String status, String severity, String reviewStatus) {}

  record EvaluationPage(List<ListedTransaction> items, String nextCursor, Instant asOf) {}
}
