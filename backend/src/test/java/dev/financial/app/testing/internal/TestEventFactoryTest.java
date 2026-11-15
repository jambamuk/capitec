package dev.financial.app.testing.internal;

import static org.assertj.core.api.Assertions.*;

import dev.financial.app.transactions.PaymentDetails;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TestEventFactoryTest {
  private TestEventRequest request(MockSources.Source source, String amount) {
    return new TestEventRequest(
        UUID.randomUUID(),
        UUID.randomUUID(),
        source,
        amount,
        "Test purchase",
        TestEventRequest.Direction.DEBIT,
        TestEventRequest.PaymentType.CARD_PURCHASE,
        TestEventRequest.Channel.ECOMMERCE,
        Instant.parse("2026-11-10T12:00:00Z"),
        3,
        10,
        "Shop",
        "5732",
        "GB",
        "Supplier",
        10);
  }

  @Test
  void sourceFormatsKeepExactMoneyAndStableIdentities() {
    for (var source : MockSources.Source.values()) {
      var request = request(source, "1234.56");
      var event = TestEventFactory.create(request, "account-ref", "1042", 0);
      assertThat(event).isEqualTo(TestEventFactory.create(request, "account-ref", "1042", 0));
      var payload = (Map<?, ?>) event.get("payload");
      switch (source) {
        case CORE_BANK -> assertThat(payload.get("amount")).isEqualTo("1234.56");
        case CARD_PROCESSOR ->
            assertThat(payload.get("amountMinor").toString()).isEqualTo("123456");
        case WALLET_PROVIDER -> assertThat(payload.get("signedAmount")).isEqualTo("-1234.56");
      }
    }
  }

  @Test
  void batchEndsAtRequestedTimeAndHasDistinctReferences() {
    var request = request(MockSources.Source.CORE_BANK, "1.00");
    var first = TestEventFactory.create(request, "account-ref", "1042", 0);
    var last = TestEventFactory.create(request, "account-ref", "1042", 2);
    assertThat(first.get("occurredAt")).isEqualTo("2026-11-10T11:59:40Z");
    assertThat(last.get("occurredAt")).isEqualTo("2026-11-10T12:00:00Z");
    assertThat(first.get("eventId")).isNotEqualTo(last.get("eventId"));
    var payment = (PaymentDetails) ((Map<?, ?>) first.get("payload")).get("payment");
    assertThat(payment.merchant().country()).isEqualTo("GB");
  }

  @Test
  void invalidAmountCannotBecomeAnEvent() {
    for (String amount : new String[] {"0", "-1.00", "1.001", "100000000000000000.00"}) {
      assertThatThrownBy(
              () ->
                  TestEventFactory.create(
                      request(MockSources.Source.CORE_BANK, amount), "account-ref", "1042", 0))
          .isInstanceOf(RuntimeException.class);
    }
  }
}
