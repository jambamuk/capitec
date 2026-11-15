package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.fraud.internal.RuleConfiguration.Type;
import java.math.BigDecimal;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class VelocityRule implements FraudRuleEvaluator {
  public Set<Type> supportedTypes() {
    return Set.of(Type.VELOCITY_COUNT, Type.VELOCITY_AMOUNT);
  }

  public RuleCheck evaluate(RuleContext context, Rule rule) {
    var window = context.history().apply(rule);
    if (window == null)
      return RuleCheck.skipped(
          RuleCheck.Outcome.INSUFFICIENT_DATA, "Account history was not available.");
    boolean matches =
        rule.type() == Type.VELOCITY_COUNT
            ? window.count() > rule.countThreshold()
            : window.total().compareTo(new BigDecimal(rule.amount())) > 0;
    var observations =
        Map.<String, Object>of(
            "transactionCount",
            window.count(),
            "totalAmount",
            window.total().toPlainString(),
            "fromExclusive",
            window.fromExclusive().toString(),
            "toInclusive",
            window.toInclusive().toString(),
            "includesCurrentTransaction",
            true);
    String explanation =
        window.count()
            + " account transactions totalling ZAR "
            + window.total().toPlainString()
            + " in "
            + rule.windowMinutes()
            + " minutes; "
            + (matches ? "threshold exceeded." : "within threshold.");
    return RuleCheck.matched(matches, explanation, observations);
  }
}
