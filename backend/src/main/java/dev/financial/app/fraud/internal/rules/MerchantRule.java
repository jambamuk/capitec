package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.fraud.internal.RuleConfiguration.Type;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class MerchantRule implements FraudRuleEvaluator {
  public Set<Type> supportedTypes() {
    return Set.of(Type.MERCHANT_EQUALS);
  }

  public RuleCheck evaluate(RuleContext context, Rule rule) {
    boolean matches = context.merchantName().equalsIgnoreCase(rule.matchValue());
    return RuleCheck.matched(
        matches,
        "Merchant " + (matches ? "matches" : "does not match") + " " + rule.matchValue() + ".",
        Map.of());
  }
}
