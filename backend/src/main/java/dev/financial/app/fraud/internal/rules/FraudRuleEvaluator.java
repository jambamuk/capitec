package dev.financial.app.fraud.internal.rules;

import dev.financial.app.fraud.internal.RuleConfiguration.Rule;
import dev.financial.app.fraud.internal.RuleConfiguration.Type;
import java.util.Set;

/** Add a Spring component implementing this interface to introduce a rule evaluator. */
public interface FraudRuleEvaluator {
  Set<Type> supportedTypes();

  RuleCheck evaluate(RuleContext context, Rule rule);
}
