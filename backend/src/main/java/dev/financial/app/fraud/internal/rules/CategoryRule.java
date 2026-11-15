package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.fraud.internal.RuleConfiguration.Type;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class CategoryRule implements FraudRuleEvaluator {
  public Set<Type> supportedTypes() {
    return Set.of(Type.CATEGORY_EQUALS);
  }

  public RuleCheck evaluate(RuleContext context, Rule rule) {
    boolean matches = context.event().category().equals(rule.matchValue());
    return RuleCheck.matched(
        matches,
        "Category " + (matches ? "matches" : "does not match") + " " + rule.matchValue() + ".",
        Map.of());
  }
}
