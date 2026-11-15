package dev.financial.app.fraud.internal;

import static org.assertj.core.api.Assertions.*;

import dev.financial.app.transactions.CategorizedTransaction;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class FraudRulesTest {
  private final RuleConfiguration.Snapshot configuration =
      new RuleConfiguration.Snapshot(
          1,
          List.of(
              new RuleConfiguration.Rule(
                  "HIGH_VALUE_DEBIT",
                  "High value debit",
                  RuleConfiguration.Type.AMOUNT_GREATER_THAN,
                  true,
                  RuleConfiguration.Direction.DEBIT,
                  "5000.00",
                  null),
              new RuleConfiguration.Rule(
                  "RESTRICTED_MERCHANT",
                  "Restricted merchant",
                  RuleConfiguration.Type.MERCHANT_EQUALS,
                  true,
                  RuleConfiguration.Direction.DEBIT,
                  null,
                  "Restricted Shop")),
          "test",
          Instant.EPOCH);

  private List<FraudRules.Result> evaluate(CategorizedTransaction event) {
    return RuleEngineFixture.engine().evaluate(event, configuration);
  }

  private CategorizedTransaction event(String amount, String direction, String merchant) {
    return new CategorizedTransaction(
        UUID.randomUUID(),
        1,
        UUID.randomUUID(),
        UUID.randomUUID(),
        new BigDecimal(amount),
        "ZAR",
        direction,
        merchant,
        "SHOPPING",
        "1",
        "1",
        Instant.parse("2026-11-09T06:00:00Z"));
  }

  @Test
  void thresholdIsStrictAndCreditsDoNotMatch() {
    assertThat(evaluate(event("5000.00", "DEBIT", "GadgetHub")).getFirst().result())
        .isEqualTo("NOT_MATCHED");
    assertThat(evaluate(event("5000.01", "DEBIT", "GadgetHub")).getFirst().result())
        .isEqualTo("MATCHED");
    assertThat(evaluate(event("25000.00", "CREDIT", "Salary")))
        .allSatisfy(r -> assertThat(r.result()).isEqualTo("NOT_APPLICABLE"));
  }

  @Test
  void differentCriteriaCanBothMatch() {
    assertThat(evaluate(event("5100.00", "DEBIT", "Restricted Shop")))
        .allSatisfy(r -> assertThat(r.result()).isEqualTo("MATCHED"));
  }

  @Test
  void usesConfiguredThresholdCategoryAndEnabledState() {
    var snapshot =
        new RuleConfiguration.Snapshot(
            7,
            List.of(
                new RuleConfiguration.Rule(
                    "HIGH",
                    "High",
                    RuleConfiguration.Type.AMOUNT_GREATER_THAN,
                    true,
                    RuleConfiguration.Direction.ANY,
                    "8000.00",
                    null),
                new RuleConfiguration.Rule(
                    "CATEGORY",
                    "Category",
                    RuleConfiguration.Type.CATEGORY_EQUALS,
                    true,
                    RuleConfiguration.Direction.ANY,
                    null,
                    "SHOPPING"),
                new RuleConfiguration.Rule(
                    "DISABLED",
                    "Disabled",
                    RuleConfiguration.Type.MERCHANT_EQUALS,
                    false,
                    RuleConfiguration.Direction.ANY,
                    null,
                    "Restricted Shop")),
            "test",
            Instant.EPOCH);
    var results =
        RuleEngineFixture.engine().evaluate(event("5100.00", "DEBIT", "Restricted Shop"), snapshot);
    assertThat(results)
        .extracting(FraudRules.Result::result)
        .containsExactly("NOT_MATCHED", "MATCHED", "DISABLED");
    assertThat(results).allSatisfy(r -> assertThat(r.version()).isEqualTo("7"));
    assertThat(results.getFirst().criteria()).containsEntry("amountGreaterThan", "8000.00");
  }
}
