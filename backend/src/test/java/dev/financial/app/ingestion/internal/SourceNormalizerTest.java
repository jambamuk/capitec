package dev.financial.app.ingestion.internal;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class SourceNormalizerTest {
  private final SourceNormalizer normalizer =
      new SourceNormalizer(new ObjectMapper().findAndRegisterModules());

  private String bank(String amount, String currency) {
    return """
          {"eventId":"e1","schemaVersion":1,"source":"CORE_BANK","sourceAccountRef":"bank-account-1042",
          "occurredAt":"2026-11-09T08:00:00+02:00","payload":{"reference":"t1","description":"Salary","amount":"%s","currency":"%s","creditDebit":"CREDIT"}}
          """
        .formatted(amount, currency);
  }

  @Test
  void preservesExactAmountAndConvertsInstant() {
    var event = normalizer.normalize("mock.bank.transactions.v1", 0, 1, bank("25000.00", "ZAR"));
    assertThat(event.amount().toPlainString()).isEqualTo("25000.00");
    assertThat(event.occurredAt().toString()).isEqualTo("2026-11-09T06:00:00Z");
  }

  @Test
  void rejectsPrecisionAndInvalidCurrency() {
    assertThatThrownBy(
            () -> normalizer.normalize("mock.bank.transactions.v1", 0, 1, bank("12.345", "ZAR")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> normalizer.normalize("mock.bank.transactions.v1", 0, 1, bank("12.00", "USD")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> normalizer.normalize("mock.bank.transactions.v1", 0, 1, bank("0.00", "ZAR")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void rejectsTopicSpoofingAndMalformedJson() {
    assertThatThrownBy(
            () -> normalizer.normalize("mock.card.transactions.v1", 0, 1, bank("1.00", "ZAR")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> normalizer.normalize("mock.bank.transactions.v1", 0, 1, "{invalid"))
        .isInstanceOf(IllegalArgumentException.class);
    String overflowingVersion =
        bank("1.00", "ZAR").replace("\"schemaVersion\":1", "\"schemaVersion\":4294967297");
    assertThatThrownBy(
            () -> normalizer.normalize("mock.bank.transactions.v1", 0, 1, overflowingVersion))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void walletSignAndCardMinorUnitsNormalizeWithoutRounding() {
    String wallet =
        """
          {"eventId":"e2","schemaVersion":1,"source":"WALLET_PROVIDER","sourceAccountRef":"wallet-account-1042","occurredAt":"2026-11-09T06:15:00Z",
          "payload":{"reference":"w1","counterparty":"FreshMart","signedAmount":"-842.50","currency":"ZAR"}}
          """;
    var w = normalizer.normalize("mock.wallet.transactions.v1", 0, 1, wallet);
    assertThat(w.amount().toPlainString()).isEqualTo("842.50");
    assertThat(w.direction()).isEqualTo("DEBIT");
    String card =
        """
          {"eventId":"e3","schemaVersion":1,"source":"CARD_PROCESSOR","sourceAccountRef":"card-account-1042","occurredAt":"2026-11-09T06:15:00Z",
          "payload":{"transactionRef":"c1","merchantName":"GadgetHub","amountMinor":510000,"currency":"ZAR","direction":"DEBIT"}}
          """;
    assertThat(
            normalizer.normalize("mock.card.transactions.v1", 0, 1, card).amount().toPlainString())
        .isEqualTo("5100.00");
  }

  @Test
  void enrichedContractValidatesContextAndPreservesLegacyUnknowns() {
    var legacy = normalizer.normalize("mock.bank.transactions.v1", 0, 1, bank("25000.00", "ZAR"));
    assertThat(legacy.payment()).isNull();
    String enriched =
        bank("25000.00", "ZAR")
            .replace("\"schemaVersion\":1", "\"schemaVersion\":2")
            .replace(
                "\"payload\":{",
                "\"payload\":{\"payment\":{\"status\":\"BOOKED\",\"type\":\"TRANSFER\",\"channel\":\"MOBILE\",\"bookedAt\":\"2026-11-09T06:00:00Z\",\"valueDate\":\"2026-11-09\",\"paymentReference\":\"p1\",\"counterparty\":{\"id\":\"b1\",\"name\":\"Supplier\",\"beneficiaryCreatedAt\":\"2026-11-09T05:55:00Z\"}},");
    var result = normalizer.normalize("mock.bank.transactions.v1", 0, 2, enriched);
    assertThat(result.payment().counterparty().id()).isEqualTo("b1");
    assertThat(result.payment().bookedAt()).isEqualTo(result.occurredAt());
    for (String invalid :
        java.util.List.of(
            enriched.replace("BOOKED", "PENDING"),
            enriched.replace("MOBILE", "ALIEN"),
            enriched.replace("05:55:00", "07:00:00")))
      assertThatThrownBy(() -> normalizer.normalize("mock.bank.transactions.v1", 0, 3, invalid))
          .isInstanceOf(IllegalArgumentException.class);
  }
}
