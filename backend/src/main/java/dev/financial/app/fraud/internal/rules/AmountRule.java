package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.fraud.internal.RuleConfiguration.Type;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class AmountRule implements FraudRuleEvaluator {
  public Set<Type> supportedTypes() {
    return Set.of(Type.AMOUNT_GREATER_THAN);
  }

  public RuleCheck evaluate(RuleContext context, Rule rule) {
    boolean matches = context.amountExceeds(rule);
    String explanation =
        "Amount " + (matches ? "exceeds" : "does not exceed") + " ZAR " + rule.amount() + ".";
    return RuleCheck.matched(matches, explanation, Map.of());
  }
}
