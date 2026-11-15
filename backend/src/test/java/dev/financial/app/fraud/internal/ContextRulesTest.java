package dev.financial.app.fraud.internal;

import static org.assertj.core.api.Assertions.*;

import dev.financial.app.transactions.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class ContextRulesTest {
  private final Instant at = Instant.parse("2026-11-09T12:00:00Z");

  private CategorizedTransaction event(String amount) {
    return new CategorizedTransaction(
        UUID.randomUUID(),
        1,
        UUID.randomUUID(),
        UUID.randomUUID(),
        new BigDecimal(amount),
        "ZAR",
        "DEBIT",
        "Merchant",
        "SHOPPING",
        "2",
        "1",
        at);
  }

  private RuleConfiguration.Rule rule(RuleConfiguration.Type type) {
    return new RuleConfiguration.Rule(
        "RULE",
        "Context rule",
        type,
        true,
        RuleConfiguration.Direction.DEBIT,
        "5000.00",
        "ZA",
        5,
        3,
        RuleConfiguration.Severity.HIGH);
  }

  private FraudRules.Result evaluate(
      RuleConfiguration.Type type,
      String amount,
      PaymentDetails payment,
      long count,
      String total) {
    return RuleEngineFixture.engine()
        .evaluate(
            event(amount),
            new RuleConfiguration.Snapshot(9, List.of(rule(type)), "operator", at),
            payment,
            r ->
                new TransactionHistory.Window(
                    count, new BigDecimal(total), at.minusSeconds(300), at))
        .getFirst();
  }

  private PaymentDetails transfer(Instant created) {
    return new PaymentDetails(
        "BOOKED",
        "TRANSFER",
        "MOBILE",
        at,
        LocalDate.of(2026, 11, 9),
        "ref",
        null,
        new PaymentDetails.Counterparty("supplier", "Supplier", created),
        null);
  }

  private PaymentDetails card(String country, String channel) {
    return new PaymentDetails(
        "BOOKED",
        "CARD_PURCHASE",
        channel,
        at,
        LocalDate.of(2026, 11, 9),
        "ref",
        new PaymentDetails.Merchant("m", "Merchant", "5732", country),
        null,
        new PaymentDetails.Instrument("1234", "NONE"));
  }

  @Test
  void velocityThresholdsAreStrictAndEvidenceIsRetained() {
    assertThat(evaluate(RuleConfiguration.Type.VELOCITY_COUNT, "1.00", null, 3, "5000.00").result())
        .isEqualTo("NOT_MATCHED");
    var result = evaluate(RuleConfiguration.Type.VELOCITY_COUNT, "1.00", null, 4, "5000.01");
    assertThat(result.result()).isEqualTo("MATCHED");
    assertThat(result.observed())
        .containsEntry("transactionCount", 4L)
        .containsEntry("totalAmount", "5000.01");
    assertThat(
            evaluate(RuleConfiguration.Type.VELOCITY_AMOUNT, "1.00", null, 4, "5000.00").result())
        .isEqualTo("NOT_MATCHED");
    assertThat(
            evaluate(RuleConfiguration.Type.VELOCITY_AMOUNT, "1.00", null, 4, "5000.01").result())
        .isEqualTo("MATCHED");
  }

  @Test
  void beneficiaryRequiresBothConditionsAndKnownCreationTime() {
    assertThat(
            evaluate(
                    RuleConfiguration.Type.NEW_BENEFICIARY_PAYMENT,
                    "5000.00",
                    transfer(at.minusSeconds(300)),
                    0,
                    "0")
                .result())
        .isEqualTo("NOT_MATCHED");
    assertThat(
            evaluate(
                    RuleConfiguration.Type.NEW_BENEFICIARY_PAYMENT,
                    "5000.01",
                    transfer(at.minusSeconds(300)),
                    0,
                    "0")
                .result())
        .isEqualTo("MATCHED");
    assertThat(
            evaluate(
                    RuleConfiguration.Type.NEW_BENEFICIARY_PAYMENT,
                    "5000.01",
                    transfer(at.minusSeconds(301)),
                    0,
                    "0")
                .result())
        .isEqualTo("NOT_MATCHED");
    assertThat(
            evaluate(
                    RuleConfiguration.Type.NEW_BENEFICIARY_PAYMENT,
                    "5000.01",
                    transfer(null),
                    0,
                    "0")
                .result())
        .isEqualTo("INSUFFICIENT_DATA");
  }

  @Test
  void overseasRuleRequiresCountryChannelAndAmount() {
    assertThat(
            evaluate(
                    RuleConfiguration.Type.FOREIGN_ONLINE_PAYMENT,
                    "5000.01",
                    card("GB", "ECOMMERCE"),
                    0,
                    "0")
                .result())
        .isEqualTo("MATCHED");
    assertThat(
            evaluate(
                    RuleConfiguration.Type.FOREIGN_ONLINE_PAYMENT,
                    "5000.00",
                    card("GB", "ECOMMERCE"),
                    0,
                    "0")
                .result())
        .isEqualTo("NOT_MATCHED");
    assertThat(
            evaluate(
                    RuleConfiguration.Type.FOREIGN_ONLINE_PAYMENT,
                    "5000.01",
                    card("ZA", "ECOMMERCE"),
                    0,
                    "0")
                .result())
        .isEqualTo("NOT_MATCHED");
    assertThat(
            evaluate(
                    RuleConfiguration.Type.FOREIGN_ONLINE_PAYMENT,
                    "5000.01",
                    card("GB", "POS"),
                    0,
                    "0")
                .result())
        .isEqualTo("NOT_APPLICABLE");
    assertThat(
            evaluate(RuleConfiguration.Type.FOREIGN_ONLINE_PAYMENT, "5000.01", null, 0, "0")
                .result())
        .isEqualTo("INSUFFICIENT_DATA");
  }

  @Test
  void paymentContractDoesNotAcceptFullCardNumbers() {
    assertThatThrownBy(() -> new PaymentDetails.Instrument("1234567812345678", "PIN"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> card("XX", "POS")).isInstanceOf(IllegalArgumentException.class);
  }
}
