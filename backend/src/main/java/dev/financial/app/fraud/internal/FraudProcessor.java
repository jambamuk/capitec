package dev.financial.app.fraud.internal;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.financial.app.fraud.internal.persistence.EvaluationRecord;
import dev.financial.app.fraud.internal.persistence.EvaluationRepository;
import dev.financial.app.fraud.internal.persistence.RuleResultRecord;
import dev.financial.app.fraud.internal.persistence.RuleResultRepository;
import dev.financial.app.transactions.CategorizedTransaction;
import dev.financial.app.transactions.TransactionHistory;
import java.util.UUID;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnProperty(name = "app.fraud-enabled", havingValue = "true")
class FraudProcessor {
  private final EvaluationRepository evaluations;
  private final RuleResultRepository ruleResults;
  private final ObjectMapper json;
  private final RuleConfiguration rules;
  private final FraudRules engine;
  private final TransactionHistory history;

  FraudProcessor(
      EvaluationRepository evaluations,
      RuleResultRepository ruleResults,
      ObjectMapper json,
      RuleConfiguration rules,
      TransactionHistory history,
      FraudRules engine) {
    this.engine = engine;
    this.evaluations = evaluations;
    this.ruleResults = ruleResults;
    this.json = json;
    this.rules = rules;
    this.history = history;
  }

  @Transactional(
      rollbackFor = Exception.class,
      isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public void evaluate(CategorizedTransaction event) throws Exception {
    validate(event);
    if (evaluations.existsByTransactionId(event.transactionId())) return;

    var configuration = rules.current();
    var cutoff = evaluations.observationTime();
    var results = evaluateRules(event, configuration, cutoff);
    saveDecision(event, configuration, cutoff, results);
  }

  private void validate(CategorizedTransaction event) {
    if (event == null || event.schemaVersion() != 1)
      throw new IllegalArgumentException("Unsupported event or ruleset version");
    if (event.transactionId() == null
        || event.accountId() == null
        || event.amount() == null
        || event.amount().signum() <= 0
        || !"ZAR".equals(event.currency())
        || !("DEBIT".equals(event.direction()) || "CREDIT".equals(event.direction()))
        || event.description() == null
        || event.occurredAt() == null)
      throw new IllegalArgumentException("Invalid categorized transaction");
  }

  private java.util.List<FraudRules.Result> evaluateRules(
      CategorizedTransaction event,
      RuleConfiguration.Snapshot configuration,
      java.time.Instant cutoff) {
    var payment = history.payment(event);
    var windows = new java.util.HashMap<String, TransactionHistory.Window>();
    return engine.evaluate(
        event,
        configuration,
        payment,
        rule ->
            windows.computeIfAbsent(
                rule.windowMinutes() + ":" + rule.direction(),
                key ->
                    history.window(event, rule.windowMinutes(), rule.direction().name(), cutoff)));
  }

  private void saveDecision(
      CategorizedTransaction event,
      RuleConfiguration.Snapshot configuration,
      java.time.Instant cutoff,
      java.util.List<FraudRules.Result> results)
      throws Exception {
    String severity =
        results.stream()
            .filter(FraudRules.Result::matched)
            .map(FraudRules.Result::severity)
            .max(java.util.Comparator.naturalOrder())
            .map(Enum::name)
            .orElse("NONE");
    String outcome =
        results.stream().anyMatch(FraudRules.Result::matched) ? "FLAGGED" : "NOT_FLAGGED";
    UUID id = UUID.randomUUID();

    var evaluation =
        new EvaluationRecord(
            id,
            event.transactionId(),
            event.accountId(),
            Long.toString(configuration.version()),
            outcome,
            severity,
            null,
            cutoff);
    if (evaluations.insertIfAbsent(evaluation) == 0) {
      return;
    }
    for (var result : results) {
      ruleResults.insert(
          new RuleResultRecord(
              UUID.randomUUID(),
              id,
              result.code(),
              result.version(),
              result.result(),
              json.writeValueAsString(result.criteria()),
              json.writeValueAsString(result.observed()),
              result.explanation()));
    }
  }
}
