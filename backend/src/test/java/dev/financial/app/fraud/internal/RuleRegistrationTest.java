package dev.financial.app.fraud.internal;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.financial.app.fraud.internal.rules.AmountRule;
import java.util.List;
import org.junit.jupiter.api.Test;

class RuleRegistrationTest {
  @Test
  void missingEvaluatorFailsAtStartupRatherThanDuringPaymentProcessing() {
    assertThatThrownBy(() -> new FraudRules(List.of(new AmountRule())))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("No evaluator registered");
  }

  @Test
  void duplicateEvaluatorFailsInsteadOfSilentlyReplacingBehaviour() {
    assertThatThrownBy(() -> new FraudRules(List.of(new AmountRule(), new AmountRule())))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Multiple evaluators");
  }
}
