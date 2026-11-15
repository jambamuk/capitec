package dev.financial.app.fraud.internal;

import dev.financial.app.fraud.internal.rules.FraudRuleEvaluator;
import dev.financial.app.fraud.internal.rules.RuleCheck;
import dev.financial.app.fraud.internal.rules.RuleContext;
import dev.financial.app.transactions.CategorizedTransaction;
import dev.financial.app.transactions.PaymentDetails;
import dev.financial.app.transactions.TransactionHistory.Window;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Component;

/** Applies common eligibility rules and captures immutable evidence for each configured check. */
@Component
public final class FraudRules {
  public record Result(
      String code,
      String version,
      String result,
      Map<String, Object> criteria,
      Map<String, Object> observed,
      String explanation,
      RuleConfiguration.Severity severity) {
    public boolean matched() {
      return "MATCHED".equals(result);
    }
  }

  private final Map<RuleConfiguration.Type, FraudRuleEvaluator> evaluators;

  public FraudRules(List<FraudRuleEvaluator> evaluators) {
    var registered =
        new EnumMap<RuleConfiguration.Type, FraudRuleEvaluator>(RuleConfiguration.Type.class);
    for (var evaluator : evaluators) {
      for (var type : evaluator.supportedTypes()) {
        if (registered.putIfAbsent(type, evaluator) != null)
          throw new IllegalStateException("Multiple evaluators registered for " + type);
      }
    }
    for (var type : RuleConfiguration.Type.values()) {
      if (!registered.containsKey(type))
        throw new IllegalStateException("No evaluator registered for " + type);
    }
    this.evaluators = Map.copyOf(registered);
  }

  public List<Result> evaluate(
      CategorizedTransaction event, RuleConfiguration.Snapshot configuration) {
    return evaluate(event, configuration, null, rule -> null);
  }

  public List<Result> evaluate(
      CategorizedTransaction event,
      RuleConfiguration.Snapshot configuration,
      PaymentDetails payment,
      Function<RuleConfiguration.Rule, Window> history) {
    var context = new RuleContext(event, payment, history);
    return configuration.rules().stream()
        .map(rule -> evaluate(context, rule, configuration.version()))
        .toList();
  }

  private Result evaluate(RuleContext context, RuleConfiguration.Rule rule, long version) {
    RuleCheck check = check(context, rule);
    Map<String, Object> observed = new LinkedHashMap<>();
    observed.put("amount", context.event().amount().toPlainString());
    observed.put("direction", context.event().direction());
    observed.put("merchant", context.merchantName());
    observed.put("category", context.event().category());
    observed.putAll(check.observations());
    return new Result(
        rule.code(),
        Long.toString(version),
        check.outcome().name(),
        criteria(rule),
        Map.copyOf(observed),
        check.explanation(),
        rule.severity());
  }

  private RuleCheck check(RuleContext context, RuleConfiguration.Rule rule) {
    if (!rule.enabled()) return RuleCheck.skipped(RuleCheck.Outcome.DISABLED, "Rule is disabled.");
    if (rule.direction() != RuleConfiguration.Direction.ANY
        && !rule.direction().name().equals(context.event().direction())) {
      return RuleCheck.skipped(
          RuleCheck.Outcome.NOT_APPLICABLE,
          "Rule applies to " + rule.direction().name().toLowerCase(Locale.ROOT) + " transactions.");
    }
    return evaluators.get(rule.type()).evaluate(context, rule);
  }

  private Map<String, Object> criteria(RuleConfiguration.Rule rule) {
    Map<String, Object> criteria = new LinkedHashMap<>();
    criteria.put("name", rule.name());
    criteria.put("type", rule.type());
    criteria.put("enabled", rule.enabled());
    criteria.put("direction", rule.direction());
    criteria.put("currency", "ZAR");
    criteria.put("severity", rule.severity());
    criteria.put("action", "REVIEW");
    if (rule.amount() != null) criteria.put("amountGreaterThan", rule.amount());
    if (rule.matchValue() != null) criteria.put("matchValue", rule.matchValue());
    if (rule.windowMinutes() != null) criteria.put("windowMinutes", rule.windowMinutes());
    if (rule.countThreshold() != null) criteria.put("countGreaterThan", rule.countThreshold());
    return Map.copyOf(criteria);
  }
}
